import { Router, Request, Response } from 'express';
import { financialIntelligenceService } from '../ai/financialIntelligenceService';
import { aiMetricsStore } from '../ai/metricsStore';
import { merchantKnowledgeStore } from '../ai/merchantStore';
import { humanCorrectionStore } from '../ai/correctionStore';
import { requireAuth, requireConsultant, resolveAuthorizedClientId, SessionPayload } from './auth';

const router = Router();

// Helper to get authenticated user context safely
function getSafeUserContext(req: Request) {
  const session = (req as any).user as SessionPayload;
  const role = session.role;
  const clientName = session.name || (role === 'CLIENT' ? 'Kássio' : 'Consultor');
  const userId = session.id;

  const { authorizedClientId } = resolveAuthorizedClientId(req, req.query.clientId as string || req.body?.clientId as string);
  return { role, clientId: authorizedClientId, clientName, userId };
}

/**
 * 1. POST /api/ai/classify
 * Layered 5-Step Classification for transactions
 */
router.post('/classify', requireAuth, async (req: Request, res: Response) => {
  const { role, clientId } = getSafeUserContext(req);
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
  const { role, clientId, clientName } = getSafeUserContext(req);
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
      message: 'Falha ao comunicar com o Assistente Financeiro.',
      reply: 'Ocorreu uma instabilidade na consulta de inteligência artificial. Por favor, tente novamente.'
    });
  }
});

/**
 * 3. POST /api/ai/insights
 * Generates discrete insights for dashboard
 */
router.post('/insights', requireAuth, async (req: Request, res: Response) => {
  const { role } = getSafeUserContext(req);
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
  const { role } = getSafeUserContext(req);
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
 * 7. POST /api/ai/correction
 * Registers human correction with client isolation
 */
router.post('/correction', requireAuth, async (req: Request, res: Response) => {
  const { role, clientId, userId } = getSafeUserContext(req);
  const {
    merchant,
    originalDescription,
    previousCategoryId,
    previousCategoryName,
    chosenCategoryId,
    chosenCategoryName,
    chosenSubcategoryName
  } = req.body || {};

  if (!chosenCategoryId || !chosenCategoryName) {
    return res.status(400).json({
      success: false,
      message: 'chosenCategoryId e chosenCategoryName são obrigatórios.'
    });
  }

  try {
    const record = financialIntelligenceService.recordHumanCorrection({
      clientId,
      merchant: merchant || '',
      originalDescription: originalDescription || '',
      previousCategoryId,
      previousCategoryName,
      chosenCategoryId,
      chosenCategoryName,
      chosenSubcategoryName,
      changedByRole: role === 'CONSULTANT' ? 'CONSULTANT' : 'CLIENT',
      changedByUserId: userId
    });

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
  const { clientId } = getSafeUserContext(req);
  const merchants = merchantKnowledgeStore.getAllKnowledge(clientId);
  return res.json({ success: true, count: merchants.length, merchants });
});

export default router;
