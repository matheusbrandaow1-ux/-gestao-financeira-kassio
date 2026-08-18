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
      .replace(/^ACHAT\s+MASTERCARD\s+\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}\s+/i, '')
      .replace(/^D[EÉ]BIT\s+TWINT\s+/i, '')
      .replace(/^CR[EÉ]DIT\s+TWINT\s+/i, '')
      .replace(/^PAYPAL\s*\*\s*/i, '')
      .replace(/^TWINT\s*\*\s*/i, '')
      .replace(/^SUMUP\s*\*\s*/i, '')
      .replace(/^STRIPE\s*\*\s*/i, '')
      .replace(/^SQ\s*\*\s*/i, '')
      .replace(/\bNUM[EÉ]RO\s+DE\s+CARTE:.*$/i, '')
      .replace(/\b04\d{12,}\b/g, '') // Terminal transaction codes
      .replace(/\b\d{12,}\b/g, '')
      .replace(/^\d{3,4}\s*-\s*/, '') // Store IDs like 0287 -
      .replace(/\b(AG|SA|GMBH|SARL|LLC|INC|LTD|COOP)\b/gi, '')
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private seedCommonSwissKnowledge() {
    const catIntentToCategoryName: Record<string, string> = {
      'SUPERMERCADO': 'Supermercado',
      'RESTAURANTES': 'Restaurantes',
      'COMBUSTIVEL': 'Combustível',
      'SAUDE': 'Farmácia',
      'ESTACIONAMENTO': 'Estacionamento',
      'TRANSPORTE': 'Transporte Público/ Uber',
      'STREAMING': 'Streaming',
      'SOFTWARE': 'Software / Apps',
      'VESTUARIO': 'Vestuário',
      'EVENTOS': 'Eventos',
      'ESPORTE': 'Academia / Esporte',
      'COMPRAS': 'Compras Diversas',
      'TARIFAS': 'Tarifas Bancárias',
      'TELECOM': 'Contas Residenciais',
      'SEGURO_SAUDE': 'Seguro Saúde LAMal',
      'ELETRONICOS': 'Compras Diversas',
      'LAZER': 'Hobbies'
    };

    const seedMerchants: Array<Partial<MerchantKnowledgeItem> & { key: string; name: string; type: string; catIntent: string; reason: string }> = [
      {
        key: 'LIDL',
        name: 'Lidl',
        legalName: 'Lidl Schweiz AG',
        country: 'Suíça',
        type: 'Supermercado / Alimentação',
        catIntent: 'SUPERMERCADO',
        confidence: 99,
        reason: 'Lidl é uma das principais redes de supermercado e compras alimentícias na Suíça.'
      },
      {
        key: 'MIGROS',
        name: 'Migros',
        legalName: 'Federation of Migros Cooperatives',
        country: 'Suíça',
        type: 'Supermercado & Alimentação',
        catIntent: 'SUPERMERCADO',
        confidence: 99,
        reason: 'Migros é a maior rede varejista e de supermercados da Suíça.'
      },
      {
        key: 'COOP',
        name: 'Coop',
        legalName: 'Coop Genossenschaft',
        country: 'Suíça',
        type: 'Supermercado & Alimentação',
        catIntent: 'SUPERMERCADO',
        confidence: 99,
        reason: 'Coop é uma das maiores cooperativas suíças de supermercados e alimentos.'
      },
      {
        key: 'DENNER',
        name: 'Denner',
        legalName: 'Denner AG',
        country: 'Suíça',
        type: 'Supermercado / Desconto',
        catIntent: 'SUPERMERCADO',
        confidence: 98,
        reason: 'Denner é uma rede suíça de supermercados de desconto.'
      },
      {
        key: 'ALDI',
        name: 'Aldi Suisse',
        legalName: 'Aldi Suisse AG',
        country: 'Suíça',
        type: 'Supermercado / Varejo',
        catIntent: 'SUPERMERCADO',
        confidence: 98,
        reason: 'Aldi Suisse é rede de supermercados e alimentação na Suíça.'
      },
      {
        key: 'MCDONALDS',
        name: "McDonald's",
        legalName: "McDonald's Restaurants Switzerland GmbH",
        country: 'Suíça',
        type: 'Restaurante / Fast Food',
        catIntent: 'RESTAURANTES',
        confidence: 99,
        reason: "McDonald's é rede global de restaurantes e refeições rápidas."
      },
      {
        key: 'BURGER KING',
        name: 'Burger King',
        legalName: 'Burger King Switzerland',
        country: 'Suíça',
        type: 'Restaurante / Fast Food',
        catIntent: 'RESTAURANTES',
        confidence: 99,
        reason: 'Burger King é rede de restaurantes e fast food.'
      },
      {
        key: 'LA BOHEME',
        name: 'La Bohème',
        country: 'Suíça',
        type: 'Restaurante / Café',
        catIntent: 'RESTAURANTES',
        confidence: 96,
        reason: 'La Bohème é restaurante/bistrô localizado em La Chaux-de-Fonds, Suíça.'
      },
      {
        key: 'ENI',
        name: 'Eni Station',
        legalName: 'Eni Suisse SA',
        country: 'Suíça',
        type: 'Posto de Combustível',
        catIntent: 'COMBUSTIVEL',
        confidence: 98,
        reason: 'Eni é rede de postos de abastecimento e combustíveis na Suíça.'
      },
      {
        key: 'PARKINGPAY',
        name: 'Parkingpay',
        legalName: 'Digitalparking AG',
        country: 'Suíça',
        type: 'Estacionamento Digital',
        catIntent: 'ESTACIONAMENTO',
        confidence: 99,
        reason: 'Parkingpay é o principal aplicativo de pagamento de estacionamento público na Suíça.'
      },
      {
        key: 'SUN STORE',
        name: 'Pharmacie Sun Store',
        legalName: 'GaleniCare AG',
        country: 'Suíça',
        type: 'Farmácia & Medicamentos',
        catIntent: 'SAUDE',
        confidence: 99,
        reason: 'Sun Store é uma importante rede suíça de farmácias e dermocosméticos.'
      },
      {
        key: 'AMAVITA',
        name: 'Pharmacie Amavita',
        legalName: 'GaleniCare AG',
        country: 'Suíça',
        type: 'Farmácia & Saúde',
        catIntent: 'SAUDE',
        confidence: 99,
        reason: 'Amavita é uma das maiores redes de farmácias da Suíça.'
      },
      {
        key: 'KKIOSK',
        name: 'k kiosk',
        legalName: 'Valora Schweiz AG',
        country: 'Suíça',
        type: 'Conveniência & Tabacaria',
        catIntent: 'COMPRAS',
        confidence: 97,
        reason: 'k kiosk é rede suíça de bancas de conveniência, tabaco e jornais.'
      },
      {
        key: 'APPLE',
        name: 'Apple / App Store',
        legalName: 'Apple Distribution International Ltd',
        country: 'Internacional / Suíça',
        type: 'Software & Serviços Digitais',
        catIntent: 'SOFTWARE',
        confidence: 99,
        reason: 'Apple / Apple.com/bill é assinatura de apps, iCloud e serviços digitais.'
      },
      {
        key: 'NETFLIX',
        name: 'Netflix',
        legalName: 'Netflix International B.V.',
        country: 'Internacional / Suíça',
        type: 'Streaming de Vídeo',
        catIntent: 'STREAMING',
        confidence: 99,
        reason: 'Netflix é serviço de streaming e entretenimento digital por assinatura.'
      },
      {
        key: 'UBER',
        name: 'Uber',
        legalName: 'Uber Switzerland GmbH',
        country: 'Suíça',
        type: 'Transporte / Mobilidade',
        catIntent: 'TRANSPORTE',
        confidence: 99,
        reason: 'Uber é serviço de transporte individual de passageiros por aplicativo.'
      },
      {
        key: 'SHEIN',
        name: 'SHEIN',
        country: 'Internacional',
        type: 'Vestuário & Moda Online',
        catIntent: 'VESTUARIO',
        confidence: 98,
        reason: 'SHEIN é varejista de vestuário, roupas e acessórios online.'
      },
      {
        key: 'BIKINI TEST',
        name: 'Bikini Test',
        country: 'Suíça',
        type: 'Casa de Shows & Eventos Culturais',
        catIntent: 'EVENTOS',
        confidence: 96,
        reason: 'Bikini Test é uma famosa sala de concertos e espaço cultural em La Chaux-de-Fonds, Suíça.'
      },
      {
        key: 'FESTI CONCEPT',
        name: 'Festi Concept Event Management',
        legalName: 'Festi Concept Event Management Sàrl',
        country: 'Suíça',
        type: 'Eventos & Produção Cultural',
        catIntent: 'EVENTOS',
        confidence: 96,
        reason: 'Festi Concept é produtora suíça de eventos, festivais e entretenimento.'
      },
      {
        key: 'HBC LA CHAUX DE FONDS',
        name: 'Handball Club La Chaux-de-Fonds',
        country: 'Suíça',
        type: 'Clube Esportivo / Handebol',
        catIntent: 'ESPORTE',
        confidence: 95,
        reason: 'HBC La Chaux-de-Fonds é o clube esportivo de handebol da cidade.'
      },
      {
        key: 'GENESIS VAPE',
        name: 'Genesis Vape',
        legalName: 'Genesis Vape sàrl',
        country: 'Suíça',
        type: 'Comércio / Varejo',
        catIntent: 'COMPRAS',
        confidence: 95,
        reason: 'Genesis Vape é comércio especializado em La Chaux-de-Fonds.'
      },
      {
        key: 'SCPO',
        name: "SCPO - Documents d'identité",
        country: 'Suíça',
        type: 'Serviço Público / Taxas de Identidade',
        catIntent: 'COMPRAS',
        confidence: 95,
        reason: 'Service cantonal de la population Neuchâtel - emissão de documentos e taxas oficiais.'
      },
      {
        key: 'KUARIO',
        name: 'KUARIO',
        country: 'Internacional / Suíça',
        type: 'Micro-pagamentos & Impressão',
        catIntent: 'COMPRAS',
        confidence: 92,
        reason: 'KUARIO é plataforma de micro-pagamento para impressões e serviços automatizados.'
      },
      {
        key: 'FRAIS FLEXIPACK',
        name: 'BCN Frais Flexipack',
        country: 'Suíça',
        type: 'Tarifa de Pacote Bancário BCN',
        catIntent: 'TARIFAS',
        confidence: 99,
        reason: 'Frais Flexipack é a tarifa mensal de manutenção de conta do Banque Cantonale Neuchâteloise (BCN).'
      }
    ];

    for (const item of seedMerchants) {
      const normalized = this.normalizeMerchantKey(item.key);
      const catName = catIntentToCategoryName[item.catIntent] || item.catIntent;
      this.knowledgeMap.set(normalized, {
        merchantKey: normalized,
        normalizedName: item.name,
        canonicalMerchant: item.name,
        legalName: item.legalName,
        country: item.country || 'Suíça',
        city: (item as any).city,
        businessType: item.type,
        confidence: item.confidence || 95,
        suggestedCategoryName: catName,
        source: 'MERCHANT_MEMORY',
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
