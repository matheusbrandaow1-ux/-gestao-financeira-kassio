import { Router, Request, Response } from 'express';
import { requireAuth } from './auth';

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
  const sessionUser = (req as any).user;
  const { transactionId, categoryId, categoryName, subcategoryName } = req.body || {};

  if (!transactionId || typeof transactionId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'ID de transação obrigatório.'
    });
  }

  // Determine target client ID based on authenticated role (Strict isolation)
  let targetClientId = 'kassio-pf';
  if (sessionUser.role === 'CLIENT') {
    targetClientId = sessionUser.clientId || 'kassio-pf';
  } else if (req.body.clientId && typeof req.body.clientId === 'string') {
    targetClientId = req.body.clientId;
  }

  const key = `${targetClientId}_${transactionId}`;
  const override: CategoryOverride = {
    clientId: targetClientId,
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
  const sessionUser = (req as any).user;
  let targetClientId = 'kassio-pf';

  if (sessionUser.role === 'CLIENT') {
    targetClientId = sessionUser.clientId || 'kassio-pf';
  } else if (req.query.clientId && typeof req.query.clientId === 'string') {
    targetClientId = req.query.clientId;
  }

  const list: CategoryOverride[] = [];
  for (const [key, val] of categorizationOverrides.entries()) {
    if (key.startsWith(`${targetClientId}_`)) {
      list.push(val);
    }
  }

  return res.json({
    success: true,
    clientId: targetClientId,
    overrides: list
  });
});

export default router;
