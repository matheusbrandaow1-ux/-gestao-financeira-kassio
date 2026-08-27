import { AssetOrLiability, CanonicalAccount, CanonicalTransaction, CurrencyCode } from '../types';
import { fxService } from './fxService';

export interface CanonicalFinancialSummary {
  income: number;
  grossExpenses: number;
  refunds: number;
  expenses: number;
  investments: number;
  redemptions: number;
  operatingResult: number;
  freeCashFlow: number;
  savingsRate: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  uncategorizedCount: number;
  unavailableConversionCount: number;
}

export interface CanonicalNetWorthSummary {
  assets: number;
  liabilities: number;
  netWorth: number;
  baseCurrency: CurrencyCode;
  unavailableConversionCount: number;
  isComplete: boolean;
}

/**
 * Returns a value in the client's base currency without inventing a zero when FX is missing.
 * Provider/base values are preferred because they are auditable snapshots from the source.
 */
export function getCanonicalBaseAmount(transaction: CanonicalTransaction): number | undefined {
  const original = Math.abs(Number(transaction.amountOriginal ?? transaction.amount ?? 0));
  if (transaction.amountBase !== undefined && Number.isFinite(transaction.amountBase)) {
    if (transaction.amountBase !== 0 || original === 0) return Math.abs(transaction.amountBase);
  }
  if (transaction.convertedAmount !== undefined && Number.isFinite(transaction.convertedAmount)) {
    if (transaction.convertedAmount !== 0 || original === 0) return Math.abs(transaction.convertedAmount);
  }

  const currency = String(transaction.currencyOriginal || transaction.currency || 'CHF').toUpperCase();
  if (currency === 'CHF') return original;
  const rate = fxService.getRateToCHF(currency);
  return rate > 0 ? Math.round(original * rate * 100) / 100 : undefined;
}

export function getFinancialSummary(transactions: CanonicalTransaction[]): CanonicalFinancialSummary {
  let income = 0;
  let grossExpenses = 0;
  let refunds = 0;
  let investments = 0;
  let redemptions = 0;
  let unavailableConversionCount = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let uncategorizedCount = 0;

  for (const transaction of transactions) {
    if (!transaction.categoryId || transaction.categoryId === 'cat-none') uncategorizedCount += 1;
    const amount = getCanonicalBaseAmount(transaction);
    if (amount === undefined) {
      unavailableConversionCount += 1;
      continue;
    }

    switch (transaction.transactionType) {
      case 'RECEITA':
        income += amount;
        incomeCount += 1;
        break;
      case 'DESPESA':
        grossExpenses += amount;
        expenseCount += 1;
        break;
      case 'ESTORNO':
        refunds += amount;
        break;
      case 'INVESTIMENTO':
        investments += amount;
        break;
      case 'RESGATE':
        redemptions += amount;
        break;
      // Transfers, card payments, ignored and patrimonial movements do not affect operating P&L.
      default:
        break;
    }
  }

  // Refunds reduce net expenses. If a refund relates to a prior period, net expenses may
  // legitimately become negative in the selected period rather than silently discarding cash flow.
  const expenses = grossExpenses - refunds;
  const operatingResult = income - expenses;
  const freeCashFlow = operatingResult - investments + redemptions;
  const savingsRate = income > 0 ? operatingResult / income : 0;

  return {
    income,
    grossExpenses,
    refunds,
    expenses,
    investments,
    redemptions,
    operatingResult,
    freeCashFlow,
    savingsRate,
    transactionCount: transactions.length,
    incomeCount,
    expenseCount,
    uncategorizedCount,
    unavailableConversionCount
  };
}

export function getCategoryRealizedMap(transactions: CanonicalTransaction[]): Record<string, number> {
  const values: Record<string, number> = {};
  for (const transaction of transactions) {
    if (!transaction.categoryId || transaction.categoryId === 'cat-none') continue;
    const amount = getCanonicalBaseAmount(transaction);
    if (amount === undefined) continue;
    const sign = transaction.transactionType === 'ESTORNO' ? -1 : 1;
    if (!['RECEITA', 'DESPESA', 'INVESTIMENTO', 'ESTORNO'].includes(transaction.transactionType)) continue;
    values[transaction.categoryId] = (values[transaction.categoryId] || 0) + (amount * sign);
  }
  return values;
}

export function getAccountBaseValue(account: CanonicalAccount, baseCurrency: CurrencyCode = 'CHF'): number | undefined {
  const original = Number(account.originalBalance ?? account.balance ?? 0);
  if (account.balanceBase !== undefined && Number.isFinite(account.balanceBase)) {
    if (account.balanceBase !== 0 || original === 0) return account.balanceBase;
  }
  const currency = String(account.originalCurrency || account.currency || baseCurrency).toUpperCase();
  if (currency === baseCurrency) return original;
  const rate = fxService.getExchangeRate(currency, baseCurrency);
  return rate > 0 ? Math.round(original * rate * 100) / 100 : undefined;
}

export function getAssetBaseValue(asset: AssetOrLiability, baseCurrency: CurrencyCode = 'CHF'): number | undefined {
  const original = Math.abs(Number(asset.originalValue ?? asset.value ?? 0));
  if (asset.baseValue !== undefined && Number.isFinite(asset.baseValue)) {
    if (asset.baseValue !== 0 || original === 0) return Math.abs(asset.baseValue);
  }
  const currency = String(asset.currency || baseCurrency).toUpperCase();
  if (currency === baseCurrency) return original;
  const rate = fxService.getExchangeRate(currency, baseCurrency);
  return rate > 0 ? Math.round(original * rate * 100) / 100 : undefined;
}

export function getConsolidatedNetWorth(
  assets: AssetOrLiability[],
  baseCurrency: CurrencyCode = 'CHF'
): CanonicalNetWorthSummary {
  let assetTotal = 0;
  let liabilityTotal = 0;
  let unavailableConversionCount = 0;

  // Each persisted asset is counted once. A converted/base value is presentation, never a second asset.
  for (const asset of assets) {
    const value = getAssetBaseValue(asset, baseCurrency);
    if (value === undefined) {
      unavailableConversionCount += 1;
      continue;
    }
    if (asset.classification === 'PASSIVO') liabilityTotal += value;
    else assetTotal += value;
  }

  return {
    assets: assetTotal,
    liabilities: liabilityTotal,
    netWorth: assetTotal - liabilityTotal,
    baseCurrency,
    unavailableConversionCount,
    isComplete: unavailableConversionCount === 0
  };
}
