import React, { useState } from 'react';
import { 
  UserCheck, 
  RefreshCw, 
  ShieldCheck, 
  Globe, 
  Clock, 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  LogOut,
  User
} from 'lucide-react';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onOpenSyncModal?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const { 
    activeClient, 
    clientsList,
    setActiveClient,
    lastSyncedAt, 
    syncStatus, 
    isSyncing, 
    triggerLunchMoneySync, 
    pendingItems 
  } = useClient();
  const { user, role, signOut } = useAuth();
  const isConsultant = role === 'CONSULTANT' || role === 'ADMIN';

  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const handleSyncClick = async () => {
    const result = await triggerLunchMoneySync();
    setSyncFeedback(result.message);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <header className="wealth-header sticky top-0 z-30 backdrop-blur border-b text-slate-100 px-4 sm:px-6 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* Left: Active Client Callout (Strictly Visible and Prominent) */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-2.5 px-1 py-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[10px] tracking-[0.18em] uppercase font-semibold text-emerald-300">
                {isConsultant ? 'Cliente Selecionado' : 'Meu Planejamento'}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-100">
                  {activeClient.name}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold text-emerald-300">
                  {activeClient.baseCurrency}
                </span>
                    <span className="text-xs text-slate-400 hidden sm:inline">
                  {activeClient.residenceCountry}
                </span>
              </div>
            </div>

            {/* If consultant and multiple clients exist, allow dropdown switch */}
            {isConsultant && clientsList.length > 1 && (
              <div className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setShowClientDropdown(!showClientDropdown)}
                  className="p-1 rounded hover:bg-emerald-900/50 text-emerald-300 transition-colors"
                  title="Trocar Cliente"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {showClientDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-1 z-50">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Selecione o Cliente
                    </div>
                    {clientsList.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setActiveClient(c);
                          setShowClientDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-800 ${
                          c.id === activeClient.id ? 'text-emerald-300 font-semibold bg-slate-800/60' : 'text-slate-300'
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="text-[10px] text-slate-500">{c.baseCurrency}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 pl-2 border-l border-slate-800">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{activeClient.timezone}</span>
          </div>
        </div>

        {/* Right: Lunch Money Status (Consultant only), Role Badge, Profile & Sair */}
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          
          {/* Lunch Money Sync Status Badge (Available for BOTH Consultant and Client) */}
          <div className="flex items-center gap-2 px-1 py-1.5 text-xs">
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : syncStatus === 'Sincronizado' || syncStatus === 'Conectado' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : syncStatus === 'Erro' ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            )}
            <div className="flex flex-col text-[11px] leading-tight">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <span>{isConsultant ? 'Lunch Money:' : 'Dados Bancários:'}</span>
                <span className={syncStatus === 'Sincronizado' || syncStatus === 'Conectado' ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
                  {isSyncing ? 'Sincronizando...' : syncStatus}
                </span>
              </div>
              {lastSyncedAt ? (
                <span className="text-[10px] text-slate-500">
                  {new Date(lastSyncedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">Aguardando dados</span>
              )}
            </div>

            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              title={isConsultant ? 'Sincronizar com Lunch Money' : 'Atualizar meus dados bancários'}
              className="ml-1 p-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>

          {/* Authentic Role Badge (strictly sourced from authenticated user, no switcher) */}
          <div className="flex items-center">
            {isConsultant ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>CONSULTOR</span>
              </span>
            ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>CLIENTE PF</span>
              </span>
            )}
          </div>

          {/* User Profile info */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner text-white ${
              isConsultant ? 'bg-emerald-800' : 'bg-emerald-700'
            }`}>
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : (isConsultant ? 'C' : 'K')}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 leading-tight">
                {user?.displayName || user?.name || (isConsultant ? 'Consultor' : 'Kássio')}
              </span>
              <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                {user?.email}
              </span>
            </div>
          </div>

          {/* Sair / Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            title="Sair da Conta"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-transparent hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-transparent text-xs font-medium transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>

      </div>

      {/* Sync Feedback Alert Banner */}
      {syncFeedback && (
        <div className="mt-2 text-xs py-1.5 px-3 rounded-md bg-slate-800/95 border border-blue-500/40 text-blue-300 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>{syncFeedback}</span>
          </div>
          <button 
            onClick={() => setSyncFeedback(null)} 
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </header>
  );
};
