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
import { useAuth } from '../context/AuthContext';
import { getCapabilities } from '../lib/capabilities';
import { formatCurrency, formatPercent, calculateProgressPercent } from '../lib/money';
import { convertToCHF, hasRateToCHF } from '../lib/fxService';
import { getTransactionBaseAmount } from '../lib/financialMetrics';
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
    transactions, 
    categories, 
    monthlyPlan, 
    goals, 
    assets, 
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

  // Compute Current Balances & Net Worth (Real-time account & asset balance)
  const totalAssets = useMemo(() => {
    const assetsVal = assets
      .filter(a => a.classification === 'ATIVO')
      .reduce((sum, a) => sum + (a.baseValue ?? convertToCHF(a.value, a.currency)), 0);
    const accountsVal = accounts.reduce((sum, account) => {
      const originalBalance = account.originalBalance ?? account.balance;
      return sum + Math.max(0, account.balanceBase ?? convertToCHF(originalBalance, account.originalCurrency || account.currency));
    }, 0);
    return assetsVal + accountsVal;
  }, [assets, accounts]);

  const totalLiabilities = useMemo(() => {
    const passivosVal = assets
      .filter(a => a.classification === 'PASSIVO')
      .reduce((sum, a) => sum + (a.baseValue ?? convertToCHF(a.value, a.currency)), 0);
    const creditDebt = accounts
      .filter(a => (a.balanceBase ?? a.balance) < 0)
      .reduce((sum, a) => sum + Math.abs(a.balanceBase ?? convertToCHF(a.originalBalance ?? a.balance, a.originalCurrency || a.currency)), 0);
    return passivosVal + creditDebt;
  }, [assets, accounts]);

  const currentNetWorth = totalAssets - totalLiabilities;

  // Available Liquid Balance (Checking + Cash + Savings)
  const availableBalance = useMemo(() => {
    return accounts
      .filter(a => a.type === 'CHECKING' || a.type === 'SAVINGS' || a.type === 'CASH')
      .reduce((sum, a) => sum + Math.max(0, a.balanceBase ?? convertToCHF(a.originalBalance ?? a.balance, a.originalCurrency || a.currency)), 0);
  }, [accounts]);

  const accountCurrencyBalances = useMemo(() => {
    const balances = new Map<string, number>();
    accounts.forEach(account => {
      const currencyCode = account.originalCurrency || account.currency;
      const originalBalance = account.originalBalance ?? account.balance;
      balances.set(currencyCode, (balances.get(currencyCode) || 0) + originalBalance);
    });
    return Array.from(balances.entries()).map(([currencyCode, amount]) => ({
      currencyCode,
      amount,
      conversionAvailable: currencyCode === currency || hasRateToCHF(currencyCode)
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

  // Realized Metrics for Selected Month
  const realizedIncome = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.transactionType === 'RECEITA')
      .reduce((sum, t) => sum + (t.amountBase ?? t.convertedAmount ?? convertToCHF(t.amount, t.currency)), 0);
  }, [currentMonthTransactions]);

  const realizedExpenses = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.transactionType === 'DESPESA')
      .reduce((sum, t) => sum + (t.amountBase ?? t.convertedAmount ?? convertToCHF(t.amount, t.currency)), 0);
  }, [currentMonthTransactions]);

  const realizedInvestments = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.transactionType === 'INVESTIMENTO')
      .reduce((sum, t) => sum + (t.amountBase ?? t.convertedAmount ?? convertToCHF(t.amount, t.currency)), 0);
  }, [currentMonthTransactions]);

  const monthNetResult = realizedIncome - realizedExpenses;
  const savingsRate = realizedIncome > 0 ? (realizedIncome - realizedExpenses) / realizedIncome : 0;

  // Realized Metrics for Previous Month
  const prevIncome = useMemo(() => {
    return previousMonthTransactions
      .filter(t => t.transactionType === 'RECEITA')
      .reduce((sum, t) => sum + (t.amountBase ?? t.convertedAmount ?? convertToCHF(t.amount, t.currency)), 0);
  }, [previousMonthTransactions]);

  const prevExpenses = useMemo(() => {
    return previousMonthTransactions
      .filter(t => t.transactionType === 'DESPESA')
      .reduce((sum, t) => sum + (t.amountBase ?? t.convertedAmount ?? convertToCHF(t.amount, t.currency)), 0);
  }, [previousMonthTransactions]);

  // Month-over-Month calculations
  const incomeMoM = prevIncome > 0 ? ((realizedIncome - prevIncome) / prevIncome) * 100 : null;
  const expenseMoM = prevExpenses > 0 ? ((realizedExpenses - prevExpenses) / prevExpenses) * 100 : null;

  // Chronological Multi-Month Patrimonial Evolution Data Points
  const chronologicalMonths = useMemo(() => {
    return getAvailableMonths(transactions, 'asc');
  }, [transactions]);

  const patrimonialEvolutionData = useMemo(() => {
    if (chronologicalMonths.length === 0) return [];

    // Calculate historical points
    return chronologicalMonths.map((ym) => {
      const txsInMonth = getTransactionsForMonth(transactions, ym);
      const inc = txsInMonth.filter(t => t.transactionType === 'RECEITA').reduce((s, t) => s + (t.amountBase ?? t.convertedAmount ?? convertToCHF(t.amount, t.currency)), 0);
      const exp = txsInMonth.filter(t => t.transactionType === 'DESPESA').reduce((s, t) => s + (t.amountBase ?? t.convertedAmount ?? convertToCHF(t.amount, t.currency)), 0);
      const inv = txsInMonth.filter(t => t.transactionType === 'INVESTIMENTO').reduce((s, t) => s + (t.amountBase ?? t.convertedAmount ?? convertToCHF(t.amount, t.currency)), 0);
      const net = inc - exp;

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
      categorySpendingMap[name] = (categorySpendingMap[name] || 0) + getTransactionBaseAmount(t);
    });

  const categoryChartData = Object.entries(categorySpendingMap)
    .map(([name, value]) => ({ name, value: Math.abs(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const categorizedExpensesTotal = Object.values(categorySpendingMap)
    .reduce((sum, value) => sum + Math.abs(value), 0);

  const PIE_COLORS = ['#2563EB', '#0D9488', '#3B82F6', '#8B5CF6', '#F59E0B', '#64748B'];

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
  const investmentAssets = assets.filter(asset =>
    asset.classification === 'ATIVO' &&
    (asset.category === 'INVESTIMENTO_LIQUIDO' || asset.category === 'PREVIDENCIA_3A')
  );
  const investmentGroups = [
    { currency: 'BRL' as const, label: 'Grupo Brasil' },
    { currency: 'EUR' as const, label: 'Grupo Europa' },
    { currency: 'CHF' as const, label: 'Grupo Suíça' }
  ].map(group => {
    const holdings = investmentAssets.filter(asset => asset.currency === group.currency);
    const originalTotal = holdings.reduce((sum, asset) => sum + (asset.originalValue ?? asset.value), 0);
    const convertedHoldings = holdings.filter(asset => asset.baseValue !== undefined || group.currency === currency || hasRateToCHF(group.currency));
    const convertedTotal = convertedHoldings.reduce((sum, asset) => sum + (asset.baseValue ?? convertToCHF(asset.originalValue ?? asset.value, asset.currency)), 0);
    const institutions = Array.from(new Set(holdings.map(asset => asset.institution || 'Custódia não informada')));
    return { ...group, holdings, originalTotal, convertedTotal, institutions, conversionAvailable: holdings.length === convertedHoldings.length };
  });

  return (
    <div className="dashboard-shell space-y-8 pb-12">
      {/* Top Banner Context with Dynamic Month Selector */}
      <div className="dashboard-context flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-emerald-400 uppercase tracking-[0.2em]">
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Patrimônio líquido</p>
            <div className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-50 font-mono">
              {formatCurrency(currentNetWorth, currency)}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-4 max-w-xl">
              <div><p className="text-[11px] text-slate-500">Liquidez</p><p className="mt-1 text-sm font-mono text-slate-200">{formatCurrency(availableBalance, currency)}</p></div>
              <div><p className="text-[11px] text-slate-500">Ativos</p><p className="mt-1 text-sm font-mono text-slate-200">{formatCurrency(totalAssets, currency)}</p></div>
              <div><p className="text-[11px] text-slate-500">Passivos</p><p className="mt-1 text-sm font-mono text-rose-300">{formatCurrency(totalLiabilities, currency)}</p></div>
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
        <div className="dashboard-metric border-l-2 border-blue-400/70 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Patrimônio Líquido Total</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100">
              {formatCurrency(currentNetWorth, currency)}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
              <span>Ativos: {formatCurrency(totalAssets, currency)}</span>
              <span>•</span>
              <span>Passivos: {formatCurrency(totalLiabilities, currency)}</span>
            </div>
          </div>
        </div>

        {/* Saldo Líquido Disponível */}
        <div className="dashboard-metric border-l-2 border-emerald-400/70 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Liquidez Disponível</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100">
              {formatCurrency(availableBalance, currency)}
            </div>
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
        <div className="dashboard-metric border-l-2 border-emerald-400/70 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Receitas ({formatMonthLabel(selectedMonth, 'short')})</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-emerald-400">
              +{formatCurrency(realizedIncome, currency)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              {incomeMoM !== null ? (
                <span className={`flex items-center font-medium ${incomeMoM >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {incomeMoM >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {formatPercent(Math.abs(incomeMoM))} vs mês anterior
                </span>
              ) : (
                <span>{currentMonthTransactions.filter(t => t.transactionType === 'RECEITA').length} entradas registradas</span>
              )}
            </div>
          </div>
        </div>

        {/* Despesas do Mês Selecionado */}
        <div className="dashboard-metric border-l-2 border-rose-400/70 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Despesas ({formatMonthLabel(selectedMonth, 'short')})</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-rose-400">
              -{formatCurrency(realizedExpenses, currency)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <span className={`font-semibold ${monthNetResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Resultado: {formatCurrency(monthNetResult, currency)}
              </span>
              <span>•</span>
              <span>Taxa: {formatPercent(savingsRate * 100)}</span>
            </div>
          </div>
        </div>
      </div>

      <section className="border-y border-slate-800/80 py-7">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">Investment intelligence</p>
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
                  {formatCurrency(group.originalTotal, group.currency)}
                </p>
              </div>
              <p className="text-[11px] text-slate-500 mt-3 truncate" title={group.institutions.join(' · ')}>
                {group.institutions.length > 0 ? group.institutions.join(' · ') : 'Nenhuma posição registrada'}
              </p>
              {group.holdings.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {group.holdings.slice(0, 3).map(holding => (
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
                Série histórica de todas as movimentações ({chronologicalMonths.length} meses disponíveis)
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
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: any) => [`${formatCurrency(Number(value), currency)}`, '']}
                  />
                  <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
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
                <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: any) => [`${formatCurrency(Number(value), currency)}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Planejado" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Realizado" fill="#10B981" radius={[0, 4, 4, 0]} />
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
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
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
