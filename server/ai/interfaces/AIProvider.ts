import { 
  ClassifyTransactionInput, 
  AssignableCategoryInfo, 
  ClassificationResult,
  ChatMessageInput,
  ChatResponse,
  MonthlyInsightsResult,
  MonthlyFinancialSummaryReport,
  AnomalyItem,
  RecurrenceSuggestion
} from '../types';

export interface ClassifyMerchantParams {
  transaction: ClassifyTransactionInput;
  availableCategories: AssignableCategoryInfo[];
  useSearchGrounding?: boolean;
}

export interface BatchClassifyParams {
  transactions: ClassifyTransactionInput[];
  availableCategories: AssignableCategoryInfo[];
  useSearchGrounding?: boolean;
}

export interface ChatAssistantParams {
  messages: ChatMessageInput[];
  userRole: 'CONSULTANT' | 'CLIENT' | 'ADMIN';
  clientId: string;
  clientName: string;
  financialContext: {
    baseCurrency: string;
    totalBalance: number;
    accountsSummary: Array<{ name: string; type: string; balance: number }>;
    currentMonthTransactions: Array<{ date: string; description: string; merchant: string; amount: number; category?: string }>;
    monthlyBudget?: { plannedIncome: number; plannedExpenses: number; plannedInvestments: number };
    realizedTotals?: { income: number; expenses: number; investments: number; netResult: number };
    topExpenseCategories?: Array<{ name: string; amount: number }>;
    goalsSummary?: Array<{ name: string; target: number; current: number; status: string }>;
    pendingCount: number;
  };
}

export interface MonthlyInsightsParams {
  month: string;
  currency: string;
  transactions: Array<{ date: string; merchant: string; description: string; amount: number; category?: string; type: string }>;
  monthlyPlan?: { plannedIncome: number; plannedExpenses: number; plannedInvestments: number };
  goals?: Array<{ name: string; targetAmount: number; currentAmount: number }>;
  recurrences?: Array<{ name: string; amount: number; status: string }>;
  role: 'CONSULTANT' | 'CLIENT';
}

export interface MonthlySummaryParams {
  month: string;
  currency: string;
  transactions: Array<{ date: string; merchant: string; description: string; amount: number; category?: string; type: string }>;
  monthlyPlan?: { plannedIncome: number; plannedExpenses: number; plannedInvestments: number };
  goals?: Array<{ name: string; targetAmount: number; currentAmount: number; status: string }>;
  pendingCount: number;
  role: 'CONSULTANT' | 'CLIENT';
}

/**
 * Generic AI Provider interface for modular AI integration.
 * Current implementation uses Gemini Provider (via @google/genai).
 * Additional providers can be swapped or plugged in seamlessly in the future.
 */
export interface AIProvider {
  name: string;
  isAvailable(): boolean;
  
  classifyMerchant(params: ClassifyMerchantParams): Promise<ClassificationResult>;
  
  generateChatResponse(params: ChatAssistantParams): Promise<ChatResponse>;
  
  generateMonthlyInsights(params: MonthlyInsightsParams): Promise<MonthlyInsightsResult>;
  
  generateMonthlySummary(params: MonthlySummaryParams): Promise<MonthlyFinancialSummaryReport>;
  
  detectAnomalies(transactions: Array<{ id: string; date: string; merchant: string; description: string; amount: number; currency: string; categoryName?: string }>): Promise<AnomalyItem[]>;
  
  detectRecurrences(transactions: Array<{ id: string; date: string; merchant: string; description: string; amount: number; currency: string; categoryName?: string }>): Promise<RecurrenceSuggestion[]>;
}
