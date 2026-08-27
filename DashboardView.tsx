import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Landmark, 
  PiggyBank, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  ShieldAlert,
  Sparkles,
  PieChart as PieChartIcon,
  RefreshCw
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { useClient } from '../context/ClientContext';
import { CHART_SERIES_COLORS } from '../lib/chartColors';
import { useAuth } from '../context/AuthContext';
import { getCapabilities } from '../lib/capabilities';
import { formatCurrency, formatPercent, calculateProgressPercent } from '../lib/money';
import { hasRateToCHF } from '../lib/fxService';
import { getAccountBaseValue, getCanonicalBaseAmount, getConsolidatedNetWorth, getFinancialSummary } from '../lib/canonicalFinance';
import { getInvestmentSummary } from '../lib/investmentData';
import { TabType } from '../components/common/Sidebar';
import { MonthSelector } from '../components/common/MonthSelector';
import { 
  getAvailableMonths, 
  getTransactionsForMonth, 
  getPreviousMonth, 
  formatMonthLabel 
} from '../lib/monthUtils';

interface DashboardViewProps {
  onNavigate: (tab: TabType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { role } = useAuth();
  const { canManageIntegrations } = getCapabilities(role);
  const { 
    activeClient, 
    accounts, 
    accountsLoadState,
    transactions, 
    transactionsLoadState,
    categories, 
    monthlyPlan, 
    goals, 
    assets, 
    assetsLoadState,
    recurringItems, 
    pendingItems,
    syncStatus,
    lastSyncedAt,
    isSyncing,
    triggerLunchMoneySync,
    selectedMonth,
    setSelectedMonth
  } = useClient();

  const currency = activeClient.baseCurrency;

  // Determine initial selected month from existing transaction dates
  const availableMonths = useMemo(() => {
    return getAvailableMonths(transactions, 'desc');
  }, [transactions]);

  const previousMonth = useMemo(() => getPreviousMonth(selectedMonth), [selectedMonth]);

  // Canonical net worth: liquid bank balances + registered assets - liabilities.
  // Investment accounts are not added again here when positions are already represented as assets.
  const patrimonySummary = useMemo(() => getConsolidatedNetWorth(assets, currency), [assets, currency]);
  const liquidAccountSummary = useMemo(() => {
    let positive = 0;
    let debt = 0;
    let unavailable = 0;
    for (const account of accounts) {
      const isLiquid = account.type === 'CHECKING' || account.type === 'SAVINGS' || account.type === 'CASH';
      const isCredit = account.type === 'CREDIT_CARD';
      if (!isLiquid && !isCredit) continue;
      const value = getAccountBaseValue(account, currency);
      if (value === undefined) { unavailable += 1; continue; }
      if (isCredit || value < 0) debt += Math.abs(value);
      else positive += Math.max(0, value);
    }
    return { positive, debt, unavailable };
  }, [accounts, currency]);

  const conversionComplete = patrimonySummary.isComplete && liquidAccountSummary.unavailable === 0;
  const totalAssets = conversionComplete ? patrimonySummary.assets + liquidAccountSummary.positive : null;
  const totalLiabilities = conversionComplete ? patrimonySummary.liabilities + liquidAccountSummary.debt : null;
  const currentNetWorth = totalAssets !== null && totalLiabilities !== null ? totalAssets - totalLiabilities : null;
  const patrimonyHasData = accounts.length > 0 || assets.length > 0;
  const patrimonyHasError = accountsLoadState === 'error' || assetsLoadState === 'error';

  // Status de indisponibilidade do dado (null = há valor real para exibir).
  // Voz da marca: status nunca se veste de número — renderiza menor, neutro e em sans.
  const baseValueStatus = (value: number | null, sourceHasData: boolean, sourceHasError: boolean): string | null => {
    if (sourceHasError) return 'Não foi possível carregar os dados';
    if (!sourceHasData) return 'Nenhum dado registrado';
    return value === null ? 'Conversão indisponível' : null;
  };
  const transactionValueStatus = (hasMatchingTransactions: boolean): string | null => {
    if (transactionsLoadState === 'error') return 'Não foi possível carregar os dados';
    if (transactionsLoadState === 'empty' || !hasMatchingTransactions) return 'Nenhuma movimentação';
    return null;
  };
  const formatBaseValue = (value: number | null, sourceHasData: boolean, sourceHasError: boolean) => {
    return baseValueStatus(value, sourceHasData, sourceHasError) ?? formatCurrency(value as number, currency);
  };
  // Valor em escala de destaque, ou status discreto quando o dado não existe.
  const MetricValue: React.FC<{ status: string | null; className: string; children: React.ReactNode }> = ({ status, className, children }) =>
    status
      ? <div className="font-sans text-sm text-slate-500">{status}</div>
      : <div className={className}>{children}</div>;

  // Available Liquid Balance (Checking + Cash + Savings)
  const availableBalance = useMemo(() => {
    let total = 0;
    for (const account of accounts.filter(a => a.type === 'CHECKING' || a.type === 'SAVINGS' || a.type === 'CASH')) {
      const value = getAccountBaseValue(account, currency);
      if (value === undefined) return null;
      total += Math.max(0, value);
    }
    return total;
  }, [accounts, currency]);

  const accountCurrencyBalances = useMemo(() => {
    const balances = new Map<string, { amount: number; allHavePersistedBase: boolean }>();
    accounts.forEach(account => {
      const currencyCode = account.originalCurrency || account.currency;
      const originalBalance = account.originalBalance ?? account.balance;
      const hasPersistedBase = typeof account.balanceBase === 'number';
      const entry = balances.get(currencyCode) || { amount: 0, allHavePersistedBase: true };
      balances.set(currencyCode, {
        amount: entry.amount + originalBalance,
        allHavePersistedBase: entry.allHavePersistedBase && hasPersistedBase,
      });
    });
    // conversão persistida (balanceBase) conta como disponível — é a mesma
    // fonte que o patrimônio líquido soma; o rótulo não pode contradizê-la
    return Array.from(balances.entries()).map(([currencyCode, entry]) => ({
      currencyCode,
      amount: entry.amount,
      conversionAvailable: currencyCode === currency || entry.allHavePersistedBase || hasRateToCHF(currencyCode)
    }));
  }, [accounts, currency]);

  // Transactions for Selected Month
  const currentMonthTransactions = useMemo(() => {
    return getTransactionsForMonth(transactions, selectedMonth);
  }, [transactions, selectedMonth]);

  // Transactions for Previous Month (for accurate MoM calculation)
  const previousMonthTransactions = useMemo(() => {
    return getTransactionsForMonth(transactions, previousMonth);
  }, [transactions, previousMonth]);

  // Realized metrics come from the canonical financial engine.
  const currentSummary = useMemo(() => getFinancialSummary(currentMonthTransactions), [currentMonthTransactions]);
  const previousSummary = useMemo(() => getFinancialSummary(previousMonthTransactions), [previousMonthTransactions]);
  const realizedIncome = currentSummary.income;
  const realizedExpenses = currentSummary.expenses;
  const realizedInvestments = currentSummary.investments;
  const monthNetResult = currentSummary.operatingResult;
  const savingsRate = currentSummary.savingsRate;
  const prevIncome = previousSummary.income;
  const prevExpenses = previousSummary.expenses;

  // Month-over-Month calculations
  const incomeMoM = prevIncome > 0 ? (realizedIncome - prevIncome) / prevIncome : null;
  const expenseMoM = prevExpenses > 0 ? (realizedExpenses - prevExpenses) / prevExpenses : null;

  // Chronological Multi-Month Patrimonial Evolution Data Points
  const chronologicalMonths = useMemo(() => {
    return getAvailableMonths(transactions, 'asc');
  }, [transactions]);

  const patrimonialEvolutionData = useMemo(() => {
    if (chronologicalMonths.length === 0) return [];

    // Calculate historical points
    return chronologicalMonths.map((ym) => {
      const txsInMonth = getTransactionsForMonth(transactions, ym);
      const summary = getFinancialSummary(txsInMonth);
      const inc = summary.income;
      const exp = summary.expenses;
      const inv = summary.investments;
      const net = summary.operatingResult;

      return {
        month: formatMonthLabel(ym, 'chart'),
        rawMonth: ym,
        receitas: Math.round(inc * 100) / 100,
        despesas: Math.round(exp * 100) / 100,
        investimentos: Math.round(inv * 100) / 100,
        resultadoLiquido: Math.round(net * 100) / 100,
        patrimonioLiquido: Math.round(currentNetWorth * 100) / 100
      };
    });
  }, [chronologicalMonths, transactions, currentNetWorth]);

  // Top spending categories for selected month
  const categorySpendingMap: Record<string, number> = {};
  currentMonthTransactions
    .filter(t => t.transactionType === 'DESPESA' && (t.categoryName || t.categoryId))
    .forEach(t => {
      const name = t.categoryName || 'Outros';
      categorySpendingMap[name] = (categorySpendingMap[name] || 0) + (getCanonicalBaseAmount(t) ?? 0);
    });

  const categoryChartData = Object.entries(categorySpendingMap)
    .map(([name, value]) => ({ name, value: Math.abs(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const categorizedExpensesTotal = Object.values(categorySpendingMap)
    .reduce((sum, value) => sum + Math.abs(value), 0);

  const PIE_COLORS = CHART_SERIES_COLORS;

  // Comparison Planned vs Realized Data for Selected Month
  const plannedVsRealizedData = [
    {
      name: 'Receitas',
      Planejado: monthlyPlan.plannedIncome || 0,
      Realizado: realizedIncome,
    },
    {
      name: 'Despesas',
      Planejado: monthlyPlan.plannedExpenses || 0,
      Realizado: realizedExpenses,
    },
    {
      name: 'Investimentos',
      Planejado: monthlyPlan.plannedInvestments || 0,
      Realizado: realizedInvestments,
    }
  ];

  const pendingUnresolved = pendingItems.filter(p => !p.isResolved);
  const uncategorizedCount = currentMonthTransactions.filter(t => !t.categoryId || t.categoryId === 'cat-none').length;
  const investmentGroups = useMemo(() => getInvestmentSummary(assets), [assets]);

  return (
    <div className="dashboard-shell space-y-8 pb-12">
      {/* Top Banner Context with Dynamic Month Selector */}
      <div className="dashboard-context flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-medium text-blue-400 uppercase tracking-[0.2em]">
            <span>Visão Patrimonial e Orçamentária</span>
            <span>•</span>
            <span>{formatMonthLabel(selectedMonth, 'full')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100 mt-2">
            {activeClient.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Residência fiscal: {activeClient.residenceCountry} <span className="text-slate-600">·</span> Moeda base: {activeClient.baseCurrency}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${isSyncing ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} />
            {isSyncing ? 'Sincronização em andamento' : lastSyncedAt ? `Sincronizado em ${new Date(lastSyncedAt).toLocaleString('pt-BR')}` : 'Sincronização pronta'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <MonthSelector
            selectedMonth={selectedMonth}
            onChange={setSelectedMonth}
            transactions={transactions}
          />

          {canManageIntegrations && <button
            onClick={() => triggerLunchMoneySync()}
            disabled={isSyncing}
            className="p-2 text-slate-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
            title="Sincronizar dados do Lunch Money"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>}
        </div>
      </div>

      {/* Pending Items & Sync Alert Banner if uncategorized transactions exist */}
      {uncategorizedCount > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Revisão Necessária</p>
              <p className="text-xs text-amber-300/90 mt-0.5">
                Existem <strong>{uncategorizedCount} movimentações sem categoria</strong> em {formatMonthLabel(selectedMonth, 'full')}.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('transactions')}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span>Classificar Transações</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <section className="dashboard-hero border-b border-slate-800/80 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-8 items-end">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Patrimônio líquido</p>
            {/* assinatura da marca: a linha de origem sob o número principal */}
            <div className="ap-origem mt-3" aria-hidden="true" />
            <MetricValue
              status={baseValueStatus(currentNetWorth, patrimonyHasData, patrimonyHasError)}
              className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-50 font-mono"
            >
              {currentNetWorth !== null && formatCurrency(currentNetWorth, currency)}
            </MetricValue>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Base {activeClient.baseCurrency}
              {lastSyncedAt ? ` · sincronizado em ${new Date(lastSyncedAt).toLocaleDateString('pt-BR')}` : ''}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-4 max-w-xl">
              <div><p className="text-[11px] text-slate-500">Liquidez</p><MetricValue status={baseValueStatus(availableBalance, accounts.length > 0, accountsLoadState === 'error')} className="mt-1 text-sm font-mono text-slate-200">{availableBalance !== null && formatCurrency(availableBalance, currency)}</MetricValue></div>
              <div><p className="text-[11px] text-slate-500">Ativos</p><MetricValue status={baseValueStatus(totalAssets, patrimonyHasData, patrimonyHasError)} className="mt-1 text-sm font-mono text-slate-200">{totalAssets !== null && formatCurrency(totalAssets, currency)}</MetricValue></div>
              <div><p className="text-[11px] text-slate-500">Passivos</p><MetricValue status={baseValueStatus(totalLiabilities, patrimonyHasData, patrimonyHasError)} className="mt-1 text-sm font-mono text-rose-300">{totalLiabilities !== null && formatCurrency(totalLiabilities, currency)}</MetricValue></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-l border-slate-800/80 pl-6">
            {accountCurrencyBalances.map(balance => (
              <div key={balance.currencyCode}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{balance.currencyCode}</p>
                <p className="mt-1 text-sm font-mono text-slate-200">{formatCurrency(balance.amount, balance.currencyCode as any)}</p>
                {!balance.conversionAvailable && <p className="mt-1 text-[10px] text-amber-300">Conversão indisponível</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Patrimônio Líquido */}
        <div className="dashboard-metric border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Patrimônio Líquido Total</span>
          </div>
          <div className="mt-3">
            <MetricValue
              status={baseValueStatus(currentNetWorth, patrimonyHasData, patrimonyHasError)}
              className="text-2xl font-bold font-mono text-slate-100"
            >
              {currentNetWorth !== null && formatCurrency(currentNetWorth, currency)}
            </MetricValue>
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
              <span>Ativos: {formatBaseValue(totalAssets, patrimonyHasData, patrimonyHasError)}</span>
              <span>•</span>
              <span>Passivos: {formatBaseValue(totalLiabilities, patrimonyHasData, patrimonyHasError)}</span>
            </div>
          </div>
        </div>

        {/* Saldo Líquido Disponível */}
        <div className="dashboard-metric border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Liquidez Disponível</span>
          </div>
          <div className="mt-3">
            <MetricValue
              status={baseValueStatus(availableBalance, accounts.length > 0, accountsLoadState === 'error')}
              className="text-2xl font-bold font-mono text-slate-100"
            >
              {availableBalance !== null && formatCurrency(availableBalance, currency)}
            </MetricValue>
            <p className="text-xs text-slate-400 mt-1">
              Contas correntes, poupança e caixa
            </p>
            {accountCurrencyBalances.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-slate-800 pt-2">
                {accountCurrencyBalances.map(balance => (
                  <div key={balance.currencyCode} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Original {balance.currencyCode}</span>
                    <span className="font-mono text-slate-200">{formatCurrency(balance.amount, balance.currencyCode as any)}</span>
                  </div>
                ))}
                {accountCurrencyBalances.some(balance => !balance.conversionAvailable) && (
                  <p className="text-[10px] text-amber-300">Conversão indisponível: saldo original preservado.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Receitas do Mês Selecionado */}
        <div className="dashboard-metric border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Receitas ({formatMonthLabel(selectedMonth, 'short')})</span>
          </div>
          <div className="mt-3">
            <MetricValue
              status={transactionValueStatus(currentMonthTransactions.some(t => t.transactionType === 'RECEITA'))}
              className="text-2xl font-bold font-mono text-emerald-400"
            >
              +{formatCurrency(realizedIncome, currency)}
            </MetricValue>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              {incomeMoM !== null ? (
                <span className={`flex items-center font-medium ${incomeMoM >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {incomeMoM >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {formatPercent(Math.abs(incomeMoM))} vs mês anterior
                </span>
              ) : (
                <span>{(() => { const n = currentMonthTransactions.filter(t => t.transactionType === 'RECEITA').length; return n === 1 ? '1 entrada registrada' : `${n} entradas registradas`; })()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Despesas do Mês Selecionado */}
        <div className="dashboard-metric border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Despesas ({formatMonthLabel(selectedMonth, 'short')})</span>
          </div>
          <div className="mt-3">
            <MetricValue
              status={transactionValueStatus(currentMonthTransactions.some(t => t.transactionType === 'DESPESA'))}
              className="text-2xl font-bold font-mono text-rose-400"
            >
              -{formatCurrency(realizedExpenses, currency)}
            </MetricValue>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <span className={`font-semibold ${monthNetResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Resultado: {formatCurrency(monthNetResult, currency)}
              </span>
              <span>•</span>
              <span>Taxa: {formatPercent(savingsRate)}</span>
            </div>
          </div>
        </div>
      </div>

      <section className="border-y border-slate-800/80 py-7">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-blue-400">Carteira de investimentos</p>
            <h2 className="text-xl font-semibold text-slate-100 mt-1">Investimentos</h2>
          </div>
          <button
            onClick={() => onNavigate('investments')}
            className="text-xs text-blue-300 hover:text-blue-200 font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Ver carteira completa</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {investmentGroups.map(group => (
            <div key={group.currency} className="border-l border-slate-700 pl-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-200">{group.label}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mt-1">{group.currency}</p>
                </div>
                <p className="text-sm font-mono text-slate-100">
                  {group.positions > 0
                    ? formatCurrency(group.originalTotal, group.currency)
                    : assetsLoadState === 'error'
                      ? 'Não foi possível carregar os dados'
                      : assetsLoadState === 'loading'
                        ? 'Carregando dados...'
                        : 'Nenhuma posição registrada'}
                </p>
              </div>
              {group.institutions.length > 0 && (
                <p className="text-[11px] text-slate-500 mt-3 truncate" title={group.institutions.join(' · ')}>
                  {group.institutions.join(' · ')}
                </p>
              )}
              {group.positions > 0 && (
                <div className="mt-3 space-y-1.5">
                  {group.assets.slice(0, 3).map(holding => (
                    <div key={holding.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-400 truncate">{holding.name}</span>
                      <span className="font-mono text-slate-300 shrink-0">{formatCurrency(holding.originalValue ?? holding.value, group.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className={`mt-4 text-[11px] font-mono ${group.conversionAvailable ? 'text-slate-400' : 'text-amber-300'}`}>
                {group.conversionAvailable ? `≈ ${formatCurrency(group.convertedTotal, currency)}` : 'Conversão indisponível'}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Main Charts Section: Patrimonial Evolution & Budget Realization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Multi-Month Evolution Bar / Area Chart */}
        <div className="lg:col-span-2 border-b border-slate-800/80 pb-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Evolução Mensal: Receitas vs Despesas
              </h3>
              <p className="text-xs text-slate-400">
                Série histórica de todas as movimentações ({chronologicalMonths.length === 1 ? '1 mês disponível' : `${chronologicalMonths.length} meses disponíveis`})
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Receitas</span>
              </div>
              <div className="flex items-center gap-1 text-rose-400 ml-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>Despesas</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {patrimonialEvolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={patrimonialEvolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" stroke="#746E84" fontSize={11} tickLine={false} />
                  <YAxis stroke="#746E84" fontSize={11} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1C1826', borderColor: '#322C42', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: any) => [`${formatCurrency(Number(value), currency)}`, '']}
                  />
                  <Bar dataKey="receitas" name="Receitas" fill="#5CAD8C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#C56A6A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Nenhum dado histórico encontrado
              </div>
            )}
          </div>
        </div>

        {/* Planned vs Realized in Selected Month */}
        <div className="border-b border-slate-800/80 pb-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Planejado x Realizado
              </h3>
              <p className="text-xs text-slate-400">
                {formatMonthLabel(selectedMonth, 'full')}
              </p>
            </div>
            <button
              onClick={() => onNavigate('planning')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <span>Ajustar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plannedVsRealizedData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <XAxis type="number" stroke="#746E84" fontSize={10} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="name" stroke="#746E84" fontSize={11} tickLine={false} width={96} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1C1826', borderColor: '#322C42', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: any) => [`${formatCurrency(Number(value), currency)}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Planejado" fill="#9B7FDB" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Realizado" fill="#5CAD8C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Spending Breakdown & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Top Spending Categories Pie & List */}
        <div className="border-b border-slate-800/80 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Principais Gastos do Mês
              </h3>
              <p className="text-xs text-slate-400">
                Distribuição por categoria ({formatMonthLabel(selectedMonth, 'short')})
              </p>
            </div>
            <PieChartIcon className="w-4 h-4 text-slate-400" />
          </div>

          {categoryChartData.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1C1826', borderColor: '#322C42', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(val: any) => [`${formatCurrency(Number(val), currency)}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                {categoryChartData.map((item, idx) => {
                  const percent = categorizedExpensesTotal > 0 ? item.value / categorizedExpensesTotal : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} 
                        />
                        <span className="text-slate-300 font-medium truncate max-w-[140px]">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{formatPercent(percent)}</span>
                        <span className="font-mono font-semibold text-slate-100">
                          {formatCurrency(item.value, currency)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500">
              Nenhuma despesa categorizada neste mês
            </div>
          )}
        </div>

        {/* Connected Accounts Breakdown */}
        <div className="border-b border-slate-800/80 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Contas Conectadas
              </h3>
              <p className="text-xs text-slate-400">
                {accounts.length} contas ativas integradas
              </p>
            </div>
            <button
              onClick={() => onNavigate('accounts')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {accounts.slice(0, 5).map(acc => (
              <div key={acc.id} className="flex items-center justify-between py-2.5 border-b border-slate-800/70 last:border-0">
                <div>
                  <div className="text-xs font-semibold text-slate-200">{acc.name}</div>
                  <div className="text-[11px] text-slate-400">{acc.institution || 'Banco'} • {acc.currency}</div>
                </div>
                <div className={`text-xs font-bold font-mono ${acc.balance >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
                  {formatCurrency(acc.balance, acc.currency || currency)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Goals Progress */}
        <div className="border-b border-slate-800/80 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Metas Patrimoniais
              </h3>
              <p className="text-xs text-slate-400">
                Acompanhamento de objetivos
              </p>
            </div>
            <button
              onClick={() => onNavigate('goals')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <span>Ver Metas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {goals.length > 0 ? (
              goals.slice(0, 3).map(goal => {
                const progress = calculateProgressPercent(goal.currentAmount, goal.targetAmount);
                return (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{goal.name}</span>
                      <span className="font-mono text-emerald-400 font-bold">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{formatCurrency(goal.currentAmount, currency)}</span>
                      <span>Meta: {formatCurrency(goal.targetAmount, currency)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-xs text-slate-500">
                <Target className="w-6 h-6 text-slate-600 mb-1" />
                <span>Nenhuma meta cadastrada</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
