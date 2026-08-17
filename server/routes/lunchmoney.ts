import { Router, Request, Response } from 'express';
import { LunchMoneyClient } from '../integrations/lunchmoney/client';
import { LunchMoneySyncService } from '../integrations/lunchmoney/sync';
import { lunchMoneyCache } from '../integrations/lunchmoney/cache';
import { LunchMoneyIntegrationStore } from '../integrations/lunchmoney/store';
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
  const { token } = req.body || {};
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Informe um Access Token válido do Lunch Money.'
    });
  }

  try {
    const client = new LunchMoneyClient(token.trim());
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
  const { clientId, token } = req.body || {};
  const targetClientId = clientId || 'kassio-pf';

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Informe um Access Token do Lunch Money para conectar.'
    });
  }

  try {
    // 1. Validate token with Lunch Money API
    const client = new LunchMoneyClient(token.trim());
    const user = await client.getMe();

    const userName = user.user_name || user.name || 'Kássio';
    const userEmail = user.user_email || user.email || '';
    const budgetName = user.budget_name || 'Orçamento Principal';
    const primaryCurrency = (user.primary_currency ? user.primary_currency.toUpperCase() : 'CHF');
    const userId = user.user_id || user.id;

    // 2. Persist in isolated server integration store (only tokenLast4 is public)
    const publicIntegration = LunchMoneyIntegrationStore.saveIntegration(targetClientId, {
      token: token.trim(),
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
      message: err.message || 'Falha ao conectar com o Lunch Money. Verifique se o token está correto.'
    });
  }
});

// 4. Disconnect Lunch Money for a client - STRICTLY CONSULTANT ONLY
router.post('/disconnect', requireConsultant, (req: Request, res: Response) => {
  const { clientId } = req.body || {};
  const targetClientId = clientId || 'kassio-pf';

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

  const token = LunchMoneyIntegrationStore.getTokenForClient(authorizedClientId);

  if (!token) {
    return res.status(401).json({
      success: false,
      status: 'NOT_CONFIGURED',
      code: 'AUTH_NOT_CONFIGURED',
      message: `Lunch Money não conectado para o cliente ${authorizedClientId}.`,
      user: null
    });
  }

  try {
    const client = new LunchMoneyClient(token);
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

  const token = LunchMoneyIntegrationStore.getTokenForClient(authorizedClientId);

  if (!token) {
    return res.json({
      configured: false,
      status: 'NOT_CONFIGURED',
      message: `Lunch Money não configurado para o cliente ${authorizedClientId}.`,
      user: null
    });
  }

  try {
    const client = new LunchMoneyClient(token);
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
router.post('/sync', requireAuth, async (req: Request, res: Response) => {
  const { 
    clientId, 
    startDate, 
    updatedSince, 
    existingTransactions, 
    existingAccounts, 
    existingCategories, 
    existingTags, 
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

  const token = LunchMoneyIntegrationStore.getTokenForClient(authorizedClientId);

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      message: `Lunch Money não conectado para o cliente ${authorizedClientId}. Por favor, conecte a integração primeiro.`
    });
  }

  try {
    const syncService = new LunchMoneySyncService(token);
    const result = await syncService.runSync(authorizedClientId, {
      startDate,
      updatedSince,
      existingTransactions,
      existingAccounts,
      existingCategories,
      existingTags,
      existingRecurring
    });

    const isSuccess = result.job.status === 'SUCCESS' || result.job.status === 'SINCRONIZADO';

    return res.json({
      success: isSuccess,
      data: result,
      job: result.job,
      user: result.user
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Erro interno durante sincronização.',
      error: err
    });
  }
});

// 8. Clear cache endpoint - STRICTLY CONSULTANT ONLY
router.post('/cache/clear', requireConsultant, (req: Request, res: Response) => {
  const { clientId } = req.body || {};
  lunchMoneyCache.clear(clientId || 'kassio-pf');
  return res.json({ success: true, message: 'Cache limpo com sucesso.' });
});

export default router;
