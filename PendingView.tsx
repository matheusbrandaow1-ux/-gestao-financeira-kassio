import React, { useState, useMemo } from 'react';
import { 
  Inbox, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ArrowRight, 
  Sparkles, 
  Check, 
  SlidersHorizontal, 
  Tag, 
  Calendar, 
  ExternalLink,
  Target,
  FileSpreadsheet,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { CanonicalTransaction, PendingItem, Category } from '../types';
import { formatCurrency } from '../lib/money';
import { TabType } from '../components/common/Sidebar';

interface PendingViewProps {
  onNavigate?: (tab: TabType) => void;
}

export const PendingView: React.FC<PendingViewProps> = ({ onNavigate }) => {
  const { 
    pendingItems, 
    transactions, 
    categories, 
    activeClient, 
    resolvePendingItem, 
    recategorizeTransaction,
    updateTransaction,
    addRule,
    executeRulesOnAllTransactions
  } = useClient();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNCATEGORIZED' | 'REVIEW' | 'GOALS' | 'RESOLVED'>('ALL');
  const [selectedTxCategory, setSelectedTxCategory] = useState<Record<string, string>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Derive real-time uncategorized transactions
  const uncategorizedTransactions = useMemo(() => {
    return transactions.filter(t => !t.categoryId || t.categoryId === 'uncat' || t.categoryName === 'Sem Categoria');
  }, [transactions]);

  // Derive transactions flagged for review
  const flaggedTransactions = useMemo(() => {
    return transactions.filter(t => t.reviewStatus === 'PENDENTE');
  }, [transactions]);

  const currency = activeClient.baseCurrency;

  const handleQuickRecategorize = async (txId: string, categoryId: string, alsoCreateRule: boolean = false) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx || !categoryId) return;

    await recategorizeTransaction(txId, categoryId);

    if (alsoCreateRule && tx.merchant) {
      await addRule({
        clientId: activeClient.id,
        name: `Auto: ${tx.merchant}`,
        priority: 5,
        isActive: true,
        conditions: [{ field: 'merchant', operator: 'contains', value: tx.merchant }],
        actions: {
          categoryId,
          transactionType: tx.transactionType,
          requestReview: false
        }
      });
      setFeedbackMsg(`Transação categorizada e nova regra criada para "${tx.merchant}".`);
    } else {
      setFeedbackMsg(`Transação "${tx.merchant || tx.description}" categorizada com sucesso.`);
    }

    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleMarkReviewed = async (txId: string) => {
    await updateTransaction(txId, { reviewStatus: 'REVISADA' });
    setFeedbackMsg(`Transação marcada como revisada.`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleBatchCategorizeWithRules = async () => {
    const count = await executeRulesOnAllTransactions();
    setFeedbackMsg(`${count} transações foram auto-categorizadas pelas regras ativas.`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Inbox className="w-6 h-6 text-amber-400" />
            Central de Pendências & Revisão
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Itens que exigem conferência do consultor ou do cliente: transações sem categoria, avisos de ritmo e divergências.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleBatchCategorizeWithRules}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-medium text-xs shadow-md shadow-blue-900/30 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Auto-Classificar via Regras</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-slate-800 border border-blue-500/40 text-blue-300 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-200 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Transações Sem Categoria</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${uncategorizedTransactions.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {uncategorizedTransactions.length}
            </span>
            <span className="text-xs text-slate-500 font-mono">pendentes</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Marcadas para Revisão</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-400">{flaggedTransactions.length}</span>
            <span className="text-xs text-slate-500 font-mono">itens</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Alertas do Consultor</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-300">
              {pendingItems.filter(p => !p.isResolved).length}
            </span>
            <span className="text-xs text-slate-500 font-mono">chamados</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Status Geral</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-sm font-bold ${uncategorizedTransactions.length === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {uncategorizedTransactions.length === 0 ? 'Em Dia ✓' : 'Atenção Requerida'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">conferência</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-fit overflow-x-auto">
        <button
          onClick={() => setActiveFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            activeFilter === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Todas as Pendências ({uncategorizedTransactions.length + pendingItems.filter(p => !p.isResolved).length})
        </button>

        <button
          onClick={() => setActiveFilter('UNCATEGORIZED')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            activeFilter === 'UNCATEGORIZED' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Sem Categoria ({uncategorizedTransactions.length})
        </button>

        <button
          onClick={() => setActiveFilter('REVIEW')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            activeFilter === 'REVIEW' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Avisos & Alertas ({pendingItems.filter(p => !p.isResolved).length})
        </button>
      </div>

      {/* Section 1: Uncategorized Transactions Quick-Fix */}
      {(activeFilter === 'ALL' || activeFilter === 'UNCATEGORIZED') && uncategorizedTransactions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Transações Sem Categoria ({uncategorizedTransactions.length})
            </h2>
            <span className="text-xs text-slate-500">
              Classifique diretamente abaixo ou crie uma regra em 1 clique
            </span>
          </div>

          <div className="space-y-2.5">
            {uncategorizedTransactions.map((tx) => {
              const selectedCatId = selectedTxCategory[tx.id] || '';

              return (
                <div 
                  key={tx.id}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-100">
                        {tx.merchant || tx.description}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                        {tx.date}
                      </span>
                      <span className="text-xs text-slate-400">
                        Conta: {tx.accountName || tx.accountId}
                      </span>
                    </div>

                    {tx.notes && (
                      <p className="text-xs text-slate-400 italic">
                        "{tx.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    <span className="font-mono font-bold text-sm text-slate-100">
                      {formatCurrency(tx.amount, tx.currency)}
                    </span>

                    {/* Quick Category Selector */}
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedCatId}
                        onChange={(e) => setSelectedTxCategory(prev => ({ ...prev, [tx.id]: e.target.value }))}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Selecione uma Categoria...</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.groupName} → {c.name}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleQuickRecategorize(tx.id, selectedCatId, false)}
                        disabled={!selectedCatId}
                        className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-medium text-xs disabled:opacity-40 transition-all"
                      >
                        Salvar
                      </button>

                      {tx.merchant && (
                        <button
                          onClick={() => handleQuickRecategorize(tx.id, selectedCatId, true)}
                          disabled={!selectedCatId}
                          title="Salvar e criar regra permanente para este comerciante"
                          className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-indigo-100 font-medium text-xs disabled:opacity-40 flex items-center gap-1.5 transition-all"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">+ Regra</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Consultant & Planning Pending Checklist */}
      {(activeFilter === 'ALL' || activeFilter === 'REVIEW') && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Inbox className="w-4 h-4 text-blue-400" />
            Pendências e Avisos da Consultoria ({pendingItems.filter(p => !p.isResolved).length})
          </h2>

          {pendingItems.filter(p => !p.isResolved).length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
              <p className="font-semibold text-slate-200">Nenhuma pendência ativa!</p>
              <p className="text-slate-500 mt-1">Todas as conciliações e tarefas da consultoria foram resolvidas.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingItems.filter(p => !p.isResolved).map((item) => (
                <div 
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                      item.severity === 'URGENTE' 
                        ? 'bg-rose-500' 
                        : item.severity === 'AVISO' 
                        ? 'bg-amber-400' 
                        : 'bg-blue-400'
                    }`} />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-100">{item.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.severity === 'URGENTE' 
                            ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                            : item.severity === 'AVISO'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{item.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    {item.actionUrl && onNavigate && (
                      <button
                        onClick={() => onNavigate(item.actionUrl as TabType)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <span>{item.actionLabel || 'Ver Detalhes'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => resolvePendingItem(item.id)}
                      className="p-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-1 transition-colors"
                      title="Marcar como resolvido"
                    >
                      <Check className="w-4 h-4 text-emerald-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
