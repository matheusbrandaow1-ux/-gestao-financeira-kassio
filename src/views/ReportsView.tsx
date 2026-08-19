import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart as PieChartIcon, 
  FileText, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  Layers,
  ChevronDown
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
import { formatCurrency, formatPercent } from '../lib/money';
import { CanonicalTransaction } from '../types';
import { getPreviousMonth, getTransactionsForMonth, formatMonthLabel } from '../lib/monthUtils';
import { getTransactionBaseAmount } from '../lib/financialMetrics';

export const ReportsView: React.FC = () => {
  const { 
    activeClient, 
    transactions, 
    categories, 
    assets, 
    netWorthHistory, 
    monthlyPlan,
    selectedMonth
  } = useClient();

  const [timeRange, setTimeRange] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
  const [reportType, setReportType] = useState<'CASHFLOW' | 'CATEGORIES' | 'NETWORTH' | 'INCOME_STATEMENT'>('CASHFLOW');

  const currency = activeClient.baseCurrency;

  // Filter transactions based on time range
  const filteredTransactions = useMemo(() => {
    if (timeRange === 'MONTH') return getTransactionsForMonth(transactions, selectedMonth);
    if (timeRange === 'YEAR') return transactions.filter(t => t.date.startsWith(selectedMonth.slice(0, 4)));
    const quarterStart = getPreviousMonth(getPreviousMonth(selectedMonth));
    return transactions.filter(t => t.date.startsWith(quarterStart) || t.date.startsWith(getPreviousMonth(selectedMonth)) || t.date.startsWith(selectedMonth));
  }, [transactions, timeRange, selectedMonth]);

  // Aggregate Metrics
  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter(t => t.transactionType === 'RECEITA')
      .reduce((sum, t) => sum + getTransactionBaseAmount(t), 0);
  }, [filteredTransactions]);

  const totalExpenses = useMemo(() => {
    return filteredTransactions
      .filter(t => t.transactionType === 'DESPESA')
      .reduce((sum, t) => sum + getTransactionBaseAmount(t), 0);
  }, [filteredTransactions]);

  const totalInvestments = useMemo(() => {
    return filteredTransactions
      .filter(t => t.transactionType === 'INVESTIMENTO')
      .reduce((sum, t) => sum + getTransactionBaseAmount(t), 0);
  }, [filteredTransactions]);

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) : 0;

  // Expenses by Category breakdown
  const categoryExpenses = useMemo(() => {
    const map: Record<string, { name: string; amount: number; color: string; groupName: string }> = {};

    filteredTransactions
      .filter(t => t.transactionType === 'DESPESA' && t.categoryName)
      .forEach(t => {
        const catName = t.categoryName!;
        const catObj = categories.find(c => c.name === catName);
        const color = catObj?.color || '#3B82F6';
        const group = catObj?.groupName || 'Geral';

        if (!map[catName]) {
          map[catName] = { name: catName, amount: 0, color, groupName: group };
        }
        map[catName].amount += getTransactionBaseAmount(t);
      });

    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, categories]);

  // Monthly Cash Flow Chart Data
  const monthlyCashflowData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      let month = selectedMonth;
      for (let offset = 0; offset < 5 - index; offset++) month = getPreviousMonth(month);
      return month;
    });
    return months.map(m => {
      const monthTxs = getTransactionsForMonth(transactions, m);
      const inc = monthTxs.filter(t => t.transactionType === 'RECEITA').reduce((s, t) => s + getTransactionBaseAmount(t), 0);
      const exp = monthTxs.filter(t => t.transactionType === 'DESPESA').reduce((s, t) => s + getTransactionBaseAmount(t), 0);
      const inv = monthTxs.filter(t => t.transactionType === 'INVESTIMENTO').reduce((s, t) => s + getTransactionBaseAmount(t), 0);
      return {
        month: formatMonthLabel(m, 'chart'),
        Receitas: inc,
        Despesas: exp,
        Investimentos: inv,
        Saldo: inc - exp
      };
    });
  }, [transactions, selectedMonth]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Data', 'Comerciante', 'Descricao', 'Valor', 'Moeda', 'Tipo', 'Categoria', 'Conta'];
    const rows = filteredTransactions.map(t => [
      t.id,
      t.date,
      `"${(t.merchant || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.amount,
      t.currency,
      t.transactionType,
      `"${(t.categoryName || '').replace(/"/g, '""')}"`,
      `"${(t.accountName || t.accountId || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_financeiro_${activeClient.name.toLowerCase().replace(/\s+/g, '_')}_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 print:bg-white print:text-black">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Relatórios & Análise Financeira
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Demonstrativos financeiros, evolução de fluxo de caixa e análise de rentabilidade para consultoria patrimonial.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setTimeRange('MONTH')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                timeRange === 'MONTH' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mês Atual ({formatMonthLabel(selectedMonth, 'short')})
            </button>
            <button
              onClick={() => setTimeRange('QUARTER')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                timeRange === 'QUARTER' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Trimestre
            </button>
            <button
              onClick={() => setTimeRange('YEAR')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                timeRange === 'YEAR' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ano {selectedMonth.slice(0, 4)}
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-xl font-bold">Relatório de Planejamento Financeiro e Gestão de Patrimônio</h1>
        <p className="text-sm">Cliente: {activeClient.name} • Moeda Base: {activeClient.baseCurrency} • Residência: {activeClient.residenceCountry}</p>
        <p className="text-xs text-gray-500">Emitido em: {new Date().toLocaleDateString('pt-BR')} via Plataforma de Wealth Planning</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Receita Total ({timeRange === 'MONTH' ? 'Mês' : timeRange})</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">
              {formatCurrency(totalIncome, currency)}
            </span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Despesas Totais</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-400">
              {formatCurrency(totalExpenses, currency)}
            </span>
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Taxa de Poupança</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-400">
              {formatPercent(savingsRate)}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              meta: 35%+
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Investimentos Realizados</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-300">
              {formatCurrency(totalInvestments, currency)}
            </span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
        </div>
      </div>

      {/* Report Sub-Tabs */}
      <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-fit overflow-x-auto print:hidden">
        <button
          onClick={() => setReportType('CASHFLOW')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            reportType === 'CASHFLOW' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Fluxo de Caixa Mensal
        </button>

        <button
          onClick={() => setReportType('CATEGORIES')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            reportType === 'CATEGORIES' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Distribuição de Despesas
        </button>

        <button
          onClick={() => setReportType('NETWORTH')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            reportType === 'NETWORTH' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Evolução Patrimonial
        </button>

        <button
          onClick={() => setReportType('INCOME_STATEMENT')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            reportType === 'INCOME_STATEMENT' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          DRE Pessoal Detalhada
        </button>
      </div>

      {/* 1. Cashflow Chart View */}
      {reportType === 'CASHFLOW' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Comparativo de Fluxo de Caixa (Últimos 6 Meses)
            </h2>
            <span className="text-xs text-slate-400">Valores em {currency}</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCashflowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: any) => formatCurrency(Number(value), currency)}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Investimentos" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 2. Categories Distribution View */}
      {reportType === 'CATEGORIES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
              Composição das Despesas
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryExpenses}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {categoryExpenses.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                    formatter={(value: any) => formatCurrency(Number(value), currency)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">
              Total gasto no período: <strong className="text-slate-100">{formatCurrency(totalExpenses, currency)}</strong>
            </p>
          </div>

          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Despesas por Categoria
            </h3>
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {categoryExpenses.map((cat, idx) => {
                const pct = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;

                return (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="font-semibold text-slate-200">{cat.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({cat.groupName})</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="font-bold text-slate-100">{formatCurrency(cat.amount, currency)}</span>
                        <span className="text-slate-400 text-[11px] w-12 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. Net Worth Evolution View */}
      {reportType === 'NETWORTH' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Evolução Histórica do Patrimônio Líquido
            </h2>
            <span className="text-xs text-slate-400">Total Acumulado ({currency})</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="netWorthReportGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: any) => formatCurrency(Number(value), currency)}
                />
                <Area type="monotone" dataKey="netWorth" name="Patrimônio Líquido" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#netWorthReportGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Income Statement / DRE Pessoal View */}
      {reportType === 'INCOME_STATEMENT' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Demonstrativo de Resultado do Exercício (DRE Pessoal)
            </h2>
            <span className="text-xs text-slate-400">Base: {filteredTransactions.length} transação(ões) no período</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5">Conta / Descrição</th>
                  <th className="py-2.5 text-right">Realizado ({currency})</th>
                  <th className="py-2.5 text-right">% da Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {/* 1. Receita Bruta */}
                <tr className="bg-emerald-950/20 font-bold text-emerald-300">
                  <td className="py-2.5 pl-2">1. RECEITA TOTAL BRUTA</td>
                  <td className="py-2.5 text-right">{formatCurrency(totalIncome, currency)}</td>
                  <td className="py-2.5 text-right">{totalIncome > 0 ? '100.0%' : '0.0%'}</td>
                </tr>

                {/* 2. Despesas por Categoria Real */}
                {categoryExpenses.length > 0 ? (
                  categoryExpenses.map((cat, idx) => (
                    <tr key={idx} className="text-slate-300">
                      <td className="py-2 pl-6 font-sans flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span>(-) {cat.name} <span className="text-[10px] text-slate-500">({cat.groupName})</span></span>
                      </td>
                      <td className="py-2 text-right text-rose-300 font-sans">{formatCurrency(cat.amount, currency)}</td>
                      <td className="py-2 text-right text-slate-400 font-sans">{totalIncome > 0 ? ((cat.amount / totalIncome) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))
                ) : (
                  <tr className="text-slate-500 italic">
                    <td className="py-2 pl-6 font-sans">(-) Nenhuma despesa no período</td>
                    <td className="py-2 text-right font-sans">{formatCurrency(0, currency)}</td>
                    <td className="py-2 text-right font-sans">0.0%</td>
                  </tr>
                )}

                {/* Subtotal Despesas */}
                <tr className="bg-rose-950/20 font-bold text-rose-300">
                  <td className="py-2.5 pl-2">2. TOTAL DAS DESPESAS</td>
                  <td className="py-2.5 text-right">{formatCurrency(totalExpenses, currency)}</td>
                  <td className="py-2.5 text-right">{totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : 0}%</td>
                </tr>

                {/* 3. Investimentos Realizados */}
                <tr className="text-indigo-300">
                  <td className="py-2 pl-6 font-sans">(+) Total de Investimentos & Aportes</td>
                  <td className="py-2 text-right font-sans">{formatCurrency(totalInvestments, currency)}</td>
                  <td className="py-2 text-right text-slate-400 font-sans">{totalIncome > 0 ? ((totalInvestments / totalIncome) * 100).toFixed(1) : 0}%</td>
                </tr>

                {/* Resultado Líquido Final */}
                <tr className="bg-blue-950/40 font-bold text-slate-100 text-sm border-t-2 border-slate-700">
                  <td className="py-3 pl-2">RESULTADO LÍQUIDO DISPONÍVEL (POUPANÇA FINAL)</td>
                  <td className="py-3 text-right text-emerald-400">{formatCurrency(netSavings, currency)}</td>
                  <td className="py-3 text-right text-blue-400">{formatPercent(savingsRate)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
