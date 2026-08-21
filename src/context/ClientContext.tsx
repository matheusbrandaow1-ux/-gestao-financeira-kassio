import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  ClientProfile, 
  CanonicalAccount, 
  CanonicalTransaction, 
  Category, 
  CanonicalRule, 
  MonthlyPlan, 
  FinancialGoal, 
  AssetOrLiability, 
  RecurringItem, 
  PendingItem, 
  SyncJob, 
  AuditLog,
  NetWorthHistoryPoint
} from '../types';
import { db, doc, getDoc, setDoc, collection, getDocs, deleteDoc, writeBatch } from '../lib/apiData';
import { applyRulesToTransaction } from '../lib/rulesEngine';
import { useAuth } from './AuthContext';
import { getCurrentMonth } from '../lib/monthUtils';
import { applyPersistedRates } from '../lib/fxService';

export const REAL_KASSIO_CLIENT: ClientProfile = {
  id: 'kassio-pf',
  name: 'Kássio',
  clientType: 'Pessoa Física',
  residenceCountry: 'Suíça',
  baseCurrency: 'CHF',
  timezone: 'Europe/Zurich',
  email: 'kassio@cliente.ch',
  isDemo: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: new Date().toISOString()
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-housing', groupId: 'grp-moradia', groupName: 'Moradia', name: 'Moradia & Aluguel', type: 'DESPESA', color: '#3B82F6', icon: 'Home', isSystem: true, subcategories: ['Aluguel', 'Condomínio', 'Energia'] },
  { id: 'cat-groceries', groupId: 'grp-alimentacao', groupName: 'Alimentação', name: 'Supermercado & Alimentação', type: 'DESPESA', color: '#10B981', icon: 'ShoppingCart', isSystem: true, subcategories: ['Supermercado', 'Feira', 'Padaria'] },
  { id: 'cat-delivery', groupId: 'grp-alimentacao', groupName: 'Alimentação', name: 'Delivery', type: 'DESPESA', color: '#22C55E', icon: 'ShoppingBag', isSystem: true, subcategories: ['Uber Eats', 'Delivery', 'Refeições'] },
  { id: 'cat-transport', groupId: 'grp-transporte', groupName: 'Transporte', name: 'Transporte & Mobilidade', type: 'DESPESA', color: '#F59E0B', icon: 'Car', isSystem: true, subcategories: ['Transporte Público', 'Combustível', 'Estacionamento'] },
  { id: 'cat-health', groupId: 'grp-saude', groupName: 'Saúde', name: 'Saúde & Seguro LAMal', type: 'DESPESA', color: '#EC4899', icon: 'HeartPulse', isSystem: true, subcategories: ['Plano de Saúde', 'Medicamentos', 'Consultas'] },
  { id: 'cat-leisure', groupId: 'grp-estilo-vida', groupName: 'Estilo de Vida', name: 'Restaurantes, Delivery & Lazer', type: 'DESPESA', color: '#8B5CF6', icon: 'Palmtree', isSystem: true, subcategories: ['Restaurantes', 'Viagens', 'Entretenimento'] },
  { id: 'cat-utilities', groupId: 'grp-servicos', groupName: 'Serviços', name: 'Streaming, Software & Telecom', type: 'DESPESA', color: '#64748B', icon: 'Tv', isSystem: true, subcategories: ['Internet', 'Streaming', 'Celular', 'Software / Apps'] },
  { id: 'cat-streaming', groupId: 'grp-servicos', groupName: 'Serviços', name: 'Streaming', type: 'DESPESA', color: '#38BDF8', icon: 'Play', isSystem: true, subcategories: ['Netflix', 'Spotify', 'YouTube', 'Streaming'] },
  { id: 'cat-software', groupId: 'grp-servicos', groupName: 'Serviços', name: 'Software / Apps', type: 'DESPESA', color: '#2DD4BF', icon: 'MonitorSmartphone', isSystem: true, subcategories: ['Apps', 'SaaS', 'IA', 'Software'] },
  { id: 'cat-family-other', groupId: 'grp-familia', groupName: 'Família', name: 'Outros Família', type: 'DESPESA', color: '#F472B6', icon: 'Users', isSystem: true, subcategories: ['Casa', 'Família', 'Extras'] },
  { id: 'cat-child-activities', groupId: 'grp-familia', groupName: 'Família', name: 'Atividades da Filha', type: 'DESPESA', color: '#F9A8D4', icon: 'Sparkles', isSystem: true, subcategories: ['Escola', 'Atividades', 'Cultura'] },
  { id: 'cat-daycare', groupId: 'grp-familia', groupName: 'Família', name: 'Creche/Escola', type: 'DESPESA', color: '#F59E0B', icon: 'School', isSystem: true, subcategories: ['Creche', 'Escola', 'Material Escolar'] },
  { id: 'cat-kids-clothes', groupId: 'grp-familia', groupName: 'Família', name: 'Roupas/Itens Infantis', type: 'DESPESA', color: '#FB7185', icon: 'Shirt', isSystem: true, subcategories: ['Roupas', 'Acessórios', 'Itens Infantis'] },
  { id: 'cat-financial-fees', groupId: 'grp-financeiro', groupName: 'Financeiro', name: 'Outras Despesas Financeiras', type: 'DESPESA', color: '#A78BFA', icon: 'Landmark', isSystem: true, subcategories: ['Financeiro', 'Juros', 'Taxas'] },
  { id: 'cat-bank-fees', groupId: 'grp-financeiro', groupName: 'Financeiro', name: 'Tarifas Bancárias', type: 'DESPESA', color: '#A78BFA', icon: 'Banknote', isSystem: true, subcategories: ['Tarifa Bancária', 'Taxas', 'Cobranças'] },
  { id: 'cat-forex-fees', groupId: 'grp-financeiro', groupName: 'Financeiro', name: 'Taxas de Câmbio', type: 'DESPESA', color: '#818CF8', icon: 'ArrowRightLeft', isSystem: true, subcategories: ['Câmbio', 'Taxa de Conversão', 'FX'] },
  { id: 'cat-salary', groupId: 'grp-renda', groupName: 'Renda', name: 'Salário Principal', type: 'RECEITA', color: '#059669', icon: 'Banknote', isSystem: true, subcategories: ['Salário Mensal', 'Bônus'] },
  { id: 'cat-invest-return', groupId: 'grp-renda', groupName: 'Renda', name: 'Rendimentos & Dividendos', type: 'RECEITA', color: '#2563EB', icon: 'TrendingUp', isSystem: true, subcategories: ['Dividendos', 'Juros'] },
  { id: 'cat-pension-3a', groupId: 'grp-invest', groupName: 'Investimentos', name: 'Previdência 3º Pilar (3a)', type: 'INVESTIMENTO', color: '#6366F1', icon: 'Landmark', isSystem: true, subcategories: ['Pilar 3a', 'Pilar 3b'] },
  { id: 'cat-investments', groupId: 'grp-invest', groupName: 'Investimentos', name: 'Investimentos Globais (ETFs/Ações)', type: 'INVESTIMENTO', color: '#0D9488', icon: 'Coins', isSystem: true, subcategories: ['ETFs Globais', 'Ações'] }
];

const INITIAL_MONTH = getCurrentMonth();
const INITIAL_EMPTY_PLAN: MonthlyPlan = {
  id: `plan-${INITIAL_MONTH}`,
  clientId: 'kassio-pf',
  month: INITIAL_MONTH,
  plannedIncome: 0,
  plannedExpenses: 0,
  plannedInvestments: 0,
  categoryPlans: {},
  createdAt: `${INITIAL_MONTH}-01T00:00:00Z`,
  updatedAt: new Date().toISOString()
};

export type DataLoadState = 'loading' | 'loaded' | 'empty' | 'error';

interface ClientContextType {
  activeClient: ClientProfile;
  clientsList: ClientProfile[];
  setActiveClient: (client: ClientProfile) => void;
  createClient: (client: Omit<ClientProfile, 'createdAt' | 'updatedAt'>) => Promise<void>;
  isLoading: boolean;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  
  // Data entities
  accounts: CanonicalAccount[];
  accountsLoadState: DataLoadState;
  transactions: CanonicalTransaction[];
  transactionsLoadState: DataLoadState;
  categories: Category[];
  rules: CanonicalRule[];
  monthlyPlan: MonthlyPlan;
  goals: FinancialGoal[];
  assets: AssetOrLiability[];
  assetsLoadState: DataLoadState;
  netWorthHistory: NetWorthHistoryPoint[];
  recurringItems: RecurringItem[];
  pendingItems: PendingItem[];
  syncJobs: SyncJob[];
  auditLogs: AuditLog[];
  lastSyncedAt: string | null;
  syncStatus: string;
  isSyncing: boolean;

  // Actions
  addTransaction: (tx: Partial<CanonicalTransaction>) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<CanonicalTransaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  recategorizeTransaction: (id: string, categoryId: string, subcategoryName?: string) => Promise<void>;
  
  addRule: (rule: Omit<CanonicalRule, 'id' | 'createdAt' | 'matchCount'>) => Promise<void>;
  updateRule: (id: string, updates: Partial<CanonicalRule>) => Promise<void>;
  toggleRule: (id: string) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  executeRulesOnAllTransactions: () => Promise<number>;

  addAccount: (acc: Omit<CanonicalAccount, 'id'>) => Promise<void>;
  updateAccount: (id: string, updates: Partial<CanonicalAccount>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  addCategory: (cat: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  updateMonthlyPlan: (plan: MonthlyPlan) => Promise<void>;
  duplicatePreviousMonthPlan: (targetMonth: string, sourceMonth: string) => Promise<void>;

  addGoal: (goal: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateGoal: (id: string, updates: Partial<FinancialGoal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  recalculateGoals: () => void;

  addAsset: (asset: Omit<AssetOrLiability, 'id' | 'updatedAt'>) => Promise<void>;
  updateAsset: (id: string, updates: Partial<AssetOrLiability>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;

  addRecurringItem: (item: Omit<RecurringItem, 'id'>) => Promise<void>;
  updateRecurringItem: (id: string, updates: Partial<RecurringItem>) => Promise<void>;
  deleteRecurringItem: (id: string) => Promise<void>;
  markRecurringPaid: (id: string) => Promise<void>;

  resolvePendingItem: (id: string) => Promise<void>;
  triggerLunchMoneySync: () => Promise<{ success: boolean; message: string }>;
  addAuditLog: (action: string, entity: string, details?: string, source?: AuditLog['source']) => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, clientId: authClientId } = useAuth();
  const isClientRole = role === 'CLIENT';

  const [activeClient, setActiveClientState] = useState<ClientProfile>(REAL_KASSIO_CLIENT);
  const [clientsList, setClientsList] = useState<ClientProfile[]>([REAL_KASSIO_CLIENT]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonth());

  // Clean real entities state (no mock demo data)
  const [accounts, setAccounts] = useState<CanonicalAccount[]>([]);
  const [accountsLoadState, setAccountsLoadState] = useState<DataLoadState>('loading');
  const [transactions, setTransactions] = useState<CanonicalTransaction[]>([]);
  const [transactionsLoadState, setTransactionsLoadState] = useState<DataLoadState>('loading');
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [rules, setRules] = useState<CanonicalRule[]>([]);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan>(INITIAL_EMPTY_PLAN);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [assets, setAssets] = useState<AssetOrLiability[]>([]);
  const [assetsLoadState, setAssetsLoadState] = useState<DataLoadState>('loading');
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthHistoryPoint[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  // Lunch Money status
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('Não conectado');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Target Client ID resolution
  const currentTargetClientId = isClientRole ? (authClientId || 'kassio-pf') : activeClient.id;

  // Load clients and active client data from Firestore
  useEffect(() => {
    let isMounted = true;

    async function loadAllData() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setAccountsLoadState('loading');
      setTransactionsLoadState('loading');
      setAssetsLoadState('loading');
      try {
        const targetId = isClientRole ? (authClientId || 'kassio-pf') : (activeClient.id || 'kassio-pf');

        try {
          const fxResponse = await fetch(`/api/lunchmoney/fx-rates?clientId=${encodeURIComponent(targetId)}`);
          if (fxResponse.ok) {
            const fxData = await fxResponse.json();
            applyPersistedRates(fxData.rates || []);
          }
        } catch {
          // FX is optional and never blocks loading financial data.
        }

        // 1. Load available clients list
        let loadedClients: ClientProfile[] = [REAL_KASSIO_CLIENT];
        try {
          const clientsColl = collection(db, 'clients');
          const clientsSnap = await getDocs(clientsColl);
          
          if (!clientsSnap.empty) {
            const fetched: ClientProfile[] = [];
            clientsSnap.forEach(d => fetched.push({ ...d.data() as ClientProfile, id: d.id }));
            loadedClients = fetched;
          } else {
            // Persist the default Kassio profile in Firestore
            const clientDocRef = doc(db, 'clients', REAL_KASSIO_CLIENT.id);
            await setDoc(clientDocRef, REAL_KASSIO_CLIENT);
          }
        } catch {
          // Keep default
        }

        if (isMounted) {
          setClientsList(loadedClients);
          const found = loadedClients.find(c => c.id === targetId) || REAL_KASSIO_CLIENT;
          setActiveClientState(found);
        }

        // 2. Load Accounts
        try {
          const accSnap = await getDocs(collection(db, 'clients', targetId, 'accounts'));
          if (!accSnap.empty && isMounted) {
            const accs: CanonicalAccount[] = [];
            accSnap.forEach(d => accs.push({ ...d.data() as CanonicalAccount, id: d.id }));
            setAccounts(accs);
            setAccountsLoadState('loaded');
          } else if (isMounted) {
            setAccounts([]);
            setAccountsLoadState('empty');
          }
        } catch {
          if (isMounted) setAccountsLoadState('error');
        }

        // 3. Load Transactions
        try {
          const txSnap = await getDocs(collection(db, 'clients', targetId, 'transactions'));
          if (!txSnap.empty && isMounted) {
            const txs: CanonicalTransaction[] = [];
            txSnap.forEach(d => {
              const data = d.data() as CanonicalTransaction;
              if (!(data as any).deleted) {
                txs.push({ ...data, id: d.id });
              }
            });
            setTransactions(txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setTransactionsLoadState('loaded');
          } else if (isMounted) {
            setTransactions([]);
            setTransactionsLoadState('empty');
          }
        } catch {
          if (isMounted) setTransactionsLoadState('error');
        }

        // 4. Load Categories
        try {
          const catSnap = await getDocs(collection(db, 'clients', targetId, 'categories'));
          if (!catSnap.empty && isMounted) {
            const cats: Category[] = [];
            catSnap.forEach(d => cats.push({ ...d.data() as Category, id: d.id }));
            setCategories(cats);
          } else {
            // Initialize default standard categories for this client
            setCategories(DEFAULT_CATEGORIES);
            try {
              const batch = writeBatch(db);
              DEFAULT_CATEGORIES.forEach(c => {
                const cRef = doc(db, 'clients', targetId, 'categories', c.id);
                batch.set(cRef, { ...c, clientId: targetId });
              });
              await batch.commit();
            } catch {
              // Ignore batch notice
            }
          }
        } catch {
          if (isMounted) setCategories(DEFAULT_CATEGORIES);
        }

        // 5. Load Rules
        try {
          const ruleSnap = await getDocs(collection(db, 'clients', targetId, 'rules'));
          if (!ruleSnap.empty && isMounted) {
            const rls: CanonicalRule[] = [];
            ruleSnap.forEach(d => rls.push({ ...d.data() as CanonicalRule, id: d.id }));
            setRules(rls.sort((a, b) => a.priority - b.priority));
          } else if (isMounted) {
            setRules([]);
          }
        } catch {
          if (isMounted) setRules([]);
        }

        // 6. Goals
        try {
          const goalSnap = await getDocs(collection(db, 'clients', targetId, 'goals'));
          if (!goalSnap.empty && isMounted) {
            const gls: FinancialGoal[] = [];
            goalSnap.forEach(d => gls.push({ ...d.data() as FinancialGoal, id: d.id }));
            setGoals(gls);
          } else if (isMounted) {
            setGoals([]);
          }
        } catch {
          if (isMounted) setGoals([]);
        }

        // 8. Assets
        try {
          const assetSnap = await getDocs(collection(db, 'clients', targetId, 'assets'));
          if (!assetSnap.empty && isMounted) {
            const asts: AssetOrLiability[] = [];
            assetSnap.forEach(d => asts.push({ ...d.data() as AssetOrLiability, id: d.id }));
            setAssets(asts);
            setAssetsLoadState('loaded');
          } else if (isMounted) {
            setAssets([]);
            setAssetsLoadState('empty');
          }
        } catch {
          if (isMounted) setAssetsLoadState('error');
        }

        // 9. Recurring Items
        try {
          const recSnap = await getDocs(collection(db, 'clients', targetId, 'recurringItems'));
          if (!recSnap.empty && isMounted) {
            const recs: RecurringItem[] = [];
            recSnap.forEach(d => recs.push({ ...d.data() as RecurringItem, id: d.id }));
            setRecurringItems(recs);
          } else if (isMounted) {
            setRecurringItems([]);
          }
        } catch {
          if (isMounted) setRecurringItems([]);
        }

        // 10. Pending items (server-side, audit-preserving)
        try {
          const pendingSnap = await getDocs(collection(db, 'clients', targetId, 'pendingItems'));
          if (isMounted) {
            const items: PendingItem[] = [];
            pendingSnap.forEach(d => items.push({ ...d.data() as PendingItem, id: d.id }));
            setPendingItems(items);
          }
        } catch {
          if (isMounted) setPendingItems([]);
        }

        // 11. Sync status & Integration info from server
        try {
          const res = await fetch(`/api/lunchmoney/integration?clientId=${encodeURIComponent(targetId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.integration && data.integration.status === 'CONNECTED') {
              setSyncStatus('Sincronizado');
              setLastSyncedAt(data.integration.lastValidatedAt || data.integration.connectedAt);
            } else {
              setSyncStatus('Não conectado');
              setLastSyncedAt(null);
            }
          }
        } catch {
          // silent fallback
        }

      } catch (err) {
        console.warn('Data load notice:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAllData();

    return () => {
      isMounted = false;
    };
  }, [user, activeClient.id, isClientRole, authClientId]);

  useEffect(() => {
    let isMounted = true;
    async function loadMonthlyPlan() {
      if (!user) return;
      try {
        const planDoc = await getDoc(doc(db, 'clients', currentTargetClientId, 'monthlyPlans', selectedMonth));
        if (isMounted) {
          setMonthlyPlan(planDoc.exists()
            ? planDoc.data() as MonthlyPlan
            : { ...INITIAL_EMPTY_PLAN, id: `plan-${selectedMonth}`, month: selectedMonth, clientId: currentTargetClientId });
        }
      } catch {
        if (isMounted) setMonthlyPlan({ ...INITIAL_EMPTY_PLAN, id: `plan-${selectedMonth}`, month: selectedMonth, clientId: currentTargetClientId });
      }
    }
    void loadMonthlyPlan();
    return () => { isMounted = false; };
  }, [user, currentTargetClientId, selectedMonth]);

  // Set active client (Consultant only)
  const setActiveClient = (client: ClientProfile) => {
    if (isClientRole) return; // Disallow client role from switching
    setActiveClientState(client);
  };

  // Create new client (Consultant only)
  const createClient = async (clientData: Omit<ClientProfile, 'createdAt' | 'updatedAt'>) => {
    if (isClientRole) return;

    const newClient: ClientProfile = {
      ...clientData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setClientsList(prev => [...prev, newClient]);
    setActiveClientState(newClient);

    try {
      const clientRef = doc(db, 'clients', newClient.id);
      await setDoc(clientRef, newClient);

      // Initialize default categories for new client
      const batch = writeBatch(db);
      DEFAULT_CATEGORIES.forEach(c => {
        const cRef = doc(db, 'clients', newClient.id, 'categories', c.id);
        batch.set(cRef, { ...c, clientId: newClient.id });
      });
      await batch.commit();

      setAccounts([]);
      setTransactions([]);
      setGoals([]);
      setAssets([]);
      setRecurringItems([]);
      setPendingItems([]);
    } catch (e) {
      console.warn('Client created locally:', e);
    }
  };

  // Recalculate financial goal values based on connected source accounts/assets
  const recalculateGoals = useCallback(() => {
    setGoals(prevGoals => {
      return prevGoals.map(goal => {
        if (goal.trackingMethod === 'ACCOUNTS' && goal.sourceAccountIds && goal.sourceAccountIds.length > 0) {
          const currentTotal = accounts
            .filter(a => goal.sourceAccountIds!.includes(a.id))
            .reduce((sum, a) => sum + Math.max(0, a.balance), 0);
          
          return {
            ...goal,
            currentAmount: Math.round(currentTotal * 100) / 100,
            updatedAt: new Date().toISOString()
          };
        }
        if (goal.trackingMethod === 'ASSETS' && goal.sourceAssetIds && goal.sourceAssetIds.length > 0) {
          const currentTotal = assets
            .filter(ast => goal.sourceAssetIds!.includes(ast.id))
            .reduce((sum, ast) => sum + Math.max(0, ast.value), 0);
          
          return {
            ...goal,
            currentAmount: Math.round(currentTotal * 100) / 100,
            updatedAt: new Date().toISOString()
          };
        }
        return goal;
      });
    });
  }, [accounts, assets]);

  useEffect(() => {
    recalculateGoals();
  }, [accounts, assets, recalculateGoals]);

  // Recalculate pending items
  useEffect(() => {
    const uncategorizedCount = transactions.filter(t => !t.categoryId).length;
    
    setPendingItems(prev => {
      const updated = [...prev];
      const uncatIdx = updated.findIndex(p => p.type === 'UNCATEGORIZED' || p.type === 'SEM_CATEGORIA');
      if (uncategorizedCount > 0) {
        const item: PendingItem = {
          id: 'pend-uncat',
          clientId: currentTargetClientId,
          type: 'UNCATEGORIZED',
          title: `${uncategorizedCount} transação(ões) sem categoria`,
          description: `Existem ${uncategorizedCount} movimentações aguardando classificação orçamentária.`,
          severity: 'AVISO',
          count: uncategorizedCount,
          actionUrl: '/transactions?filter=uncategorized',
          actionLabel: 'Categorizar Transações',
          isResolved: false,
          createdAt: new Date().toISOString()
        };
        if (uncatIdx >= 0) updated[uncatIdx] = item;
        else updated.unshift(item);
        void setDoc(doc(db, 'clients', currentTargetClientId, 'pendingItems', item.id), item, { merge: true });
      } else if (uncatIdx >= 0) {
        const resolved = { ...updated[uncatIdx], isResolved: true, resolvedAt: new Date().toISOString(), resolvedBy: user?.uid || 'system', resolutionNote: 'Não há mais transações sem categoria.' };
        updated[uncatIdx] = resolved;
        void setDoc(doc(db, 'clients', currentTargetClientId, 'pendingItems', resolved.id), resolved, { merge: true });
      }

      return updated;
    });
  }, [transactions, currentTargetClientId]);

  const addAuditLog = async (
    action: string, 
    entity: string, 
    details?: string, 
    source: AuditLog['source'] = 'CONSULTANT'
  ) => {
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: user?.uid || 'user-primary',
      userName: user?.displayName || user?.name || 'Usuário',
      clientId: currentTargetClientId,
      action,
      entity,
      details,
      source,
      timestamp: new Date().toISOString()
    };
    setAuditLogs(prev => [newLog, ...prev]);

    try {
      const logRef = doc(db, 'clients', currentTargetClientId, 'auditLogs', newLog.id);
      await setDoc(logRef, newLog);
    } catch {
      // safe fallback
    }
  };

  // Transaction mutations
  const addTransaction = async (txData: Partial<CanonicalTransaction>) => {
    const id = txData.id || `tx_${Date.now()}`;
    const newTx: CanonicalTransaction = {
      id,
      clientId: currentTargetClientId,
      provider: txData.provider || 'MANUAL',
      accountId: txData.accountId || accounts[0]?.id || 'manual',
      accountName: accounts.find(a => a.id === txData.accountId)?.name || accounts[0]?.name || 'Manual',
      date: txData.date || new Date().toISOString().split('T')[0],
      description: txData.description || 'Nova Transação',
      merchant: txData.merchant || txData.description || 'Estabelecimento',
      amount: txData.amount || 0,
      currency: txData.currency || activeClient.baseCurrency,
      transactionType: txData.transactionType || 'DESPESA',
      categoryId: txData.categoryId,
      categoryName: categories.find(c => c.id === txData.categoryId)?.name,
      subcategoryId: txData.subcategoryId,
      reviewStatus: txData.categoryId ? 'REVISADA' : 'PENDENTE',
      tags: txData.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...txData
    };

    const { updatedTx, matchedRule } = applyRulesToTransaction(newTx, rules);
    if (matchedRule) {
      setRules(prev => prev.map(r => r.id === matchedRule.id ? { ...r, matchCount: r.matchCount + 1 } : r));
    }

    setTransactions(prev => [updatedTx, ...prev]);
    await addAuditLog('CRIAR_TRANSACAO', 'TRANSACTIONS', `Criada transação ${updatedTx.description} (${updatedTx.amount} ${updatedTx.currency})`);

    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'transactions', updatedTx.id);
      await setDoc(docRef, updatedTx);
    } catch (e) {
      console.warn('Saved in local state fallback:', e);
    }
  };

  const updateTransaction = async (id: string, updates: Partial<CanonicalTransaction>) => {
    let updatedObj: CanonicalTransaction | null = null;
    setTransactions(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates, updatedAt: new Date().toISOString() };
        if (updates.categoryId && !updates.categoryName) {
          updated.categoryName = categories.find(c => c.id === updates.categoryId)?.name;
        }
        updatedObj = updated;
        return updated;
      }
      return t;
    }));

    await addAuditLog('ATUALIZAR_TRANSACAO', 'TRANSACTIONS', `Atualizada transação ID ${id}`);

    try {
      if (updatedObj) {
        const docRef = doc(db, 'clients', currentTargetClientId, 'transactions', id);
        await setDoc(docRef, updatedObj, { merge: true });
      }
    } catch (e) {
      console.warn('Updated in local state fallback:', e);
    }
  };

  const deleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    await addAuditLog('EXCLUIR_TRANSACAO', 'TRANSACTIONS', `Excluída transação ID ${id}`);

    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'transactions', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Deleted in local state fallback:', e);
    }
  };

  const recategorizeTransaction = async (id: string, categoryId: string, subcategoryName?: string) => {
    const cat = categories.find(c => c.id === categoryId);
    let updatedTxFinal: CanonicalTransaction | null = null;
    let prevTx: CanonicalTransaction | undefined;

    setTransactions(prev => prev.map(t => {
      if (t.id === id) {
        prevTx = t;
        const updated: CanonicalTransaction = {
          ...t,
          categoryId,
          categoryName: cat?.name || t.categoryName,
          subcategoryId: subcategoryName || t.subcategoryId,
          reviewStatus: 'REVISADA' as const,
          updatedAt: new Date().toISOString()
        };
        updatedTxFinal = updated;
        return updated;
      }
      return t;
    }));

    if (updatedTxFinal) {
      // Async record correction to AI learning store (isolated per client)
      if (prevTx) {
        const targetTx = prevTx;
        fetch('/api/ai/correct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: currentTargetClientId,
            transactionId: id,
            merchant: targetTx.merchant || targetTx.description,
            rawDescription: targetTx.description,
            amount: targetTx.amount,
            currency: targetTx.currency,
            correctedCategoryId: categoryId,
            correctedCategoryName: cat?.name,
            correctedSubcategoryId: subcategoryName,
            correctedSubcategoryName: subcategoryName,
            previousCategoryId: targetTx.categoryId,
            previousCategoryName: targetTx.categoryName
          })
        }).catch(err => console.warn('AI Correction recording error:', err));
      }

      try {
        const docRef = doc(db, 'clients', currentTargetClientId, 'transactions', id);
        await setDoc(docRef, updatedTxFinal, { merge: true });
      } catch (e) {
        console.warn('Recategorization local state fallback:', e);
      }
    }
  };

  // Rules mutations
  const addRule = async (ruleData: Omit<CanonicalRule, 'id' | 'createdAt' | 'matchCount'>) => {
    const newRule: CanonicalRule = {
      id: `rule_${Date.now()}`,
      createdAt: new Date().toISOString(),
      matchCount: 0,
      ...ruleData
    };
    setRules(prev => [...prev, newRule].sort((a, b) => a.priority - b.priority));
    const firstCond = newRule.conditions[0];
    const desc = firstCond ? `${firstCond.field} ${firstCond.operator} "${firstCond.value}"` : newRule.name;
    await addAuditLog('CRIAR_REGRA', 'RULES', `Criada regra: ${desc}`);

    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'rules', newRule.id);
      await setDoc(docRef, newRule);
    } catch (e) {
      console.warn('Rule add fallback:', e);
    }
  };

  const updateRule = async (id: string, updates: Partial<CanonicalRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r).sort((a, b) => a.priority - b.priority));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'rules', id);
      await setDoc(docRef, updates, { merge: true });
    } catch (e) {
      console.warn('Rule update fallback:', e);
    }
  };

  const toggleRule = async (id: string) => {
    const target = rules.find(r => r.id === id);
    if (!target) return;
    const newActive = !target.isActive;
    await updateRule(id, { isActive: newActive });
  };

  const deleteRule = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'rules', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Rule delete fallback:', e);
    }
  };

  const executeRulesOnAllTransactions = async (): Promise<number> => {
    let matchCount = 0;
    const updatedTransactions = transactions.map(tx => {
      const { updatedTx, matchedRule } = applyRulesToTransaction(tx, rules);
      if (matchedRule && updatedTx.categoryId !== tx.categoryId) {
        matchCount++;
        return updatedTx;
      }
      return tx;
    });

    if (matchCount > 0) {
      setTransactions(updatedTransactions);
      try {
        const batch = writeBatch(db);
        updatedTransactions.forEach(t => {
          const ref = doc(db, 'clients', currentTargetClientId, 'transactions', t.id);
          batch.set(ref, t, { merge: true });
        });
        await batch.commit();
      } catch (e) {
        console.warn('Batch rule execution fallback:', e);
      }
    }

    return matchCount;
  };

  // Account mutations
  const addAccount = async (accData: Omit<CanonicalAccount, 'id'>) => {
    const newAcc: CanonicalAccount = {
      id: `acc_${Date.now()}`,
      ...accData
    };
    setAccounts(prev => [...prev, newAcc]);
    await addAuditLog('CRIAR_CONTA', 'ACCOUNTS', `Criada conta ${newAcc.name} (${newAcc.institution})`);

    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'accounts', newAcc.id);
      await setDoc(docRef, newAcc);
    } catch (e) {
      console.warn('Account add fallback:', e);
    }
  };

  const updateAccount = async (id: string, updates: Partial<CanonicalAccount>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'accounts', id);
      await setDoc(docRef, updates, { merge: true });
    } catch (e) {
      console.warn('Account update fallback:', e);
    }
  };

  const deleteAccount = async (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'accounts', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Account delete fallback:', e);
    }
  };

  // Category mutations
  const addCategory = async (catData: Omit<Category, 'id'>) => {
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      ...catData
    };
    setCategories(prev => [...prev, newCat]);
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'categories', newCat.id);
      await setDoc(docRef, newCat);
    } catch (e) {
      console.warn('Category add fallback:', e);
    }
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'categories', id);
      await setDoc(docRef, updates, { merge: true });
    } catch (e) {
      console.warn('Category update fallback:', e);
    }
  };

  const deleteCategory = async (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'categories', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Category delete fallback:', e);
    }
  };

  // Monthly plan mutations
  const updateMonthlyPlan = async (plan: MonthlyPlan) => {
    setMonthlyPlan(plan);
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'monthlyPlans', plan.id || plan.month);
      await setDoc(docRef, plan);
    } catch (e) {
      console.warn('Monthly plan update fallback:', e);
    }
  };

  const duplicatePreviousMonthPlan = async (targetMonth: string, sourceMonth: string) => {
    const newPlan: MonthlyPlan = {
      ...monthlyPlan,
      id: targetMonth,
      month: targetMonth,
      notes: `Planejamento duplicado a partir de ${sourceMonth}`,
      updatedAt: new Date().toISOString()
    };
    setMonthlyPlan(newPlan);
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'monthlyPlans', targetMonth);
      await setDoc(docRef, newPlan);
    } catch (e) {
      console.warn('Monthly plan duplicate fallback:', e);
    }
  };

  // Goal mutations
  const addGoal = async (goalData: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newGoal: FinancialGoal = {
      id: `goal_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...goalData
    };
    setGoals(prev => [...prev, newGoal]);
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'goals', newGoal.id);
      await setDoc(docRef, newGoal);
    } catch (e) {
      console.warn('Goal add fallback:', e);
    }
  };

  const updateGoal = async (id: string, updates: Partial<FinancialGoal>) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'goals', id);
      await setDoc(docRef, { ...updates, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('Goal update fallback:', e);
    }
  };

  const deleteGoal = async (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'goals', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Goal delete fallback:', e);
    }
  };

  // Asset mutations
  const addAsset = async (assetData: Omit<AssetOrLiability, 'id' | 'updatedAt'>) => {
    const newAsset: AssetOrLiability = {
      id: `ast_${Date.now()}`,
      updatedAt: new Date().toISOString(),
      ...assetData
    };
    setAssets(prev => [...prev, newAsset]);
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'assets', newAsset.id);
      await setDoc(docRef, newAsset);
    } catch (e) {
      console.warn('Asset add fallback:', e);
    }
  };

  const updateAsset = async (id: string, updates: Partial<AssetOrLiability>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'assets', id);
      await setDoc(docRef, { ...updates, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('Asset update fallback:', e);
    }
  };

  const deleteAsset = async (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'assets', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Asset delete fallback:', e);
    }
  };

  // Recurring mutations
  const addRecurringItem = async (itemData: Omit<RecurringItem, 'id'>) => {
    const newItem: RecurringItem = {
      id: `rec_${Date.now()}`,
      ...itemData
    };
    setRecurringItems(prev => [...prev, newItem]);
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'recurringItems', newItem.id);
      await setDoc(docRef, newItem);
    } catch (e) {
      console.warn('Recurring add fallback:', e);
    }
  };

  const updateRecurringItem = async (id: string, updates: Partial<RecurringItem>) => {
    setRecurringItems(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'recurringItems', id);
      await setDoc(docRef, updates, { merge: true });
    } catch (e) {
      console.warn('Recurring update fallback:', e);
    }
  };

  const deleteRecurringItem = async (id: string) => {
    setRecurringItems(prev => prev.filter(r => r.id !== id));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'recurringItems', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Recurring delete fallback:', e);
    }
  };

  const markRecurringPaid = async (id: string) => {
    setRecurringItems(prev => prev.map(r => r.id === id ? { ...r, status: 'PAGO' } : r));
    try {
      const docRef = doc(db, 'clients', currentTargetClientId, 'recurringItems', id);
      await setDoc(docRef, { status: 'PAGO' }, { merge: true });
    } catch (e) {
      console.warn('Recurring pay fallback:', e);
    }
  };

  const resolvePendingItem = async (id: string) => {
    const resolvedAt = new Date().toISOString();
    const resolvedBy = user?.uid || 'user-primary';
    setPendingItems(prev => prev.map(item => item.id === id ? {
      ...item,
      isResolved: true,
      resolvedAt,
      resolvedBy,
      resolutionNote: 'Resolvida pelo usuário autenticado.'
    } : item));
    const item = pendingItems.find(current => current.id === id);
    if (item) {
      await setDoc(doc(db, 'clients', currentTargetClientId, 'pendingItems', id), {
        ...item,
        isResolved: true,
        resolvedAt,
        resolvedBy,
        resolutionNote: 'Resolvida pelo usuário autenticado.'
      }, { merge: true });
    }
  };

  // Lunch Money Sync Trigger
  const triggerLunchMoneySync = async (): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    setSyncStatus('Sincronizando...');

    try {
      const response = await fetch('/api/lunchmoney/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: currentTargetClientId,
          existingTransactions: transactions,
          existingAccounts: accounts,
          existingCategories: categories,
          existingRules: rules,
          existingRecurring: recurringItems
        })
      });

      const resData = await response.json();

      if (resData.success && resData.data) {
        const syncData = resData.data;
        const job: SyncJob = syncData.job || resData.job;
        applyPersistedRates(resData.fxRates || []);

        // Persist to Firestore
        try {
          const batch = writeBatch(db);

          const accountsToWrite: CanonicalAccount[] = syncData.accountsToPersist || syncData.accounts || [];
          if (accountsToWrite.length > 0) {
            accountsToWrite.forEach((acc: CanonicalAccount) => {
              const dRef = doc(db, 'clients', currentTargetClientId, 'accounts', acc.id);
              batch.set(dRef, acc, { merge: true });
            });
          }

          const categoriesToWrite: Category[] = syncData.categoriesToPersist || syncData.categories || [];
          if (categoriesToWrite.length > 0) {
            categoriesToWrite.forEach((cat: Category) => {
              const dRef = doc(db, 'clients', currentTargetClientId, 'categories', cat.id);
              batch.set(dRef, cat, { merge: true });
            });
          }

          const txToWrite: CanonicalTransaction[] = syncData.transactionsToPersist || syncData.transactions || [];
          if (txToWrite.length > 0) {
            txToWrite.forEach((tx: CanonicalTransaction) => {
              const dRef = doc(db, 'clients', currentTargetClientId, 'transactions', tx.id);
              batch.set(dRef, tx, { merge: true });
            });
          }

          if (job) {
            const jobRef = doc(db, 'clients', currentTargetClientId, 'syncJobs', job.id);
            batch.set(jobRef, job);
          }

          await batch.commit();
        } catch (dbErr) {
          console.warn('Firestore sync persistence notice:', dbErr);
        }

        if (syncData.accounts && syncData.accounts.length > 0) {
          setAccounts(syncData.accounts);
        }
        if (syncData.categories && syncData.categories.length > 0) {
          setCategories(syncData.categories);
        }
        if (syncData.transactions && syncData.transactions.length > 0) {
          setTransactions(syncData.transactions);
        }
        if (job) {
          setSyncJobs(prev => [job, ...prev.filter(j => j.id !== job.id)]);
        }

        const finishTime = job?.finishedAt || new Date().toISOString();
        setLastSyncedAt(finishTime);

        const txCount = syncData.transactions?.length || 0;
        const statusText = txCount === 0 ? 'CONECTADO — SEM TRANSAÇÕES' : 'SINCRONIZADO';
        setSyncStatus(statusText);

        const summaryMsg = txCount === 0
          ? `Lunch Money sincronizado com sucesso! Contas e categorias conectadas. 0 transações encontradas.`
          : `Lunch Money sincronizado com sucesso! ${txCount} transações importadas.`;

        return {
          success: true,
          message: summaryMsg
        };
      } else {
        const errorMsg = resData.message || resData.data?.job?.errorSummary || 'Falha ao sincronizar com Lunch Money.';
        setSyncStatus('ERRO NA SINCRONIZAÇÃO');
        return {
          success: false,
          message: errorMsg
        };
      }
    } catch (err: any) {
      setSyncStatus('ERRO DE CONEXÃO');
      return {
        success: false,
        message: err.message || 'Erro ao conectar com serviço de sincronização Lunch Money.'
      };
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ClientContext.Provider value={{
      activeClient,
      clientsList,
      setActiveClient,
      createClient,
      isLoading,
      selectedMonth,
      setSelectedMonth,
      accounts,
      accountsLoadState,
      transactions,
      transactionsLoadState,
      categories,
      rules,
      monthlyPlan,
      goals,
      assets,
      assetsLoadState,
      netWorthHistory,
      recurringItems,
      pendingItems,
      syncJobs,
      auditLogs,
      lastSyncedAt,
      syncStatus,
      isSyncing,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      recategorizeTransaction,
      addRule,
      updateRule,
      toggleRule,
      deleteRule,
      executeRulesOnAllTransactions,
      addAccount,
      updateAccount,
      deleteAccount,
      addCategory,
      updateCategory,
      deleteCategory,
      updateMonthlyPlan,
      duplicatePreviousMonthPlan,
      addGoal,
      updateGoal,
      deleteGoal,
      recalculateGoals,
      addAsset,
      updateAsset,
      deleteAsset,
      addRecurringItem,
      updateRecurringItem,
      deleteRecurringItem,
      markRecurringPaid,
      resolvePendingItem,
      triggerLunchMoneySync,
      addAuditLog
    }}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = (): ClientContextType => {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
};
