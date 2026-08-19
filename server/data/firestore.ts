import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';

let firestore: Firestore | null = null;
let useLocalStore: boolean | null = null;
type LocalStore = Record<string, Record<string, Record<string, Record<string, unknown>>>>;

function localStorePath(): string {
  return process.env.FIRESTORE_FALLBACK_FILE?.trim() || path.join(process.cwd(), '.data', 'firestore-fallback.json');
}

function readLocalStore(): LocalStore {
  try {
    return JSON.parse(fs.readFileSync(localStorePath(), 'utf8')) as LocalStore;
  } catch {
    return {};
  }
}

function writeLocalStore(store: LocalStore): void {
  const target = localStorePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(store), 'utf8');
  fs.renameSync(temporary, target);
}

function hasValidServiceAccountJson(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return typeof parsed.project_id === 'string'
      && typeof parsed.client_email === 'string'
      && typeof parsed.private_key === 'string';
  } catch {
    return false;
  }
}

function hasApplicationCredentials(): boolean {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  return Boolean(credentialsPath && fs.existsSync(credentialsPath));
}

function getFirestoreInstance(): Firestore {
  if (firestore) return firestore;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const hasServiceAccount = Boolean(serviceAccountJson && hasValidServiceAccountJson(serviceAccountJson));
  const hasCredentials = hasServiceAccount || hasApplicationCredentials();

  if (!hasCredentials) {
    useLocalStore = true;
    throw new Error('FIRESTORE_SERVER_CREDENTIALS_NOT_CONFIGURED');
  }

  useLocalStore = false;
  if (!getApps().length) {
    if (hasServiceAccount) {
      initializeApp({ credential: cert(JSON.parse(serviceAccountJson!) as Record<string, string>) });
    } else {
      initializeApp({ credential: applicationDefault() });
    }
  }
  firestore = getFirestore();
  return firestore;
}

function localCollection(clientId: string, collection: string): Record<string, Record<string, unknown>> {
  const store = readLocalStore();
  return store[clientId]?.[collection] || {};
}

function withLocalStore<T>(operation: (store: LocalStore) => T): T {
  return operation(readLocalStore());
}

function shouldUseLocalStore(): boolean {
  if (useLocalStore !== null) return useLocalStore;
  try {
    getFirestoreInstance();
  } catch (error) {
    if ((error as Error).message === 'FIRESTORE_SERVER_CREDENTIALS_NOT_CONFIGURED') return true;
    throw error;
  }
  return false;
}

function assertCollection(collection: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(collection)) throw new Error('INVALID_COLLECTION');
}

function assertDocumentId(id: string): void {
  if (!id || id.includes('/')) throw new Error('INVALID_DOCUMENT_ID');
}

export class FirestoreRepository {
  public static async list<T>(clientId: string, collection: string): Promise<Array<T & { id: string }>> {
    assertCollection(collection);
    if (shouldUseLocalStore()) {
      return Object.entries(localCollection(clientId, collection)).map(([id, data]) => ({ id, ...data }) as T & { id: string });
    }
    const snapshot = await getFirestoreInstance().collection('clients').doc(clientId).collection(collection).get();
    return snapshot.docs.map(document => ({ id: document.id, ...document.data() as T }));
  }

  public static async get<T>(clientId: string, collection: string, id: string): Promise<(T & { id: string }) | null> {
    assertCollection(collection);
    assertDocumentId(id);
    if (shouldUseLocalStore()) {
      const document = localCollection(clientId, collection)[id];
      return document ? ({ id, ...document } as T & { id: string }) : null;
    }
    const document = await getFirestoreInstance().collection('clients').doc(clientId).collection(collection).doc(id).get();
    return document.exists ? ({ id: document.id, ...document.data() as T } as T & { id: string }) : null;
  }

  public static async upsert<T extends Record<string, unknown>>(clientId: string, collection: string, id: string, data: T): Promise<void> {
    assertCollection(collection);
    assertDocumentId(id);
    if (shouldUseLocalStore()) {
      withLocalStore(store => {
        store[clientId] ||= {};
        store[clientId][collection] ||= {};
        store[clientId][collection][id] = { ...(store[clientId][collection][id] || {}), ...data };
        writeLocalStore(store);
      });
      return;
    }
    await getFirestoreInstance().collection('clients').doc(clientId).collection(collection).doc(id).set(data, { merge: true });
  }

  public static async remove(clientId: string, collection: string, id: string): Promise<void> {
    assertCollection(collection);
    assertDocumentId(id);
    if (shouldUseLocalStore()) {
      withLocalStore(store => {
        if (store[clientId]?.[collection]?.[id]) {
          delete store[clientId][collection][id];
          writeLocalStore(store);
        }
      });
      return;
    }
    await getFirestoreInstance().collection('clients').doc(clientId).collection(collection).doc(id).delete();
  }

  public static async setClient(clientId: string, data: Record<string, unknown>): Promise<void> {
    assertDocumentId(clientId);
    if (shouldUseLocalStore()) {
      withLocalStore(store => {
        store[clientId] ||= {};
        store[clientId]._profile ||= {};
        store[clientId]._profile.profile = { ...(store[clientId]._profile.profile || {}), ...data };
        writeLocalStore(store);
      });
      return;
    }
    await getFirestoreInstance().collection('clients').doc(clientId).set(data, { merge: true });
  }

  public static async listClients(clientIds: string[]): Promise<Array<Record<string, unknown> & { id: string }>> {
    if (shouldUseLocalStore()) {
      return clientIds.flatMap(clientId => {
        const profile = localCollection(clientId, '_profile').profile;
        return profile ? [{ id: clientId, ...profile }] : [];
      });
    }
    const results = await Promise.all(clientIds.map(async clientId => {
      const document = await getFirestoreInstance().collection('clients').doc(clientId).get();
      return document.exists ? { id: document.id, ...document.data() } as Record<string, unknown> & { id: string } : null;
    }));
    return results.filter((client): client is Record<string, unknown> & { id: string } => client !== null);
  }
}
