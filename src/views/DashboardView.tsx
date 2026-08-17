import React from 'react';
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
  Calendar, 
  CheckCircle2, 
  ChevronRight,
  ShieldAlert,
  Sparkles,
  PieChart as PieChartIcon
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
import { formatCurrency, formatPercent, calculateProgressPercent } from '../lib/money';
import { TabType } from '../components/common/Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: TabType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { 
    activeClient, 
    accounts, 
    transactions, 
    categories, 
    monthlyPlan, 
    goals, 
    assets, 
    netWorthHistory, 
    recurringItems, 
    pendingItems 
  } = useClient();

  const currency = activeClient.baseCurrency;

  // Compute Net Worth
  const totalAssets = assets
    .filter(a => a.classification === 'ATIVO')
    .reduce((sum, a) => sum + a.value, 0);

  const totalLiabilities = assets
    .filter(a => a.classification === 'PASSIVO')
    .reduce((sum, a) => sum + a.value, 0);

  const netWorth = totalAssets - totalLiabilities;

  // Check if we have sufficient historical data for net worth comparison
  const hasSufficientNetWorthHistory = netWorthHistory.length >= 2;
  let netWorthMoMChange: number | null = null;
  let netWorthYtdChange: number | null = null;

  if (hasSufficientNetWorthHistory) {
    const latest = netWorthHistory[netWorthHistory.length - 1].netWorth;
    const previous = netWorthHistory[netWorthHistory.length - 2].netWorth;
    if (previous > 0) {
      netWorthMoMChange = ((latest - previous) / previous) * 100;
    }
    const firstOfYear = netWorthHistory[0].netWorth;
    if (firstOfYear > 0) {
      netWorthYtdChange = ((latest - firstOfYear) / firstOfYear) * 100;
    }
  }

  // Compute Available Balance (Checking + Cash + Savings)
  const availableBalance = accounts
    .filter(a => a.type === 'CHECKING' || a.type === 'SAVINGS' || a.type === 'CASH')
    .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

  // Current Month Transactions Metrics
  const currentMonthTransactions = transactions.filter(t => t.date.startsWith('2026-08'));

  const realizedIncome = currentMonthTransactions
    .filter(t => t.transactionType === 'RECEITA')
    .reduce((sum, t) => sum + t.amount, 0);

  const realizedExpenses = currentMonthTransactions
    .filter(t => t.transactionType === 'DESPESA')
    .reduce((sum, t) => sum + t.amount, 0);

  const realizedInvestments = currentMonthTransactions
    .filter(t => t.transactionType === 'INVESTIMENTO')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthNetResult = realizedIncome - realizedExpenses;
  const savingsRate = realizedIncome > 0 ? (realizedIncome - realizedExpenses) / realizedIncome : 0;

  // Top spending categories
  const categorySpendingMap: Record<string, number> = {};
  currentMonthTransactions
    .filter(t => t.transactionType === 'DESPESA' && t.categoryName)
    .forEach(t => {
      const name = t.categoryName!;
      categorySpendingMap[name] = (categorySpendingMap[name] || 0) + t.amount;
    });

  const categoryChartData = Object.entries(categorySpendingMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const PIE_COLORS = ['#2563EB', '#0D9488', '#3B82F6', '#8B5CF6', '#F59E0B', '#64748B'];

  // Comparison Planned vs Realized Data
  const plannedVsRealizedData = [
    {
      name: 'Receitas',
      Planejado: monthlyPlan.plannedIncome,
      Realizado: realizedIncome,
    },
    {
      name: 'Despesas',
      Planejado: monthlyPlan.plannedExpenses,
      Realizado: realizedExpenses,
    },
    {
      name: 'Investimentos',
      Planejado: monthlyPlan.plannedInvestments,
      Realizado: realizedInvestments,
    }
  ];

  const pendingUnresolved = pendingItems.filter(p => !p.isResolved);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <span>Visão Patrimonial e Orçamentária</span>
            <span>•</span>
            <span>Agosto 2026</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
            Planejamento Financeiro de {activeClient.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Moeda base {activeClient.baseCurrency} • Residência Fiscal {activeClient.residenceCountry} • Fuso {activeClient.timezone}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('planning')}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Ver Planejamento</span>
          </button>
          <button
            onClick={() => onNavigate('transactions')}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            <span>Transações</span>
          </button>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Patrimônio Líquido */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Patrimônio Líquido</span>
            <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-100">
              {formatCurrency(netWorth, currency)}
            </div>
            {hasSufficientNetWorthHistory && netWorthMoMChange !== null ? (
              <div className="flex items-center gap-2 mt-1.5 text-xs">
                <span className={`flex items-center font-medium ${netWorthMoMChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netWorthMoMChange >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                  {netWorthMoMChange >= 0 ? `+${netWorthMoMChange.toFixed(1)}%` : `${netWorthMoMChange.toFixed(1)}%`} este mês
                </span>
                <span className="text-slate-500">vs mês anterior</span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 mt-1.5">
                Sem histórico suficiente
              </div>
            )}
          </div>
        </div>

        {/* KPI 2: Saldo Disponível */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Saldo Disponível</span>
            <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-500/30 text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-100">
              {formatCurrency(availableBalance, currency)}
            </div>
            <div className="text-xs text-slate-400 mt-1.5">
              Liquidez imediata em contas
            </div>
          </div>
        </div>

        {/* KPI 3: Resultado do Mês */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Resultado do Mês</span>
            <div className={`p-2 rounded-lg ${monthNetResult >= 0 ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400' : 'bg-rose-950/60 border-rose-500/30 text-rose-400'} border`}>
              {monthNetResult >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold font-mono tracking-tight ${monthNetResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(monthNetResult, currency)}
            </div>
            <div className="text-xs text-slate-400 mt-1.5 flex items-center justify-between">
              <span>Rec: {formatCurrency(realizedIncome, currency, { compact: true })}</span>
              <span>Desp: {formatCurrency(realizedExpenses, currency, { compact: true })}</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Taxa de Poupança */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Taxa de Poupança</span>
            <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-400">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-100">
              {formatPercent(savingsRate)}
            </div>
            <div className="text-xs text-slate-400 mt-1.5 flex items-center justify-between">
              <span>Alvo: {monthlyPlan.plannedIncome > 0 ? formatPercent((monthlyPlan.plannedIncome - monthlyPlan.plannedExpenses) / monthlyPlan.plannedIncome) : '0.0%'}</span>
              <span className="text-emerald-400 font-medium">Investido: {formatCurrency(realizedInvestments, currency, { compact: true })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Financial Insights Highlight Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-blue-950/40 border border-blue-500/30 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  Insights Financeiros Inteligentes
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  Gemini 3.7
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {currentMonthTransactions.length === 0 ? (
                  <span>
                    O extrato bancário ainda não possui transações reais sincronizadas. Assim que o Lunch Money sincronizar novas movimentações, a inteligência artificial categorizará automaticamente seus gastos e destacará oportunidades de economia.
                  </span>
                ) : (
                  <span>
                    Com base nas {currentMonthTransactions.length} transações analisadas em {activeClient.baseCurrency}: Despesas totais realizadas em {formatCurrency(realizedExpenses, currency)}, com maior concentração na categoria {categoryChartData[0]?.name || 'Geral'}.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
            <button
              onClick={() => onNavigate('ai-assistant')}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Abrir Assistente IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Grid: Evolution & Planned vs Realized */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Net Worth Evolution Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Evolução Patrimonial</h2>
              <p className="text-xs text-slate-400">Patrimônio Líquido em CHF ao longo de 2026</p>
            </div>
            <span className={`px-2.5 py-1 rounded-md bg-slate-800 text-[11px] font-mono border border-slate-700 ${
              hasSufficientNetWorthHistory && netWorthYtdChange !== null 
                ? (netWorthYtdChange >= 0 ? 'text-emerald-400' : 'text-rose-400')
                : 'text-slate-500'
            }`}>
              {hasSufficientNetWorthHistory && netWorthYtdChange !== null
                ? `${netWorthYtdChange >= 0 ? '+' : ''}${netWorthYtdChange.toFixed(1)}% YTD`
                : 'Sem histórico suficiente'}
            </span>
          </div>

          <div className="h-64 w-full">
            {netWorthHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(v) => `CHF ${(v / 1000).toFixed(0)}k`} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: any) => [formatCurrency(Number(value), currency), 'Patrimônio']}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="netWorth" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#netWorthGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                <Landmark className="w-6 h-6 mb-1 text-slate-600" />
                <span>Patrimônio Líquido atual: {formatCurrency(netWorth, currency)}</span>
                <span className="text-[11px] text-slate-600">Histórico mensal será consolidado conforme novos registros.</span>
              </div>
            )}
          </div>
        </div>

        {/* Top Spending Categories Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-100">Despesas por Categoria</h2>
              <PieChartIcon className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-400 mb-4">Principais gastos de Agosto em {currency}</p>

            <div className="h-44 w-full">
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(val: any) => formatCurrency(Number(val), currency)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                  <span>Nenhuma despesa classificada em Agosto</span>
                  <span className="text-[10px] text-slate-600 mt-0.5">CHF 0,00</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5 mt-2 border-t border-slate-800 pt-3">
            {categoryChartData.length > 0 ? (
              categoryChartData.map((cat, idx) => (
                <div key={cat.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span className="text-slate-300 truncate max-w-[130px]">{cat.name}</span>
                  </div>
                  <span className="font-mono text-slate-200 font-semibold">{formatCurrency(cat.value, currency)}</span>
                </div>
              ))
            ) : (
              <div className="text-center text-[11px] text-slate-500 py-1">
                Aguardando novas transações ou sincronização
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Planned vs Realized & Operational Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Planned vs Realized Comparison */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Planejado x Realizado</h2>
              <p className="text-xs text-slate-400">Comparativo financeiro consolidado do mês</p>
            </div>
            <button
              onClick={() => onNavigate('planning')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <span>Ver Detalhado</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plannedVsRealizedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: any) => formatCurrency(Number(val), currency)}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Planejado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Realizado" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operational Inbox / Pendências */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Central de Pendências</span>
                {pendingUnresolved.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {pendingUnresolved.length}
                  </span>
                )}
              </h2>
              <button
                onClick={() => onNavigate('pending')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                Abrir
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">Avisos e sugestões do consultor</p>

            <div className="space-y-2.5">
              {pendingUnresolved.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-800 text-center text-xs text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                  Nenhuma pendência ativa. O planejamento de Kássio está em dia!
                </div>
              ) : (
                pendingUnresolved.map((item) => (
                  <div 
                    key={item.id}
                    className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 transition-all flex items-start gap-2.5 text-xs"
                  >
                    <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${item.severity === 'AVISO' ? 'text-amber-400' : 'text-blue-400'}`} />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-200">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{item.description}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('pending')}
            className="mt-4 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold transition-all text-center"
          >
            Gerenciar Pendências
          </button>
        </div>
      </div>

      {/* Financial Goals & Recurrences Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Goals Progress Bars Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>Objetivos Financeiros</span>
              </h2>
              <p className="text-xs text-slate-400">Progresso calculado deterministicamente</p>
            </div>
            <button
              onClick={() => onNavigate('goals')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <span>Ver Todos</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {goals.length > 0 ? (
              goals.map((goal) => {
                const progress = calculateProgressPercent(goal.currentAmount, goal.targetAmount);
                const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

                return (
                  <div key={goal.id} className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-200">{goal.name}</span>
                        <div className="text-[11px] text-slate-400">
                          Alvo: {new Date(goal.targetDate).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold font-mono text-emerald-400">
                          {formatCurrency(goal.currentAmount, currency)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          de {formatCurrency(goal.targetAmount, currency)}
                        </div>
                      </div>
                    </div>

                    {/* High Craft Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{progress}% concluído</span>
                        <span>Faltam {formatCurrency(remaining, currency)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-5 rounded-lg bg-slate-800/40 border border-slate-800 text-center text-xs text-slate-400">
                <Target className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
                Nenhum objetivo financeiro cadastrado ainda.
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Recurrences Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Próximas Recorrências</span>
              </h2>
              <p className="text-xs text-slate-400">Contas fixas, aportes e salários previstos</p>
            </div>
            <button
              onClick={() => onNavigate('recurrences')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <span>Ver Agenda</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recurringItems.length > 0 ? (
              recurringItems.slice(0, 4).map((rec) => (
                <div 
                  key={rec.id}
                  className="p-3 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${rec.type === 'RECEITA' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-300'}`}>
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200">{rec.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Dia {rec.dayOfMonth} • Vencimento: {new Date(rec.nextDueDate).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-mono font-bold ${rec.type === 'RECEITA' ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {rec.type === 'RECEITA' ? '+' : '-'}{formatCurrency(rec.amount, rec.currency)}
                    </div>
                    <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold ${rec.status === 'PAGO' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {rec.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-5 rounded-lg bg-slate-800/40 border border-slate-800 text-center text-xs text-slate-400">
                <Clock className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
                Nenhuma recorrência ativa cadastrada.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
