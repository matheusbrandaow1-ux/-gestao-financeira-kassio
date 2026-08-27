import { Router, Request, Response } from 'express';
import { requireAuth, resolveAuthorizedClientId } from './auth';
import { FirestoreRepository } from '../data/firestore';
import { isMonthlyCloseClosed } from '../data/monthlyCloseStore';
import { humanCorrectionStore } from '../ai/correctionStore';
import { CanonicalTransaction, Category } from '../../src/types';

const router = Router();

/**
 * Safe human recategorization endpoint for CONSULTANT and CLIENT.
 * The authenticated client scope is enforced server-side and the correction becomes
 * durable learning data. No browser-side Firestore permission is required.
 */
router.post('/categorize', requireAuth, async (req: Request, res: Response) => {
  const { transactionId, categoryId, categoryName, subcategoryName, clientId } = req.body || {};
  if (!transactionId || typeof transactionId !== 'string' || !categoryId || typeof categoryId !== 'string') {
    return res.status(400).json({ success: false, message: 'Transação e categoria são obrigatórias.' });
  }

  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, clientId);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });

  try {
    const transaction = await FirestoreRepository.get<CanonicalTransaction>(authorizedClientId, 'transactions', transactionId);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
    if (transaction.date && await isMonthlyCloseClosed(authorizedClientId, transaction.date.slice(0, 7))) {
      return res.status(409).json({ success: false, code: 'MONTH_CLOSED', message: 'Período mensal fechado; reabra-o antes de alterar categorias.' });
    }

    const category = await FirestoreRepository.get<Category>(authorizedClientId, 'categories', categoryId);
    const finalCategoryName = category?.name || categoryName || transaction.categoryName || categoryId;
    const session = (req as any).user;
    const now = new Date().toISOString();
    const updatedTransaction: CanonicalTransaction = {
      ...transaction,
      categoryId,
      categoryName: finalCategoryName,
      subcategoryId: subcategoryName || undefined,
      subcategoryName: subcategoryName || undefined,
      reviewStatus: 'REVISADA',
      updatedAt: now
    };

    await FirestoreRepository.upsert(authorizedClientId, 'transactions', transactionId, updatedTransaction as any);

    const correction = humanCorrectionStore.recordCorrection({
      clientId: authorizedClientId,
      merchant: transaction.merchant || transaction.payee || '',
      originalDescription: transaction.description || '',
      previousCategoryId: transaction.categoryId,
      previousCategoryName: transaction.categoryName,
      chosenCategoryId: categoryId,
      chosenCategoryName: finalCategoryName,
      chosenSubcategoryName: subcategoryName || undefined,
      changedByRole: session.role === 'CONSULTANT' ? 'CONSULTANT' : 'CLIENT',
      changedByUserId: session.id
    });
    await FirestoreRepository.upsert(authorizedClientId, 'aiCorrections', correction.id, correction as any);

    return res.json({ success: true, message: 'Categorização salva e incorporada ao aprendizado.', updatedTransaction, correction });
  } catch (error) {
    console.error('[TRANSACTION_CATEGORIZE_ERROR]', error instanceof Error ? error.message : 'unknown');
    return res.status(500).json({ success: false, message: 'Não foi possível salvar a categorização.' });
  }
});

router.get('/overrides', requireAuth, async (req: Request, res: Response) => {
  const { authorizedClientId, isAllowed } = resolveAuthorizedClientId(req, req.query.clientId as string);
  if (!isAllowed) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });
  try {
    const corrections = await FirestoreRepository.list(authorizedClientId, 'aiCorrections');
    return res.json({ success: true, clientId: authorizedClientId, overrides: corrections });
  } catch {
    return res.json({ success: true, clientId: authorizedClientId, overrides: [] });
  }
});

export default router;
