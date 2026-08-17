export interface MerchantKnowledgeItem {
  merchantKey: string; // uppercase normalized key e.g. "DIGITEC GALAXUS", "COOP", "SWISSCOM"
  normalizedName: string;
  legalName?: string;
  country?: string;
  businessType?: string;
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  suggestedSubcategoryName?: string;
  confidence: number; // 0 - 100
  source: 'RULE' | 'HISTORY_OVERRIDE' | 'GEMINI' | 'SEARCH_GROUNDING';
  reasoning: string;
  lastCheckedAt: string;
  clientSpecificOverride?: boolean;
  clientId?: string;
}

export interface HumanCorrectionRecord {
  id: string;
  clientId: string;
  merchant: string;
  originalDescription: string;
  previousCategoryId?: string;
  previousCategoryName?: string;
  chosenCategoryId: string;
  chosenCategoryName: string;
  chosenSubcategoryName?: string;
  changedByRole: 'CONSULTANT' | 'CLIENT';
  changedByUserId: string;
  timestamp: string;
}

export interface AICostMetrics {
  geminiCallsThisMonth: number;
  googleSearchesThisMonth: number;
  merchantsResolvedFromCache: number;
  transactionsClassifiedByRule: number;
  transactionsClassifiedByAI: number;
  lastResetMonth: string; // "YYYY-MM"
}

export interface AIConfig {
  autoClassifyThreshold: number; // Default 90
  reviewRecommendedThreshold: number; // Default 70
  enableSearchGrounding: boolean; // Default true
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ClassificationResult {
  transactionId?: string;
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  confidenceScore: number; // 0 to 100
  reasoning: string; // Short and objective
  source: 'EXACT_RULE' | 'MERCHANT_CACHE' | 'HISTORICAL_PATTERN' | 'GEMINI_AI' | 'GOOGLE_SEARCH_GROUNDING';
  merchantKnowledge?: MerchantKnowledgeItem;
  isAutoClassified: boolean;
  needsReview: boolean;
  sentToPending: boolean;
  groundingSources?: GroundingSource[];
}

export interface ClassifyTransactionInput {
  id?: string;
  description: string;
  merchant?: string;
  payee?: string;
  notes?: string;
  amount: number;
  currency: string;
  date?: string;
  accountName?: string;
  accountId?: string;
  country?: string;
  currentCategoryId?: string;
}

export interface AssignableCategoryInfo {
  id: string;
  name: string;
  groupName: string;
  type: string;
  subcategories?: string[];
  description?: string;
}

export interface ChatMessageInput {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export interface ChatResponse {
  reply: string;
  suggestedActions?: Array<{
    label: string;
    actionType: 'NAVIGATE' | 'FILTER' | 'SYNC' | 'REVIEW';
    target?: string;
  }>;
}

export interface AnomalyItem {
  id: string;
  transactionId: string;
  description: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  categoryName?: string;
  type: 'SPIKE_SPENDING' | 'UNUSUAL_MERCHANT' | 'DUPLICATE_SUSPECT' | 'RECURRENCE_INCREASE' | 'BUDGET_OVERRUN';
  severity: 'ALTA' | 'MEDIA' | 'BAIXA';
  message: string;
  baselineComparison?: string;
}

export interface RecurrenceSuggestion {
  id: string;
  merchant: string;
  description: string;
  averageAmount: number;
  currency: string;
  frequency: 'MENSAL' | 'ANUAL' | 'SEMANAL' | 'TRIMESTRAL';
  estimatedIntervalDays: number;
  confidenceScore: number;
  transactionIds: string[];
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  reasoning: string;
}

export interface MonthlyInsightsResult {
  month: string; // "YYYY-MM"
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

export interface MonthlyFinancialSummaryReport {
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
