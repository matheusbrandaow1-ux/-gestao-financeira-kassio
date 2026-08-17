import React, { useState, useEffect, useCallback } from 'react';
import { 
  Zap, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Layers, 
  Clock, 
  Key, 
  Activity,
  Database,
  Radio,
  Info,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  Check,
  Building2,
  Wallet,
  Globe,
  User,
  ShieldAlert
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/money';
import { PublicLunchMoneyIntegration } from '../types';

export const IntegrationsView: React.FC = () => {
  const { 
    activeClient, 
    accounts, 
    categories, 
    syncJobs, 
    lastSyncedAt, 
    syncStatus, 
    isSyncing, 
    triggerLunchMoneySync 
  } = useClient();

  const { role, user: currentUser } = useAuth();
  const isConsultantOrAdmin = role === 'CONSULTANT' || role === 'ADMIN';

  // Integration state from server (isolated per client)
  const [integration, setIntegration] = useState<PublicLunchMoneyIntegration | null>(null);
  const [isLoadingIntegration, setIsLoadingIntegration] = useState(true);

  // UI feedback & testing states
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isTestingActiveConnection, setIsTestingActiveConnection] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'CONNECT' | 'REPLACE'>('CONNECT');
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    user?: {
      userName?: string;
      userEmail?: string;
      budgetName?: string;
      primaryCurrency?: string;
    };
  } | null>(null);

  // Disconnect Confirmation Modal
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Fetch integration info for the active client
  const fetchIntegrationStatus = useCallback(async () => {
    setIsLoadingIntegration(true);
    try {
      const res = await fetch(`/api/lunchmoney/integration?clientId=${encodeURIComponent(activeClient.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.integration && data.integration.status === 'CONNECTED') {
          setIntegration(data.integration);
        } else {
          setIntegration(null);
        }
      } else {
        setIntegration(null);
      }
    } catch {
      setIntegration(null);
    } finally {
      setIsLoadingIntegration(false);
    }
  }, [activeClient.id]);

  useEffect(() => {
    fetchIntegrationStatus();
  }, [fetchIntegrationStatus]);

  // Test current active connection
  const handleTestActiveConnection = async () => {
    setIsTestingActiveConnection(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/lunchmoney/me?clientId=${encodeURIComponent(activeClient.id)}`);
      const data = await response.json();

      if (response.ok && data.success) {
        if (data.integration) {
          setIntegration(data.integration);
        }
        setFeedback({
          type: 'success',
          message: `Conexão ativa e validada! Conta: ${data.user?.userName || 'Principal'} | Orçamento: ${data.user?.budgetName || 'Ativo'} (${data.user?.primaryCurrency || 'CHF'}).`
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.message || 'Falha ao validar a conexão com o Lunch Money.'
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Serviço de backend ou API do Lunch Money indisponível no momento.'
      });
    } finally {
      setIsTestingActiveConnection(false);
    }
  };

  // Open modal in Connect or Replace mode
  const handleOpenModal = (mode: 'CONNECT' | 'REPLACE') => {
    setModalMode(mode);
    setTokenInput('');
    setShowToken(false);
    setTestResult(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTokenInput('');
    setShowToken(false);
    setTestResult(null);
  };

  // Test token inside modal (transient validation via server API)
  const handleTestTokenInModal = async () => {
    if (!tokenInput.trim()) {
      setTestResult({
        success: false,
        message: 'Por favor, informe um Access Token antes de testar.'
      });
      return;
    }

    setIsTestingToken(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/lunchmoney/test-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput.trim(),
          userRole: role
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: 'Token válido e verificado com a API do Lunch Money!',
          user: data.user
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || 'Token inválido ou rejeitado pela API do Lunch Money.'
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Erro de comunicação ao validar token no servidor.'
      });
    } finally {
      setIsTestingToken(false);
    }
  };

  // Connect / Save token for client
  const handleConnectToken = async () => {
    if (!tokenInput.trim()) {
      setTestResult({
        success: false,
        message: 'Por favor, insira o token do Lunch Money.'
      });
      return;
    }

    setIsConnecting(true);

    try {
      const response = await fetch('/api/lunchmoney/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: activeClient.id,
          token: tokenInput.trim(),
          userRole: role,
          userId: currentUser?.uid
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIntegration(data.integration);
        handleCloseModal();
        setFeedback({
          type: 'success',
          message: `Lunch Money conectado com sucesso para ${activeClient.name}! Orçamento: ${data.user?.budgetName || 'Principal'} (${data.user?.primaryCurrency || 'CHF'}).`
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || 'Não foi possível conectar com o token fornecido.'
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Erro de comunicação ao salvar token no servidor.'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect integration
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/lunchmoney/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: activeClient.id,
          userRole: role,
          userId: currentUser?.uid
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIntegration(null);
        setIsDisconnectModalOpen(false);
        setFeedback({
          type: 'info',
          message: `Integração Lunch Money desconectada para o cliente ${activeClient.name}.`
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.message || 'Erro ao desconectar integração.'
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Erro ao comunicar com o servidor.'
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Manual synchronization
  const handleManualSync = async () => {
    const res = await triggerLunchMoneySync();
    setFeedback({
      type: res.success ? 'success' : 'error',
      message: res.message
    });
    fetchIntegrationStatus();
    setTimeout(() => setFeedback(null), 8000);
  };

  const isConnected = integration?.status === 'CONNECTED';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
              <Zap className="w-6 h-6 text-amber-400" />
              Integrações
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              Cliente: {activeClient.name}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Gerenciamento de conexões bancárias e sincronização contábil direta (Modo estrito Read-Only).
          </p>
        </div>

        {/* Global Action Header (Sync / Recheck) */}
        {isConnected && (
          <div className="flex items-center gap-3">
            <button
              id="test-lunchmoney-active-btn"
              onClick={handleTestActiveConnection}
              disabled={isTestingActiveConnection || isSyncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs shadow transition-all disabled:opacity-50"
            >
              <Radio className={`w-3.5 h-3.5 text-emerald-400 ${isTestingActiveConnection ? 'animate-pulse text-amber-400' : ''}`} />
              <span>{isTestingActiveConnection ? 'Validando...' : 'Testar Conexão'}</span>
            </button>

            <button
              id="sync-lunchmoney-now-btn"
              onClick={handleManualSync}
              disabled={isSyncing || isTestingActiveConnection}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-900/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Sync / Test Feedback Alert */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-fadeIn ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
            : feedback.type === 'error'
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              : 'bg-blue-950/40 border-blue-500/40 text-blue-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-200 font-bold ml-3">
            ✕
          </button>
        </div>
      )}

      {/* Main Lunch Money Integration Card */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
              isConnected 
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                : 'bg-slate-800 border border-slate-700 text-slate-400'
            }`}>
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-100">
                  Lunch Money {isConnected ? '— Conectado' : '— Não conectado'}
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {isConnected ? 'Ativo (v2 API)' : 'Desconectado'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Sincronização em tempo real e idempotente de contas bancárias, saldos, categorias e transações. 
                Isolamento estrito por cliente ({activeClient.name}).
              </p>
            </div>
          </div>

          {/* Action Buttons for Card */}
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {!isConnected ? (
              <button
                id="connect-lunchmoney-btn"
                onClick={() => handleOpenModal('CONNECT')}
                disabled={!isConsultantOrAdmin || isLoadingIntegration}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
              >
                <Key className="w-4 h-4" />
                <span>Conectar Lunch Money</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="replace-lunchmoney-token-btn"
                  onClick={() => handleOpenModal('REPLACE')}
                  disabled={!isConsultantOrAdmin || isSyncing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-all disabled:opacity-50"
                  title="Atualizar Access Token"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Substituir Token</span>
                </button>

                <button
                  id="disconnect-lunchmoney-btn"
                  onClick={() => setIsDisconnectModalOpen(true)}
                  disabled={!isConsultantOrAdmin || isSyncing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-300 text-xs font-medium transition-all disabled:opacity-50"
                  title="Desconectar integração"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Desconectar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Security & Access Guard Notice if user is CLIENT */}
        {!isConsultantOrAdmin && (
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-center gap-2.5 text-xs text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Acesso Restrito:</strong> Configuração e alteração de tokens de API são restritas aos papéis de Consultor e Administrador.
            </span>
          </div>
        )}

        {/* Connected Details Grid or Not Connected Guide */}
        {isConnected ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {/* User & Budget Info */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                Usuário / Titular
              </span>
              <p className="text-sm font-bold text-slate-100 truncate">
                {integration?.userName || 'Kássio'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {integration?.userEmail || 'Conta Principal Lunch Money'}
              </p>
            </div>

            {/* Budget & Base Currency */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                Orçamento & Moeda
              </span>
              <p className="text-sm font-bold text-slate-100 truncate">
                {integration?.lunchMoneyBudgetName || 'Orçamento Principal'}
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-slate-500" />
                Moeda padrão: <strong className="text-slate-200 font-mono">{integration?.baseCurrency || activeClient.baseCurrency}</strong>
              </p>
            </div>

            {/* Token Masked Status */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Segurança do Token
              </span>
              <p className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                •••• •••• •••• {integration?.tokenLast4 || '••••'}
              </p>
              <p className="text-[11px] text-slate-400">
                Armazenado estritamente server-side
              </p>
            </div>

            {/* Sync Timestamp */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Última Sincronização
              </span>
              <p className="text-sm font-bold text-slate-100">
                {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca executada'}
              </p>
              <p className="text-[11px] text-slate-400">
                {syncStatus || 'Pronto para sincronizar'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                Como conectar com o Lunch Money?
              </h3>
              <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Acesse sua conta no Lunch Money em <strong>lunchmoney.app</strong>.</li>
                <li>Vá até o menu <strong>Settings</strong> &gt; <strong>Developers</strong>.</li>
                <li>Clique em <strong>Request/Generate Access Token</strong>.</li>
                <li>Cole o token no modal clicando no botão <strong>"Conectar Lunch Money"</strong> acima.</li>
              </ol>
            </div>

            <div className="flex-shrink-0 p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-200">Garantia de Segurança</p>
              <p className="text-[11px] text-slate-400 max-w-[220px]">
                Operação exclusivamente Read-Only. Seus tokens nunca são expostos no frontend ou logs.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Synced Accounts Section */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            Contas Bancárias e Manuais Mapeadas
          </h2>
          <span className="text-xs text-slate-400">
            {accounts.length} contas associadas
          </span>
        </div>

        {accounts.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-slate-400 text-xs">
            Nenhuma conta sincronizada ainda. {isConnected ? 'Clique em "Sincronizar Agora" para importar suas contas.' : 'Conecte o Lunch Money para sincronizar.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5">Nome da Conta</th>
                  <th className="py-2.5">Instituição / Provedor</th>
                  <th className="py-2.5">Tipo</th>
                  <th className="py-2.5">Moeda</th>
                  <th className="py-2.5 text-right">Saldo Atualizado</th>
                  <th className="py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {accounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-800/40">
                    <td className="py-3 font-semibold text-slate-100 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${acc.provider === 'LUNCH_MONEY' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      {acc.name}
                    </td>
                    <td className="py-3 text-slate-300">{acc.institution}</td>
                    <td className="py-3 text-slate-400 font-mono text-[11px]">{acc.type}</td>
                    <td className="py-3 text-slate-300 font-mono font-bold">{acc.currency}</td>
                    <td className="py-3 text-right font-mono font-bold text-slate-100">
                      {formatCurrency(acc.balance, acc.currency)}
                    </td>
                    <td className="py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Sincronizada
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync Jobs History */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          Histórico de Execuções e Auditoria de Sync (Sync Jobs)
        </h2>

        {syncJobs.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-slate-400 text-xs">
            Nenhum job de sincronização registrado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {syncJobs.map(job => (
              <div key={job.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    job.status === 'SUCCESS' || job.status === 'SINCRONIZADO' 
                      ? 'bg-emerald-400' 
                      : job.status === 'SINCRONIZANDO' 
                        ? 'bg-amber-400 animate-pulse' 
                        : 'bg-rose-400'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-200">{job.status} • Job #{job.id.slice(-6)}</p>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400">
                        {job.provider || 'lunch_money'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Executado em: {new Date(job.startedAt).toLocaleString('pt-BR')} {job.finishedAt ? `(Concluído às ${new Date(job.finishedAt).toLocaleTimeString('pt-BR')})` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-slate-400 font-mono text-[11px] bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-emerald-400 font-semibold">+{job.transactionsCreated ?? job.created} transações</span>
                  <span className="text-blue-400">~{job.transactionsUpdated ?? job.updated} atualizadas</span>
                  <span className="text-slate-400">={job.transactionsSkipped ?? job.skipped} inalteradas</span>
                  {job.details && (
                    <span className="text-indigo-300 border-l border-slate-700 pl-3">
                      {job.details.accountsCount || 0} contas • {job.details.categoriesCount || 0} categorias • {job.details.tagsCount || 0} tags
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Conectar / Substituir Access Token                                */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {modalMode === 'CONNECT' ? 'Conectar Lunch Money' : 'Substituir Token do Lunch Money'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cliente ativo: <strong className="text-slate-200">{activeClient.name}</strong> ({activeClient.id})
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-200 text-sm p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Token Input Section */}
            <div className="space-y-2">
              <label htmlFor="lunchmoney-token-input" className="block text-xs font-semibold text-slate-300">
                Access Token do Lunch Money (v2)
              </label>
              <div className="relative">
                <input
                  id="lunchmoney-token-input"
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Cole aqui seu Access Token gerado no Lunch Money..."
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  title={showToken ? 'Ocultar token' : 'Exibir token'}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                O token é transmitido exclusivamente via HTTPS diretamente ao backend e salvo com isolamento total para este cliente.
              </p>
            </div>

            {/* Test Result Feedback Box */}
            {testResult && (
              <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                testResult.success 
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                <div className="flex items-center gap-2 font-semibold">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
                {testResult.success && testResult.user && (
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-emerald-200/90 border-t border-emerald-500/20 mt-2">
                    <div>
                      <span className="text-emerald-400/70 block text-[10px]">TITULAR:</span>
                      {testResult.user.userName || 'Principal'}
                    </div>
                    <div>
                      <span className="text-emerald-400/70 block text-[10px]">ORÇAMENTO:</span>
                      {testResult.user.budgetName || 'Principal'} ({testResult.user.primaryCurrency || 'CHF'})
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                id="modal-test-token-btn"
                onClick={handleTestTokenInModal}
                disabled={isTestingToken || isConnecting || !tokenInput.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-all disabled:opacity-40"
              >
                <Radio className={`w-3.5 h-3.5 text-blue-400 ${isTestingToken ? 'animate-pulse' : ''}`} />
                <span>{isTestingToken ? 'Testando...' : 'Testar Conexão'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isConnecting}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  id="modal-submit-connect-btn"
                  onClick={handleConnectToken}
                  disabled={isConnecting || isTestingToken || !tokenInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/50 transition-all disabled:opacity-40"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{modalMode === 'CONNECT' ? 'Conectar' : 'Salvar Novo Token'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Confirmar Desconexão                                              */}
      {/* ========================================================================= */}
      {isDisconnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Desconectar Lunch Money?</h3>
                <p className="text-xs text-slate-400">Cliente: {activeClient.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza que deseja remover as credenciais de acesso do Lunch Money para este cliente? As contas e transações já importadas serão preservadas, mas a sincronização automática será interrompida.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(false)}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="confirm-disconnect-btn"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                {isDisconnecting ? 'Desconectando...' : 'Sim, Desconectar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
