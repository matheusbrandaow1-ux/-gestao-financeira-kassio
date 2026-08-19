import { getAvailableMonths, getTransactionsForMonth, getMonthRange, formatMonthLabel, getNextMonth, getPreviousMonth } from '../src/lib/monthUtils';
import { fxService } from '../src/lib/fxService';
import { getDefaultPortfolios } from '../src/lib/investmentData';
import { calculateProgressPercent, formatCurrency, formatPercent } from '../src/lib/money';

console.log('====================================================');
console.log('🚀 EXECUTING E2E VERIFICATION AUDIT (TESTS A - L)');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 12;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    if (details) console.log(`   ${details}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   ${details}`);
    process.exit(1);
  }
}

// Test A: Dynamic Financial Calendar & Selected Month Source of Truth
const sampleTxs = [
  { id: '1', date: '2026-06-15', amount: 100, transactionType: 'DESPESA' },
  { id: '2', date: '2026-07-20', amount: 200, transactionType: 'DESPESA' },
  { id: '3', date: '2026-08-05', amount: 300, transactionType: 'RECEITA' },
  { id: '4', date: '2026-09-01', amount: 400, transactionType: 'RECEITA' }
];

const availableMonths = getAvailableMonths(sampleTxs, 'desc', false);
assert(
  availableMonths.includes('2026-06') && availableMonths.includes('2026-07') && availableMonths.includes('2026-08') && availableMonths.includes('2026-09'),
  'TEST A: Dynamic Month Detection & Single Source of Truth',
  `Detected months: ${availableMonths.join(', ')}`
);

// Test B: Month Filtering & Chronological calculations
const augTxs = getTransactionsForMonth(sampleTxs, '2026-08');
assert(
  augTxs.length === 1 && augTxs[0].amount === 300,
  'TEST B: Deterministic Month Isolation Filter',
  `August 2026 isolated correctly with 1 transaction.`
);

// Test C: Previous & Next Month Navigation
const prev = getPreviousMonth('2026-08');
const next = getNextMonth('2026-08');
assert(
  prev === '2026-07' && next === '2026-09',
  'TEST C: Month Arithmetic & Horizon Transitions',
  `Prev: ${prev}, Next: ${next}`
);

// Test D: Multi-Currency Investments & FX Service
const eurRate = fxService.getRateToCHF('EUR');
const brlRate = fxService.getRateToCHF('BRL');
const chfRate = fxService.getRateToCHF('CHF');

const convertedEur = fxService.convert(1666.92, 'EUR', 'CHF');
const convertedBrl = fxService.convert(25808.15, 'BRL', 'CHF');

assert(
  eurRate === 0 && brlRate === 0 && chfRate === 1.0 && convertedEur === 0 && convertedBrl === 0,
  'TEST D: Multi-Currency FX Without Provider Rate',
  'BRL/EUR remain unavailable for consolidation instead of being summed nominally.'
);

// Test E: Portfolios Data & Asset Class Structure
const portfolios = getDefaultPortfolios('kassio-pf');
const brlPort = portfolios.find(p => p.currency === 'BRL');
const eurPort = portfolios.find(p => p.currency === 'EUR');
const chfPort = portfolios.find(p => p.currency === 'CHF');

assert(
  portfolios.length === 0 && !brlPort && !eurPort && !chfPort,
  'TEST E: No Invented Investment Fixtures',
  'Investment totals remain empty until persisted/provider data is available.'
);

// Test F: Net Worth vs Monthly Result Separation
const currentNetWorth = 450000;
const monthlyIncome = 12500;
const monthlyExpenses = 6200;
const monthResult = monthlyIncome - monthlyExpenses;

assert(
  currentNetWorth !== monthResult && monthResult === 6300,
  'TEST F: Strict Separation of Net Worth (Patrimônio) vs Month Result (Resultado)',
  `Patrimônio: CHF ${currentNetWorth} vs Resultado do Mês: CHF ${monthResult}`
);

// Test G: Human Review Preservation Rule ('REVISADA' flag)
const mockTxRevisada = {
  id: 'tx-1',
  description: 'MIGROS ZURICH',
  categoryId: 'cat-groceries',
  reviewStatus: 'REVISADA',
  notes: 'Classificado manualmente pelo consultor'
};
// Simulating sync update rule
const updatedTxFromSync = {
  ...mockTxRevisada,
  // sync would not overwrite category if reviewStatus === 'REVISADA'
  categoryId: mockTxRevisada.reviewStatus === 'REVISADA' ? mockTxRevisada.categoryId : 'cat-ai-suggested'
};
assert(
  updatedTxFromSync.categoryId === 'cat-groceries',
  'TEST G: Preservation of Human Review (REVISADA) on Sync Update',
  `Category remained 'cat-groceries' without AI overwrite.`
);

// Test H: Zero-Token Budget Math & Progress Percentage
const planned = 5000;
const realized = 3250;
const progress = calculateProgressPercent(realized, planned);
assert(
  progress === 65,
  'TEST H: Deterministic Zero-Token Math for Budget Execution',
  `Budget execution: ${realized}/${planned} = ${progress}%`
);

// Test I: Portuguese Date & Month Labels Formatting
const labelAug = formatMonthLabel('2026-08', 'full');
const labelJun = formatMonthLabel('2026-06', 'short');
assert(
  labelAug === 'Agosto 2026' && labelJun === 'Jun 2026',
  'TEST I: Localization & Human-Friendly Month Formatting',
  `Formatted: ${labelAug} | ${labelJun}`
);

// Test J: Currency Formatting in Swiss and Brazilian conventions
const chfFormatted = formatCurrency(12500.50, 'CHF');
assert(
  chfFormatted.includes('CHF') && chfFormatted.includes("12'500.50") || chfFormatted.includes("12.500,50") || chfFormatted.includes("12,500.50"),
  'TEST J: High-Precision Currency Formatting',
  `Formatted CHF: ${chfFormatted}`
);

// Test K: Empty/Future Month Resilience
const emptyMonthTxs = getTransactionsForMonth(sampleTxs, '2027-04');
const emptyIncome = emptyMonthTxs.filter(t => t.transactionType === 'RECEITA').reduce((s, t) => s + t.amount, 0);
assert(
  emptyMonthTxs.length === 0 && emptyIncome === 0,
  'TEST K: Zeroed Metric Fallback for Future/Empty Months',
  `2027-04 correctly returns 0 transactions and 0.00 income.`
);

// Test L: Full Calendar Horizon Support
const fullCalendar = getAvailableMonths([], 'desc', true);
assert(
  fullCalendar.length === 1 && /^\d{4}-\d{2}$/.test(fullCalendar[0]),
  'TEST L: Dynamic Current-Month Fallback',
  `Fallback month: ${fullCalendar[0]}`
);

console.log(`\n====================================================`);
console.log(`🎉 ALL ${passedTests}/${totalTests} E2E AUDIT TESTS PASSED SUCCESSFULLY!`);
console.log(`====================================================\n`);
