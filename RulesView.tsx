import React, { useState, useMemo } from 'react';
import { 
  SlidersHorizontal, 
  Plus, 
  Play, 
  Sparkles, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  AlertCircle, 
  Tag, 
  Search, 
  ArrowRight,
  Filter,
  Layers,
  Copy,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  Clock
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { CanonicalRule, RuleCondition, RuleActions, TransactionType } from '../types';
import { evaluateCondition } from '../lib/rulesEngine';
import { formatCurrency } from '../lib/money';

export const RulesView: React.FC = () => {
  const { 
    rules, 
    transactions, 
    categories, 
    accounts, 
    activeClient, 
    addRule, 
    updateRule, 
    toggleRule, 
    deleteRule, 
    executeRulesOnAllTransactions 
  } = useClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CanonicalRule | null>(null);
  const [isExecutingBatch, setIsExecutingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<{ updatedCount: number; message: string } | null>(null);
  const [testRuleModal, setTestRuleModal] = useState<CanonicalRule | null>(null);

  // Form State for Create / Edit
  const [ruleForm, setRuleForm] = useState<{
    name: string;
    priority: number;
    isActive: boolean;
    conditions: RuleCondition[];
    actions: RuleActions;
  }>({
    name: '',
    priority: 1,
    isActive: true,
    conditions: [{ field: 'merchant', operator: 'contains', value: '' }],
    actions: {
      categoryId: '',
      subcategoryId: '',
      transactionType: 'DESPESA',
      tagsToAdd: [],
      requestReview: false
    }
  });

  const [newTagInput, setNewTagInput] = useState('');

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.conditions.some(c => String(c.value).toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (!matchesSearch) return false;

      if (filterActive === 'ACTIVE') return rule.isActive;
      if (filterActive === 'INACTIVE') return !rule.isActive;
      return true;
    }).sort((a, b) => a.priority - b.priority);
  }, [rules, searchTerm, filterActive]);

  // Statistics
  const totalRules = rules.length;
  const activeRulesCount = rules.filter(r => r.isActive).length;
  const totalMatches = rules.reduce((sum, r) => sum + (r.matchCount || 0), 0);
  const autoCategorizedTxs = transactions.filter(t => t.reviewStatus === 'AUTO_REGRAS').length;

  const handleOpenCreate = () => {
    setEditingRule(null);
    setRuleForm({
      name: '',
      priority: rules.length + 1,
      isActive: true,
      conditions: [{ field: 'merchant', operator: 'contains', value: '' }],
      actions: {
        categoryId: categories[0]?.id || '',
        subcategoryId: '',
        transactionType: 'DESPESA',
        tagsToAdd: [],
        requestReview: false
      }
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: CanonicalRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      priority: rule.priority,
      isActive: rule.isActive,
      conditions: rule.conditions.length > 0 ? [...rule.conditions] : [{ field: 'merchant', operator: 'contains', value: '' }],
      actions: { ...rule.actions }
    });
    setIsModalOpen(true);
  };

  const handleAddCondition = () => {
    setRuleForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: 'merchant', operator: 'contains', value: '' }]
    }));
  };

  const handleRemoveCondition = (index: number) => {
    if (ruleForm.conditions.length <= 1) return;
    setRuleForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const handleConditionChange = (index: number, updates: Partial<RuleCondition>) => {
    setRuleForm(prev => {
      const nextConds = [...prev.conditions];
      nextConds[index] = { ...nextConds[index], ...updates };
      return { ...prev, conditions: nextConds };
    });
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const currentTags = ruleForm.actions.tagsToAdd || [];
    if (!currentTags.includes(newTagInput.trim())) {
      setRuleForm(prev => ({
        ...prev,
        actions: { ...prev.actions, tagsToAdd: [...currentTags, newTagInput.trim()] }
      }));
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setRuleForm(prev => ({
      ...prev,
      actions: {
        ...prev.actions,
        tagsToAdd: (prev.actions.tagsToAdd || []).filter(t => t !== tag)
      }
    }));
  };

  // Live test matching transactions for the modal form
  const previewMatches = useMemo(() => {
    if (ruleForm.conditions.length === 0 || !ruleForm.conditions.some(c => String(c.value).trim())) {
      return [];
    }
    return transactions.filter(tx => {
      return ruleForm.conditions.every(c => evaluateCondition(c, tx));
    });
  }, [transactions, ruleForm.conditions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name.trim()) return;

    if (editingRule) {
      await updateRule(editingRule.id, {
        name: ruleForm.name,
        priority: ruleForm.priority,
        isActive: ruleForm.isActive,
        conditions: ruleForm.conditions,
        actions: ruleForm.actions
      });
    } else {
      await addRule({
        clientId: activeClient.id,
        name: ruleForm.name,
        priority: ruleForm.priority,
        isActive: ruleForm.isActive,
        conditions: ruleForm.conditions,
        actions: ruleForm.actions
      });
    }
    setIsModalOpen(false);
  };

  const handleExecuteAllBatch = async () => {
    setIsExecutingBatch(true);
    try {
      const count = await executeRulesOnAllTransactions();
      setBatchResult({
        updatedCount: count,
        message: `${count} transações foram avaliadas e categorizadas com sucesso pelas regras ativas.`
      });
      setTimeout(() => setBatchResult(null), 5000);
    } finally {
      setIsExecutingBatch(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <SlidersHorizontal className="w-6 h-6 text-blue-400" />
            Regras de Categorização Automática
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automatize a classificação de despesas e receitas importadas via Lunch Money ou inseridas manualmente.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExecuteAllBatch}
            disabled={isExecutingBatch || activeRulesCount === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white font-medium text-xs shadow-md shadow-indigo-900/20 transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isExecutingBatch ? 'animate-spin' : ''}`} />
            <span>{isExecutingBatch ? 'Executando...' : 'Executar em Lote'}</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-medium text-xs shadow-md shadow-blue-900/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Regra</span>
          </button>
        </div>
      </div>

      {/* Batch Result Notification */}
      {batchResult && (
        <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-200">Execução Concluída</p>
              <p className="text-xs text-emerald-300/90">{batchResult.message}</p>
            </div>
          </div>
          <button onClick={() => setBatchResult(null)} className="text-emerald-400 hover:text-emerald-200 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Total de Regras</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-100">{totalRules}</span>
            <span className="text-xs text-slate-500 font-mono">prioridades 1..{totalRules}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Regras Ativas</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-400">{activeRulesCount}</span>
            <span className="text-xs text-emerald-400 font-medium font-mono">
              {totalRules > 0 ? Math.round((activeRulesCount / totalRules) * 100) : 0}% ativas
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Disparos Acumulados</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-300">{totalMatches}</span>
            <span className="text-xs text-slate-500 font-mono">matches</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Transações Auto-Classificadas</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{autoCategorizedTxs}</span>
            <span className="text-xs text-slate-500 font-mono">
              de {transactions.length} total
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome da regra ou termo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700/80 text-xs">
            <button
              onClick={() => setFilterActive('ALL')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                filterActive === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas ({rules.length})
            </button>
            <button
              onClick={() => setFilterActive('ACTIVE')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                filterActive === 'ACTIVE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ativas ({activeRulesCount})
            </button>
            <button
              onClick={() => setFilterActive('INACTIVE')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                filterActive === 'INACTIVE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inativas ({totalRules - activeRulesCount})
            </button>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {filteredRules.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-slate-400">
            <SlidersHorizontal className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <p className="font-semibold text-slate-300">Nenhuma regra encontrada</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Crie regras automáticas para associar comerciantes como "Migros", "Coop", "SBB" ou pagamentos recorrentes a suas categorias correspondentes.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-medium text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Criar Primeira Regra
            </button>
          </div>
        ) : (
          filteredRules.map((rule) => {
            const targetCategory = categories.find(c => c.id === rule.actions.categoryId);
            
            return (
              <div 
                key={rule.id}
                className={`
                  p-4 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4
                  ${rule.isActive 
                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700' 
                    : 'bg-slate-900/40 border-slate-800/60 opacity-60'
                  }
                `}
              >
                {/* Left info & conditions */}
                <div className="flex-1 space-y-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      P{rule.priority}
                    </span>
                    <h3 className="font-bold text-sm text-slate-100">
                      {rule.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      rule.isActive 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {rule.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                    {rule.matchCount > 0 && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        ⚡ {rule.matchCount} transações aplicadas
                      </span>
                    )}
                  </div>

                  {/* Conditions & Actions Row */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Se:</span>
                    
                    {rule.conditions.map((cond, i) => (
                      <span 
                        key={i} 
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[11px]"
                      >
                        <span className="text-blue-400">{cond.field}</span>
                        <span className="text-slate-500">{cond.operator}</span>
                        <span className="text-amber-300 font-semibold">"{cond.value}"</span>
                      </span>
                    ))}

                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 mx-1 flex-shrink-0" />

                    <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Ação:</span>
                    
                    {targetCategory && (
                      <span 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border"
                        style={{ 
                          backgroundColor: `${targetCategory.color}15`, 
                          borderColor: `${targetCategory.color}40`,
                          color: targetCategory.color 
                        }}
                      >
                        <span>{targetCategory.name}</span>
                        {rule.actions.subcategoryId && (
                          <span className="text-slate-300 text-[10px]">/ {rule.actions.subcategoryId}</span>
                        )}
                      </span>
                    )}

                    {rule.actions.transactionType && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                        Tipo: {rule.actions.transactionType}
                      </span>
                    )}

                    {rule.actions.tagsToAdd && rule.actions.tagsToAdd.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800 text-[10px]">
                        <Tag className="w-3 h-3" />
                        {rule.actions.tagsToAdd.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions & Buttons */}
                <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800 justify-end">
                  <button
                    onClick={() => setTestRuleModal(rule)}
                    title="Testar regra com transações"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Testar</span>
                  </button>

                  <button
                    onClick={() => toggleRule(rule.id)}
                    title={rule.isActive ? 'Desativar Regra' : 'Ativar Regra'}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.isActive 
                        ? 'text-emerald-400 hover:bg-emerald-950/50' 
                        : 'text-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    {rule.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(rule)}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-blue-400" />
                {editingRule ? 'Editar Regra' : 'Nova Regra de Categorização'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-slate-300 font-medium">Nome da Regra</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Supermercados Migros / Coop"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Prioridade</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={ruleForm.priority}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Conditions Section */}
              <div className="space-y-2 border border-slate-800 rounded-xl p-3.5 bg-slate-950/40">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Condições (Todas devem ser atendidas)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="text-blue-400 hover:text-blue-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Condição
                  </button>
                </div>

                {ruleForm.conditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <select
                      value={cond.field}
                      onChange={(e) => handleConditionChange(idx, { field: e.target.value as any })}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none"
                    >
                      <option value="merchant">Comerciante (Merchant)</option>
                      <option value="description">Descrição</option>
                      <option value="amount">Valor (Amount)</option>
                      <option value="currency">Moeda</option>
                      <option value="tag">Tag</option>
                    </select>

                    <select
                      value={cond.operator}
                      onChange={(e) => handleConditionChange(idx, { operator: e.target.value as any })}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none"
                    >
                      <option value="contains">Contém</option>
                      <option value="equals">É igual a</option>
                      <option value="startsWith">Começa com</option>
                      <option value="endsWith">Termina com</option>
                      <option value="greaterThan">Maior que</option>
                      <option value="lessThan">Menor que</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Valor / Termo correspondente"
                      value={cond.value}
                      onChange={(e) => handleConditionChange(idx, { value: e.target.value })}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs placeholder-slate-500 focus:outline-none"
                    />

                    {ruleForm.conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions Section */}
              <div className="space-y-3 border border-slate-800 rounded-xl p-3.5 bg-slate-950/40">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                  Ações a Executar ao Encontrar Correspondência
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-400">Atribuir Categoria</label>
                    <select
                      value={ruleForm.actions.categoryId || ''}
                      onChange={(e) => setRuleForm(prev => ({
                        ...prev,
                        actions: { ...prev.actions, categoryId: e.target.value }
                      }))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none"
                    >
                      <option value="">(Não alterar categoria)</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.groupName} → {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400">Tipo de Transação</label>
                    <select
                      value={ruleForm.actions.transactionType || 'DESPESA'}
                      onChange={(e) => setRuleForm(prev => ({
                        ...prev,
                        actions: { ...prev.actions, transactionType: e.target.value as TransactionType }
                      }))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none"
                    >
                      <option value="DESPESA">DESPESA</option>
                      <option value="RECEITA">RECEITA</option>
                      <option value="INVESTIMENTO">INVESTIMENTO</option>
                      <option value="TRANSFERÊNCIA">TRANSFERÊNCIA</option>
                    </select>
                  </div>
                </div>

                {/* Tag manager */}
                <div className="space-y-1.5">
                  <label className="text-slate-400">Adicionar Tags Automáticas</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nova tag (ex: essencial, deduvel, suica)"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs"
                    >
                      Adicionar Tag
                    </button>
                  </div>

                  {ruleForm.actions.tagsToAdd && ruleForm.actions.tagsToAdd.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {ruleForm.actions.tagsToAdd.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-950/80 border border-blue-800 text-blue-300 text-[11px]">
                          #{tag}
                          <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-white font-bold ml-1">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Real-time Matching Preview Banner */}
              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>
                    Prévia: <strong>{previewMatches.length}</strong> transações existentes atendem a estas condições.
                  </span>
                </div>
                {previewMatches.length > 0 && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    ex: {previewMatches[0].merchant} ({formatCurrency(previewMatches[0].amount, previewMatches[0].currency)})
                  </span>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-semibold shadow-md shadow-blue-900/30"
                >
                  {editingRule ? 'Salvar Alterações' : 'Criar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Rule Modal against existing database */}
      {testRuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-400" />
                Teste da Regra: {testRuleModal.name}
              </h2>
              <button 
                onClick={() => setTestRuleModal(null)}
                className="text-slate-400 hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {(() => {
                const matched = transactions.filter(tx => testRuleModal.conditions.every(c => evaluateCondition(c, tx)));
                
                if (matched.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Nenhuma transação cadastrada atendeu aos critérios desta regra no momento.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <p className="text-xs text-emerald-400 font-semibold mb-2">
                      {matched.length} transações correspondem aos critérios:
                    </p>
                    {matched.map(tx => (
                      <div key={tx.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-200">{tx.merchant || tx.description}</p>
                          <p className="text-[11px] text-slate-500">{tx.date} • Conta: {tx.accountName || tx.accountId}</p>
                        </div>
                        <span className="font-mono font-bold text-slate-200">
                          {formatCurrency(tx.amount, tx.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setTestRuleModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Fechar Teste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
