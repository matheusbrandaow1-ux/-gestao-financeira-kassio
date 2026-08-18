import { InvestmentPortfolio, InvestmentHolding } from '../types';
import { fxService } from './fxService';

export function getDefaultPortfolios(clientId: string = 'kassio-pf'): InvestmentPortfolio[] {
  const brlRate = fxService.getRateToCHF('BRL');
  const eurRate = fxService.getRateToCHF('EUR');

  // 1. Carteira Brasil (BRL)
  const brlHoldings: InvestmentHolding[] = [
    {
      id: 'hld-brl-bolsa',
      name: 'Bolsa Brasileira (Ações / FIIs)',
      ticker: 'B3:PORTFOLIO',
      assetClass: 'AÇÕES_BRASIL',
      currency: 'BRL',
      currentValueOriginal: 13925.79,
      currentValueCHF: Math.round(13925.79 * brlRate * 100) / 100,
      exchangeRateToCHF: brlRate,
      institution: 'XP Investimentos / NuInvest',
      portfolioId: 'port-brl',
      notes: 'Carteira diversificada de renda variável e fundos imobiliários no Brasil.',
      updatedAt: '2026-08-15T12:00:00Z'
    },
    {
      id: 'hld-brl-rf',
      name: 'Renda Fixa Pós-Fixada & Tesouro',
      ticker: 'B3:RENDA_FIXA',
      assetClass: 'RENDA_FIXA_BRASIL',
      currency: 'BRL',
      currentValueOriginal: 11882.36,
      currentValueCHF: Math.round(11882.36 * brlRate * 100) / 100,
      exchangeRateToCHF: brlRate,
      institution: 'Itaú / Tesouro Direto',
      portfolioId: 'port-brl',
      notes: 'Tesouro Selic e CDBs com liquidez para reserva de oportunidade.',
      updatedAt: '2026-08-15T12:00:00Z'
    }
  ];

  const totalBrlOriginal = 25808.15;
  const totalBrlCHF = Math.round(totalBrlOriginal * brlRate * 100) / 100;

  const brlPortfolio: InvestmentPortfolio = {
    id: 'port-brl',
    clientId,
    name: 'Carteira Brasil (BRL)',
    currency: 'BRL',
    country: 'Brasil',
    totalValueOriginal: totalBrlOriginal,
    totalValueCHF: totalBrlCHF,
    totalCostOriginal: 24500.00,
    unrealizedProfitLossOriginal: 1308.15,
    unrealizedProfitLossPercent: 5.34,
    holdings: brlHoldings,
    updatedAt: new Date().toISOString()
  };

  // 2. Carteira Europa & ETFs Globais (EUR)
  const eurHoldings: InvestmentHolding[] = [
    {
      id: 'hld-eur-vuag',
      name: 'Vanguard S&P 500 UCITS ETF (Acc)',
      ticker: 'VUAG',
      assetClass: 'ETF_GLOBAL',
      currency: 'EUR',
      quantity: 11.24,
      averagePrice: 81.41,
      currentPrice: 92.54,
      totalCostOriginal: 915.00,
      currentValueOriginal: 1040.11,
      currentValueCHF: Math.round(1040.11 * eurRate * 100) / 100,
      exchangeRateToCHF: eurRate,
      unrealizedProfitLossOriginal: 125.11,
      unrealizedProfitLossPercent: 13.67,
      institution: 'Interactive Brokers / DEGIRO',
      portfolioId: 'port-eur',
      notes: 'Exposição direta às 500 maiores empresas dos Estados Unidos (S&P 500)',
      updatedAt: '2026-08-15T12:00:00Z'
    },
    {
      id: 'hld-eur-vwce',
      name: 'Vanguard FTSE All-World UCITS ETF (Acc)',
      ticker: 'VWCE',
      assetClass: 'ETF_GLOBAL',
      currency: 'EUR',
      quantity: 5.16,
      averagePrice: 106.69,
      currentPrice: 121.47,
      totalCostOriginal: 550.54,
      currentValueOriginal: 626.81,
      currentValueCHF: Math.round(626.81 * eurRate * 100) / 100,
      exchangeRateToCHF: eurRate,
      unrealizedProfitLossOriginal: 76.27,
      unrealizedProfitLossPercent: 13.85,
      institution: 'Interactive Brokers / DEGIRO',
      portfolioId: 'port-eur',
      notes: 'Exposição neutra ao mercado global (Desenvolvidos + Emergentes)',
      updatedAt: '2026-08-15T12:00:00Z'
    }
  ];

  const totalEurOriginal = 1666.92;
  const totalEurCost = 1465.54;
  const totalEurPL = 201.38;
  const totalEurPLPercent = 13.74;
  const totalEurCHF = Math.round(totalEurOriginal * eurRate * 100) / 100;

  const eurPortfolio: InvestmentPortfolio = {
    id: 'port-eur',
    clientId,
    name: 'ETFs Globais (EUR)',
    currency: 'EUR',
    country: 'Internacional / Irlanda',
    totalValueOriginal: totalEurOriginal,
    totalValueCHF: totalEurCHF,
    totalCostOriginal: totalEurCost,
    unrealizedProfitLossOriginal: totalEurPL,
    unrealizedProfitLossPercent: totalEurPLPercent,
    holdings: eurHoldings,
    updatedAt: new Date().toISOString()
  };

  // 3. Carteira Suíça & Pilar 3a (CHF)
  const chfHoldings: InvestmentHolding[] = [
    {
      id: 'hld-chf-pension3a',
      name: 'Previdência Suíça 3º Pilar (3a Global Equity)',
      ticker: '3A:GLOBAL100',
      assetClass: 'PENSION_3A',
      currency: 'CHF',
      currentValueOriginal: 7056.00,
      currentValueCHF: 7056.00,
      exchangeRateToCHF: 1.0,
      totalCostOriginal: 6800.00,
      unrealizedProfitLossOriginal: 256.00,
      unrealizedProfitLossPercent: 3.76,
      institution: 'VIAC / Finpension',
      portfolioId: 'port-chf',
      notes: 'Aporte anual máximo dedutível de imposto suíço (estratégia 99% ações globais).',
      updatedAt: '2026-08-15T12:00:00Z'
    }
  ];

  const chfPortfolio: InvestmentPortfolio = {
    id: 'port-chf',
    clientId,
    name: 'Previdência 3a Suíça (CHF)',
    currency: 'CHF',
    country: 'Suíça',
    totalValueOriginal: 7056.00,
    totalValueCHF: 7056.00,
    totalCostOriginal: 6800.00,
    unrealizedProfitLossOriginal: 256.00,
    unrealizedProfitLossPercent: 3.76,
    holdings: chfHoldings,
    updatedAt: new Date().toISOString()
  };

  return [brlPortfolio, eurPortfolio, chfPortfolio];
}
