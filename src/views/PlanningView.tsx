import React, { useState, useMemo } from 'react';
import { 
  CalendarRange, 
  Copy, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Check, 
  AlertTriangle, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Save,
  PieChart
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { formatCurrency, formatPercent, calculateProgressPercent } from '../lib/money';
import { MonthlyPlan } from '../types';

export const PlanningView: React.FC = () => {
  const { 
    activeClient, 
    categories, 
    transactions, 
    monthlyPlan, 
    updateMonthlyPlan, 
    duplicatePreviousMonthPlan 
  } = useClient();

  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [isEditingTargets, setIsEditingTargets] = useState<boolean>(false);
  const [tempPlan, setTempPlan] = useState<MonthlyPlan>(monthlyPlan);
  const [duplicateSuccess, setDuplicateSuccess] = useState<boolean>(false);

  const currency = activeClient.baseCurrency;

  // Realized calculations for the selected month
  const monthTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const realizedIncome = useMemo(() => {
    return monthTransactions
      .filter(t => t.transactionType === 'RECEITA')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthTransactions]);

  const realizedExpenses = useMemo(() => {
    return monthTransactions
      .filter(t => t.transactionType === 'DESPESA')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthTransactions]);

  const realizedInvestments = useMemo(() => {
    return monthTransactions
      .filter(t => t.transactionType === 'INVESTIMENTO')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthTransactions]);

  const plannedBalance = monthlyPlan.plannedIncome - monthlyPlan.plannedExpenses - monthlyPlan.plannedInvestments;
  const realizedBalance = realizedIncome - realizedExpenses - realizedInvestments;

  const plannedSavingsRate = monthlyPlan.plannedIncome > 0 
    ? (monthlyPlan.plannedIncome - monthlyPlan.plannedExpenses) / monthlyPlan.plannedIncome 
    : 0;

  const realizedSavingsRate = realizedIncome > 0 
    ? (realizedIncome - realizedExpenses) / realizedIncome 
    : 0;

  // Compute category spending
  const categoryRealizedMap = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions.forEach(t => {
      if (t.categoryId) {
        map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
      }
    });
    return map;
  }, [monthTransactions]);

  const handleDuplicateMonth = async () => {
    await duplicatePreviousMonthPlan('2026-09', '2026-08');
    setDuplicateSuccess(true);
    setTimeout(() => setDuplicateSuccess(false), 3000);
  };

  const handleSavePlan = async () => {
    // Recalculate totals from category plans
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
      plannedIncome: sumIncome || tempPlan.plannedIncome,
      plannedExpenses: sumExp || tempPlan.plannedExpenses,
      plannedInvestments: sumInv || tempPlan.plannedInvestments,
      updatedAt: new Date().toISOString()
    };

    await updateMonthlyPlan(updated);
    setIsEditingTargets(false);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <span>Planejamento Mensal Orçamentário</span>
            <span>•</span>
            <span>{activeClient.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
            Orçamento Base Zero e Planejado x Realizado
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Metas de gastos, receitas e aportes em {currency}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDuplicateMonth}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
            title="Copiar metas planejadas para o próximo mês"
          >
            <Copy className="w-3.5 h-3.5 text-blue-400" />
            <span>Duplicar Mês Anterior</span>
          </button>

          {!isEditingTargets ? (
            <button
              onClick={() => {
                setTempPlan(monthlyPlan);
                setIsEditingTargets(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Ajustar Metas</span>
            </button>
          ) : (
            <button
              onClick={handleSavePlan}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Metas</span>
            </button>
          )}
        </div>
      </div>

      {duplicateSuccess && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Planejamento duplicado com sucesso para o próximo mês (Setembro 2026)!</span>
        </div>
      )}

      {/* Monthly Summary KPI Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Receita */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-medium text-slate-400">Receitas</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Plan:</span>
              <span className="text-xs font-mono font-medium text-slate-300">
                {formatCurrency(monthlyPlan.plannedIncome, currency)}
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
          <span className="text-[11px] font-medium text-slate-400">Despesas</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Plan:</span>
              <span className="text-xs font-mono font-medium text-slate-300">
                {formatCurrency(monthlyPlan.plannedExpenses, currency)}
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
          <span className="text-[11px] font-medium text-slate-400">Investimentos</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Plan:</span>
              <span className="text-xs font-mono font-medium text-slate-300">
                {formatCurrency(monthlyPlan.plannedInvestments, currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-blue-400 font-semibold">Real:</span>
              <span className="text-sm font-mono font-bold text-blue-400">
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

      {/* Category-by-Category Planning Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Detalhamento por Categoria</h2>
            <p className="text-xs text-slate-400">Acompanhamento do consumo orçamentário por linha</p>
          </div>
          {isEditingTargets && (
            <span className="text-xs font-bold text-amber-400 animate-pulse">
              Modo de Edição Ativo: Ajuste os valores abaixo e clique em "Salvar Metas"
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Grupo</th>
                <th className="py-3 px-4 text-right">Planejado</th>
                <th className="py-3 px-4 text-right">Realizado</th>
                <th className="py-3 px-4 text-right">Disponível</th>
                <th className="py-3 px-4 min-w-[200px]">% Utilizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {categories.filter(c => !c.isGroup).map((cat) => {
                const planned = isEditingTargets 
                  ? tempPlan.categoryPlans[cat.id]?.plannedAmount || 0 
                  : (cat.budgetPlanned !== null && cat.budgetPlanned !== undefined && cat.budgetPlanned > 0)
                  ? cat.budgetPlanned
                  : (monthlyPlan.categoryPlans[cat.id]?.plannedAmount || cat.monthlyBudgetSuggested || 0);
                
                const realized = categoryRealizedMap[cat.id] || (cat.budgetSpent || 0);
                const available = planned - realized;
                const percentUsed = planned > 0 ? (realized / planned) * 100 : 0;
                const clampedPercent = Math.min(100, Math.round(percentUsed));

                const isOverBudget = realized > planned && planned > 0;

                return (
                  <tr key={cat.id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* Category Name */}
                    <td className="py-3 px-4 font-semibold text-slate-100 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span>{cat.name}</span>
                    </td>

                    {/* Group */}
                    <td className="py-3 px-4 text-slate-400">
                      {cat.groupName}
                    </td>

                    {/* Planned Input/Value */}
                    <td className="py-3 px-4 text-right font-mono font-medium">
                      {isEditingTargets ? (
                        <input
                          type="number"
                          step="10"
                          value={planned}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setTempPlan(prev => ({
                              ...prev,
                              categoryPlans: {
                                ...prev.categoryPlans,
                                [cat.id]: { plannedAmount: val }
                              }
                            }));
                          }}
                          className="w-28 p-1 text-right bg-slate-800 border border-blue-500 rounded text-slate-100 font-mono text-xs focus:outline-none"
                        />
                      ) : (
                        formatCurrency(planned, currency)
                      )}
                    </td>

                    {/* Realized */}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                      {formatCurrency(realized, currency)}
                    </td>

                    {/* Available */}
                    <td className={`py-3 px-4 text-right font-mono font-bold ${available >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCurrency(available, currency)}
                    </td>

                    {/* Progress Bar */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOverBudget 
                                ? 'bg-rose-500' 
                                : percentUsed > 80 
                                ? 'bg-amber-400' 
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${clampedPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>{percentUsed.toFixed(1)}%</span>
                          {isOverBudget && <span className="text-rose-400 font-bold">Estourou meta</span>}
                        </div>
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
