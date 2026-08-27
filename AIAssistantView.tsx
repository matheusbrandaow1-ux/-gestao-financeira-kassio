import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  RefreshCw, 
  FileText, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { MonthlyFinancialSummaryReportData } from '../types';
import { getAccountBaseValue, getCanonicalBaseAmount, getFinancialSummary } from '../lib/canonicalFinance';
import { getTransactionsForMonth } from '../lib/monthUtils';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AIAssistantView: React.FC = () => {
  const { 
    activeClient, 
    accounts, 
    transactions, 
    categories, 
    monthlyPlan, 
    goals, 
    pendingItems,
    lastSyncedAt,
    selectedMonth
  } = useClient();
  const { user, role } = useAuth();
  const isConsultant = role === 'CONSULTANT' || role === 'ADMIN';

  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'summary'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: isConsultant 
        ? `Olá! Sou o Assistente Financeiro IA do cliente ${activeClient.name}. Posso analisar transações sincronizadas do Lunch Money, verificar aderência ao orçamento planejado, identificar anomalias e gerar resumos executivos de reunião.`
        : `Olá, ${activeClient.name}! Sou seu Assistente Financeiro IA. Estou aqui para esclarecer dúvidas sobre seus gastos, orçamento mensal, evolução patrimonial e metas financeiras.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Monthly summary state
  const [summaryReport, setSummaryReport] = useState<MonthlyFinancialSummaryReportData | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(selectedMonth);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Suggested prompt chips tailored to role
  const clientPromptChips = [
    'Quanto gastei em alimentação e supermercado?',
    'Quais foram meus maiores gastos realizados?',
    'Estou dentro do orçamento previsto?',
    'Qual é o meu saldo consolidado atual?',
    'Como está o progresso dos meus objetivos?'
  ];

  const consultantPromptChips = [
    'Quais categorias precisam da minha atenção?',
    'Quais transações ainda precisam de revisão?',
    'O cliente está seguindo o planejamento orçamentário?',
    'Prepare um resumo executivo para reunião com o cliente',
    'Existem anomalias ou cobranças duplicadas identificadas?'
  ];

  const promptChips = isConsultant ? consultantPromptChips : clientPromptChips;

  // Build a sanitized, period-scoped financial context. The AI receives the same
  // canonical totals shown by Dashboard/Planning instead of recalculating its own truth.
  const buildFinancialContext = () => {
    const monthTransactions = getTransactionsForMonth(transactions, selectedMonth);
    const summary = getFinancialSummary(monthTransactions);
    const totalBalance = accounts.reduce((acc, account) => acc + Math.max(0, getAccountBaseValue(account, activeClient.baseCurrency) ?? 0), 0);

    const catMap = new Map<string, number>();
    for (const transaction of monthTransactions.filter(tx => tx.transactionType === 'DESPESA')) {
      const category = transaction.categoryName || 'Sem categoria';
      catMap.set(category, (catMap.get(category) || 0) + (getCanonicalBaseAmount(transaction) ?? 0));
    }
    const topExpenseCategories = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));

    return {
      baseCurrency: activeClient.baseCurrency,
      totalBalance,
      accountsSummary: accounts.map(account => ({
        name: account.name,
        type: account.type,
        balance: getAccountBaseValue(account, activeClient.baseCurrency) ?? 0
      })),
      currentMonthTransactions: monthTransactions.slice(0, 60).map(transaction => ({
        date: transaction.date,
        description: transaction.description,
        merchant: transaction.merchant,
        amount: getCanonicalBaseAmount(transaction) ?? transaction.amount,
        category: transaction.categoryName
      })),
      monthlyBudget: {
        plannedIncome: monthlyPlan?.plannedIncome || 0,
        plannedExpenses: monthlyPlan?.plannedExpenses || 0,
        plannedInvestments: monthlyPlan?.plannedInvestments || 0
      },
      realizedTotals: {
        income: summary.income,
        expenses: summary.expenses,
        investments: summary.investments,
        netResult: summary.freeCashFlow
      },
      topExpenseCategories,
      goalsSummary: goals.map(goal => ({
        name: goal.name,
        target: goal.targetAmount,
        current: goal.currentAmount,
        status: goal.status
      })),
      pendingCount: pendingItems.filter(item => !item.isResolved).length
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query || !query.trim() || isLoading) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({
          clientId: activeClient.id,
          clientName: activeClient.name,
          messages: history,
          financialContext: buildFinancialContext()
        })
      });

      const data = await res.json();

      const assistantMsg: Message = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'Desculpe, não consegui obter a resposta no momento.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: 'Ocorreu um erro ao consultar o assistente de IA. Verifique sua conexão e tente novamente.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMonthlySummary = async () => {
    setIsLoadingSummary(true);
    try {
      const monthTransactions = getTransactionsForMonth(transactions, summaryMonth);
      let summaryPlan = monthlyPlan;
      if (summaryMonth !== selectedMonth) {
        try {
          const planRes = await fetch(`/api/data/monthlyPlans/${encodeURIComponent(summaryMonth)}?clientId=${encodeURIComponent(activeClient.id)}`, { credentials: 'include' });
          const planBody = await planRes.json().catch(() => ({}));
          if (planRes.ok && planBody.item) summaryPlan = planBody.item;
        } catch {
          // Keep the currently loaded plan as a UI fallback; no financial values are invented.
        }
      }

      const res = await fetch('/api/ai/monthly-summary', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({
          clientId: activeClient.id,
          month: summaryMonth,
          currency: activeClient.baseCurrency,
          transactions: monthTransactions.map(t => ({
            date: t.date,
            merchant: t.merchant,
            description: t.description,
            amount: getCanonicalBaseAmount(t) ?? 0,
            category: t.categoryName,
            type: t.transactionType
          })),
          monthlyPlan: {
            plannedIncome: summaryPlan.plannedIncome || 0,
            plannedExpenses: summaryPlan.plannedExpenses || 0,
            plannedInvestments: summaryPlan.plannedInvestments || 0
          },
          goals: goals.map(g => ({
            name: g.name,
            targetAmount: g.targetAmount,
            currentAmount: g.currentAmount,
            status: g.status
          })),
          pendingCount: pendingItems.filter(p => !p.isResolved).length
        })
      });

      const data = await res.json();
      if (data.report) {
        setSummaryReport(data.report);
      }
    } catch (e) {
      console.error('Erro ao gerar relatório mensal:', e);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Assistente Financeiro IA
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium">
                  Gemini 3.7
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                {isConsultant 
                  ? `Análise inteligente de dados e suporte ao planejamento do cliente ${activeClient.name}`
                  : 'Tire dúvidas sobre seu orçamento, despesas e investimentos em tempo real'}
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'chat'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Conversa IA</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('summary');
              if (!summaryReport) {
                handleGenerateMonthlySummary();
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'summary'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Resumo Mensal</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'chat' ? (
        /* Chat View */
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col h-[600px] overflow-hidden shadow-xl">
          
          {/* Context Header */}
          <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Contexto Ativo: <strong>{activeClient.name}</strong> ({activeClient.baseCurrency})</span>
            </div>
            <div className="flex items-center gap-3">
              <span>{transactions.length} transações analisadas</span>
              {transactions.length === 0 && (
                <span className="text-amber-400 text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Sem transações reais sincronizadas
                </span>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((m) => {
              const isAst = m.sender === 'assistant';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isAst ? 'justify-start' : 'justify-end'}`}
                >
                  {isAst && (
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    isAst 
                      ? 'bg-slate-800/90 text-slate-200 border border-slate-700/60 shadow-sm' 
                      : 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-900/20'
                  }`}>
                    <div className="whitespace-pre-line">{m.text}</div>
                    <div className={`mt-2 text-[10px] ${isAst ? 'text-slate-500' : 'text-blue-200'} text-right`}>
                      {m.timestamp}
                    </div>
                  </div>

                  {!isAst && (
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3 items-center text-xs text-blue-400 animate-pulse pl-1">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                </div>
                <span>Analisando base financeira real e gerando resposta...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestion Chips */}
          <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800/60 overflow-x-auto flex items-center gap-2 scrollbar-none">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 flex-shrink-0">
              Sugestões:
            </span>
            {promptChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={isLoading}
                className="text-xs whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700/90 text-slate-300 border border-slate-700/50 hover:border-blue-500/40 transition-all flex-shrink-0 disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isConsultant 
                  ? `Pergunte sobre receitas, despesas, objetivos ou prepare um relatório para ${activeClient.name}...`
                  : `Pergunte sobre seus gastos, orçamento ou investimentos em ${activeClient.baseCurrency}...`
              }
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none transition-colors"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-blue-900/30"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </div>
        </div>
      ) : (
        /* Monthly Financial Summary Report View */
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-slate-300">Mês de Referência:</span>
              <input
                type="month"
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleGenerateMonthlySummary}
              disabled={isLoadingSummary}
              className="px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSummary ? 'animate-spin' : ''}`} />
              <span>{isLoadingSummary ? 'Gerando...' : 'Atualizar Resumo'}</span>
            </button>
          </div>

          {isLoadingSummary ? (
            <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs font-medium">Consolidando dados financeiros e gerando observações de IA...</p>
            </div>
          ) : summaryReport ? (
            <div className="space-y-6">
              {/* Financial Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Receitas Realizadas</span>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {summaryReport.currency} {summaryReport.incomeRealized.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Planejado: {summaryReport.currency} {summaryReport.incomePlanned.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Despesas Realizadas</span>
                  <div className="text-xl font-bold text-rose-400 mt-1">
                    {summaryReport.currency} {summaryReport.expensesRealized.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Planejado: {summaryReport.currency} {summaryReport.expensesPlanned.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Investimentos Realizados</span>
                  <div className="text-xl font-bold text-blue-400 mt-1">
                    {summaryReport.currency} {summaryReport.investmentsRealized.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Planejado: {summaryReport.currency} {summaryReport.investmentsPlanned.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Taxa de Poupança</span>
                  <div className="text-xl font-bold text-indigo-400 mt-1">
                    {summaryReport.savingsRateRealized.toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Resultado: {summaryReport.currency} {summaryReport.netResultRealized.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* AI Executive Observations */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-blue-500/30 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                    Observações Analíticas da IA
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {summaryReport.aiObservations}
                </p>
              </div>

              {/* Breakdown: Top Categories & Goals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Categories */}
                <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Principais Categorias de Despesa
                  </h4>
                  {summaryReport.topCategories.length > 0 ? (
                    <div className="space-y-3">
                      {summaryReport.topCategories.map((c, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-200">{c.name}</span>
                            <span className="font-mono text-slate-300">
                              {summaryReport.currency} {c.amount.toLocaleString('de-CH', { minimumFractionDigits: 2 })} ({c.percentageOfTotal.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, c.percentageOfTotal)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                      Nenhuma despesa registrada para este mês.
                    </div>
                  )}
                </div>

                {/* Goals Status */}
                <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Acompanhamento de Objetivos
                  </h4>
                  {summaryReport.goalsProgress.length > 0 ? (
                    <div className="space-y-3">
                      {summaryReport.goalsProgress.map((g, idx) => {
                        const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
                        return (
                          <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-200">{g.name}</span>
                              <span className="text-[11px] font-mono text-emerald-400 font-bold">{pct.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>Atual: {summaryReport.currency} {g.currentAmount.toLocaleString('de-CH')}</span>
                              <span>Meta: {summaryReport.currency} {g.targetAmount.toLocaleString('de-CH')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                      Nenhum objetivo cadastrado.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
