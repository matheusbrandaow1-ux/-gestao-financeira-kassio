import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit2, 
  Repeat, 
  Sparkles, 
  ArrowUpDown,
  Tag,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { CanonicalTransaction, TransactionType, ReviewStatus, CurrencyCode } from '../types';
import { formatCurrency } from '../lib/money';
import { MonthSelector } from '../components/common/MonthSelector';
import { getAvailableMonths } from '../lib/monthUtils';

export const TransactionsView: React.FC = () => {
  const { 
    transactions, 
    accounts, 
    categories, 
    activeClient, 
    addTransaction, 
    updateTransaction, 
    deleteTransaction, 
    recategorizeTransaction,
    addRule
  } = useClient();

  const { role } = useAuth();
  const isConsultant = role === 'CONSULTANT' || role === 'ADMIN';

  // Determine available transaction months
  const availableMonths = useMemo(() => {
    return getAvailableMonths(transactions, 'desc');
  }, [transactions]);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<string>('ALL');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [recurringOnly, setRecurringOnly] = useState<boolean>(false);
  const [monthFilter, setMonthFilter] = useState<string>(() => availableMonths[0] || '2026-08');

  // Keep monthFilter in sync if transactions change
  React.useEffect(() => {
    if (monthFilter !== 'ALL' && availableMonths.length > 0 && !availableMonths.includes(monthFilter)) {
      setMonthFilter(availableMonths[0]);
    }
  }, [availableMonths, monthFilter]);

  // Modals state
  const [isNewTxOpen, setIsNewTxOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<CanonicalTransaction | null>(null);
  const [rulePromptTx, setRulePromptTx] = useState<{ tx: CanonicalTransaction; categoryId: string } | null>(null);

  // New Transaction Form State
  const [newTxData, setNewTxData] = useState<Partial<CanonicalTransaction>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    merchant: '',
    amount: 0,
    currency: activeClient.baseCurrency,
    transactionType: 'DESPESA',
    accountId: accounts[0]?.id || '',
    categoryId: undefined
  });

  // Filter logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Month
      if (monthFilter !== 'ALL' && !tx.date.startsWith(monthFilter)) {
        return false;
      }
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchDesc = tx.description.toLowerCase().includes(query);
        const matchMerchant = tx.merchant.toLowerCase().includes(query);
        const matchNotes = tx.notes?.toLowerCase().includes(query);
        if (!matchDesc && !matchMerchant && !matchNotes) return false;
      }
      // Account
      if (selectedAccount !== 'ALL' && tx.accountId !== selectedAccount) {
        return false;
      }
      // Category
      if (selectedCategory !== 'ALL') {
        if (selectedCategory === 'UNCATEGORIZED' && tx.categoryId) return false;
        if (selectedCategory !== 'UNCATEGORIZED' && tx.categoryId !== selectedCategory) return false;
      }
      // Type
      if (selectedType !== 'ALL' && tx.transactionType !== selectedType) {
        return false;
      }
      // Review status
      if (selectedReviewStatus !== 'ALL' && tx.reviewStatus !== selectedReviewStatus) {
        return false;
      }
      // Currency
      if (selectedCurrency !== 'ALL' && tx.currency !== selectedCurrency) {
        return false;
      }
      // Recurring
      if (recurringOnly && !tx.isRecurring) {
        return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    transactions, 
    monthFilter, 
    searchTerm, 
    selectedAccount, 
    selectedCategory, 
    selectedType, 
    selectedReviewStatus, 
    selectedCurrency, 
    recurringOnly
  ]);

  // Aggregate stats for filtered list
  const filteredIncome = filteredTransactions
    .filter(t => t.transactionType === 'RECEITA')
    .reduce((sum, t) => sum + t.amount, 0);

  const filteredExpenses = filteredTransactions
    .filter(t => t.transactionType === 'DESPESA')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTxData.description || !newTxData.amount) return;

    await addTransaction(newTxData);
    setIsNewTxOpen(false);
    setNewTxData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      merchant: '',
      amount: 0,
      currency: activeClient.baseCurrency,
      transactionType: 'DESPESA',
      accountId: accounts[0]?.id || '',
      categoryId: undefined
    });
  };

  const handleUpdateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    if (!isConsultant) {
      // Client role can only update category
      await recategorizeTransaction(editingTx.id, editingTx.categoryId || '');
    } else {
      await updateTransaction(editingTx.id, editingTx);
    }
    setEditingTx(null);
  };

  const handleCategoryChange = async (tx: CanonicalTransaction, categoryId: string) => {
    await recategorizeTransaction(tx.id, categoryId);

    // If consultant and transaction has merchant and no rule exists, trigger the rule prompt
    if (isConsultant && tx.merchant && tx.merchant.trim().length >= 3) {
      setRulePromptTx({ tx, categoryId });
    }
  };

  const handleConfirmCreateRule = async () => {
    if (!rulePromptTx) return;
    const { tx, categoryId } = rulePromptTx;
    const cat = categories.find(c => c.id === categoryId);

    await addRule({
      clientId: activeClient.id,
      name: `Auto ${tx.merchant} -> ${cat?.name || 'Categoria'}`,
      priority: 10,
      conditions: [
        { field: 'merchant', operator: 'contains', value: tx.merchant }
      ],
      actions: {
        categoryId,
        transactionType: tx.transactionType,
        requestReview: false
      },
      isActive: true
    });

    setRulePromptTx(null);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <span>Controle Transacional</span>
            <span>•</span>
            <span>{activeClient.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
            Extrato e Classificação de Transações
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {filteredTransactions.length} movimentações no período selecionado
          </p>
        </div>

        {isConsultant && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsNewTxOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Transação</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary Filter Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <span className="text-xs text-slate-400">Total Receitas Filtradas</span>
          <span className="text-sm font-bold font-mono text-emerald-400">
            +{formatCurrency(filteredIncome, activeClient.baseCurrency)}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <span className="text-xs text-slate-400">Total Despesas Filtradas</span>
          <span className="text-sm font-bold font-mono text-rose-400">
            -{formatCurrency(filteredExpenses, activeClient.baseCurrency)}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <span className="text-xs text-slate-400">Resultado Líquido</span>
          <span className={`text-sm font-bold font-mono ${filteredIncome - filteredExpenses >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(filteredIncome - filteredExpenses, activeClient.baseCurrency)}
          </span>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por descrição, estabelecimento ou anotações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Dynamic Month Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">Mês:</span>
            <MonthSelector
              selectedMonth={monthFilter}
              onChange={setMonthFilter}
              transactions={transactions}
              allowAllOption={true}
            />
          </div>
        </div>

        {/* Detailed Filters Line */}
        <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-800 text-xs">
          
          {/* Account */}
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="bg-slate-800/80 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-slate-300 focus:outline-none"
          >
            <option value="ALL">Todas as Contas</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-800/80 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-slate-300 focus:outline-none"
          >
            <option value="ALL">Todas as Categorias</option>
            <option value="UNCATEGORIZED">⚠️ Sem Categoria</option>
            {Object.entries(
              categories
                .filter(c => !c.isGroup)
                .reduce((acc, cat) => {
                  const g = cat.groupName || 'Geral';
                  if (!acc[g]) acc[g] = [];
                  acc[g].push(cat);
                  return acc;
                }, {} as Record<string, typeof categories>)
            ).map(([groupName, groupCats]) => (
              <optgroup key={groupName} label={groupName}>
                {groupCats.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Type */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-800/80 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-slate-300 focus:outline-none"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="RECEITA">Receita</option>
            <option value="DESPESA">Despesa</option>
            <option value="INVESTIMENTO">Investimento</option>
            <option value="TRANSFERÊNCIA">Transferência</option>
            <option value="PAGAMENTO DE CARTÃO">Pagamento de Cartão</option>
            <option value="IGNORADA">Ignorada</option>
          </select>

          {/* Review Status */}
          <select
            value={selectedReviewStatus}
            onChange={(e) => setSelectedReviewStatus(e.target.value)}
            className="bg-slate-800/80 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-slate-300 focus:outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="REVISADA">Revisada</option>
            <option value="AUTO_REGRAS">Auto por Regras</option>
          </select>

          {/* Currency */}
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="bg-slate-800/80 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-slate-300 focus:outline-none"
          >
            <option value="ALL">Todas Moedas</option>
            <option value="CHF">CHF</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="BRL">BRL</option>
          </select>

          {/* Recurring Toggle */}
          <button
            onClick={() => setRecurringOnly(!recurringOnly)}
            className={`px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition-all ${
              recurringOnly 
                ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-semibold' 
                : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Repeat className="w-3 h-3" />
            <span>Recorrentes</span>
          </button>

          {(searchTerm || selectedAccount !== 'ALL' || selectedCategory !== 'ALL' || selectedType !== 'ALL' || selectedReviewStatus !== 'ALL' || selectedCurrency !== 'ALL' || recurringOnly) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedAccount('ALL');
                setSelectedCategory('ALL');
                setSelectedType('ALL');
                setSelectedReviewStatus('ALL');
                setSelectedCurrency('ALL');
                setRecurringOnly(false);
              }}
              className="text-blue-400 hover:text-blue-300 ml-auto font-medium"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Descrição / Estabelecimento</th>
                <th className="py-3 px-4">Conta</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Nenhuma transação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isIncome = tx.transactionType === 'RECEITA';
                  const isInvest = tx.transactionType === 'INVESTIMENTO';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                        {new Date(tx.date).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Description & Merchant */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          <span>{tx.merchant || tx.description}</span>
                          {tx.isRecurring && (
                            <span title="Transação Recorrente" className="text-blue-400">
                              <Repeat className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                          {tx.description}
                        </div>
                      </td>

                      {/* Account */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                        {tx.accountName || accounts.find(a => a.id === tx.accountId)?.name || 'Conta'}
                      </td>

                      {/* Category Selector Dropdown */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          value={tx.categoryId || ''}
                          onChange={(e) => handleCategoryChange(tx, e.target.value)}
                          className={`
                            px-2 py-1 rounded text-xs border focus:outline-none transition-all
                            ${tx.categoryId 
                              ? 'bg-slate-800 text-slate-200 border-slate-700' 
                              : 'bg-amber-950/60 text-amber-300 border-amber-500/40 font-semibold'
                            }
                          `}
                        >
                          <option value="">⚠️ Sem Categoria</option>
                          {Object.entries(
                            categories
                              .filter(c => !c.isGroup)
                              .reduce((acc, cat) => {
                                const g = cat.groupName || 'Geral';
                                if (!acc[g]) acc[g] = [];
                                acc[g].push(cat);
                                return acc;
                              }, {} as Record<string, typeof categories>)
                          ).map(([groupName, groupCats]) => (
                            <optgroup key={groupName} label={groupName}>
                              {groupCats.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`
                          px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                          ${tx.transactionType === 'RECEITA' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : ''}
                          ${tx.transactionType === 'DESPESA' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : ''}
                          ${tx.transactionType === 'INVESTIMENTO' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : ''}
                          ${tx.transactionType === 'TRANSFERÊNCIA' ? 'bg-slate-700 text-slate-300' : ''}
                          ${tx.transactionType === 'PAGAMENTO DE CARTÃO' ? 'bg-indigo-500/20 text-indigo-300' : ''}
                        `}>
                          {tx.transactionType}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold">
                        <span className={isIncome ? 'text-emerald-400' : isInvest ? 'text-blue-400' : 'text-slate-100'}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                        </span>
                      </td>

                      {/* Review Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {tx.reviewStatus === 'REVISADA' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Revisada</span>
                          </span>
                        ) : tx.reviewStatus === 'AUTO_REGRAS' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Auto Regra</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Pendente</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingTx(tx)}
                            title={isConsultant ? "Editar Transação" : "Recategorizar Transação"}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isConsultant && (
                            <button
                              onClick={() => deleteTransaction(tx.id)}
                              title="Excluir Transação"
                              className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suggest Rule Modal Prompt */}
      {rulePromptTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-blue-400 font-bold text-sm">
              <Sparkles className="w-5 h-5" />
              <span>Deseja criar uma regra para esse estabelecimento?</span>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              Você acabou de classificar <strong className="text-white">"{rulePromptTx.tx.merchant}"</strong> na categoria <strong className="text-blue-300">"{categories.find(c => c.id === rulePromptTx.categoryId)?.name}"</strong>.
              <br />
              Deseja que todas as futuras transações deste estabelecimento sejam categorizadas automaticamente?
            </p>

            <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
              SE merchant CONTÉM "{rulePromptTx.tx.merchant}"<br />
              ENTÃO categoria = "{categories.find(c => c.id === rulePromptTx.categoryId)?.name}"
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setRulePromptTx(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Não, apenas desta vez
              </button>
              <button
                onClick={handleConfirmCreateRule}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm"
              >
                Sim, Criar Regra Automática
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Transaction Modal */}
      {isNewTxOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">Nova Transação Manual</h2>
              <button onClick={() => setIsNewTxOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateTx} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={newTxData.date}
                    onChange={(e) => setNewTxData({ ...newTxData, date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Tipo</label>
                  <select
                    value={newTxData.transactionType}
                    onChange={(e) => setNewTxData({ ...newTxData, transactionType: e.target.value as TransactionType })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="DESPESA">Despesa</option>
                    <option value="RECEITA">Receita</option>
                    <option value="INVESTIMENTO">Investimento</option>
                    <option value="TRANSFERÊNCIA">Transferência</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Estabelecimento / Merchant</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Migros, SBB, Swisscom"
                  value={newTxData.merchant}
                  onChange={(e) => setNewTxData({ ...newTxData, merchant: e.target.value, description: newTxData.description || e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Compras semanais"
                  value={newTxData.description}
                  onChange={(e) => setNewTxData({ ...newTxData, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newTxData.amount || ''}
                    onChange={(e) => setNewTxData({ ...newTxData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Moeda</label>
                  <select
                    value={newTxData.currency}
                    onChange={(e) => setNewTxData({ ...newTxData, currency: e.target.value as CurrencyCode })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="BRL">BRL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Conta</label>
                  <select
                    value={newTxData.accountId}
                    onChange={(e) => setNewTxData({ ...newTxData, accountId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Categoria</label>
                  <select
                    value={newTxData.categoryId || ''}
                    onChange={(e) => setNewTxData({ ...newTxData, categoryId: e.target.value || undefined })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="">Sem Categoria</option>
                    {Object.entries(
                      categories
                        .filter(c => !c.isGroup)
                        .reduce((acc, cat) => {
                          const g = cat.groupName || 'Geral';
                          if (!acc[g]) acc[g] = [];
                          acc[g].push(cat);
                          return acc;
                        }, {} as Record<string, typeof categories>)
                    ).map(([groupName, groupCats]) => (
                      <optgroup key={groupName} label={groupName}>
                        {groupCats.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewTxOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Salvar Transação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-100">
                  {isConsultant ? 'Editar Transação' : 'Recategorizar Transação'}
                </h2>
                {!isConsultant && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Selecione a categoria apropriada para esta movimentação
                  </p>
                )}
              </div>
              <button onClick={() => setEditingTx(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            {!isConsultant && (
              <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/40 text-[11px] text-blue-300">
                Os dados financeiros originais são sincronizados em modo leitura. Apenas a categoria pode ser alterada.
              </div>
            )}

            <form onSubmit={handleUpdateTx} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    disabled={!isConsultant}
                    value={editingTx.date}
                    onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })}
                    className={`w-full border rounded-lg p-2 ${!isConsultant ? 'bg-slate-800/50 border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-200'}`}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Valor ({editingTx.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    disabled={!isConsultant}
                    value={editingTx.amount}
                    onChange={(e) => setEditingTx({ ...editingTx, amount: parseFloat(e.target.value) || 0 })}
                    className={`w-full border rounded-lg p-2 font-mono ${!isConsultant ? 'bg-slate-800/50 border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-200'}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Estabelecimento</label>
                <input
                  type="text"
                  disabled={!isConsultant}
                  value={editingTx.merchant}
                  onChange={(e) => setEditingTx({ ...editingTx, merchant: e.target.value })}
                  className={`w-full border rounded-lg p-2 ${!isConsultant ? 'bg-slate-800/50 border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-200'}`}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descrição</label>
                <input
                  type="text"
                  disabled={!isConsultant}
                  value={editingTx.description}
                  onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })}
                  className={`w-full border rounded-lg p-2 ${!isConsultant ? 'bg-slate-800/50 border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-200'}`}
                />
              </div>

              <div className={isConsultant ? "grid grid-cols-2 gap-3" : "space-y-3"}>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Categoria</label>
                  <select
                    value={editingTx.categoryId || ''}
                    onChange={(e) => setEditingTx({ ...editingTx, categoryId: e.target.value || undefined })}
                    className="w-full bg-slate-800 border border-blue-500/50 focus:border-blue-500 rounded-lg p-2 text-slate-100 font-medium"
                  >
                    <option value="">Sem Categoria</option>
                    {Object.entries(
                      categories
                        .filter(c => !c.isGroup)
                        .reduce((acc, cat) => {
                          const g = cat.groupName || 'Geral';
                          if (!acc[g]) acc[g] = [];
                          acc[g].push(cat);
                          return acc;
                        }, {} as Record<string, typeof categories>)
                    ).map(([groupName, groupCats]) => (
                      <optgroup key={groupName} label={groupName}>
                        {groupCats.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {isConsultant && (
                  <div>
                    <label className="block text-slate-400 mb-1">Status de Revisão</label>
                    <select
                      value={editingTx.reviewStatus}
                      onChange={(e) => setEditingTx({ ...editingTx, reviewStatus: e.target.value as ReviewStatus })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                    >
                      <option value="REVISADA">Revisada</option>
                      <option value="PENDENTE">Pendente</option>
                      <option value="AUTO_REGRAS">Auto por Regras</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                >
                  {isConsultant ? 'Salvar Alterações' : 'Salvar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
