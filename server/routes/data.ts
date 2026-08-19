import { Router, Request, Response } from 'express';
import { FirestoreRepository } from '../data/firestore';
import { isMonthlyCloseClosed } from '../data/monthlyCloseStore';
import { requireAuth, requireConsultant, resolveAuthorizedClientId } from './auth';

const router = Router();
const allowedCollections = new Set([
  'accounts', 'transactions', 'categories', 'rules', 'monthlyPlans', 'goals',
  'assets', 'recurringItems', 'pendingItems', 'syncJobs', 'auditLogs'
]);

function getAuthorizedClient(req: Request, requestedClientId?: string): string | null {
  const access = resolveAuthorizedClientId(req, requestedClientId);
  return access.isAllowed ? access.authorizedClientId : null;
}

function validateCollection(collection: string): boolean {
  return allowedCollections.has(collection);
}

router.get('/clients', requireAuth, async (req: Request, res: Response) => {
  const session = (req as any).user;
  const clientId = getAuthorizedClient(req, req.query.clientId as string);
  if (!clientId) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso não autorizado.' });
  try {
    const clients = session.role === 'CLIENT'
      ? await FirestoreRepository.listClients([clientId])
      : await FirestoreRepository.listClients((process.env.CONSULTANT_CLIENT_IDS || '').split(',').map(value => value.trim()).filter(Boolean));
    return res.json({ success: true, clients });
  } catch {
    return res.status(503).json({ success: false, code: 'PERSISTENCE_UNAVAILABLE', message: 'Persistência server-side indisponível.' });
  }
});

router.put('/clients/:id', requireConsultant, async (req: Request, res: Response) => {
  const clientId = getAuthorizedClient(req, req.params.id);
  if (!clientId || clientId !== req.params.id) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso não autorizado.' });
  try {
    await FirestoreRepository.setClient(clientId, { ...req.body, id: clientId });
    return res.json({ success: true });
  } catch {
    return res.status(503).json({ success: false, code: 'PERSISTENCE_UNAVAILABLE', message: 'Persistência server-side indisponível.' });
  }
});

router.get('/:collection', requireAuth, async (req: Request, res: Response) => {
  if (!validateCollection(req.params.collection)) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Coleção não disponível.' });
  const clientId = getAuthorizedClient(req, req.query.clientId as string);
  if (!clientId) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso não autorizado.' });
  try {
    const items = await FirestoreRepository.list(clientId, req.params.collection);
    return res.json({ success: true, clientId, items });
  } catch {
    return res.status(503).json({ success: false, code: 'PERSISTENCE_UNAVAILABLE', message: 'Persistência server-side indisponível.' });
  }
});

router.get('/:collection/:id', requireAuth, async (req: Request, res: Response) => {
  if (!validateCollection(req.params.collection)) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Coleção não disponível.' });
  const clientId = getAuthorizedClient(req, req.query.clientId as string);
  if (!clientId) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso não autorizado.' });
  try {
    const item = await FirestoreRepository.get(clientId, req.params.collection, req.params.id);
    return item ? res.json({ success: true, item }) : res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Registro não encontrado.' });
  } catch {
    return res.status(503).json({ success: false, code: 'PERSISTENCE_UNAVAILABLE', message: 'Persistência server-side indisponível.' });
  }
});

router.put('/:collection/:id', requireConsultant, async (req: Request, res: Response) => {
  if (!validateCollection(req.params.collection)) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Coleção não disponível.' });
  const clientId = getAuthorizedClient(req, req.body?.clientId as string);
  if (!clientId) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso não autorizado.' });
  try {
    if (req.params.collection === 'transactions' && typeof req.body?.date === 'string' && await isMonthlyCloseClosed(clientId, req.body.date.slice(0, 7))) {
      return res.status(409).json({ success: false, code: 'MONTH_CLOSED', message: 'Período mensal fechado; reabra-o antes de alterar transações.' });
    }
    await FirestoreRepository.upsert(clientId, req.params.collection, req.params.id, { ...req.body, clientId });
    return res.json({ success: true });
  } catch {
    return res.status(503).json({ success: false, code: 'PERSISTENCE_UNAVAILABLE', message: 'Persistência server-side indisponível.' });
  }
});

router.delete('/:collection/:id', requireConsultant, async (req: Request, res: Response) => {
  if (!validateCollection(req.params.collection)) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Coleção não disponível.' });
  const clientId = getAuthorizedClient(req, req.query.clientId as string);
  if (!clientId) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso não autorizado.' });
  try {
    if (req.params.collection === 'transactions') {
      const transaction = await FirestoreRepository.get<{ date?: string }>(clientId, 'transactions', req.params.id);
      if (transaction?.date && await isMonthlyCloseClosed(clientId, transaction.date.slice(0, 7))) {
        return res.status(409).json({ success: false, code: 'MONTH_CLOSED', message: 'Período mensal fechado; reabra-o antes de alterar transações.' });
      }
    }
    await FirestoreRepository.remove(clientId, req.params.collection, req.params.id);
    return res.json({ success: true });
  } catch {
    return res.status(503).json({ success: false, code: 'PERSISTENCE_UNAVAILABLE', message: 'Persistência server-side indisponível.' });
  }
});

export default router;
