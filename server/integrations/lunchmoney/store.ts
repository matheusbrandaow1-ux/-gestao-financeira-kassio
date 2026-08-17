import fs from 'fs';
import path from 'path';

export interface LunchMoneyIntegrationRecord {
  clientId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  token: string;
  tokenLast4: string;
  connectedAt: string;
  lastValidatedAt: string;
  lunchMoneyUserId?: number | string;
  lunchMoneyBudgetName?: string;
  baseCurrency?: string;
  userName?: string;
  userEmail?: string;
  updatedAt: string;
}

export interface PublicLunchMoneyIntegration {
  clientId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  tokenLast4?: string;
  connectedAt?: string;
  lastValidatedAt?: string;
  lunchMoneyUserId?: number | string;
  lunchMoneyBudgetName?: string;
  baseCurrency?: string;
  userName?: string;
  userEmail?: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'lunchmoney_integrations.json');

// In-memory mirror cache
const memoryStore: Record<string, LunchMoneyIntegrationRecord> = {};

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf-8');
    }
  } catch (err) {
    // Non-fatal, memory store will serve as fallback
  }
}

function loadAllIntegrations(): Record<string, LunchMoneyIntegrationRecord> {
  ensureDataFile();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...memoryStore, ...parsed };
    }
  } catch {
    // Return in-memory fallback
  }
  return { ...memoryStore };
}

function saveAllIntegrations(data: Record<string, LunchMoneyIntegrationRecord>) {
  Object.assign(memoryStore, data);
  ensureDataFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    // Memory store holds data
  }
}

export class LunchMoneyIntegrationStore {
  public static getIntegration(clientId: string): LunchMoneyIntegrationRecord | null {
    const all = loadAllIntegrations();
    if (all[clientId]) {
      return all[clientId];
    }

    // Default initialization for 'kassio-pf' if environment variable LUNCH_MONEY_API_KEY exists
    if (clientId === 'kassio-pf' && process.env.LUNCH_MONEY_API_KEY && process.env.LUNCH_MONEY_API_KEY.trim()) {
      const envKey = process.env.LUNCH_MONEY_API_KEY.trim();
      const last4 = envKey.slice(-4);
      const fallbackRecord: LunchMoneyIntegrationRecord = {
        clientId: 'kassio-pf',
        status: 'CONNECTED',
        token: envKey,
        tokenLast4: last4,
        connectedAt: new Date().toISOString(),
        lastValidatedAt: new Date().toISOString(),
        lunchMoneyBudgetName: 'Kássio — Planejamento Financeiro',
        baseCurrency: 'CHF',
        userName: 'Matheus Brandão Lessa',
        userEmail: 'matheusbrandao.w1@gmail.com',
        updatedAt: new Date().toISOString()
      };
      all[clientId] = fallbackRecord;
      saveAllIntegrations(all);
      return fallbackRecord;
    }

    return null;
  }

  public static getPublicIntegration(clientId: string): PublicLunchMoneyIntegration | null {
    const rec = this.getIntegration(clientId);
    if (!rec) return null;

    return {
      clientId: rec.clientId,
      status: rec.status,
      tokenLast4: rec.tokenLast4,
      connectedAt: rec.connectedAt,
      lastValidatedAt: rec.lastValidatedAt,
      lunchMoneyUserId: rec.lunchMoneyUserId,
      lunchMoneyBudgetName: rec.lunchMoneyBudgetName,
      baseCurrency: rec.baseCurrency,
      userName: rec.userName,
      userEmail: rec.userEmail
    };
  }

  public static getTokenForClient(clientId: string): string | null {
    const rec = this.getIntegration(clientId);
    if (!rec || rec.status !== 'CONNECTED' || !rec.token) {
      return null;
    }
    return rec.token;
  }

  public static saveIntegration(
    clientId: string,
    data: {
      token: string;
      status?: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
      lunchMoneyUserId?: number | string;
      lunchMoneyBudgetName?: string;
      baseCurrency?: string;
      userName?: string;
      userEmail?: string;
    }
  ): PublicLunchMoneyIntegration {
    const all = loadAllIntegrations();
    const now = new Date().toISOString();
    const token = data.token.trim();
    const tokenLast4 = token.slice(-4);

    const existing = all[clientId];
    const record: LunchMoneyIntegrationRecord = {
      clientId,
      status: data.status || 'CONNECTED',
      token,
      tokenLast4,
      connectedAt: existing?.connectedAt || now,
      lastValidatedAt: now,
      lunchMoneyUserId: data.lunchMoneyUserId ?? existing?.lunchMoneyUserId,
      lunchMoneyBudgetName: data.lunchMoneyBudgetName ?? existing?.lunchMoneyBudgetName,
      baseCurrency: data.baseCurrency ? data.baseCurrency.toUpperCase() : existing?.baseCurrency || 'CHF',
      userName: data.userName ?? existing?.userName,
      userEmail: data.userEmail ?? existing?.userEmail,
      updatedAt: now
    };

    all[clientId] = record;
    saveAllIntegrations(all);

    // Audit log without token value
    console.log(`[AUDIT] Lunch Money integration saved for client ${clientId} (token ending in ...${tokenLast4})`);

    return {
      clientId: record.clientId,
      status: record.status,
      tokenLast4: record.tokenLast4,
      connectedAt: record.connectedAt,
      lastValidatedAt: record.lastValidatedAt,
      lunchMoneyUserId: record.lunchMoneyUserId,
      lunchMoneyBudgetName: record.lunchMoneyBudgetName,
      baseCurrency: record.baseCurrency,
      userName: record.userName,
      userEmail: record.userEmail
    };
  }

  public static disconnectIntegration(clientId: string): void {
    const all = loadAllIntegrations();
    if (all[clientId]) {
      all[clientId].status = 'DISCONNECTED';
      all[clientId].token = '';
      all[clientId].updatedAt = new Date().toISOString();
      saveAllIntegrations(all);
      console.log(`[AUDIT] Lunch Money integration disconnected for client ${clientId}`);
    }
  }

  public static updateValidationTimestamp(clientId: string, userMeta?: { userName?: string; userEmail?: string; budgetName?: string; primaryCurrency?: string }): void {
    const all = loadAllIntegrations();
    if (all[clientId]) {
      all[clientId].lastValidatedAt = new Date().toISOString();
      all[clientId].status = 'CONNECTED';
      if (userMeta) {
        if (userMeta.userName) all[clientId].userName = userMeta.userName;
        if (userMeta.userEmail) all[clientId].userEmail = userMeta.userEmail;
        if (userMeta.budgetName) all[clientId].lunchMoneyBudgetName = userMeta.budgetName;
        if (userMeta.primaryCurrency) all[clientId].baseCurrency = userMeta.primaryCurrency.toUpperCase();
      }
      saveAllIntegrations(all);
    }
  }
}
