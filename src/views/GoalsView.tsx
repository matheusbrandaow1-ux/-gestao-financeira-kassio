import React, { useState } from 'react';
import { 
  Target, 
  Plus, 
  Sparkles, 
  Calendar, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Link2, 
  Edit2, 
  Trash2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { FinancialGoal, GoalType, GoalTrackingMethod } from '../types';
import { formatCurrency, calculateProgressPercent } from '../lib/money';

export const GoalsView: React.FC = () => {
  const { 
    activeClient, 
    goals, 
    accounts, 
    assets, 
    addGoal, 
    updateGoal, 
    deleteGoal, 
    recalculateGoals 
  } = useClient();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);

  const [goalForm, setGoalForm] = useState<{
    name: string;
    type: GoalType;
    description: string;
    targetAmount: number;
    currentAmount: number;
    startDate: string;
    targetDate: string;
    monthlyContribution: number;
    priority: 'ALTA' | 'MEDIA' | 'BAIXA';
    status: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'PAUSADO' | 'ATRASADO';
    trackingMethod: GoalTrackingMethod;
    sourceAccountIds: string[];
  }>({
    name: '',
    type: 'ENTRADA_IMOVEL',
    description: '',
    targetAmount: 50000,
    currentAmount: 0,
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '2029-12-31',
    monthlyContribution: 1000,
    priority: 'ALTA',
    status: 'EM_ANDAMENTO',
    trackingMethod: 'ACCOUNTS',
    sourceAccountIds: []
  });

  const currency = activeClient.baseCurrency;

  const handleOpenCreate = () => {
    setEditingGoal(null);
    setGoalForm({
      name: '',
      type: 'ENTRADA_IMOVEL',
      description: '',
      targetAmount: 50000,
      currentAmount: 0,
      startDate: new Date().toISOString().split('T')[0],
      targetDate: '2029-12-31',
      monthlyContribution: 1000,
      priority: 'ALTA',
      status: 'EM_ANDAMENTO',
      trackingMethod: 'ACCOUNTS',
      sourceAccountIds: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setGoalForm({
      name: goal.name,
      type: goal.type,
      description: goal.description,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      monthlyContribution: goal.monthlyContribution,
      priority: goal.priority,
      status: goal.status,
      trackingMethod: goal.trackingMethod,
      sourceAccountIds: goal.sourceAccountIds || []
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.name || goalForm.targetAmount <= 0) return;

    if (editingGoal) {
      await updateGoal(editingGoal.id, goalForm);
    } else {
      await addGoal({
        clientId: activeClient.id,
        currency,
        ...goalForm
      });
    }

    recalculateGoals();
    setIsModalOpen(false);
  };

  // Helper to calculate required pace and projected finish date
  const computeGoalForecast = (goal: FinancialGoal) => {
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    
    // Target months from now
    const now = new Date();
    const targetD = new Date(goal.targetDate);
    const monthsUntilTarget = Math.max(1, (targetD.getFullYear() - now.getFullYear()) * 12 + (targetD.getMonth() - now.getMonth()));

    // Required monthly pace
    const requiredMonthlyPace = remaining / monthsUntilTarget;

    // Projected months with current contribution
    const monthlyContribution = goal.monthlyContribution > 0 ? goal.monthlyContribution : requiredMonthlyPace;
    const projectedMonths = Math.ceil(remaining / (monthlyContribution || 1));
    const projectedDate = new Date();
    projectedDate.setMonth(projectedDate.getMonth() + projectedMonths);

    const isAheadOrOnTrack = monthlyContribution >= requiredMonthlyPace;

    return {
      remaining,
      monthsUntilTarget,
      requiredMonthlyPace: Math.round(requiredMonthlyPace),
      projectedDate: projectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      isAheadOrOnTrack
    };
  };

  return (
    <div className="ap-view space-y-8 pb-12">
      
      {/* Header */}
      <div className="ap-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-slate-800/80 pb-7">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-medium text-blue-400 uppercase tracking-[0.2em]">
            <span>Objetivos & Metas de Vida</span>
            <span>•</span>
            <span>{activeClient.name}</span>
          </div>
          <h1 className="ap-title text-2xl sm:text-3xl font-semibold text-slate-100 mt-2">
            Planejamento de Objetivos Financeiros
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Acompanhamento de progresso, projeções e fontes de capital vinculadas
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-3.5 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Objetivo</span>
        </button>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progress = calculateProgressPercent(goal.currentAmount, goal.targetAmount);
          const forecast = computeGoalForecast(goal);

          const linkedAccountNames = (goal.sourceAccountIds || [])
            .map(accId => accounts.find(a => a.id === accId)?.name)
            .filter(Boolean);

          return (
            <div 
              key={goal.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-sm"
            >
              {/* Top Meta */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    goal.priority === 'ALTA' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                    goal.priority === 'MEDIA' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    Prioridade {goal.priority}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(goal)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h2 className="text-base font-bold text-slate-100 mt-2">{goal.name}</h2>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{goal.description}</p>
              </div>

              {/* Progress Card Component (Specified in Prompt) */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-bold font-mono text-emerald-400">
                    {formatCurrency(goal.currentAmount, currency)}
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    de {formatCurrency(goal.targetAmount, currency)}
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 rounded-full transition-all duration-700 shadow-sm"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="font-bold text-emerald-300">{progress}%</span>
                    <span className="text-slate-400">Faltam {formatCurrency(forecast.remaining, currency)}</span>
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Aporte Mensal:</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {formatCurrency(goal.monthlyContribution, currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Data-Alvo:</span>
                    <span className="font-medium text-slate-300">
                      {new Date(goal.targetDate + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Previsão Atual:</span>
                    <span className="font-medium text-emerald-400 capitalize">
                      {forecast.projectedDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ritmo Necessário:</span>
                    <span className="font-mono text-slate-300">
                      {formatCurrency(forecast.requiredMonthlyPace, currency)}/mês
                    </span>
                  </div>
                </div>

                {/* Linked Source Callout */}
                {linkedAccountNames.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Link2 className="w-3 h-3 text-blue-400" />
                    <span>Fonte: {linkedAccountNames.join(', ')}</span>
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Goal Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingGoal ? 'Editar Objetivo Financeiro' : 'Novo Objetivo Financeiro'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome do Objetivo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Entrada do Imóvel em Zurique"
                  value={goalForm.name}
                  onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Tipo de Objetivo</label>
                  <select
                    value={goalForm.type}
                    onChange={(e) => setGoalForm({ ...goalForm, type: e.target.value as GoalType })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="ENTRADA_IMOVEL">Entrada de Imóvel</option>
                    <option value="RESERVA_EMERGENCIA">Reserva de Emergência</option>
                    <option value="INVESTIMENTOS">Investimentos</option>
                    <option value="INDEPENDENCIA_FINANCEIRA">Independência Financeira</option>
                    <option value="VIAGEM">Viagem</option>
                    <option value="EDUCACAO">Educação</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Prioridade</label>
                  <select
                    value={goalForm.priority}
                    onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Média</option>
                    <option value="BAIXA">Baixa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Valor Alvo ({currency})</label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={goalForm.targetAmount}
                    onChange={(e) => setGoalForm({ ...goalForm, targetAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Aporte Mensal Previsto ({currency})</label>
                  <input
                    type="number"
                    step="50"
                    required
                    value={goalForm.monthlyContribution}
                    onChange={(e) => setGoalForm({ ...goalForm, monthlyContribution: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    required
                    value={goalForm.startDate}
                    onChange={(e) => setGoalForm({ ...goalForm, startDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Data Alvo</label>
                  <input
                    type="date"
                    required
                    value={goalForm.targetDate}
                    onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Método de Rastreamento</label>
                <select
                  value={goalForm.trackingMethod}
                  onChange={(e) => setGoalForm({ ...goalForm, trackingMethod: e.target.value as GoalTrackingMethod })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                >
                  <option value="ACCOUNTS">Vinculado a Contas Bancárias (Auto-recalculado)</option>
                  <option value="MANUAL">Valor Manual</option>
                  <option value="ASSETS">Vinculado a Itens de Patrimônio</option>
                </select>
              </div>

              {goalForm.trackingMethod === 'ACCOUNTS' && (
                <div>
                  <label className="block text-slate-400 mb-1">Vincular Contas como Fonte:</label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto bg-slate-800/60 p-2 rounded-lg border border-slate-700">
                    {accounts.map(acc => {
                      const isChecked = goalForm.sourceAccountIds.includes(acc.id);
                      return (
                        <label key={acc.id} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setGoalForm({ ...goalForm, sourceAccountIds: [...goalForm.sourceAccountIds, acc.id] });
                              } else {
                                setGoalForm({ ...goalForm, sourceAccountIds: goalForm.sourceAccountIds.filter(id => id !== acc.id) });
                              }
                            }}
                            className="rounded bg-slate-700 text-blue-600"
                          />
                          <span>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold"
                >
                  {editingGoal ? 'Salvar Alterações' : 'Criar Objetivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
