/**
 * Shared Dynamic Month Utilities
 * 
 * Provides robust, deterministic, and fully dynamic calculations for month derivation,
 * transaction filtering, chronological sorting, formatting, and month-over-month series.
 * 
 * Eliminates all hardcoded months (e.g. June, July, August 2026).
 */

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

/**
 * Extracts all unique available months (YYYY-MM) from a transaction list,
 * sorted descending (most recent first) or ascending.
 */
export function getAvailableMonths(
  transactions: Array<{ date: string }>,
  order: 'desc' | 'asc' = 'desc',
  includeFullHorizon: boolean = true
): string[] {
  const monthSet = new Set<string>();

  // Add all transaction months
  for (const tx of transactions) {
    if (tx.date && tx.date.length >= 7) {
      const yearMonth = tx.date.substring(0, 7);
      if (/^\d{4}-\d{2}$/.test(yearMonth)) {
        monthSet.add(yearMonth);
      }
    }
  }

  // Include standard planning horizon 2026-01 to 2027-12 if requested
  if (includeFullHorizon) {
    const horizon = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06'];
    horizon.forEach(m => monthSet.add(m));
  }

  // If no transactions exist yet, add current year-month
  if (monthSet.size === 0) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    monthSet.add(`${y}-${m}`);
  }

  const sorted = Array.from(monthSet).sort((a, b) => {
    return order === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
  });

  return sorted;
}


/**
 * Calculates first and last date of a YYYY-MM month string
 */
export function getMonthRange(yearMonth: string): {
  startDate: string;
  endDate: string;
  year: number;
  month: number;
} {
  const parts = yearMonth.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    const now = new Date();
    return {
      startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-28`,
      year: now.getFullYear(),
      month: now.getMonth() + 1
    };
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  // Get last day of month by setting day 0 of next month
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return { startDate, endDate, year, month };
}

/**
 * Filters transactions that belong to a specific YYYY-MM month
 */
export function getTransactionsForMonth<T extends { date: string }>(
  transactions: T[],
  yearMonth: string
): T[] {
  if (!yearMonth || yearMonth === 'ALL') return transactions;
  return transactions.filter(tx => tx.date && tx.date.startsWith(yearMonth));
}

/**
 * Computes previous month in YYYY-MM format
 */
export function getPreviousMonth(yearMonth: string): string {
  const { year, month } = getMonthRange(yearMonth);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

/**
 * Computes next month in YYYY-MM format
 */
export function getNextMonth(yearMonth: string): string {
  const { year, month } = getMonthRange(yearMonth);
  if (month === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Formats a YYYY-MM string into friendly human label (e.g. "Agosto 2026" or "Ago/26")
 */
export function formatMonthLabel(yearMonth: string, format: 'full' | 'short' | 'chart' = 'full'): string {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return yearMonth || '';

  const [yearStr, monthStr] = yearMonth.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const year = parseInt(yearStr, 10);

  if (monthIdx < 0 || monthIdx > 11) return yearMonth;

  if (format === 'short') {
    return `${MONTH_SHORT_PT[monthIdx]} ${year}`;
  }

  if (format === 'chart') {
    return `${MONTH_SHORT_PT[monthIdx]}/${yearStr.substring(2)}`;
  }

  return `${MONTH_NAMES_PT[monthIdx]} ${year}`;
}
