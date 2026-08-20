import React, { useMemo } from 'react';
import { AlertTriangle, CalendarDays, ClipboardCheck, Coins, ShieldCheck } from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { formatCurrency } from '../lib/money';
import { convertToCHF, hasRateToCHF } from '../lib/fxService';
import { getTransactionBaseAmount } from '../lib/financialMetrics';
import { getOriginalInvestmentValue, isInvestmentAsset } from '../lib/investmentData';

const SNAPSHOT_DATE = '20/08/2026';

const analyticalGroups = [
  { key: 'essenciais', label: 'Fixos essenciais', terms: ['moradia', 'aluguel', 'energia', 'água', 'luz', 'saúde', 'telecom'] },
  { key: 'fixos', label: 'Fixos', terms: ['assinatura', 'streaming', 'serviço', 'academia', 'tarifa'] },
  { key: 'variaveis', label: 'Variáveis', terms: ['alimentação', 'supermercado', 'transporte', 'lazer', 'viagem', 'restaurante'] }
] as const;

function groupForCategory(name: string): string {
  const normalized = name.toLocaleLowerCase('pt-BR');
  return analyticalGroups.find(group => group.terms.some(term => normalized.includes(term)))?.key || 'variaveis';
}

export const ConceptAssemblyView: React.FC = () => {
  const { activeClient, accounts, assets, categories, goals, transactions, monthlyPlan, recurringItems } = useClient();
  const currency = activeClient.baseCurrency;
  const monthTransactions = transactions.filter(transaction => transaction.date.startsWith('2026-08'));

  const investmentAssets = useMemo(() => assets.filter(isInvestmentAsset), [assets]);
  const currencyTotals = useMemo(() => {
    return (['BRL', 'EUR', 'CHF'] as const).map(code => ({
      code,
      value: investmentAssets
        .filter(asset => asset.currency === code)
        .reduce((sum, asset) => sum + getOriginalInvestmentValue(asset), 0)
    }));
  }, [investmentAssets]);

  const patrimonial = useMemo(() => {
    const values = assets.reduce((result, asset) => {
      const original = asset.originalValue ?? asset.value;
      const comparable = asset.baseValue ?? (asset.currency === currency || hasRateToCHF(asset.currency) ? convertToCHF(original, asset.currency) : undefined);
      if (comparable === undefined) result.complete = false;
      if (asset.classification === 'ATIVO') result.assets += comparable ?? 0;
      else result.liabilities += comparable ?? 0;
      return result;
    }, { assets: 0, liabilities: 0, complete: true });
    return { ...values, netWorth: values.complete ? values.assets - values.liabilities : undefined };
  }, [assets, currency]);

  const budget = useMemo(() => {
    const result = new Map<string, number>();
    monthTransactions.filter(transaction => transaction.transactionType === 'DESPESA').forEach(transaction => {
      const category = transaction.categoryName || categories.find(item => item.id === transaction.categoryId)?.name || 'Sem categoria';
      const key = groupForCategory(category);
      result.set(key, (result.get(key) || 0) + Math.abs(getTransactionBaseAmount(transaction)));
    });
    const income = monthTransactions
      .filter(transaction => transaction.transactionType === 'RECEITA')
      .reduce((sum, transaction) => sum + getTransactionBaseAmount(transaction), 0);
    const investments = monthTransactions
      .filter(transaction => transaction.transactionType === 'INVESTIMENTO')
      .reduce((sum, transaction) => sum + Math.abs(getTransactionBaseAmount(transaction)), 0);
    return { income, investments, values: result };
  }, [categories, monthTransactions]);

  const liquidity = accounts
    .filter(account => ['CHECKING', 'SAVINGS', 'CASH'].includes(account.type))
    .reduce((sum, account) => sum + Math.max(0, account.balanceBase ?? (account.currency === currency || hasRateToCHF(account.currency) ? convertToCHF(account.originalBalance ?? account.balance, account.currency) : 0)), 0);
  const reserveExpenses = (budget.values.get('essenciais') || 0) + (budget.values.get('fixos') || 0) + (budget.values.get('variaveis') || 0);
  const reserveMonths = reserveExpenses > 0 ? liquidity / reserveExpenses : undefined;
  const reserveMinimum = reserveExpenses > 0 ? reserveExpenses * (reserveMonths !== undefined && reserveMonths >= 3 ? 6 : reserveMonths !== undefined && reserveMonths >= 1 ? 4 : 3) : undefined;
  const reserveIdeal = reserveExpenses > 0 ? reserveExpenses * 12 : undefined;
  const investmentFxComplete = investmentAssets.every(asset => asset.currency === currency || hasRateToCHF(asset.currency));

  const suggestedAportes = goals.reduce((sum, goal) => sum + Math.max(0, goal.monthlyContribution), 0);
  const protectionBudget = budget.income > 0 ? budget.income * 0.05 : undefined;
  const recurringContract = recurringItems.find(item => /w1|acompanhamento/i.test(item.name));

  return (
    <div className="wealth-view space-y-8 pb-12">
      <header className="border-b border-slate-800/80 pb-7">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
          <ClipboardCheck className="h-3.5 w-3.5" />
          <span>Relatório consultivo · Apresentação derivada</span>
        </div>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100">Montagem do Conceito — {activeClient.name}</h1>
            <p className="mt-1 text-sm text-slate-400">Leitura patrimonial e orçamentária em moeda base {currency}, sem alterar as fontes originais.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400"><CalendarDays className="h-4 w-4" /> {SNAPSHOT_DATE}</div>
        </div>
      </header>

      <Notice>Montagem IS ONE-TIME: PARTIAL — persistence unavailable without structural database change. Esta apresentação não cria snapshot persistente nem se atualiza por automação.</Notice>

      <section className="border-b border-slate-800/80 pb-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">01 · Resumo executivo</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Esta apresentação é uma leitura única dos dados disponíveis no aplicativo. Recomendações que exigem dados pessoais, benchmark local ou contrato confirmado permanecem como validação consultiva.</p>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div><p className="text-xs text-slate-500">Patrimônio líquido comparável</p><p className="mt-1 font-mono text-xl text-slate-100">{patrimonial.netWorth === undefined ? 'Indisponível' : formatCurrency(patrimonial.netWorth, currency)}</p></div>
          <div><p className="text-xs text-slate-500">Liquidez</p><p className="mt-1 font-mono text-xl text-slate-100">{formatCurrency(liquidity, currency)}</p></div>
          <div><p className="text-xs text-slate-500">Aportes existentes</p><p className="mt-1 font-mono text-xl text-slate-100">{formatCurrency(suggestedAportes, currency)}/mês</p></div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionTitle icon={<Coins />} label="02 · Panorama patrimonial" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DataTable rows={[
            ['Ativos', patrimonial.complete ? formatCurrency(patrimonial.assets, currency) : 'Conversão CHF indisponível'],
            ['Passivos', patrimonial.complete ? formatCurrency(patrimonial.liabilities, currency) : 'Conversão CHF indisponível'],
            ['Investimentos', `${investmentAssets.length} posições únicas`],
            ['Liquidez', formatCurrency(liquidity, currency)]
          ]} />
          <DataTable rows={currencyTotals.map(item => [item.code, formatCurrency(item.value, item.code)])} />
        </div>
        {!patrimonial.complete && <Notice>Conversão CHF indisponível; valores originais permanecem preservados.</Notice>}
      </section>

      <section className="space-y-5">
        <SectionTitle icon={<Coins />} label="03 · Orçamento atual x conceito sugerido" />
        <div className="overflow-x-auto border-y border-slate-800/80"><table className="w-full min-w-[560px] text-left text-xs"><thead className="border-b border-slate-800 text-slate-500"><tr><th className="py-3">Grupo analítico</th><th className="py-3 text-right">Atual</th><th className="py-3 text-right">Sugerido</th><th className="py-3 text-right">Diferença</th></tr></thead><tbody className="divide-y divide-slate-800/60"><tr><td className="py-3 text-slate-300">Renda</td><td className="py-3 text-right font-mono">{formatCurrency(budget.income, currency)}</td><td className="py-3 text-right text-slate-500">Revisão consultiva necessária</td><td /></tr>{analyticalGroups.map(group => { const current = budget.values.get(group.key) || 0; return <tr key={group.key}><td className="py-3 text-slate-300">{group.label}</td><td className="py-3 text-right font-mono">{formatCurrency(current, currency)}</td><td className="py-3 text-right text-slate-500">Revisão consultiva necessária</td><td className="py-3 text-right text-slate-500">—</td></tr>; })}<tr><td className="py-3 text-slate-300">Investimentos</td><td className="py-3 text-right font-mono">{formatCurrency(budget.investments, currency)}</td><td className="py-3 text-right text-slate-500">{formatCurrency(suggestedAportes, currency)}</td><td className="py-3 text-right font-mono">{formatCurrency(suggestedAportes - budget.investments, currency)}</td></tr></tbody></table></div>
        <p className="text-xs text-slate-500">O planejamento persistido não foi alterado. Os agrupamentos acima são exclusivamente analíticos.</p>
      </section>

      <section className="space-y-5">
        <SectionTitle icon={<ShieldCheck />} label="04 · Reserva de emergência" />
        {reserveMinimum === undefined || reserveIdeal === undefined || reserveMonths === undefined ? <Notice>Dados insuficientes para calcular a reserva com segurança.</Notice> : <DataTable rows={[[`Reserva atual`, formatCurrency(liquidity, currency)], ['Cobertura', `${reserveMonths.toFixed(1)} meses`], ['Reserva mínima', formatCurrency(reserveMinimum, currency)], ['Reserva ideal', formatCurrency(reserveIdeal, currency)], ['Gap mínimo', formatCurrency(Math.max(0, reserveMinimum - liquidity), currency)], ['Gap ideal', formatCurrency(Math.max(0, reserveIdeal - liquidity), currency)]]} />}
        <p className="text-xs text-slate-500">Benchmark a definir pelo consultor para o contexto CHF.</p>
      </section>

      <section className="space-y-5">
        <SectionTitle icon={<CalendarDays />} label="05 · Objetivos e plano de aportes" />
        {goals.length === 0 ? <Notice>Nenhum objetivo existente disponível.</Notice> : <div className="overflow-x-auto border-y border-slate-800/80"><table className="w-full min-w-[640px] text-left text-xs"><thead className="border-b border-slate-800 text-slate-500"><tr><th className="py-3">Objetivo existente</th><th className="py-3">Status</th><th className="py-3 text-right">Acumulado / alvo</th><th className="py-3 text-right">Aporte mensal</th><th className="py-3">Recomendação</th></tr></thead><tbody className="divide-y divide-slate-800/60">{goals.map(goal => <tr key={goal.id}><td className="py-3 text-slate-300">{goal.name}<div className="text-[10px] text-slate-500">{goal.currency}</div></td><td className="py-3 text-slate-400">{goal.status}</td><td className="py-3 text-right font-mono">{formatCurrency(goal.currentAmount, goal.currency)} / {formatCurrency(goal.targetAmount, goal.currency)}</td><td className="py-3 text-right font-mono">{formatCurrency(goal.monthlyContribution, goal.currency)}</td><td className="py-3 text-slate-400">{goal.status === 'CONCLUIDO' ? 'MANTER' : 'REVISAR'}</td></tr>)}</tbody></table></div>}
        <p className="text-sm text-slate-300">Total de aportes sugeridos pelos objetivos existentes: <strong className="font-mono text-slate-100">{formatCurrency(suggestedAportes, currency)}/mês</strong></p>
      </section>

      <section className="space-y-5">
        <SectionTitle icon={<AlertTriangle />} label="06 · Aposentadoria, proteção e validações" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Notice>Dados de idade, horizonte e benefício previdenciário não disponíveis.</Notice><Notice>{protectionBudget === undefined ? 'Renda disponível insuficiente para cenário de proteção.' : `Cenário consultivo de proteção: ${formatCurrency(protectionBudget, currency)} (5% da renda).`}</Notice><Notice>{recurringContract ? `Contrato W1 encontrado: ${formatCurrency(recurringContract.amount, recurringContract.currency)}.` : 'Valor do contrato W1 não disponível.'}</Notice></div>
        <ul className="space-y-2 text-xs text-slate-400"><li>• Premissa de rentabilidade a validar.</li><li>• Possíveis inconsistências patrimoniais devem ser revisadas pelo consultor; nenhum dado foi corrigido automaticamente.</li><li>• {investmentFxComplete ? 'Todas as posições de investimento possuem base comparável.' : 'Total consolidado de investimentos indisponível enquanto algumas taxas cambiais não estiverem disponíveis.'}</li></ul>
      </section>
    </div>
  );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 text-sm font-semibold text-slate-100"><span className="text-emerald-300">{icon}</span>{label}</div>;
const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="border-l-2 border-amber-400/70 bg-amber-950/20 px-4 py-3 text-xs leading-5 text-amber-200">{children}</div>;
const DataTable: React.FC<{ rows: string[][] }> = ({ rows }) => <div className="border-y border-slate-800/80 text-xs">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-800/60 py-3 last:border-b-0"><span className="text-slate-400">{label}</span><span className="text-right font-mono text-slate-200">{value}</span></div>)}</div>;