import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'http-test-session-secret';
process.env.CONSULTANT_EMAIL = 'consultant@test.invalid';
process.env.CONSULTANT_PASSWORD = 'consultant-password';
process.env.CLIENT_EMAIL = 'client@test.invalid';
process.env.CLIENT_PASSWORD = 'client-password';
process.env.CONSULTANT_CLIENT_IDS = 'kassio-pf';
process.env.LUNCH_MONEY_API_KEY = 'test-only-env-token';
process.env.MONTHLY_CLOSE_TEST_FILE = '/tmp/gestao-financeira-http-close-test.json';
await fs.rm(process.env.MONTHLY_CLOSE_TEST_FILE, { force: true });

const { createApp } = await import('../server');
const app = await createApp();
const server = app.listen(0);
const address = server.address();
assert(address && typeof address !== 'string');
const baseUrl = `http://127.0.0.1:${address.port}`;

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, init);
}

async function login(email: string, password: string): Promise<string> {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert(cookie, 'login must issue a session cookie');
  return cookie.split(';')[0];
}

try {
  const noSession = await request('/api/lunchmoney/integration?clientId=kassio-pf');
  assert.equal(noSession.status, 401);

  const consultantCookie = await login('consultant@test.invalid', 'consultant-password');
  const clientCookie = await login('client@test.invalid', 'client-password');

  const clientOwn = await request('/api/lunchmoney/integration?clientId=kassio-pf', {
    headers: { cookie: clientCookie }
  });
  assert.equal(clientOwn.status, 200);

  const crossClient = await request('/api/lunchmoney/integration?clientId=other-client', {
    headers: { cookie: clientCookie }
  });
  assert.equal(crossClient.status, 403);

  const consultantCrossClient = await request('/api/lunchmoney/integration?clientId=other-client', {
    headers: { cookie: consultantCookie }
  });
  assert.equal(consultantCrossClient.status, 403);

  const clientAdmin = await request('/api/lunchmoney/sync', {
    method: 'POST',
    headers: { cookie: clientCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: 'kassio-pf' })
  });
  assert.equal(clientAdmin.status, 200);

  const clientClose = await request('/api/monthly-close/2026-08', {
    method: 'POST',
    headers: { cookie: clientCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: 'kassio-pf', status: 'OPEN' })
  });
  assert.equal(clientClose.status, 403);

  const openClose = await request('/api/monthly-close/2026-08', {
    method: 'POST',
    headers: { cookie: consultantCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      clientId: 'kassio-pf',
      status: 'OPEN',
      validationSummary: {
        accountsReconciled: true,
        transactionCount: 71,
        uncategorizedCount: 1,
        possibleTransfers: 0,
        possibleDuplicates: 0,
        reviewedIncome: 0,
        reviewedExpenses: 0,
        recurringCount: 0,
        plannedVsRealizedChecked: true,
        blockers: []
      }
    })
  });
  assert.equal(openClose.status, 200);

  const blockedClose = await request('/api/monthly-close/2026-08', {
    method: 'POST',
    headers: { cookie: consultantCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: 'kassio-pf', status: 'REVIEW' })
  });
  assert.equal(blockedClose.status, 200);
  const closeResult = await request('/api/monthly-close/2026-08', {
    method: 'POST',
    headers: { cookie: consultantCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: 'kassio-pf', status: 'CLOSED' })
  });
  assert.equal(closeResult.status, 409);

  const cleanSummary = {
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
  };
  for (const statusValue of ['OPEN', 'REVIEW', 'CLOSED']) {
    const response = await request(`/api/monthly-close/2026-09`, {
      method: 'POST',
      headers: { cookie: consultantCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: 'kassio-pf', status: statusValue, validationSummary: cleanSummary })
    });
    assert.equal(response.status, 200);
  }
  const closedMutation = await request('/api/data/transactions/tx-test', {
    method: 'PUT',
    headers: { cookie: consultantCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: 'kassio-pf', date: '2026-09-15', amount: 10 })
  });
  assert.equal(closedMutation.status, 409);

  const status = await request('/api/lunchmoney/status?clientId=kassio-pf', {
    headers: { cookie: consultantCookie }
  });
  const statusBody = await status.json() as Record<string, unknown>;
  const serialized = JSON.stringify(statusBody);
  assert.equal(status.status, 200);
  assert.equal(serialized.includes('test-only-env-token'), false);
  assert.equal(serialized.includes('Authorization'), false);

  const syncRequest = {
    clientId: 'kassio-pf',
    existingTransactions: [],
    existingAccounts: [],
    existingCategories: [],
    existingRules: [],
    existingRecurring: []
  };
  const firstSync = await request('/api/lunchmoney/sync', {
    method: 'POST',
    headers: { cookie: consultantCookie, 'content-type': 'application/json' },
    body: JSON.stringify(syncRequest)
  });
  assert.equal(firstSync.status, 200);
  const firstSyncBody = await firstSync.json() as any;
  const firstTransactions = firstSyncBody.data.transactions;
  assert.equal(firstTransactions.length, 2);
  assert.equal(firstTransactions.find((tx: any) => tx.externalId === '7001').transactionType, 'TRANSFERÊNCIA');
  assert.equal(JSON.stringify(firstSyncBody).includes('test-only-env-token'), false);

  const secondSync = await request('/api/lunchmoney/sync', {
    method: 'POST',
    headers: { cookie: consultantCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ ...syncRequest, existingTransactions: firstTransactions })
  });
  assert.equal(secondSync.status, 200);
  const secondSyncBody = await secondSync.json() as any;
  assert.equal(secondSyncBody.data.job.transactionsCreated, 0);
  assert.equal(new Set(secondSyncBody.data.transactions.map((tx: any) => tx.externalId)).size, 2);

  const invalidCredential = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'client@test.invalid', password: 'wrong-password' })
  });
  assert.equal(invalidCredential.status, 401);
  const invalidBody = await invalidCredential.json() as { message?: string };
  assert.equal(invalidBody.message, 'Email ou senha inválidos.');

  console.log('HTTP regression checks passed: auth, client isolation, protected endpoints, and token redaction.');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
}
