import React, { useState } from 'react';
import { 
  Settings, 
  User, 
  ShieldCheck, 
  Globe, 
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  Sliders, 
  FileText,
  Clock,
  Briefcase
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { CurrencyCode } from '../types';

export const SettingsView: React.FC = () => {
  const { 
    activeClient, 
    setActiveClient, 
    auditLogs, 
    accounts,
    transactions,
    categories,
    goals,
    assets
  } = useClient();
  const { role } = useAuth();

  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: activeClient.name,
    email: activeClient.email || '',
    phone: activeClient.phone || '',
    residenceCountry: activeClient.residenceCountry,
    baseCurrency: activeClient.baseCurrency,
    timezone: activeClient.timezone,
    notes: activeClient.notes || ''
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveClient({
      ...activeClient,
      name: profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone,
      residenceCountry: profileForm.residenceCountry,
      baseCurrency: profileForm.baseCurrency as CurrencyCode,
      timezone: profileForm.timezone,
      notes: profileForm.notes,
      updatedAt: new Date().toISOString()
    });
    setSavedFeedback('Configurações do cliente atualizadas com sucesso.');
    setTimeout(() => setSavedFeedback(null), 4000);
  };

  const handleExportFullBackup = () => {
    const backupData = {
      client: activeClient,
      accounts,
      transactions,
      categories,
      goals,
      assets,
      exportedAt: new Date().toISOString(),
      version: '2.4'
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `backup_wealth_planning_${activeClient.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-slate-400" />
          Configurações & Parâmetros da Consultoria
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Definições de perfil de cliente, moeda padrão (CHF/EUR/BRL), enquadramento fiscal e exportação de backups.
        </p>
      </div>

      {savedFeedback && (
        <div className="p-4 rounded-xl bg-slate-800 border border-blue-500/40 text-blue-300 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{savedFeedback}</span>
          </div>
          <button onClick={() => setSavedFeedback(null)} className="text-slate-400 hover:text-slate-200 font-bold">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Settings Form */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            Perfil do Cliente Pessoa Física
          </h2>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Nome do Cliente</label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">E-mail Principal</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">País de Residência Fiscal</label>
                <input
                  type="text"
                  value={profileForm.residenceCountry}
                  onChange={(e) => setProfileForm(p => ({ ...p, residenceCountry: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Moeda Base Consolidada</label>
                <select
                  value={profileForm.baseCurrency}
                  onChange={(e) => setProfileForm(p => ({ ...p, baseCurrency: e.target.value as CurrencyCode }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="CHF">CHF - Franco Suíço (Suíça)</option>
                  <option value="EUR">EUR - Euro (Europa)</option>
                  <option value="USD">USD - Dólar Americano</option>
                  <option value="BRL">BRL - Real Brasileiro</option>
                  <option value="GBP">GBP - Libra Esterlina</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Fuso Horário</label>
                <input
                  type="text"
                  value={profileForm.timezone}
                  onChange={(e) => setProfileForm(p => ({ ...p, timezone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Papel Autenticado</label>
                <div className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs font-semibold flex items-center justify-between">
                  <span>{role === 'CONSULTANT' || role === 'ADMIN' ? 'Consultor Financeiro (Acesso Administrativo)' : 'Cliente PF (Visão Exclusiva)'}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">{role}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Notas & Diretrizes da Consultoria</label>
              <textarea
                rows={3}
                value={profileForm.notes}
                onChange={(e) => setProfileForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Observações sobre perfil de risco, metas de aposentadoria e alocação suíça..."
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-900/30 transition-all"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>

        {/* Swiss Tax & Pension Parameters */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              Parâmetros Fiscais (Suíça)
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Teto 3º Pilar A (2026)</span>
                <span className="font-mono font-bold text-emerald-400">CHF 7'056 / ano</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Aporte Mensal Sugerido</span>
                <span className="font-mono font-bold text-slate-100">CHF 588.00 / mês</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Moeda de Consolidação</span>
                <span className="font-mono font-bold text-blue-400">CHF (Franco Suíço)</span>
              </div>
            </div>
          </div>

          {/* Backup & System Reset */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              Backup & Dados
            </h2>

            <div className="space-y-2.5">
              <button
                onClick={handleExportFullBackup}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>Exportar Backup Completo (JSON)</span>
              </button>

              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" />
                <span>Recarregar Dados do Firestore</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Trail */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Trilha de Auditoria & Registro de Ações (Audit Trail)
        </h2>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum evento registrado nesta sessão.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {auditLogs.map(log => (
              <div key={log.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="font-mono text-slate-300 font-semibold">{log.action}</span>
                  <span className="text-slate-400 font-sans">{log.details}</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
