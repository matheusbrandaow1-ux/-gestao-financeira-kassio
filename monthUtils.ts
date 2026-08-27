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

export function getMonthInTimeZone(date: Date, timeZone: string = 'Europe/Zurich'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  return year && month ? `${year}-${month}` : new Date().toISOString().slice(0, 7);
}

export function getCurrentMonth(timeZone: string = 'Europe/Zurich'): string {
  return getMonthInTimeZone(new Date(), timeZone);
}

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

  // Planning months must come from persisted plans, not from a future fixture.
  // This argument remains for API compatibility with existing callers.
  void includeFullHorizon;

  // If no transactions exist yet, add current year-month
  if (monthSet.size === 0) {
    monthSet.add(getCurrentMonth());
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

/**
 * Formata uma data-somente (YYYY-MM-DD) como DD/MM/YYYY sem passar por Date,
 * evitando o deslocamento de fuso do parse UTC de datas sem horário.
 */
export function formatDateLabel(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
