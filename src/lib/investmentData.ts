import { InvestmentPortfolio } from '../types';

/**
 * Investment balances are loaded from persisted manual assets or a provider.
 * No fixture is allowed to enter the client's real net worth.
 */
export function getDefaultPortfolios(_clientId: string = 'kassio-pf'): InvestmentPortfolio[] {
  return [];
}
