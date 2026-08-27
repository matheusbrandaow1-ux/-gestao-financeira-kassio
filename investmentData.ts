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
  // Real client data only. No generated portfolio snapshots or placeholder balances are allowed.
  void clientId;
  return [];
}
