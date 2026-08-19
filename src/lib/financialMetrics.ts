import { CanonicalTransaction } from '../types';
import { convertToCHF } from './fxService';

export function getTransactionBaseAmount(transaction: CanonicalTransaction): number {
  return transaction.amountBase ?? transaction.convertedAmount ?? convertToCHF(transaction.amount, transaction.currency);
}