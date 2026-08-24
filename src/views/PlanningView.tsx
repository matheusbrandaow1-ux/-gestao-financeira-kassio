import React, { useState, useMemo } from 'react';
import { 
  Copy, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Check, 
  AlertTriangle, 
  Sparkles,
  Save,
  PieChart
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { formatCurrency, formatPercent, calculateProgressPercent } from '../lib/money';
import { MonthlyPlan } from '../types';
import { MonthSelector } from '../components/common/MonthSelector';
import { 
  getAvailableMonths, 
  getTransactionsForMonth, 
  getNextMonth, 
  formatMonthLabel 
} from '../lib/monthUtils';
import { getTransactionBaseAmount } from '../lib/financialMetrics';

export const PlanningView: React.FC = () => {
  const { 
    activeClient, 
    categories, 
    transactions, 
    monthlyPlan, 
    updateMonthlyPlan, 
    duplicatePreviousMonthPlan,
    selectedMonth,
    setSelectedMonth
  } = useClient();

  const availableMonths = useMemo(() => {
    return getAvailableMonths(transactions, 'desc');
  }, [transactions]);

  const [isEditingTargets, setIsEditingTargets] = useState<boolean>(false);
  const [tempPlan, setTempPlan] = useState<MonthlyPlan>(monthlyPlan);
  const [duplicateSuccessMsg, setDuplicateSuccessMsg] = useState<string | null>(null);

  const currency = activeClient.baseCurrency;

  // Realized calculations for the selected month
  const monthTransactions = useMemo(() => {
    return getTransactionsForMonth(transactions, selectedMonth);
  }, [transactions, selectedMonth]);

  const realizedIncome = useMemo(() => {
    return monthTransactions
      .filter(t => t.transactionType === 'RECEITA')
      .reduce((sum, t) => sum + getTransactionBaseAmount(t), 0);
  }, [monthTransactions]);

  const realizedExpenses = useMemo(() => {
    return monthTransactions
      .filter(t => t.transactionType === 'DESPESA')
      .reduce((sum, t) => sum + getTransactionBaseAmount(t), 0);
  }, [monthTransactions]);

  const realizedInvestments = useMemo(() => {
    return monthTransactions
      .filter(t => t.transactionType === 'INVESTIMENTO')
      .reduce((sum, t) => sum + getTransactionBaseAmount(t), 0);
  }, [monthTransactions]);

  const plannedBalance = (monthlyPlan.plannedIncome || 0) - (monthlyPlan.plannedExpenses || 0) - (monthlyPlan.plannedInvestments || 0);
  const realizedBalance = realizedIncome - realizedExpenses - realizedInvestments;

  const plannedSavingsRate = (monthlyPlan.plannedIncome || 0) > 0 
    ? ((monthlyPlan.plannedIncome || 0) - (monthlyPlan.plannedExpenses || 0)) / (monthlyPlan.plannedIncome || 1) 
    : 0;

  const realizedSavingsRate = realizedIncome > 0 
    ? (realizedIncome - realizedExpenses) / realizedIncome 
    : 0;

  // Compute category spending
  const categoryRealizedMap = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions.forEach(t => {
      const category = categories.find(item => item.id === t.categoryId);
      if (t.categoryId && category && category.type === t.transactionType) {
        map[t.categoryId] = (map[t.categoryId] || 0) + getTransactionBaseAmount(t);
      }
    });
    return map;
  }, [categories, monthTransactions]);

  const handleDuplicateMonth = async () => {
    const nextMonth = getNextMonth(selectedMonth);
    await duplicatePreviousMonthPlan(nextMonth, selectedMonth);
    setDuplicateSuccessMsg(`Planejamento de ${formatMonthLabel(selectedMonth, 'short')} duplicado com sucesso para ${formatMonthLabel(nextMonth, 'full')}!`);
    setTimeout(() => setDuplicateSuccessMsg(null), 4000);
  };

  const handleSavePlan = async () => {
    let sumIncome = 0;
    let sumExp = 0;
    let sumInv = 0;

    const assignableCategories = categories.filter(c => !c.isGroup);
    assignableCategories.forEach(cat => {
      const planned = tempPlan.categoryPlans[cat.id]?.plannedAmount ?? cat.budgetPlanned ?? 0;
      if (cat.type === 'RECEITA') sumIncome += planned;
      else if (cat.type === 'DESPESA') sumExp += planned;
      else if (cat.type === 'INVESTIMENTO') sumInv += planned;
    });

    const updated: MonthlyPlan = {
      ...tempPlan,
      id: selectedMonth,
      month: selectedMonth,
      plannedIncome: sumIncome || tempPlan.plannedIncome,
      plannedExpenses: sumExp || tempPlan.plannedExpenses,
      plannedInvestments: sumInv || tempPlan.plannedInvestments,
      updatedAt: new Date().toISOString()
    };

    await updateMonthlyPlan(updated);
    setIsEditingTargets(false);
  };

  return (
    <div className="ap-view space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="ap-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-7">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-medium text-blue-400 uppercase tracking-[0.2em]">
            <span>Planejamento Mensal Orçamentário</span>
            <span>•</span>
            <span>{formatMonthLabel(selectedMonth, 'full')}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
            Orçamento Base Zero e Planejado x Realizado
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Metas de gastos, receitas e aportes em {currency}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <MonthSelector
            selectedMonth={selectedMonth}
            onChange={setSelectedMonth}
            transactions={transactions}
          />

          <button
            onClick={handleDuplicateMonth}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Copiar metas planejadas para o próximo mês"
          >
            <Copy className="w-3.5 h-3.5 text-blue-400" />
            <span>Duplicar Mês</span>
          </button>

          {!isEditingTargets ? (
            <button
              onClick={() => {
                setTempPlan(monthlyPlan);
                setIsEditingTargets(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Ajustar Metas</span>
            </button>
          ) : (
            <button
              onClick={handleSavePlan}
              className="px-3.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Metas</span>
            </button>
          )}
        </div>
      </div>

      {duplicateSuccessMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{duplicateSuccessMsg}</span>
        </div>
      )}

      {/* Monthly Summary KPI Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Receita */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-medium text-slate-400">Receitas ({formatMonthLabel(selectedMonth, 'short')})</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Plan:</span>
              <span className="text-xs font-mono font-medium text-slate-300">
                {formatCurrency(monthlyPlan.plannedIncome || 0, currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-emerald-400 font-semibold">Real:</span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {formatCurrency(realizedIncome, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Despesas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-medium text-slate-400">Despesas ({formatMonthLabel(selectedMonth, 'short')})</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Plan:</span>
              <span className="text-xs font-mono font-medium text-slate-300">
                {formatCurrency(monthlyPlan.plannedExpenses || 0, currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-rose-400 font-semibold">Real:</span>
              <span className="text-sm font-mono font-bold text-rose-400">
                {formatCurrency(realizedExpenses, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Investimentos */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-medium text-slate-400">Investimentos ({formatMonthLabel(selectedMonth, 'short')})</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Plan:</span>
              <span className="text-xs font-mono font-medium text-slate-300">
                {formatCurrency(monthlyPlan.plannedInvestments || 0, currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400 font-semibold">Real:</span>
              <span className="text-sm font-mono font-bold text-slate-100">
                {formatCurrency(realizedInvestments, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Saldo Líquido */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-medium text-slate-400">Saldo Livre</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Plan:</span>
              <span className="text-xs font-mono font-medium text-slate-300">
                {formatCurrency(plannedBalance, currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-300 font-semibold">Real:</span>
              <span className="text-sm font-mono font-bold text-slate-100">
                {formatCurrency(realizedBalance, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Taxa Poupança */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-medium text-slate-400">Taxa de Poupança</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Plan:</span>
              <span className="text-xs font-mono font-medium text-slate-300">
                {formatPercent(plannedSavingsRate)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-emerald-400 font-semibold">Real:</span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {formatPercent(realizedSavingsRate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Budget Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Detalhamento por Categoria</h3>
            <p className="text-xs text-slate-400">Acompanhamento e execução orçamentária de {formatMonthLabel(selectedMonth, 'full')}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Categoria</th>
                <th className="pb-3 font-semibold">Tipo</th>
                <th className="pb-3 font-semibold text-right">Meta Planejada</th>
                <th className="pb-3 font-semibold text-right">Executado Real</th>
                <th className="pb-3 font-semibold text-right">Desvio / Saldo</th>
                <th className="pb-3 font-semibold text-center w-36">Execução (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {categories.filter(c => !c.isGroup).map(cat => {
                const planned = isEditingTargets
                  ? (tempPlan.categoryPlans[cat.id]?.plannedAmount ?? cat.budgetPlanned ?? 0)
                  : (monthlyPlan.categoryPlans[cat.id]?.plannedAmount ?? cat.budgetPlanned ?? 0);
                const realized = categoryRealizedMap[cat.id] || 0;
                const diff = cat.type === 'RECEITA' ? realized - planned : planned - realized;
                const pct = planned > 0 ? (realized / planned) * 100 : null;

                return (
                  <tr key={cat.id} className="hover:bg-slate-800/40">
                    <td className="py-3 font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#9B7FDB' }} />
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-400">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        cat.type === 'RECEITA' ? 'bg-emerald-500/10 text-emerald-400' :
                        cat.type === 'INVESTIMENTO' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {cat.type}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-medium text-slate-300">
                      {isEditingTargets ? (
                        <input
                          type="number"
                          value={planned}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setTempPlan(prev => ({
                              ...prev,
                              categoryPlans: {
                                ...prev.categoryPlans,
                                [cat.id]: {
                                  categoryId: cat.id,
                                  categoryName: cat.name,
                                  plannedAmount: val
                                }
                              }
                            }));
                          }}
                          className="w-24 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-right font-mono text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        formatCurrency(planned, currency)
                      )}
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-slate-100">
                      {formatCurrency(realized, currency)}
                    </td>
                    <td className="py-3 text-right font-mono">
                      <span className={diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {diff >= 0 ? '+' : ''}{formatCurrency(diff, currency)}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {pct === null ? (
                          <span className="text-[11px] text-slate-500 w-full text-right">Sem meta</span>
                        ) : (
                          <>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct > 100 && cat.type === 'DESPESA' ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 w-10 text-right">{Math.round(pct)}%</span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
