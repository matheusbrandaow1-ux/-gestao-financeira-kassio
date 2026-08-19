type DataRef = { kind: 'collection' | 'document'; collection: string; clientId?: string; id?: string };
type SnapshotDoc = { id: string; data: () => any };
type CollectionSnapshot = { empty: boolean; docs: SnapshotDoc[]; forEach: (callback: (doc: SnapshotDoc) => void) => void };

export const db = {};

function refFromPath(kind: DataRef['kind'], parts: string[]): DataRef {
  if (parts[0] === 'clients' && parts.length >= 2) {
    if (kind === 'collection' && parts.length === 2) return { kind, collection: 'clients' };
    if (kind === 'document' && parts.length === 2) return { kind, collection: 'clients', id: parts[1] };
    if (parts.length >= 3) return { kind, clientId: parts[1], collection: parts[2], id: parts[3] };
  }
  throw new Error('INVALID_DATA_PATH');
}

export function collection(_db: unknown, ...parts: string[]): DataRef {
  return refFromPath('collection', parts);
}

export function doc(_db: unknown, ...parts: string[]): DataRef {
  return refFromPath('document', parts);
}

async function request(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(path, { credentials: 'include', ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `DATA_API_${response.status}`);
  return body;
}

export async function getDocs(ref: DataRef): Promise<CollectionSnapshot> {
  if (ref.collection === 'clients') {
    const body = await request('/api/data/clients');
    const docs = (body.clients || []).map((item: Record<string, unknown>) => ({ id: String(item.id), data: () => item }));
    return { empty: docs.length === 0, docs, forEach: callback => docs.forEach(callback) };
  }
  const body = await request(`/api/data/${ref.collection}?clientId=${encodeURIComponent(ref.clientId || '')}`);
  const docs = (body.items || []).map((item: Record<string, unknown>) => ({ id: String(item.id), data: () => item }));
  return { empty: docs.length === 0, docs, forEach: callback => docs.forEach(callback) };
}

export async function getDoc(ref: DataRef): Promise<{ exists: () => boolean; data: () => any }> {
  const body = await request(`/api/data/${ref.collection}/${encodeURIComponent(ref.id || '')}?clientId=${encodeURIComponent(ref.clientId || '')}`);
  return { exists: () => Boolean(body.item), data: () => body.item || {} };
}

export async function setDoc(ref: DataRef, data: any, _options?: { merge?: boolean }): Promise<void> {
  if (ref.collection === 'clients' && ref.id) {
    await request(`/api/data/clients/${encodeURIComponent(ref.id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    return;
  }
  await request(`/api/data/${ref.collection}/${encodeURIComponent(ref.id || '')}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, clientId: ref.clientId }) });
}

export async function deleteDoc(ref: DataRef): Promise<void> {
  await request(`/api/data/${ref.collection}/${encodeURIComponent(ref.id || '')}?clientId=${encodeURIComponent(ref.clientId || '')}`, { method: 'DELETE' });
}

export function writeBatch(_db: unknown) {
  const operations: Array<{ ref: DataRef; data: any }> = [];
  return {
    set(ref: DataRef, data: any, _options?: { merge?: boolean }) { operations.push({ ref, data }); },
    async commit() { await Promise.all(operations.map(operation => setDoc(operation.ref, operation.data, { merge: true }))); }
  };
}
