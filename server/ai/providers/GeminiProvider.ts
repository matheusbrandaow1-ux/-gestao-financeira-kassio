import { GoogleGenAI, Type } from '@google/genai';
import { 
  AIProvider, 
  ClassifyMerchantParams, 
  ChatAssistantParams, 
  MonthlyInsightsParams, 
  MonthlySummaryParams 
} from '../interfaces/AIProvider';
import { 
  ClassificationResult, 
  ChatResponse, 
  MonthlyInsightsResult, 
  MonthlyFinancialSummaryReport,
  AnomalyItem,
  RecurrenceSuggestion,
  GroundingSource
} from '../types';
import { aiMetricsStore } from '../metricsStore';

const PRIMARY_MODEL = 'gemini-3.6-flash';

async function executeGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 1200): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const status = err?.status || err?.code || (err?.message?.includes('429') ? 429 : 0);
      const isTransient = status === 429 || status === 500 || status === 503 || status === 502 || status === 504 ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('UNAVAILABLE') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('rate limit');

      if (!isTransient || attempt > maxRetries) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 400;
      console.warn(`[Gemini Retry] Tentativa ${attempt} falhou com status ${status} (${err?.message || 'transitório'}). Aguardando ${Math.round(delay)}ms para reexecução...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export class GeminiProvider implements AIProvider {
  public name = 'GEMINI';
  private ai: GoogleGenAI | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    if (!this.ai) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
    return this.ai;
  }

  public isAvailable(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  /**
   * Layer 4 / Layer 5: Classifies a transaction using Gemini API, with optional Google Search Grounding
   */
  public async classifyMerchant(params: ClassifyMerchantParams): Promise<ClassificationResult> {
    const client = this.initClient();
    const { transaction, availableCategories, useSearchGrounding } = params;

    const availableCatsFormatted = availableCategories.map(c => ({
      id: c.id,
      name: c.name,
      group: c.groupName,
      type: c.type,
      subcategories: c.subcategories || []
    }));

    const prompt = `Você é o motor de inteligência financeira de alta precisão do sistema de Wealth Planning na Suíça.
Analise a transação financeira abaixo e sugira a melhor categoria e subcategoria estritamente a partir da lista de categorias existentes e atribuíveis fornecidas.

TRANSAÇÃO:
- Descrição original: "${transaction.description || ''}"
- Payee / Estabelecimento: "${transaction.merchant || transaction.payee || ''}"
- Moeda: ${transaction.currency || 'CHF'}
- Valor: ${transaction.amount}
- Conta / Origem: ${transaction.accountName || ''}
- Notas: "${transaction.notes || ''}"
- País do contexto: ${transaction.country || 'Suíça'}

LISTA DE CATEGORIAS VÁLIDAS DO CLIENTE (Escolha EXCLUSIVAMENTE uma destas pelo seu id):
${JSON.stringify(availableCatsFormatted, null, 2)}

INSTRUÇÕES RIGOROSAS:
1. Identifique o nome comercial, tipo de negócio e ramo de atividade da empresa.
2. Selecione a categoria mais apropriada dentre as fornecidas. NUNCA invente uma categoria fora da lista.
3. Se houver uma subcategoria compatível na lista da categoria escolhida, indique-a.
4. Forneça um confidenceScore de 0 a 100 baseado na clareza do estabelecimento e da atividade.
5. Escreva uma explicação curta, direta e objetiva no campo "reasoning" (máximo 1 a 2 frases).`;

    try {
      aiMetricsStore.incrementGeminiCalls();
      if (useSearchGrounding) {
        aiMetricsStore.incrementGoogleSearches();
      }

      if (!client) {
        throw new Error('GEMINI_API_KEY não configurada no servidor.');
      }

      const config: any = {
        systemInstruction: 'Você é um assistente sênior de classificação financeira em CHF para a Suíça. Responda exclusivamente em JSON válido.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categoryId: { type: Type.STRING, description: 'O id exato da categoria escolhida da lista' },
            categoryName: { type: Type.STRING, description: 'O nome da categoria escolhida' },
            subcategoryName: { type: Type.STRING, description: 'Subcategoria sugerida (opcional)' },
            confidenceScore: { type: Type.NUMBER, description: 'Confiança de 0 a 100' },
            reasoning: { type: Type.STRING, description: 'Justificativa curta e objetiva da classificação' },
            normalizedMerchantName: { type: Type.STRING, description: 'Nome comercial normalizado' },
            businessType: { type: Type.STRING, description: 'Ramo de atividade da empresa' }
          },
          required: ['categoryId', 'confidenceScore', 'reasoning']
        }
      };

      if (useSearchGrounding) {
        config.tools = [{ googleSearch: {} }];
      }

      let response;
      try {
        response = await executeGeminiWithRetry(async () => {
          return await client.models.generateContent({
            model: PRIMARY_MODEL,
            contents: prompt,
            config
          });
        });
      } catch (err: any) {
        // If search grounding fails specifically due to tools quota, fallback to direct reasoning
        if (useSearchGrounding && (err?.message?.includes('quota') || err?.status === 429)) {
          console.warn('[Gemini Grounding Fallback] Ferramenta googleSearch atingiu cota. Recorrendo à inteligência direta do modelo...');
          const fallbackConfig = { ...config };
          delete fallbackConfig.tools;
          response = await executeGeminiWithRetry(async () => {
            return await client.models.generateContent({
              model: PRIMARY_MODEL,
              contents: prompt,
              config: fallbackConfig
            });
          });
        } else {
          throw err;
        }
      }

      const responseText = response.text || '{}';
      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText);
      } catch (err) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      }

      // Extract grounding sources if available
      const groundingSources: GroundingSource[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks)) {
        for (const chunk of chunks) {
          if (chunk.web?.uri) {
            groundingSources.push({
              uri: chunk.web.uri,
              title: chunk.web.title || chunk.web.uri
            });
          }
        }
      }

      const matchedCat = availableCategories.find(c => c.id === parsed.categoryId) || 
                         availableCategories.find(c => c.name.toLowerCase() === (parsed.categoryName || '').toLowerCase());

      const confidence = Math.min(100, Math.max(0, Number(parsed.confidenceScore) || 50));
      const source = useSearchGrounding ? 'MERCHANT_RESEARCH' : 'AI_REASONING';
      const aiConfig = aiMetricsStore.getConfig();

      return {
        transactionId: transaction.id,
        rawPayee: transaction.merchant || transaction.payee || transaction.description,
        normalizedMerchant: parsed.normalizedMerchantName || transaction.merchant,
        canonicalMerchant: parsed.normalizedMerchantName || transaction.merchant,
        categoryId: matchedCat ? matchedCat.id : parsed.categoryId,
        categoryName: matchedCat ? matchedCat.name : parsed.categoryName,
        subcategoryName: parsed.subcategoryName,
        confidenceScore: confidence,
        reasoning: parsed.reasoning || `${parsed.normalizedMerchantName || transaction.merchant || 'Estabelecimento'} classificado via Gemini.`,
        reasoningShort: parsed.reasoning || `${parsed.normalizedMerchantName || transaction.merchant || 'Estabelecimento'} classificado via Gemini.`,
        source,
        isAutoClassified: confidence >= aiConfig.autoClassifyThreshold,
        needsReview: confidence < aiConfig.autoClassifyThreshold,
        sentToPending: confidence < aiConfig.reviewRecommendedThreshold,
        groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
        merchantKnowledge: {
          merchantKey: (parsed.normalizedMerchantName || transaction.merchant || '').toUpperCase(),
          normalizedName: parsed.normalizedMerchantName || transaction.merchant || '',
          canonicalMerchant: parsed.normalizedMerchantName || transaction.merchant,
          businessType: parsed.businessType,
          confidence,
          source,
          reasoning: parsed.reasoning || '',
          lastCheckedAt: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('Erro na classificação Gemini:', error);
      return {
        transactionId: transaction.id,
        rawPayee: transaction.merchant || transaction.payee || transaction.description,
        normalizedMerchant: transaction.merchant || transaction.description,
        canonicalMerchant: transaction.merchant || transaction.description,
        confidenceScore: 30,
        reasoning: `Erro no processamento IA (${error?.message || 'indisponível'}).`,
        reasoningShort: `Falha na IA: ${error?.status || 'Erro'} - ${error?.message || 'Indisponível'}`,
        source: 'AI_REASONING',
        isAutoClassified: false,
        needsReview: true,
        sentToPending: true
      };
    }
  }

  /**
   * Conversational Assistant: Answers financial questions using authenticated client financial data
   */
  public async generateChatResponse(params: ChatAssistantParams): Promise<ChatResponse> {
    const client = this.initClient();
    const { messages, userRole, clientName, financialContext } = params;

    const isConsultant = userRole === 'CONSULTANT' || userRole === 'ADMIN';

    const systemInstruction = `Você é o "Assistente Financeiro Inteligente" da plataforma de Wealth Planning e Planejamento Financeiro na Suíça.
Você está interagindo com ${isConsultant ? `o Consultor Financeiro responsável pela conta do cliente ${clientName}` : `o cliente ${clientName}`}.

DADOS FINANCEIROS REAIS DO CLIENTE (Utilize ESTRITAMENTE estes dados para responder):
- Moeda Base: ${financialContext.baseCurrency}
- Saldo Total Consolidado em Contas: ${financialContext.baseCurrency} ${financialContext.totalBalance.toFixed(2)}
- Resumo de Contas: ${JSON.stringify(financialContext.accountsSummary)}
- Totais Realizados do Mês: Receitas ${financialContext.baseCurrency} ${(financialContext.realizedTotals?.income || 0).toFixed(2)}, Despesas ${financialContext.baseCurrency} ${(financialContext.realizedTotals?.expenses || 0).toFixed(2)}, Investimentos ${financialContext.baseCurrency} ${(financialContext.realizedTotals?.investments || 0).toFixed(2)}, Resultado ${financialContext.baseCurrency} ${(financialContext.realizedTotals?.netResult || 0).toFixed(2)}
- Planejado Orçamentário: Receitas ${financialContext.baseCurrency} ${(financialContext.monthlyBudget?.plannedIncome || 0).toFixed(2)}, Despesas ${financialContext.baseCurrency} ${(financialContext.monthlyBudget?.plannedExpenses || 0).toFixed(2)}, Investimentos ${financialContext.baseCurrency} ${(financialContext.monthlyBudget?.plannedInvestments || 0).toFixed(2)}
- Maiores Categorias de Despesas Realizadas: ${JSON.stringify(financialContext.topExpenseCategories || [])}
- Transações Recentes Realizadas: ${JSON.stringify((financialContext.currentMonthTransactions || []).slice(0, 30))}
- Objetivos Financeiros: ${JSON.stringify(financialContext.goalsSummary || [])}
- Itens Pendentes de Revisão: ${financialContext.pendingCount}

DIRETRIZES FUNDAMENTAIS:
1. SE NÃO HOUVER TRANSAÇÕES REALIZADAS (ou se estiverem zeradas), informe claramente que os valores realizados estão em ${financialContext.baseCurrency} 0,00 aguardando sincronização ou lançamentos reais. NUNCA invente transações, números ou baselines fictícios.
2. Mantenha as respostas elegantes, diretas, claras e sem jargões desnecessários.
3. Se for o CLIENTE: ajude com visão de orçamento, gastos por categoria, progresso em objetivos e oportunidades de economia.
4. Se for o CONSULTOR: ofereça visão analítica, aderência ao planejamento, itens que necessitam de atenção ou resumos para reuniões com o cliente.
5. Sempre formate valores monetários com a moeda ${financialContext.baseCurrency} (ex: CHF 1'250.00).`;

    try {
      aiMetricsStore.incrementGeminiCalls();

      if (!client) {
        return {
          reply: `O Assistente Financeiro está aguardando a configuração da chave de IA no ambiente seguro. Com base nos dados carregados, o saldo consolidado atual é de ${financialContext.baseCurrency} ${financialContext.totalBalance.toFixed(2)} e você possui ${financialContext.pendingCount} pendência(s).`
        };
      }

      // Convert conversation history
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const response = await executeGeminiWithRetry(async () => {
        return await client.models.generateContent({
          model: PRIMARY_MODEL,
          contents,
          config: {
            systemInstruction,
            temperature: 0.4
          }
        });
      });

      const reply = response.text || 'Não consegui processar a resposta no momento.';
      return { reply };
    } catch (err: any) {
      console.error('Erro no Chat Gemini:', err);
      return {
        reply: `Erro de comunicação com o serviço Gemini (${err?.status || err?.code || 'Erro de Execução'}: ${err?.message || 'Falha temporária na API de IA'}). Detalhes: modelo ${PRIMARY_MODEL}.`
      };
    }
  }

  /**
   * Generates discrete dashboard insights for the current month
   */
  public async generateMonthlyInsights(params: MonthlyInsightsParams): Promise<MonthlyInsightsResult> {
    const { month, currency, transactions, monthlyPlan, goals, recurrences, role } = params;

    const expenseTransactions = transactions.filter(t => t.type === 'DESPESA');
    const incomeTransactions = transactions.filter(t => t.type === 'RECEITA');
    const investTransactions = transactions.filter(t => t.type === 'INVESTIMENTO');

    const totalExpenses = expenseTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalIncome = incomeTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalInvest = investTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

    if (transactions.length === 0 || (totalExpenses === 0 && totalIncome === 0)) {
      return {
        month,
        hasSufficientData: false,
        statusMessage: 'Aguardando histórico financeiro para gerar insights.',
        highlights: [],
        pendingReviewCount: 0,
        anomaliesDetectedCount: 0,
        summaryParagraph: 'Aguardando sincronização de transações reais do Lunch Money ou lançamentos manuais para gerar análises e insights personalizados do mês.'
      };
    }

    const client = this.initClient();
    if (!client) {
      return {
        month,
        hasSufficientData: true,
        statusMessage: 'Dados reais consolidados.',
        highlights: [
          `Total de despesas realizadas no período: ${currency} ${totalExpenses.toFixed(2)}`,
          `Total de receitas realizadas: ${currency} ${totalIncome.toFixed(2)}`
        ],
        pendingReviewCount: 0,
        anomaliesDetectedCount: 0,
        summaryParagraph: `Foram registradas ${transactions.length} transações no período com total de receitas de ${currency} ${totalIncome.toFixed(2)} e despesas de ${currency} ${totalExpenses.toFixed(2)}.`
      };
    }

    const prompt = `Analise os dados financeiros REAIS do mês ${month} para gerar 2 a 4 insights curtos, objetivos e valiosos para o painel de controle.

DADOS DO MÊS:
- Moeda: ${currency}
- Total Receitas: ${currency} ${totalIncome.toFixed(2)} (Planejado: ${currency} ${(monthlyPlan?.plannedIncome || 0).toFixed(2)})
- Total Despesas: ${currency} ${totalExpenses.toFixed(2)} (Planejado: ${currency} ${(monthlyPlan?.plannedExpenses || 0).toFixed(2)})
- Total Investimentos: ${currency} ${totalInvest.toFixed(2)} (Planejado: ${currency} ${(monthlyPlan?.plannedInvestments || 0).toFixed(2)})
- Número de transações: ${transactions.length}
- Principais transações: ${JSON.stringify(transactions.slice(0, 20))}
- Objetivos: ${JSON.stringify(goals || [])}
- Perfil: ${role}

INSTRUÇÕES:
- Retorne apenas insights baseados nos números reais acima.
- Destaque taxa de poupança, desvios em relação ao planejado se existirem, ou categorias mais representativas.
- Não invente nada.`;

    try {
      aiMetricsStore.incrementGeminiCalls();

      const response = await executeGeminiWithRetry(async () => {
        return await client.models.generateContent({
          model: PRIMARY_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                highlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Lista de 2 a 4 insights curtos de 1 linha'
                },
                summaryParagraph: {
                  type: Type.STRING,
                  description: 'Parágrafo conciso de resumo do mês (máx 2 frases)'
                },
                savingsRateInsight: { type: Type.STRING },
                budgetStatusInsight: { type: Type.STRING }
              },
              required: ['highlights', 'summaryParagraph']
            }
          }
        });
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        month,
        hasSufficientData: true,
        statusMessage: 'Insights gerados com base em transações reais.',
        highlights: parsed.highlights || [],
        summaryParagraph: parsed.summaryParagraph || '',
        savingsRateInsight: parsed.savingsRateInsight,
        budgetStatusInsight: parsed.budgetStatusInsight,
        pendingReviewCount: 0,
        anomaliesDetectedCount: 0
      };
    } catch (e) {
      return {
        month,
        hasSufficientData: true,
        statusMessage: 'Insights consolidados.',
        highlights: [`Despesas realizadas: ${currency} ${totalExpenses.toFixed(2)}`],
        summaryParagraph: `Total de ${transactions.length} transações registradas no período.`,
        pendingReviewCount: 0,
        anomaliesDetectedCount: 0
      };
    }
  }

  /**
   * Generates comprehensive monthly financial report
   */
  public async generateMonthlySummary(params: MonthlySummaryParams): Promise<MonthlyFinancialSummaryReport> {
    const { month, currency, transactions, monthlyPlan, goals, pendingCount, role } = params;

    const incomeRealized = transactions.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
    const expensesRealized = transactions.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
    const investmentsRealized = transactions.filter(t => t.type === 'INVESTIMENTO').reduce((s, t) => s + t.amount, 0);
    const netResultRealized = incomeRealized - expensesRealized - investmentsRealized;
    const savingsRateRealized = incomeRealized > 0 ? ((incomeRealized - expensesRealized) / incomeRealized) * 100 : 0;

    // Top Categories aggregation
    const catMap = new Map<string, number>();
    for (const t of transactions.filter(tx => tx.type === 'DESPESA')) {
      const catName = t.category || 'Outros';
      catMap.set(catName, (catMap.get(catName) || 0) + t.amount);
    }
    const sortedCats = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name,
        amount,
        percentageOfTotal: expensesRealized > 0 ? (amount / expensesRealized) * 100 : 0
      }));

    if (transactions.length === 0) {
      return {
        month,
        currency,
        hasSufficientData: false,
        incomeRealized: 0,
        incomePlanned: monthlyPlan?.plannedIncome || 0,
        expensesRealized: 0,
        expensesPlanned: monthlyPlan?.plannedExpenses || 0,
        investmentsRealized: 0,
        investmentsPlanned: monthlyPlan?.plannedInvestments || 0,
        netResultRealized: 0,
        savingsRateRealized: 0,
        topCategories: [],
        notableChanges: ['Aguardando sincronização de transações reais para gerar comparativos.'],
        goalsProgress: (goals || []).map(g => ({
          name: g.name,
          currentAmount: g.currentAmount,
          targetAmount: g.targetAmount,
          status: g.status
        })),
        pendingItemsCount: pendingCount,
        aiObservations: 'O planejamento do mês está estruturado. Conecte o Lunch Money ou importe transações para visualizar o acompanhamento dos valores realizados em tempo real.'
      };
    }

    const client = this.initClient();
    let aiObs = `Foram registradas ${transactions.length} transações no mês com resultado líquido de ${currency} ${netResultRealized.toFixed(2)}.`;

    if (client) {
      try {
        aiMetricsStore.incrementGeminiCalls();
        const prompt = `Gere observações analíticas executivas para o "Resumo Financeiro do Mês" (${month}):
Moeda: ${currency}
Receitas Realizadas: ${incomeRealized.toFixed(2)} (Planejadas: ${monthlyPlan?.plannedIncome || 0})
Despesas Realizadas: ${expensesRealized.toFixed(2)} (Planejadas: ${monthlyPlan?.plannedExpenses || 0})
Investimentos Realizados: ${investmentsRealized.toFixed(2)} (Planejados: ${monthlyPlan?.plannedInvestments || 0})
Taxa de Poupança: ${savingsRateRealized.toFixed(1)}%
Principais Categorias: ${JSON.stringify(sortedCats.slice(0, 5))}
Perfil: ${role}`;

        const resp = await executeGeminiWithRetry(async () => {
          return await client.models.generateContent({
            model: PRIMARY_MODEL,
            contents: prompt,
            config: {
              systemInstruction: 'Escreva um parágrafo profissional e objetivo de 3 a 4 frases avaliando o desempenho financeiro do mês.'
            }
          });
        });
        if (resp.text) {
          aiObs = resp.text.trim();
        }
      } catch (e) {
        console.warn('Fallback monthly summary obs:', e);
      }
    }

    return {
      month,
      currency,
      hasSufficientData: true,
      incomeRealized,
      incomePlanned: monthlyPlan?.plannedIncome || 0,
      expensesRealized,
      expensesPlanned: monthlyPlan?.plannedExpenses || 0,
      investmentsRealized,
      investmentsPlanned: monthlyPlan?.plannedInvestments || 0,
      netResultRealized,
      savingsRateRealized,
      topCategories: sortedCats.slice(0, 6),
      notableChanges: [
        `Taxa de poupança realizada de ${savingsRateRealized.toFixed(1)}%`,
        sortedCats[0] ? `Maior categoria de despesa: ${sortedCats[0].name} (${sortedCats[0].percentageOfTotal.toFixed(1)}%)` : 'Despesas distribuídas'
      ],
      goalsProgress: (goals || []).map(g => ({
        name: g.name,
        currentAmount: g.currentAmount,
        targetAmount: g.targetAmount,
        status: g.status
      })),
      pendingItemsCount: pendingCount,
      aiObservations: aiObs
    };
  }

  /**
   * Detects unusual financial behavior or spikes
   */
  public async detectAnomalies(transactions: Array<{ id: string; date: string; merchant: string; description: string; amount: number; currency: string; categoryName?: string }>): Promise<AnomalyItem[]> {
    if (transactions.length < 3) return [];

    const anomalies: AnomalyItem[] = [];
    const amounts = transactions.map(t => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / amounts.length);

    // 1. Spending spikes (> mean + 2.5 * stdDev and amount > 500)
    for (const t of transactions) {
      if (t.amount > mean + (2.5 * stdDev) && t.amount > 500) {
        anomalies.push({
          id: `anom_spike_${t.id}`,
          transactionId: t.id,
          description: t.description,
          merchant: t.merchant,
          amount: t.amount,
          currency: t.currency,
          date: t.date,
          categoryName: t.categoryName,
          type: 'SPIKE_SPENDING',
          severity: t.amount > 2000 ? 'ALTA' : 'MEDIA',
          message: `Despesa significativamente acima do padrão médio (${t.currency} ${t.amount.toFixed(2)} vs média de ${t.currency} ${mean.toFixed(2)}).`,
          baselineComparison: `Média do período: ${t.currency} ${mean.toFixed(2)}`
        });
      }
    }

    // 2. Suspected Duplicates (same merchant, exact same amount within 3 days)
    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const t1 = transactions[i];
        const t2 = transactions[j];
        if (
          t1.merchant && t2.merchant &&
          t1.merchant.toLowerCase().trim() === t2.merchant.toLowerCase().trim() &&
          Math.abs(t1.amount - t2.amount) < 0.01 &&
          t1.id !== t2.id
        ) {
          const d1 = new Date(t1.date).getTime();
          const d2 = new Date(t2.date).getTime();
          const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
          if (diffDays <= 3) {
            anomalies.push({
              id: `anom_dup_${t1.id}_${t2.id}`,
              transactionId: t1.id,
              description: t1.description,
              merchant: t1.merchant,
              amount: t1.amount,
              currency: t1.currency,
              date: t1.date,
              categoryName: t1.categoryName,
              type: 'DUPLICATE_SUSPECT',
              severity: 'MEDIA',
              message: `Possível cobrança duplicada com ${t1.merchant} (${t1.currency} ${t1.amount.toFixed(2)}) em datas próximas (${t1.date} e ${t2.date}).`
            });
          }
        }
      }
    }

    return anomalies;
  }

  /**
   * Identifies recurring patterns across transactions
   */
  public async detectRecurrences(transactions: Array<{ id: string; date: string; merchant: string; description: string; amount: number; currency: string; categoryName?: string }>): Promise<RecurrenceSuggestion[]> {
    if (transactions.length < 2) return [];

    const suggestions: RecurrenceSuggestion[] = [];
    const grouped = new Map<string, typeof transactions>();

    for (const t of transactions) {
      const key = (t.merchant || t.description).toUpperCase().trim();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(t);
    }

    for (const [key, group] of grouped.entries()) {
      if (group.length >= 2) {
        // Check amount variance
        const avgAmt = group.reduce((acc, t) => acc + t.amount, 0) / group.length;
        const maxDiff = Math.max(...group.map(t => Math.abs(t.amount - avgAmt)));

        if (maxDiff < avgAmt * 0.15 || maxDiff <= 5) {
          // Sort dates
          const sorted = [...group].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const firstDate = new Date(sorted[0].date).getTime();
          const lastDate = new Date(sorted[sorted.length - 1].date).getTime();
          const totalDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
          const intervalDays = totalDays / (sorted.length - 1);

          let frequency: 'MENSAL' | 'ANUAL' | 'SEMANAL' | 'TRIMESTRAL' = 'MENSAL';
          if (intervalDays >= 25 && intervalDays <= 35) frequency = 'MENSAL';
          else if (intervalDays >= 80 && intervalDays <= 100) frequency = 'TRIMESTRAL';
          else if (intervalDays >= 6 && intervalDays <= 9) frequency = 'SEMANAL';
          else if (intervalDays >= 340 && intervalDays <= 390) frequency = 'ANUAL';

          suggestions.push({
            id: `rec_sug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            merchant: group[0].merchant || group[0].description,
            description: group[0].description,
            averageAmount: Number(avgAmt.toFixed(2)),
            currency: group[0].currency,
            frequency,
            estimatedIntervalDays: Math.round(intervalDays),
            confidenceScore: Math.min(95, 70 + (group.length * 5)),
            transactionIds: group.map(t => t.id),
            suggestedCategoryId: undefined,
            suggestedCategoryName: group[0].categoryName,
            reasoning: `${group[0].merchant || group[0].description}: ${group.length} pagamentos identificados em intervalos regulares de ~${Math.round(intervalDays)} dias no valor de ${group[0].currency} ${avgAmt.toFixed(2)}.`
          });
        }
      }
    }

    return suggestions;
  }
}

