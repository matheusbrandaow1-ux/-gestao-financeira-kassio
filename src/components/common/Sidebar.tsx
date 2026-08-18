import React from 'react';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  CalendarRange, 
  Target, 
  Landmark, 
  Wallet, 
  Repeat, 
  Tags, 
  SlidersHorizontal, 
  Inbox, 
  BarChart3, 
  Zap, 
  Settings,
  Briefcase,
  ShieldCheck,
  UserCheck,
  Sparkles,
  Coins
} from 'lucide-react';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';

export type TabType = 
  | 'dashboard' 
  | 'transactions' 
  | 'planning' 
  | 'investments'
  | 'goals' 
  | 'assets' 
  | 'accounts' 
  | 'recurrences' 
  | 'categories' 
  | 'rules' 
  | 'pending' 
  | 'reports' 
  | 'ai-assistant'
  | 'integrations' 
  | 'settings';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const { pendingItems } = useClient();
  const { role } = useAuth();
  const isConsultant = role === 'CONSULTANT' || role === 'ADMIN';

  const pendingCount = pendingItems.filter(p => !p.isResolved).length;

  const allNavItems: Array<{ 
    id: TabType; 
    label: string; 
    icon: React.FC<{ className?: string }>; 
    badge?: number;
    consultantOnly?: boolean;
    section?: 'main' | 'admin';
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'main' },
    { id: 'ai-assistant', label: 'Assistente IA', icon: Sparkles, section: 'main' },
    { id: 'transactions', label: 'Transações', icon: ArrowLeftRight, section: 'main' },
    { id: 'planning', label: 'Planejamento', icon: CalendarRange, section: 'main' },
    { id: 'investments', label: 'Investimentos', icon: Coins, section: 'main' },
    { id: 'categories', label: 'Categorias', icon: Tags, section: 'main' },
    { id: 'goals', label: 'Objetivos', icon: Target, section: 'main' },
    { id: 'assets', label: 'Patrimônio', icon: Landmark, section: 'main' },
    { id: 'accounts', label: 'Contas', icon: Wallet, section: 'main' },
    { id: 'recurrences', label: 'Recorrências', icon: Repeat, section: 'main' },
    { id: 'reports', label: 'Relatórios', icon: BarChart3, section: 'main' },
    
    // Consultant administrative items
    { id: 'pending', label: 'Pendências', icon: Inbox, badge: pendingCount, consultantOnly: true, section: 'admin' },
    { id: 'rules', label: 'Regras', icon: SlidersHorizontal, consultantOnly: true, section: 'admin' },
    { id: 'integrations', label: 'Integrações', icon: Zap, consultantOnly: true, section: 'admin' },
    { id: 'settings', label: 'Configurações', icon: Settings, consultantOnly: true, section: 'admin' },
  ];

  // Filter items based on user role
  const visibleNavItems = allNavItems.filter(item => {
    if (item.consultantOnly && !isConsultant) return false;
    return true;
  });

  const mainItems = visibleNavItems.filter(i => i.section === 'main');
  const adminItems = visibleNavItems.filter(i => i.section === 'admin');

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile} 
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden" 
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-0
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-slate-100 tracking-tight">
                Wealth Planning
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                {isConsultant ? 'Painel do Consultor' : 'Portal do Cliente'}
              </span>
            </div>
          </div>
          {onCloseMobile && (
            <button 
              onClick={onCloseMobile}
              className="lg:hidden p-1 rounded-md text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          
          {/* Main Section */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {isConsultant ? 'Planejamento do Cliente' : 'Meu Planejamento'}
            </div>

            {mainItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20 font-semibold' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`
                      px-2 py-0.5 rounded-full text-[10px] font-bold font-mono
                      ${isActive 
                        ? 'bg-white text-blue-700' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }
                    `}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Admin Section (Consultant Only) */}
          {isConsultant && adminItems.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-800/60">
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Administração & Regras
              </div>

              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group
                      ${isActive 
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20 font-semibold' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`
                        px-2 py-0.5 rounded-full text-[10px] font-bold font-mono
                        ${isActive 
                          ? 'bg-white text-blue-700' 
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }
                      `}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer info badge */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              {isConsultant ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Consultor</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cliente</span>
                </>
              )}
            </span>
            <span className="font-mono text-[10px] text-slate-500">v2.5 Prod</span>
          </div>
        </div>
      </aside>
    </>
  );
};
