import React, { useState, useMemo } from 'react';
import { 
  FolderTree, 
  Layers, 
  Search, 
  RefreshCw, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  ShieldCheck, 
  ChevronDown, 
  ChevronRight,
  ExternalLink,
  Filter
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { Category } from '../types';
import { formatCurrency } from '../lib/money';

export const CategoriesView: React.FC = () => {
  const { 
    activeClient, 
    categories, 
    triggerLunchMoneySync, 
    isSyncing, 
    syncStatus, 
    lastSyncedAt 
  } = useClient();
  const { role } = useAuth();
  const isConsultant = role === 'CONSULTANT' || role === 'ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'DESPESA' | 'RECEITA' | 'INVESTIMENTO'>('ALL');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [syncFeedback, setSyncFeedback] = useState<{ message: string; success: boolean } | null>(null);

  const currency = activeClient?.baseCurrency || 'CHF';

  // Toggle group accordion
  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Group the categories hierarchically
  const { groupsList, childMap, standaloneCategories, stats } = useMemo(() => {
    const groups: Category[] = [];
    const childrenByGroupId = new Map<string, Category[]>();
    const standalone: Category[] = [];

    const allGroupsFromList = categories.filter(c => c.isGroup);
    const allChildFromList = categories.filter(c => !c.isGroup);

    // If we have explicit group objects
    if (allGroupsFromList.length > 0) {
      allGroupsFromList.forEach(grp => {
        groups.push(grp);
      });

      allChildFromList.forEach(cat => {
        if (cat.groupId && cat.groupId !== 'grp-root') {
          const list = childrenByGroupId.get(cat.groupId) || [];
          list.push(cat);
          childrenByGroupId.set(cat.groupId, list);
        } else {
          // Check by groupName matching
          const matchedGroup = allGroupsFromList.find(g => g.name.toLowerCase().trim() === (cat.groupName || '').toLowerCase().trim());
          if (matchedGroup) {
            const list = childrenByGroupId.get(matchedGroup.id) || [];
            list.push(cat);
            childrenByGroupId.set(matchedGroup.id, list);
          } else {
            standalone.push(cat);
          }
        }
      });
    } else {
      // Fallback: group by groupName if no isGroup objects present
      const uniqueGroupNames = Array.from(new Set(categories.map(c => c.groupName || 'Geral')));
      uniqueGroupNames.forEach((gName, idx) => {
        const groupItems = categories.filter(c => (c.groupName || 'Geral') === gName);
        const pseudoGroup: Category = {
          id: `grp-gen-${idx}`,
          groupId: 'grp-root',
          groupName: gName,
          name: gName,
          type: groupItems[0]?.type || 'DESPESA',
          subcategories: groupItems.map(i => i.name),
          color: groupItems[0]?.color || '#3B82F6',
          isGroup: true
        };
        groups.push(pseudoGroup);
        childrenByGroupId.set(pseudoGroup.id, groupItems);
      });
    }

    // Calculate metrics
    const totalGroups = groups.length;
    const totalAssignable = allChildFromList.length > 0 ? allChildFromList.length : categories.length;
    const withBudget = categories.filter(c => c.hasBudget || (c.budgetPlanned !== null && c.budgetPlanned !== undefined && c.budgetPlanned > 0)).length;

    return {
      groupsList: groups,
      childMap: childrenByGroupId,
      standaloneCategories: standalone,
      stats: {
        totalGroups,
        totalAssignable,
        withBudget
      }
    };
  }, [categories]);

  // Filter groups and categories based on search and type filter
  const filteredHierarchy = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return groupsList.map(group => {
      const children = (childMap.get(group.id) || group.children || []).filter(cat => {
        const matchesQuery = !q || cat.name.toLowerCase().includes(q) || (cat.groupName || '').toLowerCase().includes(q);
        const matchesType = selectedTypeFilter === 'ALL' || cat.type === selectedTypeFilter;
        return matchesQuery && matchesType;
      });

      const groupMatchesQuery = !q || group.name.toLowerCase().includes(q);
      const groupMatchesType = selectedTypeFilter === 'ALL' || group.type === selectedTypeFilter;

      const isVisible = children.length > 0 || (groupMatchesQuery && groupMatchesType);

      return {
        group,
        children,
        isVisible
      };
    }).filter(item => item.isVisible);
  }, [groupsList, childMap, searchQuery, selectedTypeFilter]);

  const handleSyncNow = async () => {
    setSyncFeedback(null);
    const result = await triggerLunchMoneySync();
    setSyncFeedback(result);
    setTimeout(() => {
      setSyncFeedback(null);
    }, 5000);
  };

  return (
    <div className="wealth-view space-y-8 pb-12">
      
      {/* Header Banner */}
      <div className="wealth-page-header flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-slate-800/80 pb-7">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-emerald-300 uppercase tracking-[0.2em]">
            <FolderTree className="w-3.5 h-3.5" />
            <span>Estrutura de Categorias & Orçamento</span>
            <span>•</span>
            <span className="text-slate-400">{activeClient?.name || 'Cliente'}</span>
          </div>
          <h1 className="wealth-title text-2xl sm:text-3xl font-semibold text-slate-100 mt-2">
            Categorias
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Hierarquia de grupos, categorias sincronizadas do Lunch Money e acompanhamento orçamentário
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-2 ${
              isSyncing 
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed' 
                : 'bg-emerald-800 hover:bg-emerald-700 text-white'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Lunch Money'}</span>
          </button>
        </div>
      </div>

      {/* Sync Feedback Alert */}
      {syncFeedback && (
        <div className={`p-4 rounded-xl border text-xs flex items-center justify-between transition-all ${
          syncFeedback.success 
            ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' 
            : 'bg-rose-950/40 border-rose-800 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {syncFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{syncFeedback.message}</span>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="wealth-metric border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Grupos de Categoria</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{stats.totalGroups}</div>
          <div className="text-[11px] text-slate-500 mt-1">Macro-divisões orçamentárias</div>
        </div>

        <div className="wealth-metric border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Categorias Atribuíveis</span>
            <Tag className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{stats.totalAssignable}</div>
          <div className="text-[11px] text-slate-500 mt-1">Disponíveis para classificar transações</div>
        </div>

        <div className="wealth-metric border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Fonte dos Dados</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-slate-200 mt-1">Lunch Money API v2</div>
          <div className="text-[11px] text-slate-500 mt-1">Sincronização fiel e idempotente</div>
        </div>

        <div className="wealth-metric border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Status de Conexão</span>
            <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'SINCRONIZADO' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
          </div>
          <div className="text-sm font-semibold text-slate-200 mt-1">{syncStatus || 'CONECTADO'}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {lastSyncedAt ? `Última: ${new Date(lastSyncedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Sincronizado'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="wealth-toolbar border-y border-slate-800/80 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome de categoria ou grupo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
          <button
            onClick={() => setSelectedTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedTypeFilter === 'ALL'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Todas ({stats.totalAssignable})
          </button>
          <button
            onClick={() => setSelectedTypeFilter('DESPESA')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedTypeFilter === 'DESPESA'
                ? 'bg-rose-800 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Despesas
          </button>
          <button
            onClick={() => setSelectedTypeFilter('RECEITA')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedTypeFilter === 'RECEITA'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Receitas
          </button>
          <button
            onClick={() => setSelectedTypeFilter('INVESTIMENTO')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedTypeFilter === 'INVESTIMENTO'
                ? 'bg-emerald-900 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Investimentos
          </button>
        </div>
      </div>

      {/* Category Hierarchy List */}
      <div className="space-y-4">
        {filteredHierarchy.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">Nenhuma categoria encontrada</p>
            <p className="text-xs text-slate-500 mt-1">Tente ajustar o termo de busca ou filtros acima.</p>
          </div>
        ) : (
          filteredHierarchy.map(({ group, children }) => {
            const isCollapsed = !!collapsedGroups[group.id];
            const hasChildren = children.length > 0;
            const groupBudgetPlanned = group.budgetPlanned !== null && group.budgetPlanned !== undefined ? group.budgetPlanned : null;
            const groupBudgetSpent = group.budgetSpent || 0;

            return (
              <div 
                key={group.id} 
                className="wealth-taxonomy border-y border-slate-800/80 overflow-hidden transition-all hover:border-slate-700"
              >
                {/* Group Accordion Header */}
                <div 
                  onClick={() => toggleGroup(group.id)}
                  className="p-4 bg-slate-800/50 border-b border-slate-800/80 flex items-center justify-between cursor-pointer select-none hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button className="text-slate-400 hover:text-slate-200">
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <span 
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" 
                      style={{ backgroundColor: group.color || '#3B82F6' }} 
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-100">{group.name}</h2>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                          {group.type}
                        </span>
                        {group.lunchMoneyCategoryId && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/80 text-emerald-400 font-mono">
                            LM #{group.lunchMoneyCategoryId}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {children.length} {children.length === 1 ? 'categoria' : 'categorias'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    {groupBudgetPlanned !== null && groupBudgetPlanned > 0 ? (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Orçamento do Grupo</span>
                        <span className="font-mono font-bold text-slate-200">
                          {formatCurrency(groupBudgetPlanned, currency)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium hidden sm:inline-block">
                        Grupo estrutural
                      </span>
                    )}
                  </div>
                </div>

                {/* Subcategories Grid / List */}
                {!isCollapsed && hasChildren && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-900/60">
                    {children.map(child => {
                      const hasBudget = child.hasBudget || (child.budgetPlanned !== null && child.budgetPlanned !== undefined && child.budgetPlanned > 0);
                      const planned = child.budgetPlanned || 0;
                      const spent = child.budgetSpent || 0;
                      const remaining = child.budgetRemaining !== null && child.budgetRemaining !== undefined ? child.budgetRemaining : (planned - spent);
                      const percent = planned > 0 ? Math.min(100, Math.round((spent / planned) * 100)) : 0;
                      const isOverBudget = spent > planned && planned > 0;

                      return (
                        <div 
                          key={child.id}
                          className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                style={{ backgroundColor: child.color || group.color || '#3B82F6' }} 
                              />
                              <div className="truncate">
                                <div className="text-xs font-bold text-slate-200 truncate">{child.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">{group.name}</div>
                              </div>
                            </div>

                            {child.lunchMoneyCategoryId && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono shrink-0">
                                #{child.lunchMoneyCategoryId}
                              </span>
                            )}
                          </div>

                          {/* Budget numbers if available */}
                          {hasBudget ? (
                            <div className="mt-3 pt-2.5 border-t border-slate-800/60 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Meta:</span>
                                <span className="font-mono font-semibold text-slate-200">{formatCurrency(planned, currency)}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Gasto:</span>
                                <span className="font-mono font-semibold text-slate-200">{formatCurrency(spent, currency)}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Saldo:</span>
                                <span className={`font-mono font-bold ${remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {formatCurrency(remaining, currency)}
                                </span>
                              </div>

                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div 
                                  className={`h-full rounded-full transition-all ${
                                    isOverBudget ? 'bg-rose-500' : percent > 85 ? 'bg-amber-400' : 'bg-emerald-400'
                                  }`} 
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 pt-2 border-t border-slate-800/40 text-[10px] text-slate-500 flex items-center justify-between">
                              <span>Sem limite fixado</span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-500">Ativa</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
