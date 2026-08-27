import { CanonicalTransaction } from '../types';
import { getCanonicalBaseAmount } from './canonicalFinance';

/** Backward-compatible helper. New aggregate views should use getFinancialSummary(). */
export function getTransactionBaseAmount(transaction: CanonicalTransaction): number {
  return getCanonicalBaseAmount(transaction) ?? 0;
}

export { getCanonicalBaseAmount };
