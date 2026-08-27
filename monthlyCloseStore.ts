import fs from 'node:fs';
import path from 'node:path';
import { FirestoreRepository } from './firestore';
import { MonthlyClose } from '../../src/types';

const TEST_FILE = process.env.MONTHLY_CLOSE_TEST_FILE || path.join('/tmp', 'gestao-financeira-monthly-close-test.json');

type CloseMap = Record<string, MonthlyClose>;

function testRead(): CloseMap {
  try {
    return JSON.parse(fs.readFileSync(TEST_FILE, 'utf8')) as CloseMap;
  } catch {
    return {};
  }
}

function testWrite(data: CloseMap): void {
  fs.writeFileSync(TEST_FILE, JSON.stringify(data), 'utf8');
}

function closeId(clientId: string, month: string): string {
  return `close-${clientId}-${month}`;
}

export async function getMonthlyClose(clientId: string, month: string): Promise<MonthlyClose | null> {
  if (process.env.NODE_ENV === 'test') return testRead()[`${clientId}:${month}`] || null;
  return FirestoreRepository.get<MonthlyClose>(clientId, 'monthlyCloses', closeId(clientId, month));
}

export async function saveMonthlyClose(close: MonthlyClose): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    const data = testRead();
    data[`${close.clientId}:${close.month}`] = close;
    testWrite(data);
    return;
  }
  await FirestoreRepository.upsert(close.clientId, 'monthlyCloses', closeId(close.clientId, close.month), close as unknown as Record<string, unknown>);
}

export async function isMonthlyCloseClosed(clientId: string, month: string): Promise<boolean> {
  const close = await getMonthlyClose(clientId, month);
  return close?.status === 'CLOSED';
}

export async function saveMonthlyCloseAudit(clientId: string, month: string, actorId: string, timestamp: string): Promise<void> {
  const audit = {
    id: `monthly-close-reopen-${clientId}-${month}-${Date.parse(timestamp)}`,
    userId: actorId,
    clientId,
    action: 'REOPEN_MONTHLY_CLOSE',
    entity: 'MONTHLY_CLOSE',
    timestamp,
    source: 'CONSULTANT' as const,
    details: `Período ${month} reaberto pelo consultor.`
  };
  if (process.env.NODE_ENV === 'test') {
    const data = testRead();
    data[`audit:${audit.id}`] = audit as unknown as MonthlyClose;
    testWrite(data);
    return;
  }
  await FirestoreRepository.upsert(clientId, 'auditLogs', audit.id, audit);
}
