import { CurrencyCode, FXRateTable } from '../types';

/**
 * FX Exchange Rate Service
 * 
 * Manages currency conversions for multi-currency investments (BRL, EUR, USD, GBP)
 * into base currency (CHF) for Swiss tax residency and wealth management.
 */

class FXService {
  private static instance: FXService;
  private ratesToCHF: Record<string, number> = { CHF: 1 };
  private lastUpdated: string = 'FALLBACK_NOT_PROVIDER_DATA';
  private source: FXRateTable['source'] = 'FALLBACK';

  private constructor() {}

  public static getInstance(): FXService {
    if (!FXService.instance) {
      FXService.instance = new FXService();
    }
    return FXService.instance;
  }

  public getRateToCHF(currency: string): number {
    const code = (currency || 'CHF').toUpperCase();
    return this.ratesToCHF[code] || 0;
  }

  public hasRateToCHF(currency: string): boolean {
    return this.getRateToCHF(currency) > 0;
  }

  public getExchangeRate(from: string, to: string = 'CHF'): number {
    const fromCode = (from || 'CHF').toUpperCase();
    const toCode = (to || 'CHF').toUpperCase();

    if (fromCode === toCode) return 1.0;

    const fromRateToCHF = this.getRateToCHF(fromCode);
    const toRateToCHF = this.getRateToCHF(toCode);

    if (fromRateToCHF <= 0 || toRateToCHF <= 0) return 0;
    return fromRateToCHF / toRateToCHF;
  }

  public convert(amount: number, from: string, to: string = 'CHF'): number {
    if (!amount || isNaN(amount)) return 0;
    const rate = this.getExchangeRate(from, to);
    if (rate <= 0) return 0;
    return Math.round(amount * rate * 100) / 100;
  }

  public getRateTable(): FXRateTable {
    return {
      baseCurrency: 'CHF',
      rates: { ...this.ratesToCHF },
      lastUpdated: this.lastUpdated,
      source: this.source,
      isStale: this.source !== 'PROVIDER',
      isRealTime: this.source === 'PROVIDER'
    };
  }

  public setProviderRate(currency: string, rateToCHF: number, timestamp: string = new Date().toISOString()): void {
    const code = currency.toUpperCase();
    if (rateToCHF > 0 && Number.isFinite(rateToCHF)) {
      this.ratesToCHF[code] = rateToCHF;
      this.lastUpdated = timestamp;
      this.source = 'PROVIDER';
    }
  }

  public setCachedRate(currency: string, rateToCHF: number, timestamp: string): void {
    const code = currency.toUpperCase();
    if (rateToCHF > 0 && Number.isFinite(rateToCHF)) {
      this.ratesToCHF[code] = rateToCHF;
      this.lastUpdated = timestamp;
      this.source = 'CACHED';
    }
  }

  public setCustomRate(currency: string, rateToCHF: number): void {
    this.setCachedRate(currency, rateToCHF, new Date().toISOString());
  }
}

export interface PersistedFXRate {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  timestamp: string;
  source: string;
  status: string;
}

export function applyPersistedRates(rates: PersistedFXRate[]): void {
  rates
    .filter(rate => rate.quoteCurrency.toUpperCase() === 'CHF' && rate.status === 'VALID')
    .forEach(rate => fxService.setCachedRate(rate.baseCurrency, rate.rate, rate.timestamp));
}

export const fxService = FXService.getInstance();
export const convertToCHF = (amount: number, currency: string) => fxService.convert(amount, currency, 'CHF');
export const getRateToCHF = (currency: string) => fxService.getRateToCHF(currency);
export const hasRateToCHF = (currency: string) => fxService.hasRateToCHF(currency);
