import { 
  ClassifyTransactionInput, 
  AssignableCategoryInfo, 
  ClassificationResult,
  MerchantKnowledgeItem,
  ClassificationSource
} from './types';
import { CanonicalRule } from '../../src/types';
import { evaluateCondition } from '../../src/lib/rulesEngine';
import { merchantKnowledgeStore } from './merchantStore';
import { humanCorrectionStore } from './correctionStore';
import { aiMetricsStore } from './metricsStore';
import { defaultMerchantResearchProvider } from './providers/GeminiSearchGroundingResearchProvider';
import { getAIProvider } from './providers';

export class LayeredCategorizationEngine {
  /**
   * Identifies whether a transaction is an internal transfer, banking movement, or personal transfer
   * to strictly protect privacy and avoid running web searches on private individuals.
   */
  public isTransferOrBankMovement(transaction: ClassifyTransactionInput): boolean {
    const text = `${transaction.merchant || ''} ${transaction.payee || ''} ${transaction.description || ''} ${transaction.notes || ''}`.toLowerCase();
    
    const patterns = [
      /\bcr[eé]dit\b/i,
      /\bversement\b/i,
      /\bvirement\b/i,
      /\bordre\s+permanent\b/i,
      /\bbcn[\s-]*netbanking\b/i,
      /\bbcn[\s-]*mobile\b/i,
      /\be-?banking\b/i,
      /\btransfert?\b/i,
      /\btransfer\b/i,
      /\bdepot\b/i,
      /\bd[eé]p[oô]t\b/i,
      /\bsalaire\b/i,
      /\bremboursement\b/i,
      /\bcompensation\b/i,
      /\bepargne\b/i,
      /\b[eé]pargne\b/i,
      /\btwint\s+de\b/i,
      /\btwint\s+a\b/i,
      /\btwint\s+p2p\b/i
    ];

    return patterns.some(p => p.test(text));
  }

  /**
   * Executes the strict 6-Step Decision Hierarchy:
   * 1. HUMAN_CORRECTION (Absolute highest priority, client-isolated)
   * 2. MERCHANT_MEMORY (Merchant knowledge cache & known Swiss merchants)
   * 3. DETERMINISTIC_RULE (Configured canonical user rules)
   * 4. MERCHANT_RESEARCH (Google Search Grounding web research with Swiss/Geneva context)
   * 5. AI_REASONING (Gemini model semantic analysis)
   * 6. HUMAN_REVIEW (Safe review queue when ambiguous or confidence < threshold)
   */
  public async classifyTransaction(
    transaction: ClassifyTransactionInput,
    availableCategories: AssignableCategoryInfo[],
    existingRules: CanonicalRule[] = [],
    clientId: string = 'kassio-pf'
  ): Promise<ClassificationResult> {
    const config = aiMetricsStore.getConfig();
    const rawPayee = transaction.merchant || transaction.payee || transaction.description || '';
    const originalDesc = transaction.description || '';

    // =========================================================================
    // STEP 1 — HUMAN_CORRECTION (Prioridade Absoluta — Sobrescreve IA e Regras)
    // =========================================================================
    const humanCorrection = humanCorrectionStore.findCorrectionForTransaction(
      clientId,
      transaction.merchant,
      transaction.description
    );

    if (humanCorrection) {
      const matchedCategory = availableCategories.find(c => c.id === humanCorrection.chosenCategoryId) ||
                             availableCategories.find(c => c.name.toLowerCase() === humanCorrection.chosenCategoryName.toLowerCase());

      if (matchedCategory) {
        aiMetricsStore.incrementCacheHits();
        return {
          transactionId: transaction.id,
          rawPayee,
          normalizedMerchant: humanCorrection.merchant || rawPayee,
          canonicalMerchant: humanCorrection.merchant || rawPayee,
          categoryId: matchedCategory.id,
          categoryName: matchedCategory.name,
          subcategoryId: humanCorrection.chosenSubcategoryName,
          subcategoryName: humanCorrection.chosenSubcategoryName,
          confidenceScore: 100,
          reasoning: `Decisão humana prévia: definida por ${humanCorrection.changedByRole === 'CONSULTANT' ? 'Consultor' : 'Cliente'} em ${new Date(humanCorrection.timestamp).toLocaleDateString('pt-BR')}.`,
          reasoningShort: `Correção humana confirmada (${humanCorrection.chosenCategoryName}).`,
          source: 'HUMAN_CORRECTION',
          isAutoClassified: true,
          needsReview: false,
          sentToPending: false
        };
      }
    }

    // =========================================================================
    // STEP 2 — MERCHANT_MEMORY (Memória / Cache de Estabelecimentos Conhecidos)
    // =========================================================================
    const cachedMerchant = merchantKnowledgeStore.lookup(rawPayee || originalDesc, clientId);

    if (cachedMerchant) {
      let matchedCategory: AssignableCategoryInfo | undefined;
      
      if (cachedMerchant.suggestedCategoryId) {
        matchedCategory = availableCategories.find(c => c.id === cachedMerchant.suggestedCategoryId);
      }
      
      if (!matchedCategory && cachedMerchant.suggestedCategoryName) {
        matchedCategory = availableCategories.find(c => 
          c.name.toLowerCase() === cachedMerchant.suggestedCategoryName!.toLowerCase()
        );
      }

      if (matchedCategory && cachedMerchant.confidence >= config.reviewRecommendedThreshold) {
        aiMetricsStore.incrementCacheHits();
        const isAuto = cachedMerchant.confidence >= config.autoClassifyThreshold;

        return {
          transactionId: transaction.id,
          rawPayee,
          normalizedMerchant: cachedMerchant.normalizedName,
          canonicalMerchant: cachedMerchant.canonicalMerchant || cachedMerchant.normalizedName,
          categoryId: matchedCategory.id,
          categoryName: matchedCategory.name,
          subcategoryId: cachedMerchant.suggestedSubcategoryName,
          subcategoryName: cachedMerchant.suggestedSubcategoryName,
          confidenceScore: cachedMerchant.confidence,
          reasoning: cachedMerchant.reasoning || `Reconhecido pela memória de estabelecimentos (${cachedMerchant.normalizedName}).`,
          reasoningShort: `Identificado pela memória de merchants (${cachedMerchant.normalizedName}).`,
          source: 'MERCHANT_MEMORY',
          merchantKnowledge: cachedMerchant,
          isAutoClassified: isAuto,
          needsReview: !isAuto,
          sentToPending: cachedMerchant.confidence < config.reviewRecommendedThreshold,
          evidenceSummary: cachedMerchant.researchMetadata?.evidenceSummary,
          sourceUrls: cachedMerchant.researchMetadata?.sourceUrls
        };
      }
    }

    // =========================================================================
    // STEP 3 — DETERMINISTIC_RULE (Regras Determinísticas Configuradas)
    // =========================================================================
    if (existingRules && existingRules.length > 0) {
      const activeRules = existingRules
        .filter(r => r.isActive)
        .sort((a, b) => (a.priority || 999) - (b.priority || 999));

      for (const rule of activeRules) {
        const testTx: any = {
          id: transaction.id || '',
          clientId,
          merchant: transaction.merchant || '',
          description: transaction.description || '',
          accountId: transaction.accountId || '',
          amount: transaction.amount,
          currency: transaction.currency,
          tags: []
        };

        const matchesAll = rule.conditions.length > 0 && rule.conditions.every(c => evaluateCondition(c, testTx));

        if (matchesAll && rule.actions.categoryId) {
          const matchedCategory = availableCategories.find(c => c.id === rule.actions.categoryId);
          aiMetricsStore.incrementRuleMatches();

          return {
            transactionId: transaction.id,
            rawPayee,
            normalizedMerchant: rawPayee,
            canonicalMerchant: rawPayee,
            categoryId: rule.actions.categoryId,
            categoryName: matchedCategory?.name || rule.actions.categoryId,
            subcategoryId: rule.actions.subcategoryId,
            subcategoryName: rule.actions.subcategoryId,
            confidenceScore: 100,
            reasoning: `Regra determinística ativa: "${rule.name}"`,
            reasoningShort: `Regra determinística: ${rule.name}`,
            source: 'DETERMINISTIC_RULE',
            isAutoClassified: true,
            needsReview: false,
            sentToPending: false
          };
        }
      }
    }

    // =========================================================================
    // SAFETY CHECK — TRANSFERÊNCIA BANCÁRIA / MOVIMENTAÇÃO PESSOAL
    // (Não pesquisar pessoas físicas ou transferências bancárias na web por privacidade)
    // =========================================================================
    if (this.isTransferOrBankMovement(transaction)) {
      // Find transfer or financial operation category if exists
      const transferCategory = availableCategories.find(c => 
        c.type === 'TRANSFERENCIA' || 
        c.name.toLowerCase().includes('transfer') || 
        c.name.toLowerCase().includes('ajuste')
      );

      return {
        transactionId: transaction.id,
        rawPayee,
        normalizedMerchant: rawPayee || 'Movimentação / Transferência Bancária',
        canonicalMerchant: 'Transferência Bancária / Pessoal',
        categoryId: transferCategory?.id,
        categoryName: transferCategory?.name || 'Transferência',
        transactionType: 'TRANSFERENCIA',
        confidenceScore: 85,
        reasoning: 'Movimentação bancária interna, débito/crédito em conta ou transferência de fundos. Pesquisa pública suprimida por privacidade.',
        reasoningShort: 'Transferência bancária interna / movimentação de fundos.',
        source: 'MERCHANT_MEMORY',
        isAutoClassified: false,
        needsReview: true,
        sentToPending: false,
        isTransferOrPersonal: true
      };
    }

    // =========================================================================
    // STEP 4 — MERCHANT_RESEARCH (Pesquisa Web com Contexto Suíça / Genebra)
    // =========================================================================
    if (config.enableSearchGrounding && defaultMerchantResearchProvider.isAvailable()) {
      try {
        const research = await defaultMerchantResearchProvider.researchMerchant({
          rawPayee,
          description: transaction.description,
          amount: transaction.amount,
          currency: transaction.currency || 'CHF',
          accountName: transaction.accountName,
          country: 'Suíça',
          city: 'Genève',
          availableCategories
        });

        if (research && research.researchUsed && research.suggestedCategoryId) {
          const matchedCategory = availableCategories.find(c => c.id === research.suggestedCategoryId) ||
                                 availableCategories.find(c => c.name.toLowerCase() === (research.suggestedCategoryName || '').toLowerCase());

          if (matchedCategory) {
            const isAuto = research.confidence >= config.autoClassifyThreshold;

            // Cache into Merchant Knowledge Store so subsequent transactions hit Step 2
            merchantKnowledgeStore.saveItem({
              merchantKey: research.canonicalMerchant || rawPayee,
              normalizedName: research.canonicalMerchant || rawPayee,
              canonicalMerchant: research.canonicalMerchant,
              legalName: research.legalName,
              country: research.country || 'Suíça',
              city: research.city,
              businessType: research.merchantType,
              suggestedCategoryId: matchedCategory.id,
              suggestedCategoryName: matchedCategory.name,
              suggestedSubcategoryName: research.suggestedSubcategoryName,
              confidence: research.confidence,
              source: 'MERCHANT_RESEARCH',
              reasoning: research.reasoningShort || `Identificado via pesquisa web como ${research.canonicalMerchant}.`,
              lastCheckedAt: new Date().toISOString(),
              researchMetadata: research.researchMetadata
            }, clientId);

            return {
              transactionId: transaction.id,
              rawPayee,
              normalizedMerchant: research.normalizedMerchant,
              canonicalMerchant: research.canonicalMerchant,
              categoryId: matchedCategory.id,
              categoryName: matchedCategory.name,
              subcategoryId: research.suggestedSubcategoryName,
              subcategoryName: research.suggestedSubcategoryName,
              transactionType: research.transactionType,
              confidenceScore: research.confidence,
              reasoning: research.reasoningShort,
              reasoningShort: research.reasoningShort,
              source: 'MERCHANT_RESEARCH',
              researchUsed: true,
              evidenceSummary: research.evidenceSummary,
              sourceUrls: research.sourceUrls,
              groundingSources: research.groundingSources,
              isAutoClassified: isAuto,
              needsReview: !isAuto,
              sentToPending: research.confidence < config.reviewRecommendedThreshold
            };
          }
        }
      } catch (err: any) {
        console.warn('Erro ao executar Step 4 (Merchant Research):', err?.message || err);
      }
    }

    // =========================================================================
    // STEP 5 — AI_REASONING (Raciocínio Semântico via Gemini)
    // =========================================================================
    const aiProvider = getAIProvider();
    if (aiProvider.isAvailable()) {
      try {
        const aiResult = await aiProvider.classifyMerchant({
          transaction,
          availableCategories,
          useSearchGrounding: false
        });

        aiMetricsStore.incrementAIClassifications();

        if (aiResult.categoryId && aiResult.confidenceScore >= config.reviewRecommendedThreshold) {
          const matchedCategory = availableCategories.find(c => c.id === aiResult.categoryId);
          if (matchedCategory) {
            const isAuto = aiResult.confidenceScore >= config.autoClassifyThreshold;

            if (isAuto && aiResult.merchantKnowledge) {
              merchantKnowledgeStore.saveItem({
                ...aiResult.merchantKnowledge,
                suggestedCategoryId: matchedCategory.id,
                suggestedCategoryName: matchedCategory.name,
                suggestedSubcategoryName: aiResult.subcategoryId,
                source: 'AI_REASONING'
              }, clientId);
            }

            return {
              ...aiResult,
              rawPayee,
              source: 'AI_REASONING',
              isAutoClassified: isAuto,
              needsReview: !isAuto,
              sentToPending: aiResult.confidenceScore < config.reviewRecommendedThreshold
            };
          }
        }
      } catch (err: any) {
        console.warn('Erro no Step 5 (AI Reasoning):', err?.message || err);
      }
    }

    // =========================================================================
    // STEP 6 — HUMAN_REVIEW (Fila Segura de Revisão Manual)
    // =========================================================================
    return {
      transactionId: transaction.id,
      rawPayee,
      normalizedMerchant: rawPayee,
      canonicalMerchant: rawPayee,
      confidenceScore: 30,
      reasoning: 'Não foi possível classificar automaticamente com certeza suficiente. Encaminhado para conferência humana.',
      reasoningShort: 'Encaminhado para conferência do consultor/cliente.',
      source: 'HUMAN_REVIEW',
      isAutoClassified: false,
      needsReview: true,
      sentToPending: true
    };
  }

  /**
   * Classifies a list of transactions in batch while respecting the 6-step hierarchy
   */
  public async classifyBatch(
    transactions: ClassifyTransactionInput[],
    availableCategories: AssignableCategoryInfo[],
    existingRules: CanonicalRule[] = [],
    clientId: string = 'kassio-pf'
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    for (const tx of transactions) {
      const res = await this.classifyTransaction(tx, availableCategories, existingRules, clientId);
      results.push(res);
    }
    return results;
  }
}

export const categorizationEngine = new LayeredCategorizationEngine();
