import React, { useState } from 'react';
import { 
  Repeat, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Edit2, 
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowRight
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { RecurringItem, TransactionType, RecurrenceFrequency } from '../types';
import { formatCurrency } from '../lib/money';

export const RecurrencesView: React.FC = () => {
  const { 
    activeClient, 
    recurringItems, 
    categories, 
    accounts, 
    addRecurringItem, 
    updateRecurringItem, 
    deleteRecurringItem 
  } = useClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null);

  const [recForm, setRecForm] = useState<{
    name: string;
    type: TransactionType;
    frequency: RecurrenceFrequency;
    dayOfMonth: number;
    amount: number;
    currency: string;
    categoryId?: string;
    accountId?: string;
    nextDueDate: string;
    status: 'PREVISTO' | 'PAGO' | 'ATRASADO';
    isActive: boolean;
  }>({
    name: '',
    type: 'DESPESA',
    frequency: 'MENSAL',
    dayOfMonth: 1,
    amount: 100,
    currency: activeClient.baseCurrency,
    nextDueDate: new Date().toISOString().split('T')[0],
    status: 'PREVISTO',
    isActive: true
  });

  const currency = activeClient.baseCurrency;

  const totalMonthlyCommitted = recurringItems
    .filter(r => r.type === 'DESPESA' && r.isActive)
    .reduce((sum, r) => sum + r.amount, 0);

  const totalMonthlyIncome = recurringItems
    .filter(r => r.type === 'RECEITA' && r.isActive)
    .reduce((sum, r) => sum + r.amount, 0);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setRecForm({
      name: '',
      type: 'DESPESA',
      frequency: 'MENSAL',
      dayOfMonth: 1,
      amount: 100,
      currency: activeClient.baseCurrency,
      nextDueDate: new Date().toISOString().split('T')[0],
      status: 'PREVISTO',
      isActive: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: RecurringItem) => {
    setEditingItem(item);
    setRecForm({
      name: item.name,
      type: item.type,
      frequency: item.frequency,
      dayOfMonth: item.dayOfMonth,
      amount: item.amount,
      currency: item.currency,
      categoryId: item.categoryId,
      accountId: item.accountId,
      nextDueDate: item.nextDueDate,
      status: item.status,
      isActive: item.isActive
    });
    setIsModalOpen(true);
  };

  const handleTogglePaid = async (item: RecurringItem) => {
    const newStatus = item.status === 'PAGO' ? 'PREVISTO' : 'PAGO';
    await updateRecurringItem(item.id, { status: newStatus });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recForm.name || recForm.amount <= 0) return;

    if (editingItem) {
      await updateRecurringItem(editingItem.id, recForm);
    } else {
      await addRecurringItem({
        clientId: activeClient.id,
        ...recForm as any
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="wealth-view space-y-8 pb-12">
      
      {/* Header */}
      <div className="wealth-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-slate-800/80 pb-7">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-emerald-300 uppercase tracking-[0.2em]">
            <span>Contratos & Pagamentos Recorrentes</span>
            <span>•</span>
            <span>{activeClient.name}</span>
          </div>
          <h1 className="wealth-title text-2xl sm:text-3xl font-semibold text-slate-100 mt-2">
            Agenda de Recorrências e Contas Fixas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Previsão mensal de compromissos fixos, salários e aportes programados
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Recorrência</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Receitas Recorrentes / Mês</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              +{formatCurrency(totalMonthlyIncome, currency)}
            </div>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Compromissos Fixos / Mês</span>
            <div className="text-xl font-bold font-mono text-rose-400 mt-1">
              -{formatCurrency(totalMonthlyCommitted, currency)}
            </div>
          </div>
          <TrendingDown className="w-5 h-5 text-rose-400" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Margem Fixa Líquida</span>
            <div className="text-xl font-bold font-mono text-slate-100 mt-1">
              {formatCurrency(totalMonthlyIncome - totalMonthlyCommitted, currency)}
            </div>
          </div>
          <Clock className="w-5 h-5 text-blue-400" />
        </div>
      </div>

      {/* Recurring Items Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100">Contratos & Agendamentos</h2>
          <span className="text-xs text-slate-400">{recurringItems.length} itens programados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Nome / Descrição</th>
                <th className="py-3 px-4">Frequência</th>
                <th className="py-3 px-4">Dia do Mês</th>
                <th className="py-3 px-4">Próx. Vencimento</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {recurringItems.map((item) => {
                const isIncome = item.type === 'RECEITA';
                const cat = categories.find(c => c.id === item.categoryId);

                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* Name */}
                    <td className="py-3 px-4 font-semibold text-slate-100">
                      {item.name}
                    </td>

                    {/* Frequency */}
                    <td className="py-3 px-4 text-slate-400 capitalize">
                      {item.frequency.toLowerCase()}
                    </td>

                    {/* Day of Month */}
                    <td className="py-3 px-4 font-mono text-slate-300">
                      Dia {item.dayOfMonth}
                    </td>

                    {/* Next Due Date */}
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(item.nextDueDate).toLocaleDateString('pt-BR')}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 text-slate-300">
                      {cat?.name || 'Geral'}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={isIncome ? 'text-emerald-400' : 'text-slate-100'}>
                        {isIncome ? '+' : '-'}{formatCurrency(item.amount, item.currency)}
                      </span>
                    </td>

                    {/* Status Button */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleTogglePaid(item)}
                        className={`
                          px-2.5 py-1 rounded text-[11px] font-bold uppercase transition-all flex items-center gap-1.5 mx-auto
                          ${item.status === 'PAGO' 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                          }
                        `}
                        title="Clique para alternar Previsto / Pago"
                      >
                        {item.status === 'PAGO' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        <span>{item.status}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteRecurringItem(item.id)}
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recurrence Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingItem ? 'Editar Recorrência' : 'Nova Recorrência'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome do Contrato / Recorrência</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel Zurique, Seguro Swica"
                  value={recForm.name}
                  onChange={(e) => setRecForm({ ...recForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Tipo</label>
                  <select
                    value={recForm.type}
                    onChange={(e) => setRecForm({ ...recForm, type: e.target.value as TransactionType })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="DESPESA">Despesa Fixa</option>
                    <option value="RECEITA">Receita Recorrente</option>
                    <option value="INVESTIMENTO">Aporte Recorrente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Frequência</label>
                  <select
                    value={recForm.frequency}
                    onChange={(e) => setRecForm({ ...recForm, frequency: e.target.value as RecurrenceFrequency })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="MENSAL">Mensal</option>
                    <option value="ANUAL">Anual</option>
                    <option value="TRIMESTRAL">Trimestral</option>
                    <option value="SEMANAL">Semanal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Valor ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={recForm.amount}
                    onChange={(e) => setRecForm({ ...recForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Dia do Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={recForm.dayOfMonth}
                    onChange={(e) => setRecForm({ ...recForm, dayOfMonth: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Categoria</label>
                  <select
                    value={recForm.categoryId || ''}
                    onChange={(e) => setRecForm({ ...recForm, categoryId: e.target.value || undefined })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="">Sem Categoria</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Status</label>
                  <select
                    value={recForm.status}
                    onChange={(e) => setRecForm({ ...recForm, status: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="PREVISTO">Previsto</option>
                    <option value="PAGO">Pago</option>
                    <option value="ATRASADO">Atrasado</option>
                  </select>
                </div>
              </div>

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
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Salvar Recorrência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
