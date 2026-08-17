import { MerchantKnowledgeItem } from './types';

class MerchantKnowledgeStore {
  // Map of merchantKey -> MerchantKnowledgeItem
  private knowledgeMap = new Map<string, MerchantKnowledgeItem>();

  constructor() {
    this.seedCommonSwissKnowledge();
  }

  public normalizeMerchantKey(text: string): string {
    if (!text) return '';
    return text
      .toUpperCase()
      .replace(/^PAYPAL\s*\*\s*/i, '')
      .replace(/^TWINT\s*\*\s*/i, '')
      .replace(/^SUMUP\s*\*\s*/i, '')
      .replace(/^STRIPE\s*\*\s*/i, '')
      .replace(/^SQ\s*\*\s*/i, '')
      .replace(/\b(AG|SA|GMBH|SARL|LLC|INC|LTD|COOP)\b/gi, '')
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private seedCommonSwissKnowledge() {
    const seedMerchants: Array<Partial<MerchantKnowledgeItem> & { key: string; name: string; type: string; catIntent: string; reason: string }> = [
      {
        key: 'DIGITEC GALAXUS',
        name: 'Digitec Galaxus',
        legalName: 'Digitec Galaxus AG',
        country: 'Suíça',
        type: 'Varejo / Eletrônicos & E-commerce',
        catIntent: 'ELETRONICOS',
        confidence: 96,
        reason: 'Digitec Galaxus é uma varejista suíça especializada em eletrônicos, tecnologia e equipamentos.'
      },
      {
        key: 'DIGITEC',
        name: 'Digitec',
        legalName: 'Digitec Galaxus AG',
        country: 'Suíça',
        type: 'Varejo / Eletrônicos',
        catIntent: 'ELETRONICOS',
        confidence: 96,
        reason: 'Digitec é a principal loja suíça de eletrônicos, computação e tecnologia.'
      },
      {
        key: 'GALAXUS',
        name: 'Galaxus',
        legalName: 'Digitec Galaxus AG',
        country: 'Suíça',
        type: 'Varejo / E-commerce Geral',
        catIntent: 'COMPRAS',
        confidence: 94,
        reason: 'Galaxus é a maior loja online de departamentos e compras da Suíça.'
      },
      {
        key: 'COOP SUPERMARKT',
        name: 'Coop Supermarkt',
        legalName: 'Coop Genossenschaft',
        country: 'Suíça',
        type: 'Supermercado & Alimentação',
        catIntent: 'SUPERMERCADO',
        confidence: 98,
        reason: 'Coop Supermarkt é uma das maiores redes de supermercados e alimentos da Suíça.'
      },
      {
        key: 'COOP',
        name: 'Coop',
        legalName: 'Coop Genossenschaft',
        country: 'Suíça',
        type: 'Supermercado & Alimentação',
        catIntent: 'SUPERMERCADO',
        confidence: 97,
        reason: 'Coop é uma cooperativa suíça de supermercados e produtos de conveniência.'
      },
      {
        key: 'MIGROS',
        name: 'Migros',
        legalName: 'Federation of Migros Cooperatives',
        country: 'Suíça',
        type: 'Supermercado & Alimentação',
        catIntent: 'SUPERMERCADO',
        confidence: 98,
        reason: 'Migros é a maior rede varejista e de supermercados da Suíça.'
      },
      {
        key: 'DENNER',
        name: 'Denner',
        legalName: 'Denner AG',
        country: 'Suíça',
        type: 'Supermercado / Desconto',
        catIntent: 'SUPERMERCADO',
        confidence: 96,
        reason: 'Denner é uma rede suíça de supermercados de desconto (Grupo Migros).'
      },
      {
        key: 'ALDI SUISSE',
        name: 'Aldi Suisse',
        legalName: 'Aldi Suisse AG',
        country: 'Suíça',
        type: 'Supermercado / Varejo',
        catIntent: 'SUPERMERCADO',
        confidence: 95,
        reason: 'Aldi Suisse é rede de supermercados e alimentação na Suíça.'
      },
      {
        key: 'LIDL SCHWEIZ',
        name: 'Lidl Schweiz',
        legalName: 'Lidl Schweiz AG',
        country: 'Suíça',
        type: 'Supermercado / Varejo',
        catIntent: 'SUPERMERCADO',
        confidence: 95,
        reason: 'Lidl Schweiz é uma rede de supermercados e alimentação na Suíça.'
      },
      {
        key: 'SWISSCOM',
        name: 'Swisscom',
        legalName: 'Swisscom AG',
        country: 'Suíça',
        type: 'Telecomunicações / Internet & Celular',
        catIntent: 'TELECOM',
        confidence: 98,
        reason: 'Swisscom é a principal empresa estatal/pública de telecomunicações, internet e telefonia da Suíça.'
      },
      {
        key: 'SALT MOBILE',
        name: 'Salt Mobile',
        legalName: 'Salt Mobile SA',
        country: 'Suíça',
        type: 'Telecomunicações / Telefonia & Fibra',
        catIntent: 'TELECOM',
        confidence: 97,
        reason: 'Salt é uma das operadoras móveis e de fibra óptica líderes na Suíça.'
      },
      {
        key: 'SUNRISE',
        name: 'Sunrise',
        legalName: 'Sunrise GmbH',
        country: 'Suíça',
        type: 'Telecomunicações / Internet & TV',
        catIntent: 'TELECOM',
        confidence: 97,
        reason: 'Sunrise é uma provedora suíça líder em telecomunicações, celular e banda larga.'
      },
      {
        key: 'SBB CFF FFS',
        name: 'SBB CFF FFS',
        legalName: 'Schweizerische Bundesbahnen SBB',
        country: 'Suíça',
        type: 'Transporte Público Ferroviário',
        catIntent: 'TRANSPORTE',
        confidence: 99,
        reason: 'SBB CFF FFS é a ferrovia federal suíça responsável pelo transporte ferroviário nacional.'
      },
      {
        key: 'SBB',
        name: 'SBB',
        legalName: 'SBB CFF FFS',
        country: 'Suíça',
        type: 'Transporte Público / Trens',
        catIntent: 'TRANSPORTE',
        confidence: 99,
        reason: 'SBB é a companhia de trens e transporte público da Suíça.'
      },
      {
        key: 'HELSANA',
        name: 'Helsana',
        legalName: 'Helsana Versicherungen AG',
        country: 'Suíça',
        type: 'Seguro de Saúde Obrigatório (LAMal)',
        catIntent: 'SAUDE',
        confidence: 98,
        reason: 'Helsana é uma das maiores seguradoras de saúde da Suíça para planos LAMal e complementares.'
      },
      {
        key: 'SWICA',
        name: 'SWICA',
        legalName: 'SWICA Krankenversicherung AG',
        country: 'Suíça',
        type: 'Seguro de Saúde (LAMal)',
        catIntent: 'SAUDE',
        confidence: 98,
        reason: 'SWICA é uma das principais seguradoras de saúde da Suíça.'
      },
      {
        key: 'CSS VERSICHERUNG',
        name: 'CSS Versicherung',
        legalName: 'CSS Kranken-Versicherung AG',
        country: 'Suíça',
        type: 'Seguro de Saúde (LAMal)',
        catIntent: 'SAUDE',
        confidence: 98,
        reason: 'CSS é uma das maiores caixas de seguro saúde da Suíça.'
      },
      {
        key: 'VIAC',
        name: 'VIAC',
        legalName: 'VIAC Technologies AG / Terzo Vorsorgestiftung',
        country: 'Suíça',
        type: 'Previdência Privada 3º Pilar / Investimentos',
        catIntent: 'PREVIDENCIA_3A',
        confidence: 97,
        reason: 'VIAC é uma plataforma suíça de previdência 3a e 3º pilar com carteiras indexadas.'
      },
      {
        key: 'SWISSQUOTE',
        name: 'Swissquote',
        legalName: 'Swissquote Bank SA',
        country: 'Suíça',
        type: 'Banco de Investimentos / Corretora',
        catIntent: 'INVESTIMENTOS',
        confidence: 98,
        reason: 'Swissquote é um banco suíço líder em negociação de ações, ETFs e corretagem financeira online.'
      },
      {
        key: 'INTERACTIVE BROKERS',
        name: 'Interactive Brokers',
        legalName: 'Interactive Brokers Ireland / UK',
        country: 'Internacional / Suíça',
        type: 'Corretora Global de Investimentos',
        catIntent: 'INVESTIMENTOS',
        confidence: 98,
        reason: 'Interactive Brokers é uma das maiores corretoras mundiais de ETFs e ações globais.'
      },
      {
        key: 'NETFLIX',
        name: 'Netflix',
        legalName: 'Netflix Services Switzerland / EU',
        country: 'Internacional',
        type: 'Serviço de Streaming de Vídeo',
        catIntent: 'STREAMING',
        confidence: 99,
        reason: 'Netflix é uma plataforma global de streaming de filmes e séries por assinatura.'
      },
      {
        key: 'SPOTIFY',
        name: 'Spotify',
        legalName: 'Spotify AB',
        country: 'Internacional',
        type: 'Serviço de Streaming de Música',
        catIntent: 'STREAMING',
        confidence: 99,
        reason: 'Spotify é uma plataforma de streaming de música e podcasts por assinatura.'
      },
      {
        key: 'MANOR',
        name: 'Manor',
        legalName: 'Manor AG',
        country: 'Suíça',
        type: 'Loja de Departamentos & Moda',
        catIntent: 'COMPRAS',
        confidence: 95,
        reason: 'Manor é uma tradicional rede de lojas de departamento, moda e artigos para o lar na Suíça.'
      }
    ];

    for (const item of seedMerchants) {
      const normalized = this.normalizeMerchantKey(item.key);
      this.knowledgeMap.set(normalized, {
        merchantKey: normalized,
        normalizedName: item.name,
        legalName: item.legalName,
        country: item.country || 'Suíça',
        businessType: item.type,
        confidence: item.confidence || 95,
        source: 'RULE',
        reasoning: item.reason,
        lastCheckedAt: '2026-01-01T00:00:00Z',
        clientSpecificOverride: false
      });
    }
  }

  public lookup(merchantOrDescription: string, clientId?: string): MerchantKnowledgeItem | null {
    if (!merchantOrDescription) return null;
    const normalized = this.normalizeMerchantKey(merchantOrDescription);

    // 1. Check client-specific override in knowledge map if present
    if (clientId) {
      const clientKey = `${clientId}:::${normalized}`;
      const clientItem = this.knowledgeMap.get(clientKey);
      if (clientItem) return clientItem;
    }

    // 2. Check exact normalized key
    const direct = this.knowledgeMap.get(normalized);
    if (direct) return direct;

    // 3. Check partial inclusion for known long descriptions
    for (const [key, item] of this.knowledgeMap.entries()) {
      if (key.length >= 4 && (normalized.includes(key) || key.includes(normalized))) {
        return item;
      }
    }

    return null;
  }

  public saveItem(item: MerchantKnowledgeItem, clientId?: string) {
    const normalized = this.normalizeMerchantKey(item.merchantKey || item.normalizedName);
    const enrichedItem: MerchantKnowledgeItem = {
      ...item,
      merchantKey: normalized,
      lastCheckedAt: new Date().toISOString()
    };

    if (item.clientSpecificOverride && clientId) {
      this.knowledgeMap.set(`${clientId}:::${normalized}`, enrichedItem);
    } else {
      this.knowledgeMap.set(normalized, enrichedItem);
    }
  }

  public getAllKnowledge(clientId?: string): MerchantKnowledgeItem[] {
    const list: MerchantKnowledgeItem[] = [];
    for (const [key, val] of this.knowledgeMap.entries()) {
      if (key.includes(':::')) {
        if (clientId && key.startsWith(`${clientId}:::`)) {
          list.push(val);
        }
      } else {
        list.push(val);
      }
    }
    return list;
  }
}

export const merchantKnowledgeStore = new MerchantKnowledgeStore();
