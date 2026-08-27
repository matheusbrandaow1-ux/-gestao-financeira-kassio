import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mapLunchMoneyTransaction } from '../server/integrations/lunchmoney/mapper';
import { getAvailableMonths, getMonthInTimeZone } from '../src/lib/monthUtils';
import { transitionMonthlyClose } from '../src/lib/monthlyClose';
import { fxService } from '../src/lib/fxService';

const monthProbe = getAvailableMonths([
  { date: '2026-06-15' },
  { date: '2026-07-15' },
  { date: '2026-08-15' }
], 'desc', false);
assert.deepEqual(monthProbe, ['2026-08', '2026-07', '2026-06']);

async function findCsvFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findCsvFiles(fullPath));
    else if (entry.name.toLowerCase().endsWith('.csv')) files.push(fullPath);
  }
  return files;
}

function extractMonthCounts(content: string): Record<string, number> {
  const counts: Record<string, number> = { '2026-06': 0, '2026-07': 0, '2026-08': 0 };
  for (const line of content.split(/\r?\n/)) {
    const iso = line.match(/2026-(06|07|08)-\d{2}/)?.[0];
    const br = line.match(/\b\d{2}\/(06|07)\/2026\b|\b\d{2}\/08\/2026\b/)?.[0];
    const date = iso || br;
    if (!date) continue;
    const month = iso ? iso.slice(0, 7) : `2026-${date.split('/')[1]}`;
    counts[month] += 1;
  }
  return counts;
}

const csvFiles = await findCsvFiles(process.cwd());
const sourceFiles = csvFiles.filter(file => /nubank|extracto|releve|banc[aá]rio/i.test(path.basename(file)));
if (sourceFiles.length >= 2) {
  const counts = { '2026-06': 0, '2026-07': 0, '2026-08': 0 };
  for (const file of sourceFiles) {
    const fileCounts = extractMonthCounts(await fs.readFile(file, 'utf8'));
    for (const month of Object.keys(counts)) counts[month] += fileCounts[month];
  }
  assert.deepEqual(counts, { '2026-06': 64, '2026-07': 96, '2026-08': 71 });
  assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), 231);
  console.log('FINANCIAL SNAPSHOT COUNTS: PASS');
} else {
  console.log('FINANCIAL SNAPSHOT COUNTS: NOT RUN (real CSV snapshots not present)');
}

const payment = mapLunchMoneyTransaction('kassio-pf', {
  id: 1,
  date: '2026-07-01',
  payee: 'Pagamento recebido',
  original_name: 'Pagamento recebido',
  amount: '-11105.10',
  currency: 'BRL',
  to_base: 1754.61
});
assert.equal(payment.transactionType, 'TRANSFERÊNCIA');
assert.notEqual(payment.transactionType, 'RECEITA');

const iofRefund = mapLunchMoneyTransaction('kassio-pf', {
  id: 2,
  date: '2026-07-02',
  payee: 'IOF de volta de compra',
  amount: '-10',
  currency: 'BRL',
  to_base: 1.58
});
assert.equal(iofRefund.transactionType, 'ESTORNO');
assert.notEqual(iofRefund.transactionType, 'RECEITA');

const brl = mapLunchMoneyTransaction('kassio-pf', {
  id: 3,
  date: '2026-07-03',
  payee: 'Compra BRL',
  amount: '100',
  currency: 'BRL',
  to_base: 15.8
});
const chf = mapLunchMoneyTransaction('kassio-pf', {
  id: 4,
  date: '2026-07-03',
  payee: 'Compra CHF',
  amount: '100',
  currency: 'CHF',
  to_base: 100
});
const brlWithoutProviderRate = mapLunchMoneyTransaction('kassio-pf', {
  id: 5,
  date: '2026-07-03',
  payee: 'Compra sem taxa',
  amount: '100',
  currency: 'BRL'
});
assert.equal(brl.currencyOriginal, 'BRL');
assert.equal(brl.amountOriginal, 100);
assert.equal(brl.amountBase, 15.8);
assert.equal(chf.amountBase, 100);
assert.equal(brlWithoutProviderRate.amountBase, undefined);
assert.notEqual((brl.amountBase || 0) + (chf.amountBase || 0), 200);

const importedIds = new Set<string>();
for (const tx of [payment, iofRefund, brl, chf, payment, iofRefund, brl, chf]) {
  importedIds.add(tx.externalId || tx.id);
}
assert.equal(importedIds.size, 4);

const close = {
  id: 'close-2026-08',
  clientId: 'kassio-pf',
  month: '2026-08',
  status: 'OPEN' as const,
  openedAt: '2026-08-18T00:00:00.000Z',
  validationSummary: {
    accountsReconciled: true,
    transactionCount: 71,
    uncategorizedCount: 0,
    possibleTransfers: 0,
    possibleDuplicates: 0,
    reviewedIncome: 0,
    reviewedExpenses: 0,
    recurringCount: 0,
    plannedVsRealizedChecked: true,
    blockers: []
  }
};
const reviewedClose = transitionMonthlyClose(close, 'REVIEW', 'consultant-1', '2026-08-18T01:00:00.000Z');
const closedClose = transitionMonthlyClose(reviewedClose, 'CLOSED', 'consultant-1', '2026-08-18T02:00:00.000Z');
assert.equal(closedClose.status, 'CLOSED');
assert.equal(closedClose.closedBy, 'consultant-1');

const staleFx = fxService.getRateTable();
assert.equal(staleFx.source, 'FALLBACK');
assert.equal(staleFx.isRealTime, false);
assert.equal(staleFx.isStale, true);
assert.equal(fxService.getRateToCHF('BRL'), 0);
assert.equal(fxService.convert(5770.28, 'BRL', 'CHF'), 0);
assert.notEqual(5781.36 + fxService.convert(5770.28, 'BRL', 'CHF'), 11551.64);
assert.equal(getMonthInTimeZone(new Date('2026-08-31T22:30:00.000Z')), '2026-09');
assert.equal(getMonthInTimeZone(new Date('2026-09-30T22:30:00.000Z')), '2026-10');

console.log('Financial regression checks passed: classification, base currency, month selection, and stable external IDs.');
