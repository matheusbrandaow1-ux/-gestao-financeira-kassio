import React from 'react';
import { CanonicalTransaction, CanonicalAccount } from '../../types';

/*
 * apurato · marcadores de proveniência v1.0
 * "Marcador é rastro, não enfeite": um marcador só é exibido quando a
 * condição é verdadeira no dado persistido — nunca por estética.
 *
 *  SINCRONIZADO — dado trazido pela integração (Lunch Money)
 *  MANUAL       — registro ou classificação feita por pessoa
 *  CONVERTIDO   — valor convertido por FX; o original aparece sempre junto
 *  CONCILIADO   — verificado contra a fonte canônica
 */

export type ProvenanceKind = 'sincronizado' | 'manual' | 'convertido' | 'conciliado';

const ICONS: Record<ProvenanceKind, React.ReactNode> = {
  sincronizado: (
    <>
      <path d="M 5 10 a 6 6 0 0 1 10.4 -2.6" />
      <path d="M 15.5 4.5 L 15.6 7.6 L 12.5 7.5" />
      <path d="M 16 11 a 6 6 0 0 1 -10.4 2.6" />
      <path d="M 5.5 16.5 L 5.4 13.4 L 8.5 13.5" />
    </>
  ),
  manual: (
    <>
      <path d="M 5 16 L 6.2 12.2 L 13.6 4.8 A 1.6 1.6 0 0 1 15.9 7.1 L 8.5 14.5 Z" />
      <path d="M 6.2 12.2 L 8.5 14.5" />
    </>
  ),
  convertido: (
    <>
      <path d="M 4 7.5 L 15 7.5" />
      <path d="M 12.4 4.8 L 15.2 7.5 L 12.4 10.2" />
      <path d="M 17 13.5 L 6 13.5" />
      <path d="M 8.6 10.8 L 5.8 13.5 L 8.6 16.2" />
    </>
  ),
  conciliado: (
    <>
      <circle cx="10.5" cy="10.5" r="7.5" />
      <path d="M 7.2 10.6 L 9.7 13 L 14 7.9" />
    </>
  ),
};

const LABELS: Record<ProvenanceKind, string> = {
  sincronizado: 'Sincronizado',
  manual: 'Manual',
  convertido: 'Convertido',
  conciliado: 'Conciliado',
};

const TITLES: Record<ProvenanceKind, string> = {
  sincronizado: 'Dado trazido pela integração bancária',
  manual: 'Registro ou classificação feita por pessoa',
  convertido: 'Valor convertido por câmbio; o original acompanha',
  conciliado: 'Verificado contra a fonte canônica',
};

interface ProvenanceTagProps {
  kind: ProvenanceKind;
  /** Detalhe factual exibido no tooltip (ex.: data da sincronização ou da taxa FX). */
  detail?: string;
  compact?: boolean;
  className?: string;
}

export const ProvenanceTag: React.FC<ProvenanceTagProps> = ({ kind, detail, compact = false, className }) => (
  <span
    title={detail ? `${TITLES[kind]} · ${detail}` : TITLES[kind]}
    className={`inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-blue-300 ${className ?? ''}`}
  >
    <svg
      viewBox="0 0 21 21"
      className="h-3 w-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[kind]}
    </svg>
    {!compact && <span>{LABELS[kind]}</span>}
    <span className="sr-only">{compact ? LABELS[kind] : ''}</span>
  </span>
);

/**
 * Deriva os marcadores verdadeiros de uma transação persistida.
 * Retorna no máximo dois: origem (sincronizado/manual) + convertido quando houver FX.
 */
export function transactionProvenance(tx: CanonicalTransaction): Array<{ kind: ProvenanceKind; detail?: string }> {
  const tags: Array<{ kind: ProvenanceKind; detail?: string }> = [];

  const isSynced = tx.provider === 'LUNCH_MONEY' || tx.provider === 'lunch_money';
  if (tx.reviewStatus === 'REVISADA') {
    tags.push({ kind: 'manual', detail: 'classificação revisada por pessoa' });
  } else if (isSynced) {
    tags.push({
      kind: 'sincronizado',
      detail: tx.lastSyncedAt ? `sincronizado em ${formatDateTime(tx.lastSyncedAt)}` : undefined,
    });
  } else if (tx.provider === 'MANUAL') {
    tags.push({ kind: 'manual', detail: 'lançamento manual' });
  }

  if (tx.currencyOriginal && tx.currencyOriginal !== tx.currency && typeof tx.amountOriginal === 'number') {
    tags.push({
      kind: 'convertido',
      detail: tx.exchangeRate ? `taxa ${tx.exchangeRate}` : undefined,
    });
  }

  return tags;
}

/** Deriva os marcadores verdadeiros de uma conta persistida. */
export function accountProvenance(account: CanonicalAccount): Array<{ kind: ProvenanceKind; detail?: string }> {
  const tags: Array<{ kind: ProvenanceKind; detail?: string }> = [];

  if (account.provider === 'LUNCH_MONEY') {
    tags.push({
      kind: 'sincronizado',
      detail: account.lastSyncedAt ? `sincronizado em ${formatDateTime(account.lastSyncedAt)}` : undefined,
    });
  } else {
    tags.push({ kind: 'manual', detail: 'conta cadastrada manualmente' });
  }

  // convertido só quando existe valor convertido persistido — e ele deve ser
  // exibido ao lado do original (marcador é rastro, não enfeite)
  if (
    account.originalCurrency &&
    account.baseCurrency &&
    account.originalCurrency !== account.baseCurrency &&
    typeof account.balanceBase === 'number'
  ) {
    tags.push({
      kind: 'convertido',
      detail: account.fxRateTimestamp ? `FX de ${formatDateTime(account.fxRateTimestamp)}` : account.fxSource,
    });
  }

  return tags;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
