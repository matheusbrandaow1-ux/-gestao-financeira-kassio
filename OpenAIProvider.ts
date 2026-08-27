import {
  AIProvider,
  ClassifyMerchantParams,
  ChatAssistantParams,
  MonthlyInsightsParams,
  MonthlySummaryParams
} from '../interfaces/AIProvider';
import {
  AnomalyItem,
  ChatResponse,
  ClassificationResult,
  MonthlyFinancialSummaryReport,
  MonthlyInsightsResult,
  RecurrenceSuggestion
} from '../types';

interface OpenAIAnswer {
  text: string;
  payload: any;
  sourceUrls: string[];
}

function extractResponseText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const chunks: string[] = [];
  for (const output of payload?.output || []) {
    if (output?.type !== 'message') continue;
    for (const content of output?.content || []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function extractSourceUrls(payload: any): string[] {
  const urls = new Set<string>();
  for (const output of payload?.output || []) {
    const sources = output?.action?.sources || [];
    for (const source of sources) {
      if (typeof source?.url === 'string' && /^https?:\/\//i.test(source.url)) urls.add(source.url);
    }
    for (const content of output?.content || []) {
      for (const annotation of content?.annotations || []) {
        const url = annotation?.url || annotation?.url_citation?.url;
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) urls.add(url);
      }
    }
  }
  return Array.from(urls).slice(0, 8);
}

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
  return JSON.parse(cleaned) as T;
}

function normalizedMerchantKey(value: string): string {
  return value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
}

export class OpenAIProvider implements AIProvider {
  public name = 'OPENAI';

  public isAvailable(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  private async ask(prompt: string, options: { webSearch?: boolean } = {}): Promise<OpenAIAnswer> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error('OPENAI_API_KEY não configurada no servidor.');

    // Balanced default for production. Can be replaced in Render without code changes.
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5';
    const requestBody: Record<string, unknown> = {
      model,
      input: prompt
    };

    if (options.webSearch) {
      requestBody.tools = [{ type: 'web_search', search_context_size: 'medium' }];
      requestBody.include = ['web_search_call.action.sources'];
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `OPENAI_${response.status}`);

    return {
      text: extractResponseText(payload),
      payload,
      sourceUrls: extractSourceUrls(payload)
    };
  }

  public async classifyMerchant(params: ClassifyMerchantParams): Promise<ClassificationResult> {
    const { transaction, availableCategories } = params;
    const useWebSearch = params.useSearchGrounding !== false;
    const prompt = `Você é um classificador financeiro extremamente conservador para um sistema de planejamento financeiro.\n` +
      `A transação abaixo já passou por regras determinísticas e por um filtro que impede pesquisa de transferências pessoais.\n` +
      `Quando pesquisa web estiver disponível, identifique o ESTABELECIMENTO/EMPRESA usando fontes públicas. Procure nome empresarial, atividade, site oficial e registro público (CNPJ no Brasil, UID/CHE quando aplicável na Suíça ou equivalente).\n` +
      `NUNCA invente CNPJ, UID, razão social, categoria ou estabelecimento. Se a evidência for insuficiente, reduza a confiança e peça revisão.\n` +
      `Créditos bancários ambíguos, versement, ordre permanent, BCN Netbanking/Mobile, transferências e P2P NÃO são salário por padrão.\n` +
      `Escolha SOMENTE uma categoria da lista permitida. Responda APENAS com um JSON válido, sem markdown.\n` +
      `Transação: ${JSON.stringify(transaction)}\n` +
      `Categorias permitidas: ${JSON.stringify(availableCategories)}\n` +
      `Formato: {"categoryId":string|null,"subcategoryName":string|null,"confidenceScore":number,"reasoning":string,"normalizedMerchant":string,"canonicalMerchant":string|null,"merchantEvidence":string|null,"publicRegistration":string|null,"transactionType":"DESPESA"|"RECEITA"|"INVESTIMENTO"|"TRANSFERENCIA"|"OUTROS"}.`;

    try {
      const answer = await this.ask(prompt, { webSearch: useWebSearch });
      const raw = parseJson<any>(answer.text);
      const category = availableCategories.find(c => c.id === raw.categoryId);
      const confidence = Math.max(0, Math.min(100, Number(raw.confidenceScore) || 0));
      const validCategory = category ? category.id : undefined;
      const isTransfer = raw.transactionType === 'TRANSFERENCIA';
      const isAuto = Boolean(validCategory && confidence >= 90 && !isTransfer);
      const normalizedMerchant = String(raw.normalizedMerchant || transaction.merchant || transaction.payee || transaction.description || '').trim();
      const canonicalMerchant = raw.canonicalMerchant ? String(raw.canonicalMerchant).trim() : normalizedMerchant;
      const evidence = [raw.merchantEvidence, raw.publicRegistration].filter(Boolean).join(' · ');

      return {
        transactionId: transaction.id,
        rawPayee: transaction.merchant || transaction.payee || transaction.description,
        normalizedMerchant,
        canonicalMerchant,
        categoryId: validCategory,
        categoryName: category?.name,
        subcategoryName: raw.subcategoryName || undefined,
        transactionType: raw.transactionType,
        confidenceScore: confidence,
        reasoning: String(raw.reasoning || 'Sugestão gerada pela OpenAI.'),
        reasoningShort: String(raw.reasoning || 'Sugestão OpenAI.').slice(0, 220),
        source: 'AI_REASONING',
        researchUsed: useWebSearch && answer.sourceUrls.length > 0,
        evidenceSummary: evidence || undefined,
        sourceUrls: answer.sourceUrls,
        isAutoClassified: isAuto,
        needsReview: !isAuto,
        sentToPending: !isAuto,
        isTransferOrPersonal: isTransfer
      };
    } catch (error: any) {
      return {
        transactionId: transaction.id,
        rawPayee: transaction.merchant || transaction.payee || transaction.description,
        normalizedMerchant: transaction.merchant || transaction.payee || transaction.description,
        confidenceScore: 0,
        reasoning: `OpenAI indisponível: ${error?.message || 'falha temporária'}.`,
        reasoningShort: 'IA indisponível; revisão humana necessária.',
        source: 'AI_REASONING',
        isAutoClassified: false,
        needsReview: true,
        sentToPending: true
      };
    }
  }

  public async generateChatResponse(params: ChatAssistantParams): Promise<ChatResponse> {
    if (!this.isAvailable()) {
      return { reply: `A camada OpenAI está desativada. Os cálculos determinísticos continuam funcionando normalmente para ${params.clientName}.` };
    }
    const prompt = `Você é o assistente financeiro do apurato. Use SOMENTE o contexto fornecido, não invente valores.\n` +
      `Moeda base: ${params.financialContext.baseCurrency}. Cliente: ${params.clientName}. Perfil: ${params.userRole}.\n` +
      `Contexto financeiro: ${JSON.stringify(params.financialContext)}\nConversa: ${JSON.stringify(params.messages)}\n` +
      `Responda em português, objetivamente, explicitando período/moeda quando houver números. Não dê como certo um valor ausente ou conversão indisponível.`;
    const answer = await this.ask(prompt);
    return { reply: answer.text || 'Não foi possível gerar uma resposta agora.' };
  }

  public async generateMonthlyInsights(params: MonthlyInsightsParams): Promise<MonthlyInsightsResult> {
    const expenseTransactions = params.transactions.filter(t => t.type === 'DESPESA');
    const refundTransactions = params.transactions.filter(t => t.type === 'ESTORNO');
    const incomeTransactions = params.transactions.filter(t => t.type === 'RECEITA');
    const investmentTransactions = params.transactions.filter(t => t.type === 'INVESTIMENTO');
    const grossExpenses = expenseTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);
    const refunds = refundTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);
    const totalExpenses = grossExpenses - refunds;
    const totalIncome = incomeTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);
    const totalInvestments = investmentTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);

    if (!params.transactions.length) {
      return {
        month: params.month,
        hasSufficientData: false,
        statusMessage: 'Sem transações suficientes no período.',
        highlights: [],
        pendingReviewCount: 0,
        anomaliesDetectedCount: 0,
        summaryParagraph: 'Aguardando dados reais para gerar insights.'
      };
    }

    if (!this.isAvailable()) {
      return {
        month: params.month,
        hasSufficientData: true,
        statusMessage: 'Dados reais consolidados; IA opcional indisponível.',
        highlights: [
          `Receitas realizadas: ${params.currency} ${totalIncome.toFixed(2)}`,
          `Despesas líquidas realizadas: ${params.currency} ${totalExpenses.toFixed(2)}`,
          `Investimentos realizados: ${params.currency} ${totalInvestments.toFixed(2)}`
        ],
        pendingReviewCount: 0,
        anomaliesDetectedCount: 0,
        summaryParagraph: `Foram consideradas ${params.transactions.length} transações reais no período.`
      };
    }

    try {
      const answer = await this.ask(`Responda apenas JSON válido para insights financeiros mensais. Não invente números. Dados: ${JSON.stringify({ ...params, transactions: params.transactions.slice(0, 50) })}. Campos: highlights:string[], summaryParagraph:string, savingsRateInsight?:string, topSpendingCategoryInsight?:string, budgetStatusInsight?:string.`);
      const raw = parseJson<any>(answer.text);
      return {
        month: params.month,
        hasSufficientData: true,
        statusMessage: 'Análise concluída com base nos dados reais.',
        highlights: Array.isArray(raw.highlights) ? raw.highlights.slice(0, 4) : [],
        savingsRateInsight: raw.savingsRateInsight,
        topSpendingCategoryInsight: raw.topSpendingCategoryInsight,
        budgetStatusInsight: raw.budgetStatusInsight,
        pendingReviewCount: 0,
        anomaliesDetectedCount: 0,
        summaryParagraph: raw.summaryParagraph || 'Análise concluída.'
      };
    } catch {
      return {
        month: params.month,
        hasSufficientData: true,
        statusMessage: 'Dados carregados; IA temporariamente indisponível.',
        highlights: [`Receitas ${params.currency} ${totalIncome.toFixed(2)} · Despesas ${params.currency} ${totalExpenses.toFixed(2)}`],
        pendingReviewCount: 0,
        anomaliesDetectedCount: 0,
        summaryParagraph: 'Os dados reais permanecem disponíveis mesmo sem a camada de IA.'
      };
    }
  }

  public async generateMonthlySummary(params: MonthlySummaryParams): Promise<MonthlyFinancialSummaryReport> {
    const income = params.transactions.filter(t => t.type === 'RECEITA').reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const grossExpenses = params.transactions.filter(t => t.type === 'DESPESA').reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const refunds = params.transactions.filter(t => t.type === 'ESTORNO').reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const expenses = grossExpenses - refunds;
    const investments = params.transactions.filter(t => t.type === 'INVESTIMENTO').reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const netResult = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    const categoryMap = new Map<string, number>();
    for (const tx of params.transactions.filter(t => t.type === 'DESPESA' || t.type === 'ESTORNO')) {
      const name = tx.category || 'Sem categoria';
      const amount = Math.abs(Number(tx.amount) || 0) * (tx.type === 'ESTORNO' ? -1 : 1);
      categoryMap.set(name, (categoryMap.get(name) || 0) + amount);
    }
    const topCategories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, amount]) => ({
        name,
        amount,
        percentageOfTotal: expenses > 0 ? (amount / expenses) * 100 : 0
      }));

    let aiObservations = params.transactions.length
      ? `Resultado operacional do período: ${params.currency} ${netResult.toFixed(2)}. Investimentos são acompanhados separadamente e não reduzem o resultado operacional.`
      : 'Aguardando transações reais para gerar comparativos.';

    if (this.isAvailable() && params.transactions.length) {
      try {
        const answer = await this.ask(`Com base SOMENTE neste resumo financeiro, escreva 2 a 4 frases executivas em português, sem inventar números: ${JSON.stringify({ month: params.month, currency: params.currency, income, expenses, investments, netResult, savingsRate, topCategories, monthlyPlan: params.monthlyPlan })}`);
        if (answer.text.trim()) aiObservations = answer.text.trim();
      } catch {
        // Deterministic observation above remains valid.
      }
    }

    return {
      month: params.month,
      currency: params.currency,
      hasSufficientData: params.transactions.length > 0,
      incomeRealized: income,
      incomePlanned: params.monthlyPlan?.plannedIncome || 0,
      expensesRealized: expenses,
      expensesPlanned: params.monthlyPlan?.plannedExpenses || 0,
      investmentsRealized: investments,
      investmentsPlanned: params.monthlyPlan?.plannedInvestments || 0,
      netResultRealized: netResult,
      savingsRateRealized: savingsRate,
      topCategories,
      notableChanges: [
        `Taxa de poupança realizada: ${savingsRate.toFixed(1)}%`,
        topCategories[0] ? `Maior categoria de despesa: ${topCategories[0].name} (${topCategories[0].percentageOfTotal.toFixed(1)}%)` : 'Sem despesas categorizadas no período.'
      ],
      goalsProgress: (params.goals || []).map(g => ({ name: g.name, currentAmount: g.currentAmount, targetAmount: g.targetAmount, status: g.status })),
      pendingItemsCount: params.pendingCount,
      aiObservations
    };
  }

  public async detectAnomalies(transactions: Array<{ id: string; date: string; merchant: string; description: string; amount: number; currency: string; categoryName?: string }>): Promise<AnomalyItem[]> {
    if (transactions.length < 3) return [];
    const anomalies: AnomalyItem[] = [];
    const amounts = transactions.map(tx => Math.abs(Number(tx.amount) || 0));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    for (const tx of transactions) {
      const amount = Math.abs(Number(tx.amount) || 0);
      if (amount > mean + (2.5 * stdDev) && amount > 500) {
        anomalies.push({
          id: `anom_spike_${tx.id}`,
          transactionId: tx.id,
          description: tx.description,
          merchant: tx.merchant,
          amount,
          currency: tx.currency,
          date: tx.date,
          categoryName: tx.categoryName,
          type: 'SPIKE_SPENDING',
          severity: amount > 2000 ? 'ALTA' : 'MEDIA',
          message: `Valor significativamente acima do padrão do período (${tx.currency} ${amount.toFixed(2)} vs média ${tx.currency} ${mean.toFixed(2)}).`,
          baselineComparison: `Média do período: ${tx.currency} ${mean.toFixed(2)}`
        });
      }
    }

    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const left = sorted[i];
        const right = sorted[j];
        const sameMerchant = normalizedMerchantKey(left.merchant || left.description) === normalizedMerchantKey(right.merchant || right.description);
        const sameAmount = Math.abs(Math.abs(left.amount) - Math.abs(right.amount)) < 0.01;
        if (!sameMerchant || !sameAmount || left.id === right.id) continue;
        const diffDays = Math.abs(new Date(left.date).getTime() - new Date(right.date).getTime()) / 86400000;
        if (diffDays <= 3) {
          anomalies.push({
            id: `anom_dup_${left.id}_${right.id}`,
            transactionId: left.id,
            description: left.description,
            merchant: left.merchant,
            amount: Math.abs(left.amount),
            currency: left.currency,
            date: left.date,
            categoryName: left.categoryName,
            type: 'DUPLICATE_SUSPECT',
            severity: 'MEDIA',
            message: `Possível cobrança duplicada em datas próximas (${left.date} e ${right.date}).`
          });
        }
      }
    }

    return anomalies.slice(0, 50);
  }

  public async detectRecurrences(transactions: Array<{ id: string; date: string; merchant: string; description: string; amount: number; currency: string; categoryName?: string }>): Promise<RecurrenceSuggestion[]> {
    if (transactions.length < 2) return [];
    const groups = new Map<string, typeof transactions>();

    for (const tx of transactions) {
      const key = normalizedMerchantKey(tx.merchant || tx.description || '');
      if (!key) continue;
      const list = groups.get(key) || [];
      list.push(tx);
      groups.set(key, list);
    }

    const suggestions: RecurrenceSuggestion[] = [];
    for (const [merchantKey, list] of groups.entries()) {
      if (list.length < 2) continue;
      const amounts = list.map(tx => Math.abs(Number(tx.amount) || 0));
      const averageAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const maxDeviation = Math.max(...amounts.map(amount => Math.abs(amount - averageAmount)));
      if (averageAmount > 0 && maxDeviation > Math.max(5, averageAmount * 0.15)) continue;

      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(Math.abs(new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000);
      }
      const intervalDays = intervals.reduce((a, b) => a + b, 0) / Math.max(1, intervals.length);

      let frequency: RecurrenceSuggestion['frequency'] | null = null;
      if (intervalDays >= 6 && intervalDays <= 9) frequency = 'SEMANAL';
      else if (intervalDays >= 25 && intervalDays <= 35) frequency = 'MENSAL';
      else if (intervalDays >= 80 && intervalDays <= 100) frequency = 'TRIMESTRAL';
      else if (intervalDays >= 340 && intervalDays <= 390) frequency = 'ANUAL';
      if (!frequency) continue;

      suggestions.push({
        id: `rec_${merchantKey.replace(/[^A-Z0-9]/g, '-').slice(0, 45)}_${frequency}`,
        merchant: sorted[0].merchant || sorted[0].description,
        description: sorted[0].description,
        averageAmount: Number(averageAmount.toFixed(2)),
        currency: sorted[0].currency,
        frequency,
        estimatedIntervalDays: Math.round(intervalDays),
        confidenceScore: Math.min(95, 70 + (list.length * 5)),
        transactionIds: sorted.map(tx => tx.id),
        suggestedCategoryName: sorted[0].categoryName,
        reasoning: `${list.length} lançamentos com valor semelhante em intervalo médio de ~${Math.round(intervalDays)} dias; confirmar antes de automatizar.`
      });
    }

    return suggestions.sort((a, b) => b.confidenceScore - a.confidenceScore).slice(0, 50);
  }
}
