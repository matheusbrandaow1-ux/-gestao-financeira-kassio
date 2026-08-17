import React, { useState } from 'react';
import { 
  Landmark, 
  Plus, 
  ShieldCheck, 
  TrendingUp, 
  Wallet, 
  Building2, 
  Coins, 
  CreditCard, 
  Edit2, 
  Trash2,
  PieChart as PieIcon,
  HelpCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { useClient } from '../context/ClientContext';
import { AssetOrLiability, AssetClassification, AssetCategory } from '../types';
import { formatCurrency } from '../lib/money';

export const AssetsView: React.FC = () => {
  const { 
    activeClient, 
    assets, 
    netWorthHistory, 
    addAsset, 
    updateAsset, 
    deleteAsset 
  } = useClient();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<AssetOrLiability | null>(null);

  const [assetForm, setAssetForm] = useState<{
    name: string;
    classification: AssetClassification;
    category: AssetCategory;
    value: number;
    currency: string;
    institution: string;
    notes: string;
  }>({
    name: '',
    classification: 'ATIVO',
    category: 'INVESTIMENTO_LIQUIDO',
    value: 10000,
    currency: activeClient.baseCurrency,
    institution: '',
    notes: ''
  });

  const currency = activeClient.baseCurrency;

  const totalAssets = assets
    .filter(a => a.classification === 'ATIVO')
    .reduce((sum, a) => sum + a.value, 0);

  const totalLiabilities = assets
    .filter(a => a.classification === 'PASSIVO')
    .reduce((sum, a) => sum + a.value, 0);

  const netWorth = totalAssets - totalLiabilities;

  // Asset allocation categories
  const assetAllocationData = assets
    .filter(a => a.classification === 'ATIVO')
    .map(a => ({ name: a.name, value: a.value }));

  const ALLOCATION_COLORS = ['#2563EB', '#0D9488', '#10B981', '#6366F1', '#8B5CF6', '#D97706', '#0284C7'];

  const handleOpenCreate = (classification: AssetClassification = 'ATIVO') => {
    setEditingAsset(null);
    setAssetForm({
      name: '',
      classification,
      category: classification === 'ATIVO' ? 'INVESTIMENTO_LIQUIDO' : 'CARTAO_CREDITO',
      value: 5000,
      currency: activeClient.baseCurrency,
      institution: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: AssetOrLiability) => {
    setEditingAsset(item);
    setAssetForm({
      name: item.name,
      classification: item.classification,
      category: item.category,
      value: item.value,
      currency: item.currency,
      institution: item.institution || '',
      notes: item.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.name || assetForm.value <= 0) return;

    if (editingAsset) {
      await updateAsset(editingAsset.id, assetForm);
    } else {
      await addAsset({
        clientId: activeClient.id,
        ...assetForm as any
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
            <span>Balanço Patrimonial & Wealth</span>
            <span>•</span>
            <span>{activeClient.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
            Gestão de Patrimônio Líquido (Ativos & Passivos)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Contas, previdência suíça (3a/2e pilier), investimentos e obrigações em {currency}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenCreate('PASSIVO')}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Passivo</span>
          </button>
          <button
            onClick={() => handleOpenCreate('ATIVO')}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Ativo</span>
          </button>
        </div>
      </div>

      {/* Patrimônio Summary Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-medium">Patrimônio Bruto (Ativos)</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {formatCurrency(totalAssets, currency)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {assets.filter(a => a.classification === 'ATIVO').length} itens cadastrados
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-medium">Total de Obrigações (Passivos)</span>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-2">
            {formatCurrency(totalLiabilities, currency)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {assets.filter(a => a.classification === 'PASSIVO').length} passivos abertos
          </span>
        </div>

        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5 bg-gradient-to-br from-slate-900 to-emerald-950/30">
          <span className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">Patrimônio Líquido</span>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
            {formatCurrency(netWorth, currency)}
          </div>
          <span className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Base de cálculo auditada</span>
          </span>
        </div>
      </div>

      {/* Net Worth Chart & Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Evolution Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Histórico de Evolução Patrimonial</h2>
              <p className="text-xs text-slate-400">Crescimento do patrimônio líquido consolidado</p>
            </div>
            <span className="text-xs font-mono text-slate-400 font-bold px-2 py-1 bg-slate-800 rounded">
              2026 YTD
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthHistory}>
                <defs>
                  <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `CHF ${(v / 1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: any) => formatCurrency(Number(val), currency)}
                />
                <Area type="monotone" dataKey="netWorth" stroke="#3b82f6" strokeWidth={2.5} fill="url(#assetGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Asset Allocation Pie */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-100 mb-1">Alocação de Ativos</h2>
            <p className="text-xs text-slate-400 mb-3">Distribuição percentual dos bens</p>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetAllocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {assetAllocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val: any) => formatCurrency(Number(val), currency)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-slate-800 pt-3 text-xs">
            {assetAllocationData.slice(0, 4).map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length] }} />
                  <span className="text-slate-300 truncate max-w-[130px]">{item.name}</span>
                </div>
                <span className="font-mono text-slate-200 font-semibold">{formatCurrency(item.value, currency, { compact: true })}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Two Columns: Ativos & Passivos Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Ativos Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-100">Ativos & Investimentos</h2>
            </div>
            <span className="font-mono font-bold text-xs text-emerald-400">
              {formatCurrency(totalAssets, currency)}
            </span>
          </div>

          <div className="space-y-2.5">
            {assets.filter(a => a.classification === 'ATIVO').map((item) => (
              <div 
                key={item.id}
                className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="font-semibold text-slate-200">{item.name}</div>
                  <div className="text-[11px] text-slate-400">{item.institution || 'Custódia Própria'}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono font-bold text-emerald-400">
                      {formatCurrency(item.value, currency)}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{item.category.replace('_', ' ')}</div>
                  </div>

                  <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteAsset(item.id)}
                      className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Passivos Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold text-slate-100">Passivos & Obrigações</h2>
            </div>
            <span className="font-mono font-bold text-xs text-rose-400">
              {formatCurrency(totalLiabilities, currency)}
            </span>
          </div>

          <div className="space-y-2.5">
            {assets.filter(a => a.classification === 'PASSIVO').length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Nenhum passivo em aberto.
              </div>
            ) : (
              assets.filter(a => a.classification === 'PASSIVO').map((item) => (
                <div 
                  key={item.id}
                  className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="font-semibold text-slate-200">{item.name}</div>
                    <div className="text-[11px] text-slate-400">{item.institution || 'Emissor'}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono font-bold text-rose-400">
                        -{formatCurrency(item.value, currency)}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{item.category.replace('_', ' ')}</div>
                    </div>

                    <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteAsset(item.id)}
                        className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Asset Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingAsset ? 'Editar Item Patrimonial' : 'Novo Item Patrimonial'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Classificação</label>
                  <select
                    value={assetForm.classification}
                    onChange={(e) => setAssetForm({ ...assetForm, classification: e.target.value as AssetClassification })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="ATIVO">Ativo (Bens / Investimentos)</option>
                    <option value="PASSIVO">Passivo (Dívidas / Cartão)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Categoria</label>
                  <select
                    value={assetForm.category}
                    onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value as AssetCategory })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="INVESTIMENTO_LIQUIDO">Investimento Líquido (Ações/ETFs)</option>
                    <option value="PREVIDENCIA_3A">3º Pilar Suíço (3a Säule)</option>
                    <option value="PREVIDENCIA_2E">2º Pilar Suíço (BVG)</option>
                    <option value="CONTA_BANCARIA">Conta Bancária / Caixa</option>
                    <option value="IMOVEL">Imóvel</option>
                    <option value="VEICULO">Veículo</option>
                    <option value="CRIPTO">Criptoativos</option>
                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                    <option value="EMPRESTIMO">Empréstimo / Financiamento</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nome do Item</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carteira Swissquote ETFs"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Valor Atual ({currency})</label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={assetForm.value}
                    onChange={(e) => setAssetForm({ ...assetForm, value: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Instituição</label>
                  <input
                    type="text"
                    placeholder="Ex: UBS, Swissquote, Viac"
                    value={assetForm.institution}
                    onChange={(e) => setAssetForm({ ...assetForm, institution: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Anotações / Notas do Consultor</label>
                <textarea
                  rows={2}
                  value={assetForm.notes}
                  onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
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
                  Salvar Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
