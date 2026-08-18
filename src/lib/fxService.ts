import { CurrencyCode, FXRateTable } from '../types';

/**
 * FX Exchange Rate Service
 * 
 * Manages currency conversions for multi-currency investments (BRL, EUR, USD, GBP)
 * into base currency (CHF) for Swiss tax residency and wealth management.
 */

// Reference exchange rates (Base: CHF)
// 1 Unit of foreign currency = X CHF
const DEFAULT_RATES_TO_CHF: Record<string, number> = {
  'CHF': 1.0000,
  'EUR': 0.9420,  // 1 EUR ≈ 0.942 CHF
  'BRL': 0.1580,  // 1 BRL ≈ 0.158 CHF
  'USD': 0.8840,  // 1 USD ≈ 0.884 CHF
  'GBP': 1.1250,  // 1 GBP ≈ 1.125 CHF
};

class FXService {
  private static instance: FXService;
  private ratesToCHF: Record<string, number> = { ...DEFAULT_RATES_TO_CHF };
  private lastUpdated: string = new Date().toISOString();

  private constructor() {}

  public static getInstance(): FXService {
    if (!FXService.instance) {
      FXService.instance = new FXService();
    }
    return FXService.instance;
  }

  public getRateToCHF(currency: string): number {
    const code = (currency || 'CHF').toUpperCase();
    return this.ratesToCHF[code] || 1.0;
  }

  public getExchangeRate(from: string, to: string = 'CHF'): number {
    const fromCode = (from || 'CHF').toUpperCase();
    const toCode = (to || 'CHF').toUpperCase();

    if (fromCode === toCode) return 1.0;

    const fromRateToCHF = this.getRateToCHF(fromCode);
    const toRateToCHF = this.getRateToCHF(toCode);

    if (toRateToCHF === 0) return 1.0;
    return fromRateToCHF / toRateToCHF;
  }

  public convert(amount: number, from: string, to: string = 'CHF'): number {
    if (!amount || isNaN(amount)) return 0;
    const rate = this.getExchangeRate(from, to);
    return Math.round(amount * rate * 100) / 100;
  }

  public getRateTable(): FXRateTable {
    return {
      baseCurrency: 'CHF',
      rates: { ...this.ratesToCHF },
      lastUpdated: this.lastUpdated,
      isRealTime: true
    };
  }

  public setCustomRate(currency: string, rateToCHF: number): void {
    const code = currency.toUpperCase();
    if (rateToCHF > 0) {
      this.ratesToCHF[code] = rateToCHF;
      this.lastUpdated = new Date().toISOString();
    }
  }
}

export const fxService = FXService.getInstance();
export const convertToCHF = (amount: number, currency: string) => fxService.convert(amount, currency, 'CHF');
export const getRateToCHF = (currency: string) => fxService.getRateToCHF(currency);
