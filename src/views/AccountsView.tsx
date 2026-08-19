import React, { useState } from 'react';
import { 
  Wallet, 
  Plus, 
  CreditCard, 
  Building, 
  PiggyBank, 
  TrendingUp, 
  Edit2, 
  Trash2, 
  RefreshCw,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { getCapabilities } from '../lib/capabilities';
import { CanonicalAccount, AccountType, CurrencyCode } from '../types';
import { formatCurrency } from '../lib/money';

export const AccountsView: React.FC = () => {
  const { role } = useAuth();
  const { canEditAccounts, canManageIntegrations } = getCapabilities(role);
  const { 
    activeClient, 
    accounts, 
    addAccount, 
    updateAccount, 
    deleteAccount,
    triggerLunchMoneySync,
    isSyncing
  } = useClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<CanonicalAccount | null>(null);

  const [accForm, setAccForm] = useState<{
    name: string;
    institution: string;
    type: AccountType;
    currency: CurrencyCode;
    balance: number;
    creditLimit?: number;
    notes?: string;
  }>({
    name: '',
    institution: '',
    type: 'CHECKING',
    currency: activeClient.baseCurrency,
    balance: 0
  });

  const currency = activeClient.baseCurrency;

  const totalBalanceInCHF = accounts.reduce((sum, a) => sum + (a.balanceBase ?? a.balance), 0);

  const handleOpenCreate = () => {
    setEditingAcc(null);
    setAccForm({
      name: '',
      institution: '',
      type: 'CHECKING',
      currency: activeClient.baseCurrency,
      balance: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: CanonicalAccount) => {
    setEditingAcc(acc);
    setAccForm({
      name: acc.name,
      institution: acc.institution,
      type: acc.type,
      currency: acc.currency,
      balance: acc.balance,
      creditLimit: acc.creditLimit,
      notes: acc.notes
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accForm.name) return;

    if (editingAcc) {
      await updateAccount(editingAcc.id, accForm);
    } else {
      await addAccount({
        clientId: activeClient.id,
        isActive: true,
        provider: 'MANUAL',
        ...accForm
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <span>Gestão de Contas Bancárias & Custódias</span>
            <span>•</span>
            <span>{activeClient.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
            Contas Conectadas e Manuais
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Sincronizadas via Lunch Money v2 ou gerenciadas diretamente pelo consultor
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManageIntegrations && <button
            onClick={() => triggerLunchMoneySync()}
            disabled={isSyncing}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : 'text-blue-400'}`} />
            <span>Sincronizar Saldos</span>
          </button>}
          {canEditAccounts && <button
            onClick={handleOpenCreate}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Conta</span>
          </button>}
        </div>
      </div>

      {/* Grid of Accounts */}
      {accounts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center max-w-lg mx-auto">
          <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">Nenhuma conta cadastrada</h3>
          <p className="text-xs text-slate-400 mt-1">
            Sincronize com o Lunch Money v2 ou clique em "Nova Conta" para cadastrar saldos reais.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {canManageIntegrations && <button
              onClick={() => triggerLunchMoneySync()}
              disabled={isSyncing}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sincronizar Lunch Money</span>
            </button>}
            {canEditAccounts && <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Criar Manual</span>
            </button>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc) => {
            const isNegative = acc.balance < 0;

            return (
              <div 
                key={acc.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      acc.provider === 'LUNCH_MONEY' 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {acc.provider === 'LUNCH_MONEY' ? 'Lunch Money v2' : 'Manual'}
                    </span>

                    <div className="flex items-center gap-1">
                      {canEditAccounts && <button
                        onClick={() => handleOpenEdit(acc)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>}
                      {canEditAccounts && acc.provider === 'MANUAL' && (
                        <button
                          onClick={() => deleteAccount(acc.id)}
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <div className="p-2.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      {acc.type === 'CREDIT_CARD' ? <CreditCard className="w-5 h-5 text-indigo-400" /> :
                       acc.type === 'SAVINGS' ? <PiggyBank className="w-5 h-5 text-emerald-400" /> :
                       acc.type === 'INVESTMENT' || acc.type === 'PENSION_3A' ? <TrendingUp className="w-5 h-5 text-blue-400" /> :
                       <Building className="w-5 h-5 text-slate-300" />}
                    </div>

                    <div>
                      <h2 className="text-sm font-bold text-slate-100">{acc.name}</h2>
                      <span className="text-xs text-slate-400">{acc.institution}</span>
                    </div>
                  </div>
                </div>

                {/* Balance Box */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Saldo Contábil
                    </span>
                    <div className={`text-xl font-bold font-mono ${isNegative ? 'text-rose-400' : 'text-slate-100'}`}>
                      {formatCurrency(acc.balance, acc.currency)}
                    </div>
                  </div>

                  <span className="px-2 py-1 rounded bg-slate-800 text-xs font-mono font-bold text-slate-300 border border-slate-700">
                    {acc.currency}
                  </span>
                </div>

                {acc.lastSyncedAt && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Sincronizado: {new Date(acc.lastSyncedAt).toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingAcc ? 'Editar Conta' : 'Nova Conta Bancária / Custódia'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome da Conta</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: UBS Conta Corrente"
                  value={accForm.name}
                  onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Instituição</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: UBS Switzerland, BCGE"
                    value={accForm.institution}
                    onChange={(e) => setAccForm({ ...accForm, institution: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Tipo</label>
                  <select
                    value={accForm.type}
                    onChange={(e) => setAccForm({ ...accForm, type: e.target.value as AccountType })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="CHECKING">Conta Corrente</option>
                    <option value="SAVINGS">Poupança / Reserva</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="INVESTMENT">Custódia Investimento (ETFs/Ações)</option>
                    <option value="PENSION_3A">3º Pilar (3a Säule)</option>
                    <option value="CASH">Dinheiro / Carteira</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Saldo Atual</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={accForm.balance}
                    onChange={(e) => setAccForm({ ...accForm, balance: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Moeda da Conta</label>
                  <select
                    value={accForm.currency}
                    onChange={(e) => setAccForm({ ...accForm, currency: e.target.value as CurrencyCode })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="CHF">CHF (Franco Suíço)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="USD">USD (Dólar)</option>
                    <option value="BRL">BRL (Real)</option>
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
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
