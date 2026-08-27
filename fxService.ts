import { FirestoreRepository } from '../../server/data/firestore';

export interface FXRateRecord {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  timestamp: string;
  source: string;
  retrievedAt: string;
  status: 'VALID' | 'STALE' | 'REJECTED';
}

interface FrankfurterResponse {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

const PRIORITY_CURRENCIES = ['BRL', 'EUR'];
const MAX_VARIATION_RATIO = 0.35;
const MAX_AGE_DAYS = 7;

function isValidRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
}

function rateDocumentId(baseCurrency: string, quoteCurrency: string): string {
  return `${baseCurrency.toUpperCase()}_${quoteCurrency.toUpperCase()}`;
}

async function fetchLatestRates(): Promise<FrankfurterResponse> {
  const response = await fetch('https://api.frankfurter.app/latest?from=CHF&to=BRL,EUR');
  if (!response.ok) throw new Error(`FX provider HTTP ${response.status}`);
  return await response.json() as FrankfurterResponse;
}

export class FXRateService {
  public async refreshForClient(clientId: string, currencies: string[]): Promise<FXRateRecord[]> {
    const required = Array.from(new Set(currencies.map(currency => currency.toUpperCase())))
      .filter(currency => currency !== 'CHF' && PRIORITY_CURRENCIES.includes(currency));

    if (required.length === 0) return [];

    let providerData: FrankfurterResponse;
    try {
      providerData = await fetchLatestRates();
    } catch (error) {
      console.warn('[FX] Provider indisponível; taxas anteriores preservadas.', error);
      return [];
    }

    const retrievedAt = new Date().toISOString();
    const timestamp = providerData.date ? `${providerData.date}T00:00:00.000Z` : retrievedAt;
    const records: FXRateRecord[] = [];

    for (const currency of required) {
      const chfPerCurrency = providerData.rates?.[currency];
      const rate = isValidRate(chfPerCurrency) ? 1 / chfPerCurrency : 0;
      const previous = await FirestoreRepository.get<FXRateRecord>(clientId, 'fxRates', rateDocumentId(currency, 'CHF'));

      if (!isValidRate(rate) || !this.isRecent(timestamp) || !this.isSafeVariation(rate, previous?.rate)) {
        if (previous) records.push(previous);
        continue;
      }

      const record: FXRateRecord = {
        baseCurrency: currency,
        quoteCurrency: 'CHF',
        rate,
        timestamp,
        source: 'FRANKFURTER_ECB',
        retrievedAt,
        status: 'VALID'
      };
      await FirestoreRepository.upsert(clientId, 'fxRates', rateDocumentId(currency, 'CHF'), { ...record });
      records.push(record);
    }

    return records;
  }

  public async getRates(clientId: string): Promise<FXRateRecord[]> {
    return FirestoreRepository.list<FXRateRecord>(clientId, 'fxRates');
  }

  private isRecent(timestamp: string): boolean {
    const ageMs = Date.now() - new Date(timestamp).getTime();
    return Number.isFinite(ageMs) && ageMs >= -86400000 && ageMs <= MAX_AGE_DAYS * 86400000;
  }

  private isSafeVariation(rate: number, previousRate?: number): boolean {
    if (!previousRate) return true;
    return Math.abs(rate - previousRate) / previousRate <= MAX_VARIATION_RATIO;
  }
}

export const fxRateService = new FXRateService();
