import { CanonicalTransaction } from '../types';
import { convertToCHF } from './fxService';

export function getTransactionBaseAmount(transaction: CanonicalTransaction): number {
  const hasStoredBaseAmount = transaction.amountBase !== undefined && (
    transaction.amountBase !== 0 || transaction.amount === 0
  );
  const hasStoredConvertedAmount = transaction.convertedAmount !== undefined && (
    transaction.convertedAmount !== 0 || transaction.amount === 0
  );

  return hasStoredBaseAmount
    ? transaction.amountBase!
    : hasStoredConvertedAmount
      ? transaction.convertedAmount!
      : convertToCHF(transaction.amount, transaction.currency);
}