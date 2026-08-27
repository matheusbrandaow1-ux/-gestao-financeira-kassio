export interface LunchMoneyIntegrationRecord {
  clientId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  connectedAt: string;
  lastValidatedAt: string;
  lunchMoneyUserId?: number | string;
  lunchMoneyBudgetName?: string;
  baseCurrency?: string;
  userName?: string;
  userEmail?: string;
}

export interface PublicLunchMoneyIntegration {
  clientId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  connectedAt?: string;
  lastValidatedAt?: string;
  lunchMoneyUserId?: number | string;
  lunchMoneyBudgetName?: string;
  baseCurrency?: string;
  userName?: string;
  userEmail?: string;
}

const memoryStore: Record<string, LunchMoneyIntegrationRecord> = {};

function getEnvironmentToken(): string | null {
  const token = process.env.LUNCH_MONEY_API_KEY?.trim();
  return token || null;
}

function getOrCreateMetadata(clientId: string): LunchMoneyIntegrationRecord | null {
  const existing = memoryStore[clientId];
  if (existing) return existing;
  if (!getEnvironmentToken()) return null;

  const now = new Date().toISOString();
  const record: LunchMoneyIntegrationRecord = {
    clientId,
    status: 'CONNECTED',
    connectedAt: now,
    lastValidatedAt: now,
    baseCurrency: 'CHF'
  };
  memoryStore[clientId] = record;
  return record;
}

function toPublic(record: LunchMoneyIntegrationRecord): PublicLunchMoneyIntegration {
  return { ...record };
}

export class LunchMoneyIntegrationStore {
  public static getIntegration(clientId: string): LunchMoneyIntegrationRecord | null {
    return getOrCreateMetadata(clientId);
  }

  public static getPublicIntegration(clientId: string): PublicLunchMoneyIntegration | null {
    const record = getOrCreateMetadata(clientId);
    return record ? toPublic(record) : null;
  }

  public static getTokenForClient(clientId: string): string | null {
    const record = getOrCreateMetadata(clientId);
    return record?.status === 'CONNECTED' ? getEnvironmentToken() : null;
  }

  public static saveIntegration(
    clientId: string,
    data: {
      status?: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
      lunchMoneyUserId?: number | string;
      lunchMoneyBudgetName?: string;
      baseCurrency?: string;
      userName?: string;
      userEmail?: string;
    }
  ): PublicLunchMoneyIntegration {
    if (!getEnvironmentToken()) {
      throw new Error('LUNCH_MONEY_API_KEY_NOT_CONFIGURED');
    }

    const existing = getOrCreateMetadata(clientId);
    const now = new Date().toISOString();
    const record: LunchMoneyIntegrationRecord = {
      clientId,
      status: data.status || 'CONNECTED',
      connectedAt: existing?.connectedAt || now,
      lastValidatedAt: now,
      lunchMoneyUserId: data.lunchMoneyUserId ?? existing?.lunchMoneyUserId,
      lunchMoneyBudgetName: data.lunchMoneyBudgetName ?? existing?.lunchMoneyBudgetName,
      baseCurrency: data.baseCurrency?.toUpperCase() || existing?.baseCurrency || 'CHF',
      userName: data.userName ?? existing?.userName,
      userEmail: data.userEmail ?? existing?.userEmail
    };
    memoryStore[clientId] = record;
    return toPublic(record);
  }

  public static disconnectIntegration(clientId: string): void {
    const existing = getOrCreateMetadata(clientId);
    if (existing) {
      existing.status = 'DISCONNECTED';
      existing.lastValidatedAt = new Date().toISOString();
    }
  }

  public static updateValidationTimestamp(clientId: string, userMeta?: { userName?: string; userEmail?: string; budgetName?: string; primaryCurrency?: string }): void {
    const record = getOrCreateMetadata(clientId);
    if (!record) return;
    record.lastValidatedAt = new Date().toISOString();
    record.status = 'CONNECTED';
    if (userMeta?.userName) record.userName = userMeta.userName;
    if (userMeta?.userEmail) record.userEmail = userMeta.userEmail;
    if (userMeta?.budgetName) record.lunchMoneyBudgetName = userMeta.budgetName;
    if (userMeta?.primaryCurrency) record.baseCurrency = userMeta.primaryCurrency.toUpperCase();
  }
}
