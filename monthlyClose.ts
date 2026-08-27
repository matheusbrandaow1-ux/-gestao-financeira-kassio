import { MonthlyClose, MonthlyCloseStatus } from '../types';

export function getCloseBlockers(summary: MonthlyClose['validationSummary']): string[] {
  const blockers = [...summary.blockers];
  if (!summary.accountsReconciled) blockers.push('ACCOUNTS_NOT_RECONCILED');
  if (summary.uncategorizedCount > 0) blockers.push('UNCATEGORIZED_TRANSACTIONS');
  if (summary.possibleDuplicates > 0) blockers.push('POSSIBLE_DUPLICATES');
  return Array.from(new Set(blockers));
}

export function transitionMonthlyClose(
  close: MonthlyClose,
  nextStatus: MonthlyCloseStatus,
  actorId: string,
  now: string = new Date().toISOString()
): MonthlyClose {
  if (nextStatus === 'REVIEW' && close.status !== 'OPEN') {
    throw new Error('INVALID_MONTHLY_CLOSE_TRANSITION');
  }
  if (nextStatus === 'CLOSED') {
    if (close.status !== 'REVIEW') throw new Error('MONTH_MUST_BE_IN_REVIEW');
    const blockers = getCloseBlockers(close.validationSummary);
    if (blockers.length > 0) throw new Error(`MONTH_HAS_BLOCKERS:${blockers.join(',')}`);
    return { ...close, status: 'CLOSED', closedAt: now, closedBy: actorId };
  }
  if (nextStatus === 'REVIEW') return { ...close, status: 'REVIEW', reviewedAt: now };
  return { ...close, status: 'OPEN' };
}
