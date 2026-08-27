import { Router, Request, Response } from 'express';
import { financialIntelligenceService } from '../ai/financialIntelligenceService';
import { aiMetricsStore } from '../ai/metricsStore';
import { merchantKnowledgeStore } from '../ai/merchantStore';
import { humanCorrectionStore } from '../ai/correctionStore';
import { requireAuth, requireConsultant, resolveAuthorizedClientId, SessionPayload } from './auth';
import { FirestoreRepository } from '../data/firestore';
import { isMonthlyCloseClosed } from '../data/monthlyCloseStore';

const router = Router();

// Helper to get authenticated user context safely
function getSafeUserContext(req: Request) {
  const session = (req as any).user as SessionPayload;
  const role = session.role;
  const clientName = session.name || (role === 'CLIENT' ? 'Kássio' : 'Consultor');
  const userId = session.id;

  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, req.query.clientId as string || req.body?.clientId as string);
  return { role, clientId: authorizedClientId, clientName, userId, isAllowed };
}

/**
 * 1. POST /api/ai/classify
 * Layered 5-Step Classification for transactions
 */
router.post('/classify', requireAuth, async (req: Request, res: Response) => {
  const { role, clientId, isAllowed } = getSafeUserContext(req);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });
  const { transaction, transactions, availableCategories, existingRules } = req.body || {};

  if (!availableCategories || !Array.isArray(availableCategories)) {
    return res.status(400).json({
      success: false,
      message: 'Lista de categorias válidas é obrigatória.'
    });
  }

  try {
    if (transaction) {
      const result = await financialIntelligenceService.classifySingle(
        transaction,
        availableCategories,
        existingRules || [],
        clientId
      );
      return res.json({ success: true, result });
    }

    if (transactions && Array.isArray(transactions)) {
      const results = await financialIntelligenceService.classifyBatch(
        transactions,
        availableCategories,
        existingRules || [],
        clientId
      );
      return res.json({ success: true, results });
    }

    return res.status(400).json({
      success: false,
      message: 'Informe "transaction" ou "transactions" para classificar.'
    });
  } catch (error: any) {
    console.error('Erro no /api/ai/classify:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Erro durante a classificação inteligente.'
    });
  }
});

/**
 * 2. POST /api/ai/chat
 * Financial AI Assistant conversational endpoint
 */
router.post('/chat', requireAuth, async (req: Request, res: Response) => {
  const { role, clientId, clientName, isAllowed } = getSafeUserContext(req);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });
  const { messages, financialContext } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Histórico de mensagens é obrigatório.'
    });
  }

  // Security guard: strip any sensitive tokens, secrets, or passwords if accidentally sent
  const sanitizedContext = {
    baseCurrency: financialContext?.baseCurrency || 'CHF',
    totalBalance: Number(financialContext?.totalBalance) || 0,
    accountsSummary: Array.isArray(financialContext?.accountsSummary) ? financialContext.accountsSummary : [],
    currentMonthTransactions: Array.isArray(financialContext?.currentMonthTransactions) ? financialContext.currentMonthTransactions.slice(0, 50) : [],
    monthlyBudget: financialContext?.monthlyBudget || { plannedIncome: 0, plannedExpenses: 0, plannedInvestments: 0 },
    realizedTotals: financialContext?.realizedTotals || { income: 0, expenses: 0, investments: 0, netResult: 0 },
    topExpenseCategories: Array.isArray(financialContext?.topExpenseCategories) ? financialContext.topExpenseCategories : [],
    goalsSummary: Array.isArray(financialContext?.goalsSummary) ? financialContext.goalsSummary : [],
    pendingCount: Number(financialContext?.pendingCount) || 0
  };

  try {
    const response = await financialIntelligenceService.chatWithAssistant({
      messages,
      userRole: role,
      clientId,
      clientName,
      financialContext: sanitizedContext
    });

    return res.json({
      success: true,
      reply: response.reply,
      suggestedActions: response.suggestedActions
    });
  } catch (error: any) {
    console.error('Erro no /api/ai/chat:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Falha ao comunicar com o Assistente Financeiro.',
      reply: `Erro ao comunicar com o modelo de inteligência artificial (${error?.status || 500}: ${error?.message || 'Falha no processamento'}).`
    });
  }
});

/**
 * 3. POST /api/ai/insights
 * Generates discrete insights for dashboard
 */
router.post('/insights', requireAuth, async (req: Request, res: Response) => {
  const { role, isAllowed } = getSafeUserContext(req);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });
  const { month, currency, transactions, monthlyPlan, goals, recurrences } = req.body || {};

  try {
    const result = await financialIntelligenceService.generateMonthlyInsights({
      month: month || new Date().toISOString().substring(0, 7),
      currency: currency || 'CHF',
      transactions: Array.isArray(transactions) ? transactions : [],
      monthlyPlan,
      goals,
      recurrences,
      role: role === 'CONSULTANT' ? 'CONSULTANT' : 'CLIENT'
    });

    return res.json({ success: true, insights: result });
  } catch (error: any) {
    console.error('Erro no /api/ai/insights:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao gerar insights do mês.'
    });
  }
});

/**
 * 4. POST /api/ai/monthly-summary
 * Generates comprehensive monthly financial report
 */
router.post('/monthly-summary', requireAuth, async (req: Request, res: Response) => {
  const { role, isAllowed } = getSafeUserContext(req);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });
  const { month, currency, transactions, monthlyPlan, goals, pendingCount } = req.body || {};

  try {
    const report = await financialIntelligenceService.generateMonthlySummary({
      month: month || new Date().toISOString().substring(0, 7),
      currency: currency || 'CHF',
      transactions: Array.isArray(transactions) ? transactions : [],
      monthlyPlan,
      goals,
      pendingCount: Number(pendingCount) || 0,
      role: role === 'CONSULTANT' ? 'CONSULTANT' : 'CLIENT'
    });

    return res.json({ success: true, report });
  } catch (error: any) {
    console.error('Erro no /api/ai/monthly-summary:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao gerar resumo financeiro do mês.'
    });
  }
});

/**
 * 5. POST /api/ai/anomalies
 * Detects spending anomalies and duplicates
 */
router.post('/anomalies', requireAuth, async (req: Request, res: Response) => {
  const { isAllowed } = getSafeUserContext(req);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });
  const { transactions } = req.body || {};

  try {
    const anomalies = await financialIntelligenceService.detectAnomalies(
      Array.isArray(transactions) ? transactions : []
    );
    return res.json({ success: true, anomalies });
  } catch (error: any) {
    console.error('Erro no /api/ai/anomalies:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao analisar anomalias.'
    });
  }
});

/**
 * 6. POST /api/ai/recurrences
 * Detects recurring transaction candidates
 */
router.post('/recurrences', requireAuth, async (req: Request, res: Response) => {
  const { isAllowed } = getSafeUserContext(req);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });
  const { transactions } = req.body || {};

  try {
    const recurrences = await financialIntelligenceService.detectRecurrences(
      Array.isArray(transactions) ? transactions : []
    );
    return res.json({ success: true, recurrences });
  } catch (error: any) {
    console.error('Erro no /api/ai/recurrences:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao detectar recorrências.'
    });
  }
});

/**
 * 7. POST /api/ai/correction (and alias /api/ai/correct)
 * Registers human correction with client isolation
 */
const handleCorrection = async (req: Request, res: Response) => {
  const { role, clientId, userId, isAllowed } = getSafeUserContext(req);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });
  const {
    merchant,
    originalDescription,
    rawDescription,
    previousCategoryId,
    previousCategoryName,
    chosenCategoryId,
    correctedCategoryId,
    chosenCategoryName,
    correctedCategoryName,
    chosenSubcategoryName,
    correctedSubcategoryName
  } = req.body || {};

  const finalCategoryId = chosenCategoryId || correctedCategoryId;
  const finalCategoryName = chosenCategoryName || correctedCategoryName;

  if (!finalCategoryId) {
    return res.status(400).json({
      success: false,
      message: 'chosenCategoryId ou correctedCategoryId é obrigatório.'
    });
  }

  try {
    const record = financialIntelligenceService.recordHumanCorrection({
      clientId,
      merchant: merchant || '',
      originalDescription: originalDescription || rawDescription || '',
      previousCategoryId,
      previousCategoryName,
      chosenCategoryId: finalCategoryId,
      chosenCategoryName: finalCategoryName || finalCategoryId,
      chosenSubcategoryName: chosenSubcategoryName || correctedSubcategoryName,
      changedByRole: role === 'CONSULTANT' ? 'CONSULTANT' : 'CLIENT',
      changedByUserId: userId
    });
    await FirestoreRepository.upsert(clientId, 'aiCorrections', record.id, record as any);

    return res.json({
      success: true,
      message: 'Correção registrada no aprendizado contínuo com sucesso.',
      record
    });
  } catch (error: any) {
    console.error('Erro no /api/ai/correction:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao registrar correção humana.'
    });
  }
};

router.post('/correction', requireAuth, handleCorrection);
router.post('/correct', requireAuth, handleCorrection);

/**
 * 7.5. POST /api/ai/process-uncategorized
 * Retroactive automatic categorization for existing uncategorized transactions
 */
router.post('/process-uncategorized', requireAuth, async (req: Request, res: Response) => {
  const { clientId, isAllowed } = getSafeUserContext(req);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });

  try {
    // Server-side source of truth: never trust browser snapshots for bulk recategorization.
    const [storedTransactions, storedCategories, storedRules, storedCorrections] = await Promise.all([
      FirestoreRepository.list<any>(clientId, 'transactions'),
      FirestoreRepository.list<any>(clientId, 'categories'),
      FirestoreRepository.list<any>(clientId, 'rules'),
      FirestoreRepository.list<any>(clientId, 'aiCorrections')
    ]);

    humanCorrectionStore.hydrateClientCorrections(clientId, storedCorrections as any);

    if (!storedCategories.length) {
      return res.status(409).json({
        success: false,
        code: 'CATEGORIES_REQUIRED',
        message: 'Cadastre ou sincronize as categorias antes de executar a categorização automática.'
      });
    }

    const availableCategories = storedCategories.map(category => ({
      id: String(category.id),
      name: String(category.name || category.id),
      groupName: String(category.groupName || category.group || ''),
      type: String(category.type || 'DESPESA'),
      subcategories: Array.isArray(category.subcategories) ? category.subcategories : []
    }));

    const results: any[] = [];
    let uncategorizedFound = 0;
    let categorizedCount = 0;
    let pendingCount = 0;
    let researchedCount = 0;
    let lockedCount = 0;

    for (const tx of storedTransactions) {
      if ((tx as any).deleted) continue;
      const categoryName = String(tx.categoryName || '').trim().toLowerCase();
      const isUncategorized =
        !tx.categoryId ||
        tx.categoryId === 'cat-none' ||
        !categoryName ||
        categoryName === 'sem categoria' ||
        categoryName === 'uncategorized';

      if (!isUncategorized && tx.reviewStatus === 'REVISADA') {
        continue;
      }

      uncategorizedFound++;
      const month = String(tx.date || '').slice(0, 7);
      if (month && await isMonthlyCloseClosed(clientId, month)) {
        lockedCount++;
        results.push({ transactionId: tx.id, skipped: true, reason: 'MONTH_CLOSED' });
        continue;
      }

      try {
        const classifyInput = {
          id: tx.id,
          merchant: tx.merchant || tx.payee || tx.description,
          payee: tx.payee,
          description: tx.description || tx.payee || tx.merchant || 'Movimentação',
          notes: tx.notes,
          amount: Number(tx.amountOriginal ?? tx.amount ?? 0),
          currency: tx.currencyOriginal || tx.currency || 'CHF',
          date: tx.date,
          accountName: tx.accountName,
          accountId: tx.accountId,
          country: 'Suíça',
          currentCategoryId: tx.categoryId
        };

        const classification = await financialIntelligenceService.classifySingle(
          classifyInput,
          availableCategories,
          storedRules as any,
          clientId
        );

        if (classification.researchUsed || classification.source === 'MERCHANT_RESEARCH') researchedCount++;

        // Only high-confidence results may become the actual category. Everything else is a persisted suggestion.
        const shouldApply = Boolean(
          classification.categoryId &&
          classification.isAutoClassified &&
          classification.confidenceScore >= aiMetricsStore.getConfig().autoClassifyThreshold
        );

        if (shouldApply) categorizedCount++;
        else pendingCount++;

        const now = new Date().toISOString();
        const updatedTransaction = {
          ...tx,
          categoryId: shouldApply ? classification.categoryId : tx.categoryId,
          categoryName: shouldApply ? classification.categoryName : tx.categoryName,
          subcategoryId: shouldApply ? classification.subcategoryId : tx.subcategoryId,
          subcategoryName: shouldApply ? classification.subcategoryName : tx.subcategoryName,
          reviewStatus: shouldApply
            ? (classification.source === 'DETERMINISTIC_RULE' ? 'AUTO_REGRAS' : 'AI_CLASSIFIED')
            : 'PENDENTE',
          aiClassification: {
            suggestedCategoryId: classification.categoryId,
            suggestedCategoryName: classification.categoryName,
            suggestedSubcategoryId: classification.subcategoryId,
            suggestedSubcategoryName: classification.subcategoryName,
            confidenceScore: classification.confidenceScore,
            reasoning: classification.reasoning,
            reasoningShort: classification.reasoningShort,
            source: classification.source,
            isAutoClassified: shouldApply,
            needsReview: !shouldApply,
            researchUsed: classification.researchUsed,
            evidenceSummary: classification.evidenceSummary,
            sourceUrls: classification.sourceUrls,
            canonicalMerchant: classification.canonicalMerchant,
            groundingSources: classification.groundingSources
          },
          updatedAt: now
        };

        await FirestoreRepository.upsert(clientId, 'transactions', String(tx.id), updatedTransaction as any);
        results.push({ transactionId: tx.id, classification, updatedTransaction });
      } catch (err: any) {
        pendingCount++;
        results.push({ transactionId: tx.id, error: err?.message || 'Classification failed' });
      }
    }

    return res.json({
      success: true,
      metrics: { uncategorizedFound, categorizedCount, pendingCount, researchedCount, lockedCount },
      // Write-back to Lunch Money is deliberately not automatic because internal category IDs are not
      // guaranteed to equal provider category IDs. The canonical database remains the source of truth.
      providerWriteBackPerformed: false,
      results
    });
  } catch (error: any) {
    console.error('Erro no /api/ai/process-uncategorized:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar transações retroativamente.'
    });
  }
});

/**
 * 8. GET /api/ai/metrics
 * Real-time AI Cost & Usage metrics (Consultant only)
 */
router.get('/metrics', requireConsultant, (req: Request, res: Response) => {
  const metrics = aiMetricsStore.getMetrics();
  const config = aiMetricsStore.getConfig();

  return res.json({
    success: true,
    metrics,
    config
  });
});

/**
 * 9. POST /api/ai/config
 * Update AI Thresholds (Consultant only)
 */
router.post('/config', requireConsultant, (req: Request, res: Response) => {
  const { autoClassifyThreshold, reviewRecommendedThreshold, enableSearchGrounding } = req.body || {};

  const updated = aiMetricsStore.updateConfig({
    autoClassifyThreshold,
    reviewRecommendedThreshold,
    enableSearchGrounding
  });

  return res.json({
    success: true,
    message: 'Limites de confiança atualizados com sucesso.',
    config: updated
  });
});

/**
 * 10. GET /api/ai/merchants
 * Inspect Merchant Knowledge base
 */
router.get('/merchants', requireAuth, (req: Request, res: Response) => {
  const { clientId, isAllowed } = getSafeUserContext(req);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });
  const merchants = merchantKnowledgeStore.getAllKnowledge(clientId);
  return res.json({ success: true, count: merchants.length, merchants });
});

export default router;
