import { Router, Request, Response } from 'express';
import { requireAuth, requireConsultant, resolveAuthorizedClientId } from './auth';
import { MonthlyClose, MonthlyCloseStatus } from '../../src/types';
import { transitionMonthlyClose } from '../../src/lib/monthlyClose';
import { getMonthlyClose, saveMonthlyClose, saveMonthlyCloseAudit } from '../data/monthlyCloseStore';

const router = Router();
router.get('/:month', requireAuth, async (req: Request, res: Response) => {
  const access = resolveAuthorizedClientId(req, req.query.clientId as string);
  if (!access.isAllowed) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso não autorizado.' });
  try {
    const close = await getMonthlyClose(access.authorizedClientId, req.params.month);
    return res.json({ success: true, close: close || null });
  } catch {
    return res.status(503).json({ success: false, code: 'PERSISTENCE_UNAVAILABLE', message: 'Persistência server-side indisponível.' });
  }
});

router.post('/:month', requireConsultant, async (req: Request, res: Response) => {
  const access = resolveAuthorizedClientId(req, req.body?.clientId as string);
  if (!access.isAllowed) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso não autorizado.' });

  const month = req.params.month;
  let existing: MonthlyClose | null;
  try {
    existing = await getMonthlyClose(access.authorizedClientId, month);
  } catch {
    return res.status(503).json({ success: false, code: 'PERSISTENCE_UNAVAILABLE', message: 'Persistência server-side indisponível.' });
  }
  const now = new Date().toISOString();
  const requestedStatus = (req.body?.status || 'OPEN') as MonthlyCloseStatus;
  const base: MonthlyClose = existing || {
    id: `close-${access.authorizedClientId}-${month}`,
    clientId: access.authorizedClientId,
    month,
    status: 'OPEN',
    openedAt: now,
    validationSummary: req.body?.validationSummary || {
      accountsReconciled: false,
      transactionCount: 0,
      uncategorizedCount: 0,
      possibleTransfers: 0,
      possibleDuplicates: 0,
      reviewedIncome: 0,
      reviewedExpenses: 0,
      recurringCount: 0,
      plannedVsRealizedChecked: false,
      blockers: []
    }
  };

  try {
    const actorId = (req as any).user.id;
    const next = requestedStatus === 'OPEN' && base.status === 'CLOSED'
      ? { ...base, status: 'OPEN' as const, reopenedAt: now, reopenedBy: actorId }
      : requestedStatus === base.status ? base : transitionMonthlyClose(base, requestedStatus, actorId, now);
    await saveMonthlyClose(next);
    if (base.status === 'CLOSED' && next.status === 'OPEN') {
      await saveMonthlyCloseAudit(access.authorizedClientId, month, actorId, now);
    }
    return res.json({ success: true, close: next });
  } catch (error) {
    return res.status(409).json({ success: false, code: 'MONTHLY_CLOSE_BLOCKED', message: 'O fechamento mensal possui blockers ou transição inválida.' });
  }
});

export default router;
