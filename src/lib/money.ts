import { CurrencyCode } from '../types';

// Standard fixed exchange rates relative to CHF (Swiss Franc) base currency
// Can be updated or fetched dynamically if configured
export const EXCHANGE_RATES_TO_CHF: Record<CurrencyCode, number> = {
  CHF: 1.0,
  EUR: 0.94, // 1 EUR = ~0.94 CHF
  USD: 0.88, // 1 USD = ~0.88 CHF
  BRL: 0.16, // 1 BRL = ~0.16 CHF
  GBP: 1.12, // 1 GBP = ~1.12 CHF
};

/**
 * Safely round monetary number to 2 decimal places to avoid floating point anomalies.
 */
export function roundMoney(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Converts any currency amount to target currency using base exchange rates
 */
export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode = 'CHF'
): { converted: number; rate: number } {
  if (from === to) return { converted: roundMoney(amount), rate: 1.0 };
  
  // Convert 'from' -> CHF -> 'to'
  const fromRateToChf = EXCHANGE_RATES_TO_CHF[from] || 1.0;
  const toRateToChf = EXCHANGE_RATES_TO_CHF[to] || 1.0;
  
  const chfValue = amount * fromRateToChf;
  const targetValue = chfValue / toRateToChf;
  const effectiveRate = fromRateToChf / toRateToChf;

  return {
    converted: roundMoney(targetValue),
    rate: roundMoney(effectiveRate * 10000) / 10000
  };
}

/**
 * Format currency with locale standard (e.g. CHF 12'500.00, R$ 12.500,00, etc.)
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'CHF',
  options: { showSymbol?: boolean; compact?: boolean } = {}
): string {
  const { showSymbol = true, compact = false } = options;
  const val = isNaN(amount) ? 0 : amount;

  if (compact && Math.abs(val) >= 1000000) {
    return `${currency} ${(val / 1000000).toFixed(1)}M`;
  }
  if (compact && Math.abs(val) >= 10000) {
    return `${currency} ${(val / 1000).toFixed(1)}k`;
  }

  // Swiss locale uses apostrophe for thousands separator in CHF
  const localeMap: Record<CurrencyCode, string> = {
    CHF: 'de-CH',
    EUR: 'de-DE',
    USD: 'en-US',
    BRL: 'pt-BR',
    GBP: 'en-GB'
  };

  const locale = localeMap[currency] || 'de-CH';

  try {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);

    if (!showSymbol) return formatted;

    // Currency symbol prefixes
    switch (currency) {
      case 'CHF':
        return `CHF ${formatted}`;
      case 'EUR':
        return `€ ${formatted}`;
      case 'USD':
        return `$ ${formatted}`;
      case 'BRL':
        return `R$ ${formatted}`;
      case 'GBP':
        return `£ ${formatted}`;
      default:
        return `${currency} ${formatted}`;
    }
  } catch {
    return `${currency} ${val.toFixed(2)}`;
  }
}

/**
 * Format percentage with 1 decimal place (e.g. "42.5%")
 */
export function formatPercent(value: number): string {
  if (isNaN(value) || !isFinite(value)) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Calculate progress percentage clamped between 0 and 100
 */
export function calculateProgressPercent(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  const pct = (current / target) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}
