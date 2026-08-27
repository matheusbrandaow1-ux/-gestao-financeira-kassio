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
  ShieldCheck,
  UserCheck,
  Sparkles,
  Coins,
} from 'lucide-react';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';
import { ApuratoLogo } from './Brand';

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

interface NavItem {
  id: TabType;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: number;
  consultantOnly?: boolean;
  section: 'planning' | 'patrimony' | 'admin';
}

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const NavButton: React.FC<{
  item: NavItem;
  isActive: boolean;
  onSelect: () => void;
}> = ({ item, isActive, onSelect }) => {
  const Icon = item.icon;
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // mantém o item ativo visível quando a navegação rola internamente
  React.useEffect(() => {
    if (isActive) buttonRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isActive]);

  return (
    <button
      ref={buttonRef}
      onClick={onSelect}
      aria-current={isActive ? 'page' : undefined}
      className={`
        w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-all group
        ${isActive
          ? 'bg-slate-800 text-slate-100 font-semibold'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }
      `}
    >
      <div className="flex items-center gap-3">
        {/* ponto de origem: marca o item ativo em Púrpura-Mil */}
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
            isActive ? 'bg-blue-500' : 'bg-transparent'
          }`}
          aria-hidden="true"
        />
        <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-200'}`} />
        <span>{item.label}</span>
      </div>

      {item.badge !== undefined && item.badge > 0 && (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
          {item.badge}
        </span>
      )}
    </button>
  );
};

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

  const allNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'planning' },
    { id: 'ai-assistant', label: 'Assistente IA', icon: Sparkles, section: 'planning' },
    { id: 'transactions', label: 'Transações', icon: ArrowLeftRight, section: 'planning' },
    { id: 'planning', label: 'Planejamento', icon: CalendarRange, section: 'planning' },
    { id: 'investments', label: 'Investimentos', icon: Coins, section: 'patrimony' },
    { id: 'categories', label: 'Categorias', icon: Tags, section: 'patrimony' },
    { id: 'goals', label: 'Objetivos', icon: Target, section: 'patrimony' },
    { id: 'assets', label: 'Patrimônio', icon: Landmark, section: 'patrimony' },
    { id: 'accounts', label: 'Contas', icon: Wallet, section: 'patrimony' },
    { id: 'recurrences', label: 'Recorrências', icon: Repeat, section: 'patrimony' },
    { id: 'reports', label: 'Relatórios', icon: BarChart3, section: 'patrimony' },

    // Itens administrativos do consultor
    { id: 'pending', label: 'Pendências', icon: Inbox, badge: pendingCount, consultantOnly: true, section: 'admin' },
    { id: 'rules', label: 'Regras', icon: SlidersHorizontal, consultantOnly: true, section: 'admin' },
    { id: 'integrations', label: 'Integrações', icon: Zap, consultantOnly: true, section: 'admin' },
    { id: 'settings', label: 'Configurações', icon: Settings, consultantOnly: true, section: 'admin' },
  ];

  const visibleNavItems = allNavItems.filter(item => !(item.consultantOnly && !isConsultant));
  const adminItems = visibleNavItems.filter(i => i.section === 'admin');

  const handleSelect = (tab: TabType) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Backdrop mobile */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside className={`
        ap-sidebar fixed top-0 bottom-0 left-0 z-50 w-64 border-r flex flex-col transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-0
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Cabeçalho da marca */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <ApuratoLogo size={26} className="text-slate-100" />
            <span className="text-[10px] text-slate-400 font-medium tracking-[0.18em] uppercase pl-0.5">
              {isConsultant ? 'Painel do Consultor' : 'Portal do Cliente'}
            </span>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              aria-label="Fechar menu"
              className="lg:hidden p-1 rounded-md text-slate-400 hover:text-slate-100"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {(['planning', 'patrimony'] as const).map(section => {
            const sectionItems = visibleNavItems.filter(i => i.section === section);
            const sectionLabel = section === 'planning'
              ? (isConsultant ? 'Planejamento do Cliente' : 'Planejamento')
              : 'Patrimônio';
            return (
              <div key={section} className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.18em]">
                  {sectionLabel}
                </div>
                {sectionItems.map(item => (
                  <NavButton
                    key={item.id}
                    item={item}
                    isActive={activeTab === item.id}
                    onSelect={() => handleSelect(item.id)}
                  />
                ))}
              </div>
            );
          })}

          {/* Administração (somente consultor) */}
          {isConsultant && adminItems.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-700/60">
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.18em]">
                Administração
              </div>
              {adminItems.map(item => (
                <NavButton
                  key={item.id}
                  item={item}
                  isActive={activeTab === item.id}
                  onSelect={() => handleSelect(item.id)}
                />
              ))}
            </div>
          )}
        </nav>

        {/* Rodapé */}
        <div className="p-3 border-t border-slate-700 bg-slate-950/40">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              {isConsultant ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Consultor</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cliente</span>
                </>
              )}
            </span>
            {/* grafia da marca: sempre caixa-baixa */}
            <span className="font-mono text-[10px] tracking-[0.12em] text-slate-500">apurato · v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};
