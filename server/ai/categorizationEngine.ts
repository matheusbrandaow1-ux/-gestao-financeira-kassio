import { 
  ClassifyTransactionInput, 
  AssignableCategoryInfo, 
  ClassificationResult,
  MerchantKnowledgeItem
} from './types';
import { CanonicalRule } from '../../src/types';
import { evaluateCondition } from '../../src/lib/rulesEngine';
import { merchantKnowledgeStore } from './merchantStore';
import { humanCorrectionStore } from './correctionStore';
import { aiMetricsStore } from './metricsStore';
import { getAIProvider } from './providers';

export class LayeredCategorizationEngine {
  /**
   * Runs the 5-Layer Categorization Engine on a transaction:
   * Layer 1: Exact Rule Match
   * Layer 2: Merchant Knowledge Cache
   * Layer 3: Historical Pattern / Human Corrections (Client-Isolated)
   * Layer 4: Gemini AI Model
   * Layer 5: Google Search Grounding (Only if needed for unknown/ambiguous merchants)
   */
  public async classifyTransaction(
    transaction: ClassifyTransactionInput,
    availableCategories: AssignableCategoryInfo[],
    existingRules: CanonicalRule[] = [],
    clientId: string = 'kassio-pf'
  ): Promise<ClassificationResult> {
    const config = aiMetricsStore.getConfig();
    const merchantName = transaction.merchant || transaction.payee || transaction.description || '';
    const originalDesc = transaction.description || '';

    // =========================================================================
    // CAMADA 1 — REGRA EXATA (Prioridade Máxima Determinística)
    // =========================================================================
    if (existingRules && existingRules.length > 0) {
      const activeRules = existingRules
        .filter(r => r.isActive)
        .sort((a, b) => (a.priority || 999) - (b.priority || 999));

      for (const rule of activeRules) {
        // Convert to canonical transaction shape for evaluateCondition
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
            categoryId: rule.actions.categoryId,
            categoryName: matchedCategory?.name || rule.actions.categoryId,
            subcategoryId: rule.actions.subcategoryId,
            confidenceScore: 100,
            reasoning: `Regra determinística personalizada: "${rule.name}"`,
            source: 'EXACT_RULE',
            isAutoClassified: true,
            needsReview: false,
            sentToPending: false
          };
        }
      }
    }

    // =========================================================================
    // CAMADA 2 — MEMÓRIA / CACHE DE MERCHANTS CONHECIDOS
    // =========================================================================
    const cachedMerchant = merchantKnowledgeStore.lookup(merchantName || originalDesc, clientId);

    if (cachedMerchant) {
      // Find matching category from the available categories list
      let matchedCategory: AssignableCategoryInfo | undefined;
      
      if (cachedMerchant.suggestedCategoryId) {
        matchedCategory = availableCategories.find(c => c.id === cachedMerchant.suggestedCategoryId);
      }
      
      if (!matchedCategory && cachedMerchant.suggestedCategoryName) {
        matchedCategory = availableCategories.find(c => 
          c.name.toLowerCase() === cachedMerchant.suggestedCategoryName!.toLowerCase()
        );
      }

      // If category matches available categories with sufficient confidence
      if (matchedCategory && cachedMerchant.confidence >= config.reviewRecommendedThreshold) {
        aiMetricsStore.incrementCacheHits();
        const isAuto = cachedMerchant.confidence >= config.autoClassifyThreshold;

        return {
          transactionId: transaction.id,
          categoryId: matchedCategory.id,
          categoryName: matchedCategory.name,
          subcategoryId: cachedMerchant.suggestedSubcategoryName,
          confidenceScore: cachedMerchant.confidence,
          reasoning: cachedMerchant.reasoning || `Reconhecido pelo catálogo de estabelecimentos (${cachedMerchant.normalizedName}).`,
          source: 'MERCHANT_CACHE',
          merchantKnowledge: cachedMerchant,
          isAutoClassified: isAuto,
          needsReview: !isAuto,
          sentToPending: cachedMerchant.confidence < config.reviewRecommendedThreshold
        };
      }
    }

    // =========================================================================
    // CAMADA 3 — PADRÃO HISTÓRICO / CORREÇÕES HUMANAS (Isoladas por clientId)
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
          categoryId: matchedCategory.id,
          categoryName: matchedCategory.name,
          subcategoryId: humanCorrection.chosenSubcategoryName,
          confidenceScore: 98,
          reasoning: `Decisão humana prévia: alterado por ${humanCorrection.changedByRole === 'CONSULTANT' ? 'Consultor' : 'Cliente'} em ${new Date(humanCorrection.timestamp).toLocaleDateString('pt-BR')}.`,
          source: 'HISTORICAL_PATTERN',
          isAutoClassified: true,
          needsReview: false,
          sentToPending: false
        };
      }
    }

    // =========================================================================
    // CAMADA 4 — GEMINI API (Inferência de Estabelecimento & Classificação)
    // =========================================================================
    const aiProvider = getAIProvider();
    
    if (!aiProvider.isAvailable()) {
      return {
        transactionId: transaction.id,
        confidenceScore: 30,
        reasoning: 'IA indisponível. Recomenda-se revisão manual ou criação de regra.',
        source: 'GEMINI_AI',
        isAutoClassified: false,
        needsReview: true,
        sentToPending: true
      };
    }

    // Attempt Layer 4 (Standard Gemini prompt without web search first)
    const aiResult = await aiProvider.classifyMerchant({
      transaction,
      availableCategories,
      useSearchGrounding: false
    });

    aiMetricsStore.incrementAIClassifications();

    // If Gemini confidence is >= config.autoClassifyThreshold (e.g. 90%), save to cache and return!
    if (aiResult.confidenceScore >= config.autoClassifyThreshold) {
      if (aiResult.merchantKnowledge) {
        merchantKnowledgeStore.saveItem({
          ...aiResult.merchantKnowledge,
          suggestedCategoryId: aiResult.categoryId,
          suggestedCategoryName: aiResult.categoryName,
          suggestedSubcategoryName: aiResult.subcategoryId
        }, clientId);
      }
      return aiResult;
    }

    // =========================================================================
    // CAMADA 5 — GOOGLE SEARCH GROUNDING (Apenas para estabelecimentos incertos/ambíguos)
    // =========================================================================
    if (config.enableSearchGrounding && aiResult.confidenceScore < config.autoClassifyThreshold) {
      try {
        const searchResult = await aiProvider.classifyMerchant({
          transaction,
          availableCategories,
          useSearchGrounding: true
        });

        // If search grounding improved or gave a result, store into merchantKnowledge
        if (searchResult.confidenceScore >= config.reviewRecommendedThreshold && searchResult.merchantKnowledge) {
          merchantKnowledgeStore.saveItem({
            ...searchResult.merchantKnowledge,
            suggestedCategoryId: searchResult.categoryId,
            suggestedCategoryName: searchResult.categoryName,
            suggestedSubcategoryName: searchResult.subcategoryId
          }, clientId);
        }

        return searchResult;
      } catch (err) {
        console.warn('Erro ao executar Camada 5 (Google Search Grounding):', err);
        return aiResult;
      }
    }

    return aiResult;
  }

  /**
   * Classifies a list of transactions in batch while respecting caches
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
