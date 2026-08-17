import { Router, Request, Response } from 'express';
import { requireAuth, resolveAuthorizedClientId } from './auth';

const router = Router();

// In-memory / server-side categorization overrides store (persists across syncs)
// Key: `${clientId}_${transactionId}` -> { categoryId, categoryName, subcategoryName, updatedAt }
interface CategoryOverride {
  clientId: string;
  transactionId: string;
  categoryId: string;
  categoryName: string;
  subcategoryName?: string;
  updatedAt: string;
}

const categorizationOverrides = new Map<string, CategoryOverride>();

// 1. POST /api/transactions/categorize - Safe Recategorization (ReadOnly to Lunch Money)
router.post('/categorize', requireAuth, (req: Request, res: Response) => {
  const { transactionId, categoryId, categoryName, subcategoryName, clientId } = req.body || {};

  if (!transactionId || typeof transactionId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'ID de transação obrigatório.'
    });
  }

  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, clientId);
  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      message: 'Acesso não autorizado para categorizar transações deste cliente.'
    });
  }

  const key = `${authorizedClientId}_${transactionId}`;
  const override: CategoryOverride = {
    clientId: authorizedClientId,
    transactionId,
    categoryId: categoryId || '',
    categoryName: categoryName || '',
    subcategoryName: subcategoryName || undefined,
    updatedAt: new Date().toISOString()
  };

  categorizationOverrides.set(key, override);

  return res.json({
    success: true,
    message: 'Categorização salva com sucesso.',
    override
  });
});

// 2. GET /api/transactions/overrides - Get all overrides for client
router.get('/overrides', requireAuth, (req: Request, res: Response) => {
  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, req.query.clientId as string);
  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      message: 'Acesso não autorizado para consultar overrides deste cliente.'
    });
  }

  const list: CategoryOverride[] = [];
  for (const [key, val] of categorizationOverrides.entries()) {
    if (key.startsWith(`${authorizedClientId}_`)) {
      list.push(val);
    }
  }

  return res.json({
    success: true,
    clientId: authorizedClientId,
    overrides: list
  });
});

export default router;
