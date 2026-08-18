export type CurrencyCode = 'CHF' | 'BRL' | 'EUR' | 'USD' | 'GBP';

export type UserRole = 'ADMIN' | 'CONSULTANT' | 'CLIENT' | 'CONSULTOR' | 'ADMINISTRADOR' | 'CLIENTE';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  name?: string;
  role: UserRole;
  clientId?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConsultantClientAccess {
  id: string; // `${consultantUid}_${clientId}`
  consultantUid: string;
  clientId: string;
  role: 'OWNER' | 'CONSULTANT_VIEWER' | 'CONSULTANT_EDITOR';
  grantedAt: string;
}

export interface ClientProfile {
  id: string;
  name: string;
  clientType: 'Pessoa Física';
  residenceCountry: string;
  baseCurrency: CurrencyCode;
  timezone: string;
  consultantId?: string;
  email?: string;
  phone?: string;
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
  lunchMoneyConfigured?: boolean;
}

export type AccountType = 
  | 'CHECKING' 
  | 'SAVINGS' 
  | 'CREDIT_CARD' 
  | 'INVESTMENT' 
  | 'PENSION_3A' 
  | 'PENSION_2ND' 
  | 'CASH' 
  | 'CRYPTO' 
  | 'OTHER';

export interface CanonicalAccount {
  id: string;
  clientId: string;
  name: string;
  institution: string;
  type: AccountType;
  currency: CurrencyCode;
  balance: number; // in cents or standard unit depending on convention, we maintain exact amount
  balanceFormatted?: string;
  isActive: boolean;
  provider: 'MANUAL' | 'LUNCH_MONEY';
  externalId?: string;
  lastSyncedAt?: string;
  creditLimit?: number;
  notes?: string;
}

export type TransactionType = 
  | 'RECEITA' 
  | 'DESPESA' 
  | 'TRANSFERÊNCIA' 
  | 'INVESTIMENTO' 
  | 'RESGATE' 
  | 'ESTORNO' 
  | 'PAGAMENTO DE CARTÃO' 
  | 'MOVIMENTAÇÃO PATRIMONIAL' 
  | 'IGNORADA';

export type ReviewStatus = 'PENDENTE' | 'REVISADA' | 'AUTO_REGRAS' | 'AI_CLASSIFIED' | 'REVISAO_RECOMENDADA';

export interface AIClassificationInfo {
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  suggestedSubcategoryId?: string;
  suggestedSubcategoryName?: string;
  confidenceScore: number; // 0 - 100
  reasoning: string;
  reasoningShort?: string;
  source: 
    | 'HUMAN_CORRECTION' 
    | 'MERCHANT_MEMORY' 
    | 'DETERMINISTIC_RULE' 
    | 'MERCHANT_RESEARCH' 
    | 'AI_REASONING' 
    | 'HUMAN_REVIEW'
    | 'EXACT_RULE' 
    | 'MERCHANT_CACHE' 
    | 'HISTORICAL_PATTERN' 
    | 'GEMINI_AI' 
    | 'GOOGLE_SEARCH_GROUNDING';
  isAutoClassified: boolean;
  needsReview: boolean;
  researchUsed?: boolean;
  evidenceSummary?: string;
  sourceUrls?: string[];
  canonicalMerchant?: string;
  groundingSources?: Array<{ uri: string; title: string }>;
}

export interface CanonicalTransaction {
  id: string;
  clientId: string;
  provider: 'MANUAL' | 'LUNCH_MONEY' | 'lunch_money';
  externalId?: string;
  lunchMoneyTransactionId?: number | string;
  accountId: string;
  accountName?: string;
  manualAccountId?: string;
  plaidAccountId?: string;
  date: string; // YYYY-MM-DD
  description: string;
  merchant: string;
  payee?: string;
  amount: number; // Positive absolute amount for UI/aggregation; transactionType dictates flow
  amountOriginal?: number;
  currencyOriginal?: string;
  amountBase?: number;
  baseCurrency?: string;
  currency: CurrencyCode;
  convertedAmount?: number; // In base currency (CHF)
  exchangeRate?: number;
  transactionType: TransactionType;
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  tagIds?: string[];
  tags?: string[];
  status?: string; // 'cleared' | 'uncleared' | 'recurring'
  isPending?: boolean;
  isRecurring?: boolean;
  recurringItemId?: string;
  hasChildren?: boolean;
  parentId?: string;
  isGroup?: boolean;
  groupId?: string;
  notes?: string;
  reviewStatus: ReviewStatus;
  suggestedRule?: boolean;
  aiClassification?: AIClassificationInfo;
  createdAtProvider?: string;
  updatedAtProvider?: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  color: string;
}

export interface Category {
  id: string;
  lunchMoneyCategoryId?: number;
  clientId?: string;
  groupId: string;
  groupName: string;
  name: string;
  type: 'DESPESA' | 'RECEITA' | 'INVESTIMENTO' | 'OUTRO';
  subcategories: string[];
  color: string;
  icon?: string;
  isSystem?: boolean;
  isGroup?: boolean;
  order?: number | null;
  collapsed?: boolean;
  isIncome?: boolean;
  excludeFromBudget?: boolean;
  excludeFromTotals?: boolean;
  archived?: boolean;
  parentId?: string | null;
  children?: Category[];
  
  // Real budget data from Lunch Money summary/budget
  budgetPlanned?: number | null;
  budgetSpent?: number;
  budgetRemaining?: number | null;
  hasBudget?: boolean;
  
  monthlyBudgetSuggested?: number;
  description?: string;
}

export type CanonicalCategory = Category;

export interface RuleCondition {
  field: 'merchant' | 'description' | 'accountId' | 'amount' | 'currency' | 'tag';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
  value: string | number;
}

export interface RuleActions {
  categoryId?: string;
  subcategoryId?: string;
  transactionType?: TransactionType;
  tagsToAdd?: string[];
  goalId?: string;
  ignoreFromPlanning?: boolean;
  requestReview?: boolean;
}

export interface CanonicalRule {
  id: string;
  clientId: string;
  name: string;
  priority: number; // 1 = highest
  conditions: RuleCondition[];
  actions: RuleActions;
  isActive: boolean;
  matchCount: number;
  lastMatchedAt?: string;
  createdAt: string;
}

export interface CategoryPlanItem {
  plannedAmount: number;
  notes?: string;
}

export interface MonthlyPlan {
  id: string; // e.g. "2026-08"
  clientId: string;
  month: string; // "YYYY-MM"
  plannedIncome: number;
  plannedExpenses: number;
  plannedInvestments: number;
  categoryPlans: Record<string, CategoryPlanItem>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type GoalType = 
  | 'RESERVA_EMERGENCIA' 
  | 'ENTRADA_IMOVEL' 
  | 'COMPRA_IMOVEL' 
  | 'INVESTIMENTOS' 
  | 'VIAGEM' 
  | 'EDUCACAO' 
  | 'INDEPENDENCIA_FINANCEIRA' 
  | 'OUTRO';

export type GoalTrackingMethod = 'MANUAL' | 'ACCOUNTS' | 'ASSETS' | 'CATEGORIES' | 'TAGS';

export interface FinancialGoal {
  id: string;
  clientId: string;
  name: string;
  type: GoalType;
  description: string;
  currency: CurrencyCode;
  targetAmount: number;
  currentAmount: number;
  startDate: string; // YYYY-MM-DD
  targetDate: string; // YYYY-MM-DD
  monthlyContribution: number;
  priority: 'ALTA' | 'MEDIA' | 'BAIXA';
  status: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'PAUSADO' | 'ATRASADO';
  trackingMethod: GoalTrackingMethod;
  sourceAccountIds?: string[];
  sourceCategoryIds?: string[];
  sourceAssetIds?: string[];
  sourceTags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type AssetClassification = 'ATIVO' | 'PASSIVO';

export type AssetCategory = 
  | 'CONTA_BANCARIA' 
  | 'INVESTIMENTO_LIQUIDO' 
  | 'PREVIDENCIA_3A' 
  | 'PREVIDENCIA_2E' 
  | 'IMOVEL' 
  | 'VEICULO' 
  | 'CRIPTO' 
  | 'PARTICIPACAO_EMPRESA' 
  | 'EMPRESTIMO' 
  | 'FINANCIAMENTO_IMOVEL' 
  | 'CARTAO_CREDITO' 
  | 'OUTRO_PASSIVO' 
  | 'OUTRO_ATIVO';

export interface AssetOrLiability {
  id: string;
  clientId: string;
  name: string;
  classification: AssetClassification;
  category: AssetCategory;
  value: number; // positive number; classification dictates if it adds or subtracts
  currency: CurrencyCode;
  institution?: string;
  acquisitionDate?: string;
  interestRate?: number;
  monthlyPayment?: number;
  notes?: string;
  linkedAccountId?: string;
  updatedAt: string;
}

export interface NetWorthHistoryPoint {
  date: string; // YYYY-MM
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  currency: CurrencyCode;
}

export type RecurrenceFrequency = 'MENSAL' | 'ANUAL' | 'SEMANAL' | 'TRIMESTRAL' | 'SEMESTRAL';

export type RecurrenceStatus = 'PREVISTO' | 'PAGO' | 'ATRASADO';

export interface RecurringItem {
  id: string;
  clientId: string;
  name: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  frequency: RecurrenceFrequency;
  dayOfMonth: number;
  nextDueDate: string; // YYYY-MM-DD
  status: RecurrenceStatus;
  isActive?: boolean;
  accountId?: string;
  accountName?: string;
  categoryId?: string;
  categoryName?: string;
  provider: 'MANUAL' | 'LUNCH_MONEY';
  externalId?: string;
  autoConfirmed?: boolean;
}

export type PendingItemSeverity = 'INFO' | 'AVISO' | 'URGENTE';

export interface PendingItem {
  id: string;
  clientId: string;
  type: 
    | 'SEM_CATEGORIA' 
    | 'NAO_REVISADA' 
    | 'REGRA_SUGERIDA' 
    | 'OBJETIVO_ABAIXO_RITMO' 
    | 'SYNC_DESATUALIZADO' 
    | 'PLANO_NAO_CRIADO'
    | 'AI_LOW_CONFIDENCE'
    | 'RECORRENCIA_SUGERIDA'
    | 'ANOMALIA_DETECTADA'
    | 'ESTABELECIMENTO_NOVO';
  title: string;
  description: string;
  severity: PendingItemSeverity;
  count?: number;
  actionUrl: string;
  actionLabel?: string;
  isResolved: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export type SyncJobStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SINCRONIZANDO' | 'SINCRONIZADO' | 'ERRO' | 'CREDENCIAL_INVALIDA';

export interface SyncJob {
  id: string;
  clientId: string;
  provider?: string;
  startedAt: string;
  finishedAt?: string;
  status: SyncJobStatus;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  accountsCreated?: number;
  accountsUpdated?: number;
  accountsSkipped?: number;
  categoriesCreated?: number;
  categoriesUpdated?: number;
  categoriesSkipped?: number;
  tagsCreated?: number;
  tagsUpdated?: number;
  tagsSkipped?: number;
  transactionsCreated?: number;
  transactionsUpdated?: number;
  transactionsSkipped?: number;
  errors?: string[];
  errorSummary?: string;
  details?: {
    accountsCount?: number;
    transactionsCount?: number;
    categoriesCount?: number;
    tagsCount?: number;
    recurringCount?: number;
    uncategorizedFound?: number;
    categorizedCount?: number;
    pendingCount?: number;
    researchedCount?: number;
    writeBackCount?: number;
  };
}

export interface AuditLog {
  id: string;
  userId: string;
  userName?: string;
  clientId: string;
  action: string;
  entity: string;
  timestamp: string;
  source: 'USER' | 'CONSULTANT' | 'LUNCH_MONEY' | 'RULE' | 'SYSTEM' | 'GEMINI_AI';
  details?: string;
}

export interface PublicLunchMoneyIntegration {
  clientId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  tokenLast4?: string;
  connectedAt?: string;
  lastValidatedAt?: string;
  lunchMoneyUserId?: number | string;
  lunchMoneyBudgetName?: string;
  baseCurrency?: string;
  userName?: string;
  userEmail?: string;
}

export interface AIMetricsData {
  geminiCallsThisMonth: number;
  googleSearchesThisMonth: number;
  merchantsResolvedFromCache: number;
  transactionsClassifiedByRule: number;
  transactionsClassifiedByAI: number;
  lastResetMonth: string;
}

export interface AIConfigData {
  autoClassifyThreshold: number;
  reviewRecommendedThreshold: number;
  enableSearchGrounding: boolean;
}

export interface MonthlyInsightsData {
  month: string;
  hasSufficientData: boolean;
  statusMessage: string;
  highlights: string[];
  savingsRateInsight?: string;
  topSpendingCategoryInsight?: string;
  budgetStatusInsight?: string;
  pendingReviewCount: number;
  anomaliesDetectedCount: number;
  summaryParagraph: string;
}

export interface InvestmentHolding {
  id: string;
  ticker?: string;
  name: string;
  assetClass: 'AÇÕES_BRASIL' | 'RENDA_FIXA_BRASIL' | 'ETF_GLOBAL' | 'PENSION_3A' | 'CRYPTO' | 'RENDA_VARIAVEL' | 'OUTROS';
  currency: CurrencyCode;
  quantity?: number;
  averagePrice?: number;
  currentPrice?: number;
  totalCostOriginal?: number;
  currentValueOriginal: number;
  currentValueCHF: number;
  exchangeRateToCHF: number;
  unrealizedProfitLossOriginal?: number;
  unrealizedProfitLossPercent?: number;
  institution?: string;
  portfolioId?: string;
  notes?: string;
  updatedAt: string;
}

export interface InvestmentPortfolio {
  id: string;
  clientId: string;
  name: string;
  currency: CurrencyCode;
  country: string;
  totalValueOriginal: number;
  totalValueCHF: number;
  totalCostOriginal?: number;
  unrealizedProfitLossOriginal?: number;
  unrealizedProfitLossPercent?: number;
  holdings: InvestmentHolding[];
  updatedAt: string;
}

export interface FXRateTable {
  baseCurrency: CurrencyCode;
  rates: Record<string, number>; // e.g. { 'BRL': 0.158, 'EUR': 0.942, 'USD': 0.884, 'CHF': 1.0 }
  lastUpdated: string;
  isRealTime?: boolean;
}

export interface MonthlyFinancialSummaryReportData {
  month: string;
  currency: string;
  hasSufficientData: boolean;
  incomeRealized: number;
  incomePlanned: number;
  expensesRealized: number;
  expensesPlanned: number;
  investmentsRealized: number;
  investmentsPlanned: number;
  netResultRealized: number;
  savingsRateRealized: number;
  topCategories: Array<{
    name: string;
    amount: number;
    percentageOfTotal: number;
    diffFromPlanned?: number;
  }>;
  notableChanges: string[];
  goalsProgress: Array<{
    name: string;
    currentAmount: number;
    targetAmount: number;
    status: string;
  }>;
  pendingItemsCount: number;
  aiObservations: string;
}




