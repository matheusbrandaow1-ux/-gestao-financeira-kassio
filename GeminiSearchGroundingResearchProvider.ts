import { GoogleGenAI, Type } from '@google/genai';
import { 
  MerchantResearchProvider, 
  ResearchMerchantParams, 
  MerchantResearchResult 
} from '../interfaces/MerchantResearchProvider';
import { GroundingSource } from '../types';
import { aiMetricsStore } from '../metricsStore';

const PRIMARY_MODEL = 'gemini-3.6-flash';

async function executeResearchWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 1200): Promise<T> {
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
      console.warn(`[Merchant Research Retry] Tentativa ${attempt} falhou com status ${status}. Aguardando ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export class GeminiSearchGroundingResearchProvider implements MerchantResearchProvider {
  public name = 'GEMINI_SEARCH_GROUNDING';
  private ai: GoogleGenAI | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

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
   * Identifies whether a string describes an internal transfer, banking operation, or private individual
   * to strictly prevent web searches on private individuals and personal transfers.
   */
  public isTransferOrPersonalMovement(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    const transferPatterns = [
      /\bcr[eé]dit\b/i,
      /\bversement\b/i,
      /\bvirement\b/i,
      /\bordre\s+permanent\b/i,
      /\bbcn[\s-]*netbanking\b/i,
      /\bbcn[\s-]*mobile\b/i,
      /\be-?banking\b/i,
      /\btransfert?\b/i,
      /\btransfer\b/i,
      /\bdepot\b/i,
      /\bd[eé]p[oô]t\b/i,
      /\bsalaire\b/i,
      /\bremboursement\b/i,
      /\bcompensation\b/i,
      /\bepargne\b/i,
      /\b[eé]pargne\b/i,
      /\btwint\s+de\b/i,
      /\btwint\s+a\b/i,
      /\btwint\s+p2p\b/i
    ];

    return transferPatterns.some(p => p.test(lower));
  }

  public async researchMerchant(params: ResearchMerchantParams): Promise<MerchantResearchResult> {
    const { rawPayee, description, amount, currency, accountName, country = 'Suíça', city = 'Genève', availableCategories } = params;
    const searchText = (rawPayee || description || '').trim();

    // 1. Guard against investigating private individuals or banking transfers
    if (this.isTransferOrPersonalMovement(searchText) || this.isTransferOrPersonalMovement(description || '')) {
      return {
        rawPayee,
        normalizedMerchant: rawPayee || description || 'Transferência / Movimentação Interna',
        canonicalMerchant: 'Transferência Bancária / Pessoal',
        merchantType: 'Transferência / Movimentação Financeira',
        country: 'Suíça',
        city,
        transactionType: 'TRANSFERENCIA',
        confidence: 85,
        researchUsed: false,
        evidenceSummary: 'Identificado como movimentação interna, transferência bancária ou versement. Pesquisa web pública omitida por privacidade.',
        reasoningShort: 'Movimentação financeira interna ou transferência bancária entre contas/pessoas.',
        needsReview: false,
        isTransferOrPersonal: true
      };
    }

    const client = this.initClient();
    if (!client) {
      return {
        rawPayee,
        normalizedMerchant: rawPayee,
        canonicalMerchant: rawPayee,
        confidence: 40,
        researchUsed: false,
        evidenceSummary: 'Chave GEMINI_API_KEY não configurada no servidor para pesquisa pública.',
        reasoningShort: 'Não foi possível pesquisar online por ausência de credencial de IA.',
        needsReview: true
      };
    }

    const availableCatsFormatted = availableCategories.map(c => ({
      id: c.id,
      name: c.name,
      group: c.groupName,
      type: c.type,
      subcategories: c.subcategories || []
    }));

    // Progressive query design prioritizing Switzerland, Geneva, Canton of Geneva, and Swiss business context
    const progressiveContext = `
ESTABELECIMENTO ALVO: "${searchText}"
DESCRIÇÃO BANCÁRIA: "${description || ''}"
VALOR: ${currency || 'CHF'} ${amount || 0}
CONTA: "${accountName || ''}"
CONTEXTO GEOGRÁFICO DO CLIENTE: ${city}, ${country} (Cantão de Genebra, Suíça)
`;

    const prompt = `Você é um especialista em investigação e inteligência de estabelecimentos comerciais, empresas e serviços na Suíça e no exterior para planejamento financeiro patrimonial em CHF.

Pesquise na web utilizando o Google Search para identificar com precisão o estabelecimento comercial por trás do texto bancário abaixo:
${progressiveContext}

LISTA DE CATEGORIAS PERMITIDAS (Escolha EXCLUSIVAMENTE uma destas pelo seu id):
${JSON.stringify(availableCatsFormatted, null, 2)}

DIRETRIZES DE INVESTIGAÇÃO:
1. Pesquise e identifique:
   - Nome comercial do estabelecimento (canonicalMerchant);
   - Razão social ou nome jurídico quando relevante (legalName);
   - Ramo de atividade / tipo de negócio (merchantType, ex: Supermercado, Restaurante, Farmácia, Consultório Médico, Hotel, Transporte, Software SaaS, Concessionária, etc.);
   - País e cidade onde opera (priorizando Suíça/Genebra se compatível, ou país de origem se for empresa internacional/online);
   - Resumo das evidências encontradas (evidenceSummary);
   - Categoria financeira mais compatível DENTRE AS CATEGORIAS FORNECIDAS ACIMA.
2. NUNCA invente categorias que não estejam na lista de categorias válidas fornecida.
3. Se o estabelecimento for internacional ou online (ex: Apple, Airbnb, Amazon, EasyJet), identifique-o corretamente.
4. Se houver ambiguidade ou múltiplos negócios com nome similar, analise o contexto de Genebra/Suíça e a descrição bancária para ponderar a confiança.
5. Calcule a confiança (confidence) de 0 a 100 com rigor:
   - 90 a 100: Identificação com alto lastro (site oficial, registro empresarial suíço, Google Maps/Local.ch claro).
   - 70 a 89: Identificação provável com evidências razoáveis.
   - Abaixo de 70: Evidências fracas, insuficientes ou estabelecimento ambíguo.`;

    try {
      aiMetricsStore.incrementGeminiCalls();
      aiMetricsStore.incrementGoogleSearches();

      const searchConfig: any = {
        tools: [{ googleSearch: {} }],
        systemInstruction: 'Você é um auditor financeiro e pesquisador corporativo na Suíça. Analise evidências com rigor e responda exclusivamente em JSON válido.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            canonicalMerchant: { type: Type.STRING, description: 'Nome comercial canônico do estabelecimento' },
            legalName: { type: Type.STRING, description: 'Razão social oficial (opcional)' },
            merchantType: { type: Type.STRING, description: 'Tipo de atividade / segmento comercial' },
            country: { type: Type.STRING, description: 'País do estabelecimento' },
            city: { type: Type.STRING, description: 'Cidade do estabelecimento (se aplicável)' },
            categoryId: { type: Type.STRING, description: 'ID da categoria escolhida estritamente da lista' },
            categoryName: { type: Type.STRING, description: 'Nome da categoria' },
            subcategoryName: { type: Type.STRING, description: 'Subcategoria sugerida (opcional)' },
            transactionType: { 
              type: Type.STRING, 
              enum: ['DESPESA', 'RECEITA', 'INVESTIMENTO', 'TRANSFERENCIA', 'OUTROS'],
              description: 'Tipo financeiro da transação' 
            },
            confidence: { type: Type.NUMBER, description: 'Score de confiança de 0 a 100' },
            evidenceSummary: { type: Type.STRING, description: 'Resumo factual das evidências e fontes encontradas' },
            reasoningShort: { type: Type.STRING, description: 'Justificativa concisa de 1 frase' }
          },
          required: ['canonicalMerchant', 'merchantType', 'categoryId', 'confidence', 'evidenceSummary', 'reasoningShort']
        }
      };

      let response;
      try {
        // First try with googleSearch tool (single attempt to detect tool quota without wasting retries)
        response = await client.models.generateContent({
          model: PRIMARY_MODEL,
          contents: prompt,
          config: searchConfig
        });
      } catch (err: any) {
        const isQuotaOr429 = err?.status === 429 || 
          err?.message?.includes('quota') || 
          err?.message?.includes('RESOURCE_EXHAUSTED') ||
          err?.message?.includes('Tool');

        if (isQuotaOr429) {
          const fallbackConfig = { ...searchConfig };
          delete fallbackConfig.tools;
          response = await executeResearchWithRetry(async () => {
            return await client.models.generateContent({
              model: PRIMARY_MODEL,
              contents: prompt,
              config: fallbackConfig
            });
          });
        } else {
          // Retry standard transient network errors
          response = await executeResearchWithRetry(async () => {
            return await client.models.generateContent({
              model: PRIMARY_MODEL,
              contents: prompt,
              config: searchConfig
            });
          });
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

      // Extract real grounding sources from response candidate
      const groundingSources: GroundingSource[] = [];
      const sourceUrls: string[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks)) {
        for (const chunk of chunks) {
          if (chunk.web?.uri) {
            groundingSources.push({
              uri: chunk.web.uri,
              title: chunk.web.title || chunk.web.uri
            });
            sourceUrls.push(chunk.web.uri);
          }
        }
      }

      const matchedCategory = availableCategories.find(c => c.id === parsed.categoryId) ||
                             availableCategories.find(c => c.name.toLowerCase() === (parsed.categoryName || '').toLowerCase());

      const confidence = Math.min(100, Math.max(0, Number(parsed.confidence) || 50));
      const autoThreshold = aiMetricsStore.getConfig().autoClassifyThreshold;

      const result: MerchantResearchResult = {
        rawPayee,
        normalizedMerchant: parsed.canonicalMerchant || rawPayee,
        canonicalMerchant: parsed.canonicalMerchant || rawPayee,
        legalName: parsed.legalName,
        merchantType: parsed.merchantType,
        country: parsed.country || 'Suíça',
        city: parsed.city,
        suggestedCategoryId: matchedCategory?.id || parsed.categoryId,
        suggestedCategoryName: matchedCategory?.name || parsed.categoryName,
        suggestedSubcategoryName: parsed.subcategoryName,
        transactionType: (parsed.transactionType as any) || 'DESPESA',
        confidence,
        researchUsed: true,
        evidenceSummary: parsed.evidenceSummary || 'Pesquisa web pública realizada com sucesso.',
        sourceUrls: sourceUrls.length > 0 ? sourceUrls : undefined,
        reasoningShort: parsed.reasoningShort || `Identificado como ${parsed.canonicalMerchant || rawPayee} (${parsed.merchantType || 'comércio'}).`,
        needsReview: confidence < autoThreshold,
        groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
        researchMetadata: {
          query: searchText,
          canonicalMerchant: parsed.canonicalMerchant || rawPayee,
          legalName: parsed.legalName,
          merchantType: parsed.merchantType,
          country: parsed.country,
          city: parsed.city,
          sourceUrls: sourceUrls.length > 0 ? sourceUrls : undefined,
          sourceTitle: groundingSources[0]?.title,
          evidenceSummary: parsed.evidenceSummary || '',
          researchedAt: new Date().toISOString(),
          confidence
        }
      };

      return result;
    } catch (error: any) {
      console.warn('Erro ao executar Gemini Search Grounding para merchant:', error?.message || error);
      return {
        rawPayee,
        normalizedMerchant: rawPayee,
        canonicalMerchant: rawPayee,
        confidence: 35,
        researchUsed: false,
        evidenceSummary: 'Falha ou indisponibilidade temporária na pesquisa web.',
        reasoningShort: 'Não foi possível concluir a pesquisa pública do estabelecimento.',
        needsReview: true
      };
    }
  }
}

export const defaultMerchantResearchProvider = new GeminiSearchGroundingResearchProvider();
