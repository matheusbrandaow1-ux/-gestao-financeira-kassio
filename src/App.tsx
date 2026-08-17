import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClientProvider, useClient } from './context/ClientContext';
import { Header } from './components/common/Header';
import { Sidebar, TabType } from './components/common/Sidebar';
import { DashboardView } from './views/DashboardView';
import { TransactionsView } from './views/TransactionsView';
import { PlanningView } from './views/PlanningView';
import { GoalsView } from './views/GoalsView';
import { AssetsView } from './views/AssetsView';
import { AccountsView } from './views/AccountsView';
import { RecurrencesView } from './views/RecurrencesView';
import { CategoriesView } from './views/CategoriesView';
import { RulesView } from './views/RulesView';
import { PendingView } from './views/PendingView';
import { ReportsView } from './views/ReportsView';
import { AIAssistantView } from './views/AIAssistantView';
import { IntegrationsView } from './views/IntegrationsView';
import { SettingsView } from './views/SettingsView';
import { LoginView } from './views/LoginView';
import { Menu, RefreshCw, ShieldAlert } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading: authLoading, role } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isLoading: clientLoading } = useClient();

  const isConsultant = role === 'CONSULTANT' || role === 'ADMIN';

  // Guard against Client role attempting to access consultant-only admin tabs
  useEffect(() => {
    const adminOnlyTabs: TabType[] = ['rules', 'pending', 'integrations', 'settings'];
    if (!isConsultant && adminOnlyTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [role, isConsultant, activeTab]);

  const handleNavigate = (tab: TabType) => {
    const adminOnlyTabs: TabType[] = ['rules', 'pending', 'integrations', 'settings'];
    if (!isConsultant && adminOnlyTabs.includes(tab)) {
      setActiveTab('dashboard');
      return;
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. Initial Authentication Loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-3">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Iniciando ambiente seguro...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated -> Show Login Screen
  if (!user) {
    return <LoginView />;
  }

  // 3. Authenticated View Rendering
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={handleNavigate} />;
      case 'ai-assistant':
        return <AIAssistantView />;
      case 'transactions':
        return <TransactionsView />;
      case 'planning':
        return <PlanningView />;
      case 'goals':
        return <GoalsView />;
      case 'assets':
        return <AssetsView />;
      case 'accounts':
        return <AccountsView />;
      case 'recurrences':
        return <RecurrencesView />;
      case 'reports':
        return <ReportsView />;
      case 'categories':
        return <CategoriesView />;
      
      // Consultant-only views
      case 'rules':
        return isConsultant ? <RulesView /> : <DashboardView onNavigate={handleNavigate} />;
      case 'pending':
        return isConsultant ? <PendingView onNavigate={handleNavigate} /> : <DashboardView onNavigate={handleNavigate} />;
      case 'integrations':
        return isConsultant ? <IntegrationsView /> : <DashboardView onNavigate={handleNavigate} />;
      case 'settings':
        return isConsultant ? <SettingsView /> : <DashboardView onNavigate={handleNavigate} />;
      
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* Top sticky Header */}
      <Header />

      {/* Main Workspace with Fixed Sidebar and Fluid Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            handleNavigate(tab);
            setIsMobileMenuOpen(false);
          }}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Primary View Container */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full">
          {/* Mobile Menu trigger bar */}
          <div className="lg:hidden flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-4 h-4 text-blue-400" />
              <span>Menu</span>
            </button>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {activeTab}
            </span>
          </div>

          {/* Active View Render */}
          {clientLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-sm font-medium">Carregando dados financeiros...</p>
            </div>
          ) : (
            renderActiveView()
          )}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ClientProvider>
        <AppContent />
      </ClientProvider>
    </AuthProvider>
  );
}
