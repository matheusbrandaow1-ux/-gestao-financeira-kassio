import { Router, Request, Response } from 'express';
import { LunchMoneyClient } from '../integrations/lunchmoney/client';
import { LunchMoneySyncService } from '../integrations/lunchmoney/sync';
import { lunchMoneyCache } from '../integrations/lunchmoney/cache';
import { LunchMoneyIntegrationStore } from '../integrations/lunchmoney/store';
import { LunchMoneyTestClient } from '../integrations/lunchmoney/testClient';
import { fxRateService } from '../integrations/fxService';
import { requireAuth, requireConsultant, resolveAuthorizedClientId } from './auth';

const router = Router();

// 1. Get current public integration details for a client (No raw token is ever returned)
router.get('/integration', requireAuth, (req: Request, res: Response) => {
  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, req.query.clientId as string);
  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Acesso não autorizado aos dados deste cliente.'
    });
  }

  const integration = LunchMoneyIntegrationStore.getPublicIntegration(authorizedClientId);

  return res.json({
    success: true,
    clientId: authorizedClientId,
    integration: integration || {
      clientId: authorizedClientId,
      status: 'DISCONNECTED',
      message: 'Nenhuma integração ativa configurada para este cliente.'
    }
  });
});

// 2. Test a raw token before connecting (Transient validation via GET /v2/me) - STRICTLY CONSULTANT ONLY
router.post('/test-token', requireConsultant, async (req: Request, res: Response) => {
  try {
    const client = new LunchMoneyClient();
    const user = await client.getMe();

    return res.json({
      success: true,
      message: 'Conexão validada com sucesso com a API Lunch Money!',
      user: {
        id: user.user_id || user.id,
        userName: user.user_name || user.name || 'Usuário Lunch Money',
        userEmail: user.user_email || user.email || '',
        primaryCurrency: (user.primary_currency ? user.primary_currency.toUpperCase() : 'CHF'),
        budgetName: user.budget_name || 'Orçamento Principal',
        accountId: user.account_id
      }
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      code: err.code || 'VALIDATION_FAILED',
      message: err.message || 'Token inválido ou não autorizado pela API do Lunch Money.'
    });
  }
});

// 3. Connect/Save Lunch Money token for a client - STRICTLY CONSULTANT ONLY
router.post('/connect', requireConsultant, async (req: Request, res: Response) => {
  const { clientId } = req.body || {};
  const access = resolveAuthorizedClientId(req, clientId);
  if (!access.isAllowed) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso não autorizado para este cliente.' });
  const targetClientId = access.authorizedClientId;

  try {
    // The credential is always read from the server environment.
    const client = new LunchMoneyClient();
    const user = await client.getMe();

    const userName = user.user_name || user.name || 'Kássio';
    const userEmail = user.user_email || user.email || '';
    const budgetName = user.budget_name || 'Orçamento Principal';
    const primaryCurrency = (user.primary_currency ? user.primary_currency.toUpperCase() : 'CHF');
    const userId = user.user_id || user.id;

    // 2. Persist only non-secret connection metadata; the credential remains in the environment.
    const publicIntegration = LunchMoneyIntegrationStore.saveIntegration(targetClientId, {
      status: 'CONNECTED',
      lunchMoneyUserId: userId,
      lunchMoneyBudgetName: budgetName,
      baseCurrency: primaryCurrency,
      userName,
      userEmail
    });

    return res.json({
      success: true,
      message: `Lunch Money conectado com sucesso para o cliente ${targetClientId}!`,
      integration: publicIntegration,
      user: {
        userName,
        userEmail,
        budgetName,
        primaryCurrency
      }
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      code: err.code || 'CONNECTION_FAILED',
      message: 'Falha ao conectar com o Lunch Money. Verifique a configuração server-side.'
    });
  }
});

// 4. Disconnect Lunch Money for a client - STRICTLY CONSULTANT ONLY
router.post('/disconnect', requireConsultant, (req: Request, res: Response) => {
  const { clientId } = req.body || {};
  const access = resolveAuthorizedClientId(req, clientId);
  if (!access.isAllowed) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso não autorizado para este cliente.' });
  const targetClientId = access.authorizedClientId;

  LunchMoneyIntegrationStore.disconnectIntegration(targetClientId);
  lunchMoneyCache.clear(targetClientId);

  return res.json({
    success: true,
    message: `Integração Lunch Money desconectada com sucesso para o cliente ${targetClientId}.`
  });
});

// 5. GET /api/lunchmoney/me (Check active connection for client)
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, req.query.clientId as string);
  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Acesso não autorizado aos dados deste cliente.'
    });
  }

  if (!LunchMoneyIntegrationStore.getTokenForClient(authorizedClientId)) {
    return res.status(401).json({
      success: false,
      status: 'NOT_CONFIGURED',
      code: 'AUTH_NOT_CONFIGURED',
      message: `Lunch Money não conectado para o cliente ${authorizedClientId}.`,
      user: null
    });
  }

  try {
    const client = new LunchMoneyClient();
    const user = await client.getMe();
    
    const userMeta = {
      userName: user.user_name || user.name || 'Kássio',
      userEmail: user.user_email || user.email || '',
      primaryCurrency: (user.primary_currency ? user.primary_currency.toUpperCase() : 'CHF'),
      budgetName: user.budget_name,
      accountId: user.account_id
    };

    LunchMoneyIntegrationStore.updateValidationTimestamp(authorizedClientId, userMeta);
    const publicIntegration = LunchMoneyIntegrationStore.getPublicIntegration(authorizedClientId);

    return res.json({
      success: true,
      status: 'CONNECTED',
      message: 'Lunch Money: Conectado',
      integration: publicIntegration,
      user: userMeta
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      status: err.code === 'AUTH_ERROR' ? 'AUTH_ERROR' : 'ERROR',
      code: err.code || 'API_ERROR',
      message: err.message || 'Erro ao validar conexão com Lunch Money.',
      user: null
    });
  }
});

// 6. Test status endpoint
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, req.query.clientId as string);
  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Acesso não autorizado aos dados deste cliente.'
    });
  }

  if (!LunchMoneyIntegrationStore.getTokenForClient(authorizedClientId)) {
    return res.json({
      configured: false,
      status: 'NOT_CONFIGURED',
      message: `Lunch Money não configurado para o cliente ${authorizedClientId}.`,
      user: null
    });
  }

  try {
    const client = new LunchMoneyClient();
    const user = await client.getMe();
    return res.json({
      configured: true,
      status: 'CONNECTED',
      message: 'Conectado à API Lunch Money v2',
      user: {
        userName: user.user_name,
        userEmail: user.user_email,
        primaryCurrency: user.primary_currency,
        budgetName: user.budget_name
      }
    });
  } catch (err: any) {
    return res.json({
      configured: true,
      status: 'ERROR',
      message: err.message || 'Falha ao autenticar com Lunch Money',
      user: null
    });
  }
});

// 7. Trigger Idempotent Sync for a client
router.post('/sync', requireConsultant, async (req: Request, res: Response) => {
  const { 
    clientId, 
    startDate, 
    updatedSince, 
    existingTransactions, 
    existingAccounts, 
    existingCategories, 
    existingTags, 
    existingRules,
    existingRecurring 
  } = req.body || {};
  
  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, clientId);
  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Acesso não autorizado para sincronizar este cliente.'
    });
  }

  if (!LunchMoneyIntegrationStore.getTokenForClient(authorizedClientId)) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      message: `Lunch Money não conectado para o cliente ${authorizedClientId}. Por favor, conecte a integração primeiro.`
    });
  }

  try {
    const syncService = new LunchMoneySyncService(process.env.NODE_ENV === 'test' ? new LunchMoneyTestClient() : undefined);
    const result = await syncService.runSync(authorizedClientId, {
      startDate,
      updatedSince,
      existingTransactions,
      existingAccounts,
      existingCategories,
      existingTags,
      existingRules,
      existingRecurring
    });

    let fxRates = [];
    if (result.job.status === 'SUCCESS' || result.job.status === 'SINCRONIZADO') {
      const currencies = [
        ...result.accounts.map(account => account.currency),
        ...result.transactions.map(transaction => transaction.currency)
      ];
      try {
        fxRates = await fxRateService.refreshForClient(authorizedClientId, currencies);
      } catch (fxError) {
        console.warn('[FX] Atualização pós-sync ignorada; sincronização preservada.', fxError);
      }
    }

    const isSuccess = result.job.status === 'SUCCESS' || result.job.status === 'SINCRONIZADO';

    return res.json({
      success: isSuccess,
      data: result,
      job: result.job,
      user: result.user,
      metrics: result.metrics,
      fxRates
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'SYNC_FAILED',
      message: 'Erro interno durante sincronização.'
    });
  }
});

router.get('/fx-rates', requireAuth, async (req: Request, res: Response) => {
  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, req.query.clientId as string);
  if (!isAllowed) return res.status(403).json({ success: false, code: 'FORBIDDEN' });

  try {
    const rates = await fxRateService.getRates(authorizedClientId);
    return res.json({ success: true, rates });
  } catch {
    return res.json({ success: true, rates: [] });
  }
});

// 8. Clear cache endpoint - STRICTLY CONSULTANT ONLY
router.post('/cache/clear', requireConsultant, (req: Request, res: Response) => {
  const { clientId } = req.body || {};
  lunchMoneyCache.clear(clientId || 'kassio-pf');
  return res.json({ success: true, message: 'Cache limpo com sucesso.' });
});

// 9. Update Transaction in Lunch Money (write-back)
router.put('/transaction/:id', requireConsultant, async (req: Request, res: Response) => {
  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, req.body?.clientId as string);
  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Acesso não autorizado aos dados deste cliente.'
    });
  }

  if (!LunchMoneyIntegrationStore.getTokenForClient(authorizedClientId)) {
    return res.status(401).json({
      success: false,
      message: 'Lunch Money não conectado para este cliente.'
    });
  }

  const txId = req.params.id;
  const { category_id, notes, tags, payee, status } = req.body || {};

  try {
    const client = new LunchMoneyClient();
    const result = await client.updateTransaction(txId, {
      category_id,
      notes,
      tags,
      payee,
      status
    });

    return res.json({
      success: result.updated,
      result
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Erro ao atualizar transação no Lunch Money.'
    });
  }
});

export default router;
