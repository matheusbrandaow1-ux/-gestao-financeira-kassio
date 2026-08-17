import { AICostMetrics, AIConfig } from './types';

class AIMetricsStore {
  private metrics: AICostMetrics = {
    geminiCallsThisMonth: 0,
    googleSearchesThisMonth: 0,
    merchantsResolvedFromCache: 0,
    transactionsClassifiedByRule: 0,
    transactionsClassifiedByAI: 0,
    lastResetMonth: new Date().toISOString().substring(0, 7)
  };

  private config: AIConfig = {
    autoClassifyThreshold: 90,
    reviewRecommendedThreshold: 70,
    enableSearchGrounding: true
  };

  private checkMonthlyReset() {
    const currentMonth = new Date().toISOString().substring(0, 7);
    if (this.metrics.lastResetMonth !== currentMonth) {
      this.metrics = {
        geminiCallsThisMonth: 0,
        googleSearchesThisMonth: 0,
        merchantsResolvedFromCache: 0,
        transactionsClassifiedByRule: 0,
        transactionsClassifiedByAI: 0,
        lastResetMonth: currentMonth
      };
    }
  }

  public getMetrics(): AICostMetrics {
    this.checkMonthlyReset();
    return { ...this.metrics };
  }

  public getConfig(): AIConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<AIConfig>): AIConfig {
    if (updates.autoClassifyThreshold !== undefined) {
      this.config.autoClassifyThreshold = Math.max(50, Math.min(100, updates.autoClassifyThreshold));
    }
    if (updates.reviewRecommendedThreshold !== undefined) {
      this.config.reviewRecommendedThreshold = Math.max(30, Math.min(this.config.autoClassifyThreshold, updates.reviewRecommendedThreshold));
    }
    if (updates.enableSearchGrounding !== undefined) {
      this.config.enableSearchGrounding = Boolean(updates.enableSearchGrounding);
    }
    return { ...this.config };
  }

  public incrementGeminiCalls() {
    this.checkMonthlyReset();
    this.metrics.geminiCallsThisMonth++;
  }

  public incrementGoogleSearches() {
    this.checkMonthlyReset();
    this.metrics.googleSearchesThisMonth++;
  }

  public incrementCacheHits() {
    this.checkMonthlyReset();
    this.metrics.merchantsResolvedFromCache++;
  }

  public incrementRuleMatches() {
    this.checkMonthlyReset();
    this.metrics.transactionsClassifiedByRule++;
  }

  public incrementAIClassifications() {
    this.checkMonthlyReset();
    this.metrics.transactionsClassifiedByAI++;
  }
}

export const aiMetricsStore = new AIMetricsStore();
