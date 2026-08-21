import { AssetOrLiability, CurrencyCode, InvestmentPortfolio, InvestmentHolding } from '../types';
import { fxService } from './fxService';

export function isInvestmentAsset(asset: { classification?: string; category?: string }): boolean {
  return asset.classification === 'ATIVO' && (
    asset.category === 'INVESTIMENTO_LIQUIDO' || asset.category === 'PREVIDENCIA_3A'
  );
}

export function getOriginalInvestmentValue(asset: { originalValue?: number; value: number }): number {
  return asset.originalValue ?? asset.value;
}

function getInvestmentBaseValue(asset: AssetOrLiability): number | undefined {
  const originalValue = getOriginalInvestmentValue(asset);
  if (asset.baseValue !== undefined && (asset.baseValue !== 0 || originalValue === 0)) return asset.baseValue;
  const rate = asset.currency === 'CHF' ? 1 : fxService.getRateToCHF(asset.currency);
  return rate > 0 ? Math.round(originalValue * rate * 100) / 100 : undefined;
}

export interface InvestmentSummaryGroup {
  currency: CurrencyCode;
  label: string;
  originalTotal: number;
  convertedTotal: number;
  conversionAvailable: boolean;
  positions: number;
  institutions: string[];
  assets: AssetOrLiability[];
}

/** Single source of truth for currency totals shown across wealth views. */
export function getInvestmentSummary(assets: AssetOrLiability[]): InvestmentSummaryGroup[] {
  const labels: Record<CurrencyCode, string> = {
    BRL: 'Grupo Brasil',
    EUR: 'Grupo Europa',
    CHF: 'Grupo Suíça',
    USD: 'Grupo Dólar',
    GBP: 'Grupo Libra'
  };

  return (['BRL', 'EUR', 'CHF'] as CurrencyCode[]).map(currency => {
    const groupAssets = assets.filter(asset => isInvestmentAsset(asset) && asset.currency === currency);
    const originalTotal = groupAssets.reduce((sum, asset) => sum + getOriginalInvestmentValue(asset), 0);
    const convertedValues = groupAssets.map(getInvestmentBaseValue);

    return {
      currency,
      label: labels[currency],
      originalTotal,
      convertedTotal: convertedValues.every(value => value !== undefined)
        ? convertedValues.reduce((sum, value) => sum + value!, 0)
        : 0,
      conversionAvailable: groupAssets.length === 0 || convertedValues.every(value => value !== undefined),
      positions: groupAssets.length,
      institutions: Array.from(new Set(groupAssets.map(asset => asset.institution || 'Custódia não informada'))),
      assets: groupAssets
    };
  });
}

export function getDefaultPortfolios(clientId: string = 'kassio-pf'): InvestmentPortfolio[] {
  const brlRate = fxService.getRateToCHF('BRL');
  const eurRate = fxService.getRateToCHF('EUR');

  const brlHoldings: InvestmentHolding[] = [
    {
      id: 'hld-brl-bolsa', name: 'Bolsa Brasileira (Ações / FIIs)', ticker: 'B3:PORTFOLIO',
      assetClass: 'AÇÕES_BRASIL', currency: 'BRL', currentValueOriginal: 13925.79,
      currentValueCHF: Math.round(13925.79 * brlRate * 100) / 100, exchangeRateToCHF: brlRate,
      institution: 'XP Investimentos / NuInvest', portfolioId: 'port-brl',
      notes: 'Carteira diversificada de renda variável e fundos imobiliários no Brasil.', updatedAt: '2026-08-15T12:00:00Z'
    },
    {
      id: 'hld-brl-rf', name: 'Renda Fixa Pós-Fixada & Tesouro', ticker: 'B3:RENDA_FIXA',
      assetClass: 'RENDA_FIXA_BRASIL', currency: 'BRL', currentValueOriginal: 11882.36,
      currentValueCHF: Math.round(11882.36 * brlRate * 100) / 100, exchangeRateToCHF: brlRate,
      institution: 'Itaú / Tesouro Direto', portfolioId: 'port-brl',
      notes: 'Tesouro Selic e CDBs com liquidez para reserva de oportunidade.', updatedAt: '2026-08-15T12:00:00Z'
    }
  ];
  const brlPortfolio: InvestmentPortfolio = {
    id: 'port-brl', clientId, name: 'Carteira Brasil (BRL)', currency: 'BRL', country: 'Brasil',
    totalValueOriginal: 25808.15, totalValueCHF: Math.round(25808.15 * brlRate * 100) / 100,
    totalCostOriginal: 24500.00, unrealizedProfitLossOriginal: 1308.15, unrealizedProfitLossPercent: 5.34,
    holdings: brlHoldings, updatedAt: '2026-08-15T12:00:00Z'
  };

  const eurHoldings: InvestmentHolding[] = [
    {
      id: 'hld-eur-vuag', name: 'Vanguard S&P 500 UCITS ETF (Acc)', ticker: 'VUAG', assetClass: 'ETF_GLOBAL',
      currency: 'EUR', quantity: 11.24, averagePrice: 81.41, currentPrice: 92.54, totalCostOriginal: 915.00,
      currentValueOriginal: 1040.11, currentValueCHF: Math.round(1040.11 * eurRate * 100) / 100,
      exchangeRateToCHF: eurRate, unrealizedProfitLossOriginal: 125.11, unrealizedProfitLossPercent: 13.67,
      institution: 'Interactive Brokers / DEGIRO', portfolioId: 'port-eur',
      notes: 'Exposição direta às 500 maiores empresas dos Estados Unidos (S&P 500)', updatedAt: '2026-08-15T12:00:00Z'
    },
    {
      id: 'hld-eur-vwce', name: 'Vanguard FTSE All-World UCITS ETF (Acc)', ticker: 'VWCE', assetClass: 'ETF_GLOBAL',
      currency: 'EUR', quantity: 5.16, averagePrice: 106.69, currentPrice: 121.47, totalCostOriginal: 550.54,
      currentValueOriginal: 626.81, currentValueCHF: Math.round(626.81 * eurRate * 100) / 100,
      exchangeRateToCHF: eurRate, unrealizedProfitLossOriginal: 76.27, unrealizedProfitLossPercent: 13.85,
      institution: 'Interactive Brokers / DEGIRO', portfolioId: 'port-eur',
      notes: 'Exposição neutra ao mercado global (Desenvolvidos + Emergentes)', updatedAt: '2026-08-15T12:00:00Z'
    }
  ];
  const eurPortfolio: InvestmentPortfolio = {
    id: 'port-eur', clientId, name: 'ETFs Globais (EUR)', currency: 'EUR', country: 'Internacional / Irlanda',
    totalValueOriginal: 1666.92, totalValueCHF: Math.round(1666.92 * eurRate * 100) / 100,
    totalCostOriginal: 1465.54, unrealizedProfitLossOriginal: 201.38, unrealizedProfitLossPercent: 13.74,
    holdings: eurHoldings, updatedAt: '2026-08-15T12:00:00Z'
  };

  const chfHolding: InvestmentHolding = {
    id: 'hld-chf-pension3a', name: 'Previdência Suíça 3º Pilar (3a Global Equity)', ticker: '3A:GLOBAL100',
    assetClass: 'PENSION_3A', currency: 'CHF', currentValueOriginal: 7056.00, currentValueCHF: 7056.00,
    exchangeRateToCHF: 1, totalCostOriginal: 6800.00, unrealizedProfitLossOriginal: 256.00,
    unrealizedProfitLossPercent: 3.76, institution: 'VIAC / Finpension', portfolioId: 'port-chf',
    notes: 'Aporte anual máximo dedutível de imposto suíço (estratégia 99% ações globais).', updatedAt: '2026-08-15T12:00:00Z'
  };
  const chfPortfolio: InvestmentPortfolio = {
    id: 'port-chf', clientId, name: 'Previdência 3a Suíça (CHF)', currency: 'CHF', country: 'Suíça',
    totalValueOriginal: 7056.00, totalValueCHF: 7056.00, totalCostOriginal: 6800.00,
    unrealizedProfitLossOriginal: 256.00, unrealizedProfitLossPercent: 3.76,
    holdings: [chfHolding], updatedAt: '2026-08-15T12:00:00Z'
  };

  return [brlPortfolio, eurPortfolio, chfPortfolio];
}
