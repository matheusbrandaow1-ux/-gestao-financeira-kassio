import assert from 'node:assert/strict';
import { getConsolidatedNetWorth, getFinancialSummary } from '../src/lib/canonicalFinance';
import { CanonicalTransaction } from '../src/types';

const base = {
  clientId: 'kassio-pf', provider: 'MANUAL' as const, accountId: 'a1', date: '2026-08-01',
  description: '', merchant: '', currency: 'CHF' as const, reviewStatus: 'REVISADA' as const,
  createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z'
};
const tx = (id: string, amount: number, transactionType: CanonicalTransaction['transactionType'], categoryId?: string): CanonicalTransaction => ({
  ...base, id, amount, amountOriginal: amount, transactionType, categoryId
});

let summary = getFinancialSummary([
  tx('income', 1000, 'RECEITA'),
  tx('expense', 200, 'DESPESA'),
  tx('transfer', 500, 'TRANSFERÊNCIA')
]);
assert.equal(summary.income, 1000, 'income without category must count');
assert.equal(summary.expenses, 200, 'expense without category must count');
assert.equal(summary.operatingResult, 800, 'transfer must not affect P&L');
assert.equal(summary.uncategorizedCount, 3);

summary = getFinancialSummary([tx('expense2', 100, 'DESPESA'), tx('refund', 100, 'ESTORNO')]);
assert.equal(summary.grossExpenses, 100);
assert.equal(summary.refunds, 100);
assert.equal(summary.expenses, 0, 'full refund must neutralize expense');

const netWorth = getConsolidatedNetWorth([{
  id: 'br-invest', clientId: 'kassio-pf', name: 'Investimento Brasil', classification: 'ATIVO',
  category: 'INVESTIMENTO_LIQUIDO', value: 25000, originalValue: 25000, baseValue: 3500,
  currency: 'BRL', updatedAt: new Date().toISOString()
}], 'CHF');
assert.equal(netWorth.assets, 3500, 'converted representation must be counted once');
assert.equal(netWorth.netWorth, 3500);

const fxMissing = getConsolidatedNetWorth([{
  id: 'eur-no-fx', clientId: 'kassio-pf', name: 'EUR sem FX', classification: 'ATIVO',
  category: 'OUTRO_ATIVO', value: 1000, currency: 'EUR', updatedAt: new Date().toISOString()
}], 'CHF');
assert.equal(fxMissing.isComplete, false);
assert.equal(fxMissing.unavailableConversionCount, 1);
assert.equal(fxMissing.assets, 0, 'missing FX must be flagged, not invented as a converted amount');

console.log('Canonical finance regression checks passed.');
