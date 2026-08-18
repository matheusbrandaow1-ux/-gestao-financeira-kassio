import { 
  ClassifyTransactionInput, 
  AssignableCategoryInfo, 
  ClassificationResult,
  ChatMessageInput,
  ChatResponse,
  MonthlyInsightsResult,
  MonthlyFinancialSummaryReport,
  AnomalyItem,
  RecurrenceSuggestion,
  HumanCorrectionRecord
} from './types';
import { CanonicalRule } from '../../src/types';
import { categorizationEngine } from './categorizationEngine';
import { getAIProvider } from './providers';
import { humanCorrectionStore } from './correctionStore';
import { merchantKnowledgeStore } from './merchantStore';

export class FinancialIntelligenceService {
  /**
   * 5-Layer Categorization for a single transaction
   */
  public async classifySingle(
    tx: ClassifyTransactionInput,
    categories: AssignableCategoryInfo[],
    rules: CanonicalRule[],
    clientId: string
  ): Promise<ClassificationResult> {
    return categorizationEngine.classifyTransaction(tx, categories, rules, clientId);
  }

  /**
   * 5-Layer Categorization for multiple transactions
   */
  public async classifyBatch(
    txList: ClassifyTransactionInput[],
    categories: AssignableCategoryInfo[],
    rules: CanonicalRule[],
    clientId: string
  ): Promise<ClassificationResult[]> {
    return categorizationEngine.classifyBatch(txList, categories, rules, clientId);
  }

  /**
   * Human Correction Learning: Registers human decision and saves with highest priority
   */
  public recordHumanCorrection(params: {
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
  }): HumanCorrectionRecord {
    const record = humanCorrectionStore.recordCorrection(params);

    // Also update merchant knowledge memory for this client
    if (params.merchant || params.originalDescription) {
      merchantKnowledgeStore.saveItem({
        merchantKey: params.merchant || params.originalDescription,
        normalizedName: params.merchant || params.originalDescription,
        suggestedCategoryId: params.chosenCategoryId,
        suggestedCategoryName: params.chosenCategoryName,
        suggestedSubcategoryName: params.chosenSubcategoryName,
        confidence: 99,
        source: 'HUMAN_CORRECTION',
        reasoning: `Classificação customizada definida pelo ${params.changedByRole === 'CONSULTANT' ? 'Consultor' : 'Cliente'}.`,
        lastCheckedAt: new Date().toISOString(),
        clientSpecificOverride: true,
        clientId: params.clientId
      }, params.clientId);
    }

    return record;
  }

  /**
   * Conversational Assistant
   */
  public async chatWithAssistant(params: {
    messages: ChatMessageInput[];
    userRole: 'CONSULTANT' | 'CLIENT' | 'ADMIN';
    clientId: string;
    clientName: string;
    financialContext: any;
  }): Promise<ChatResponse> {
    const provider = getAIProvider();
    return provider.generateChatResponse(params);
  }

  /**
   * Monthly Insights for Dashboard
   */
  public async generateMonthlyInsights(params: {
    month: string;
    currency: string;
    transactions: any[];
    monthlyPlan?: any;
    goals?: any[];
    recurrences?: any[];
    role: 'CONSULTANT' | 'CLIENT';
  }): Promise<MonthlyInsightsResult> {
    const provider = getAIProvider();
    return provider.generateMonthlyInsights(params);
  }

  /**
   * Monthly Financial Summary Report
   */
  public async generateMonthlySummary(params: {
    month: string;
    currency: string;
    transactions: any[];
    monthlyPlan?: any;
    goals?: any[];
    pendingCount: number;
    role: 'CONSULTANT' | 'CLIENT';
  }): Promise<MonthlyFinancialSummaryReport> {
    const provider = getAIProvider();
    return provider.generateMonthlySummary(params);
  }

  /**
   * Anomaly Detection
   */
  public async detectAnomalies(transactions: any[]): Promise<AnomalyItem[]> {
    const provider = getAIProvider();
    return provider.detectAnomalies(transactions);
  }

  /**
   * Recurrence Detection
   */
  public async detectRecurrences(transactions: any[]): Promise<RecurrenceSuggestion[]> {
    const provider = getAIProvider();
    return provider.detectRecurrences(transactions);
  }
}

export const financialIntelligenceService = new FinancialIntelligenceService();
