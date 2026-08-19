import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Globe2, 
  Coins, 
  Landmark, 
  ShieldCheck, 
  Plus, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  ArrowUpRight, 
  DollarSign, 
  RefreshCw, 
  PieChart as PieIcon, 
  CheckCircle2, 
  Info,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis 
} from 'recharts';
import { useClient } from '../context/ClientContext';
import { AssetOrLiability, InvestmentPortfolio, InvestmentHolding, CurrencyCode } from '../types';
import { formatCurrency, formatPercent } from '../lib/money';
import { fxService } from '../lib/fxService';
import { getDefaultPortfolios } from '../lib/investmentData';

const ALLOCATION_COLORS = ['#3B82F6', '#10B981', '#6366F1', '#F59E0B', '#EC4899', '#8B5CF6'];

export const InvestmentsView: React.FC = () => {
  const { activeClient, assets } = useClient();
  const baseCurrency = activeClient.baseCurrency || 'CHF';

  const portfolios = useMemo(() => {
    const investmentAssets = assets.filter(asset =>
      asset.classification === 'ATIVO' &&
      (asset.category === 'INVESTIMENTO_LIQUIDO' || asset.category === 'PREVIDENCIA_3A')
    );
    const portfoliosByInstitution = new Map<string, InvestmentPortfolio>();

    investmentAssets.forEach((asset: AssetOrLiability) => {
      const institution = asset.institution || 'Custódia não informada';
      const originalValue = asset.originalValue ?? asset.value;
      const storedBaseValue = asset.baseValue;
      const rate = asset.currency === 'CHF' ? 1 : fxService.getRateToCHF(asset.currency);
      const currentValueCHF = storedBaseValue ?? (rate > 0 ? Math.round(originalValue * rate * 100) / 100 : 0);
      const holding: InvestmentHolding = {
        id: asset.id,
        name: asset.name,
        assetClass: asset.category === 'PREVIDENCIA_3A' ? 'PENSION_3A' : 'OUTROS',
        currency: asset.currency,
        currentValueOriginal: originalValue,
        currentValueCHF,
        exchangeRateToCHF: storedBaseValue !== undefined && originalValue > 0 ? storedBaseValue / originalValue : rate,
        institution,
        notes: asset.notes,
        updatedAt: asset.updatedAt
      };
      const existing = portfoliosByInstitution.get(institution);
      if (existing) {
        existing.holdings.push(holding);
      } else {
        portfoliosByInstitution.set(institution, {
          id: `portfolio-${institution}`,
          clientId: asset.clientId,
          name: institution,
          currency: asset.currency,
          country: asset.currency === 'BRL' ? 'BRASIL' : asset.currency === 'EUR' ? 'EUROPA' : 'SUÍÇA',
          totalValueOriginal: 0,
          totalValueCHF: 0,
          holdings: [holding],
          updatedAt: asset.updatedAt
        });
      }
    });

    return portfoliosByInstitution.size > 0
      ? Array.from(portfoliosByInstitution.values())
      : getDefaultPortfolios(activeClient.id);
  }, [activeClient.id, assets]);
  const [selectedCurrencyFilter, setSelectedCurrencyFilter] = useState<'ALL' | CurrencyCode>('ALL');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentHolding | null>(null);

  // FX Rate table
  const fxTable = fxService.getRateTable();

  // Recalculate portfolio CHF values when rates or holdings change
  const enrichedPortfolios = useMemo(() => {
    return portfolios.map(p => {
      const rate = fxService.getRateToCHF(p.currency);
      const holdingsWithCHF = p.holdings.map(h => {
        const hRate = fxService.getRateToCHF(h.currency);
        const chfVal = Math.round(h.currentValueOriginal * hRate * 100) / 100;
        return {
          ...h,
          exchangeRateToCHF: hRate,
          currentValueCHF: chfVal
        };
      });

      const totalOrig = holdingsWithCHF.reduce((sum, h) => sum + h.currentValueOriginal, 0);
      const totalCHF = holdingsWithCHF.reduce((sum, h) => sum + h.currentValueCHF, 0);

      return {
        ...p,
        totalValueOriginal: totalOrig,
        totalValueCHF: totalCHF,
        holdings: holdingsWithCHF
      };
    });
  }, [portfolios]);

  // Aggregate Metrics in CHF
  const totalInvestedCHF = useMemo(() => {
    return enrichedPortfolios.reduce((sum, p) => sum + p.totalValueCHF, 0);
  }, [enrichedPortfolios]);

  // Specific portfolio values
  const brlPortfolio = enrichedPortfolios.find(p => p.currency === 'BRL');
  const eurPortfolio = enrichedPortfolios.find(p => p.currency === 'EUR');
  const chfPortfolio = enrichedPortfolios.find(p => p.currency === 'CHF');

  // Asset class breakdown
  const assetClassData = useMemo(() => {
    const classMap = new Map<string, number>();
    enrichedPortfolios.forEach(p => {
      p.holdings.forEach(h => {
        const label = h.assetClass.replace(/_/g, ' ');
        const curr = classMap.get(label) || 0;
        classMap.set(label, curr + h.currentValueCHF);
      });
    });

    return Array.from(classMap.entries()).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
      percent: totalInvestedCHF > 0 ? (value / totalInvestedCHF) * 100 : 0
    }));
  }, [enrichedPortfolios, totalInvestedCHF]);

  // Currency breakdown
  const currencyBreakdownData = useMemo(() => {
    return enrichedPortfolios.map(p => ({
      name: p.currency,
      value: p.totalValueCHF,
      originalValue: p.totalValueOriginal,
      percent: totalInvestedCHF > 0 ? (p.totalValueCHF / totalInvestedCHF) * 100 : 0
    }));
  }, [enrichedPortfolios, totalInvestedCHF]);

  // Flattened filtered holdings
  const displayedHoldings = useMemo(() => {
    const allHoldings: Array<InvestmentHolding & { portfolioName: string }> = [];
    enrichedPortfolios.forEach(p => {
      if (selectedCurrencyFilter === 'ALL' || p.currency === selectedCurrencyFilter) {
        p.holdings.forEach(h => {
          allHoldings.push({ ...h, portfolioName: p.name });
        });
      }
    });
    return allHoldings;
  }, [enrichedPortfolios, selectedCurrencyFilter]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
            <span>Gestão de Investimentos Globais</span>
            <span>•</span>
            <span>Residência Fiscal: {activeClient.residenceCountry}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
            Carteiras & Portfólio Multi-Moeda
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Monitoramento consolidado de ativos no Brasil (BRL), Europa (EUR) e Suíça (CHF) com conversão cambial dinâmica para {baseCurrency}.
          </p>
        </div>

        {/* Currency & FX Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <Globe2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">EUR/CHF:</span>
            <span className="font-semibold text-slate-200">{fxTable.rates['EUR']}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <span className="text-emerald-400 font-bold">R$</span>
            <span className="text-slate-400">BRL/CHF:</span>
            <span className="font-semibold text-slate-200">{fxTable.rates['BRL']}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{fxTable.source === 'PROVIDER' ? 'FX do provedor' : fxTable.source === 'CACHED' ? 'FX em cache' : 'FX fallback'}</span>
          </div>
          <span className="text-[10px] text-slate-500">Atualizada em: {fxTable.source === 'FALLBACK' ? 'sem provedor' : new Date(fxTable.lastUpdated).toLocaleString('pt-BR')}</span>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Invested (CHF) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Investido Consolidado
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-100">
              {formatCurrency(totalInvestedCHF, baseCurrency)}
            </div>
            <div className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>100% dos ativos em custódia</span>
            </div>
          </div>
        </div>

        {/* BRL Portfolio */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Carteira Brasil (BRL)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              BRL
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-100">
              R$ {brlPortfolio?.totalValueOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{fxService.hasRateToCHF('BRL') ? `Eq. ${formatCurrency(brlPortfolio?.totalValueCHF || 0, baseCurrency)}` : 'Conversão indisponível'}</span>
              <span className="text-emerald-400 font-medium">+5,34% rent.</span>
            </div>
          </div>
        </div>

        {/* EUR Portfolio */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              ETFs Globais (EUR)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              EUR
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-100">
              € {eurPortfolio?.totalValueOriginal.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{fxService.hasRateToCHF('EUR') ? `Eq. ${formatCurrency(eurPortfolio?.totalValueCHF || 0, baseCurrency)}` : 'Conversão indisponível'}</span>
              <span className="text-emerald-400 font-semibold flex items-center">
                <ArrowUpRight className="w-3 h-3" />
                +€ {eurPortfolio?.unrealizedProfitLossOriginal?.toFixed(2)} (+{eurPortfolio?.unrealizedProfitLossPercent}%)
              </span>
            </div>
          </div>
        </div>

        {/* Swiss Pillar 3a (CHF) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Previdência 3a (CHF)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              CHF
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-100">
              {formatCurrency(chfPortfolio?.totalValueOriginal || 0, 'CHF')}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>VIAC / 3a Global</span>
              <span className="text-emerald-400 font-medium">+3,76%</span>
            </div>
          </div>
        </div>

      </div>

      {/* Allocation & Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Asset Class Allocation Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-blue-400" />
            <span>Alocação por Classe de Ativo (CHF)</span>
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetClassData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {assetClassData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: number) => [formatCurrency(val, baseCurrency), 'Total']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800">
            {assetClassData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length] }} />
                <span className="text-slate-400 truncate">{item.name}:</span>
                <span className="font-semibold text-slate-200 ml-auto">{item.percent.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Currency Exposure Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-emerald-400" />
            <span>Exposição Cambial Global</span>
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currencyBreakdownData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={40} />
                <Tooltip 
                  formatter={(val: number) => [formatCurrency(val, baseCurrency), 'Equivalente CHF']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20}>
                  {currencyBreakdownData.map((entry, index) => (
                    <Cell 
                      key={`curr-${index}`} 
                      fill={entry.name === 'CHF' ? '#10B981' : entry.name === 'EUR' ? '#6366F1' : '#F59E0B'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-800 text-xs">
            {currencyBreakdownData.map(c => (
              <div key={c.name} className="flex items-center justify-between text-slate-300">
                <span className="font-medium text-slate-400">{c.name} (Original):</span>
                <span>{c.name === 'BRL' ? `R$ ${c.originalValue.toFixed(2)}` : c.name === 'EUR' ? `€ ${c.originalValue.toFixed(2)}` : `${c.originalValue.toFixed(2)} CHF`}</span>
                <span className="font-semibold text-slate-100">{c.percent.toFixed(1)}% do portfólio</span>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy & Swiss Tax Shield */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Diretrizes Estratégicas & Tributárias</span>
            </h2>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="font-semibold text-slate-200">Previdência Suíça 3º Pilar (3a)</div>
                <div className="text-slate-400 mt-0.5">Dedução fiscal direta no imposto de renda da Suíça (teto anual de CHF 7'056).</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="font-semibold text-slate-200">ETFs Acumuladores (Irlanda / UCITS)</div>
                <div className="text-slate-400 mt-0.5">Reinvestimento automático de dividendos sem bitributação na fonte (S&P 500 / All-World).</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="font-semibold text-slate-200">Exposição Brasil (Renda Fixa & Ações)</div>
                <div className="text-slate-400 mt-0.5">Ativos mantidos em moeda de origem para diversificação e liquidez no Brasil.</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Base de cálculo patrimonial:</span>
            <span className="font-bold text-slate-200">{formatCurrency(totalInvestedCHF, 'CHF')}</span>
          </div>
        </div>

      </div>

      {/* Holdings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        
        {/* Table Header Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Posições & Ativos Detalhados
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Lista consolidada de ações, renda fixa, fundos e ETFs com conversão cambial individual
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60">
            {(['ALL', 'EUR', 'BRL', 'CHF'] as const).map(curr => (
              <button
                key={curr}
                onClick={() => setSelectedCurrencyFilter(curr)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedCurrencyFilter === curr 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {curr === 'ALL' ? 'Todos os Ativos' : curr}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-3 px-4">Ativo / Ticker</th>
                <th className="py-3 px-4">Classe</th>
                <th className="py-3 px-4">Instituição</th>
                <th className="py-3 px-4 text-right">Valor Original</th>
                <th className="py-3 px-4 text-center">Taxa FX</th>
                <th className="py-3 px-4 text-right">Valor em CHF</th>
                <th className="py-3 px-4 text-right">Rentabilidade (P/L)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {displayedHoldings.map((h) => {
                const isPositive = (h.unrealizedProfitLossOriginal || 0) >= 0;
                return (
                  <tr key={h.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-100 flex items-center gap-2">
                        {h.ticker && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-blue-400 border border-slate-700">
                            {h.ticker}
                          </span>
                        )}
                        <span>{h.name}</span>
                      </div>
                      {h.notes && (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{h.notes}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {h.assetClass.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {h.institution || 'Custodiante Direto'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-100">
                      {h.currency === 'BRL' ? `R$ ${h.currentValueOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` :
                       h.currency === 'EUR' ? `€ ${h.currentValueOriginal.toLocaleString('de-CH', { minimumFractionDigits: 2 })}` :
                       `${h.currentValueOriginal.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                      {h.exchangeRateToCHF.toFixed(4)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                      {formatCurrency(h.currentValueCHF, baseCurrency)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {h.unrealizedProfitLossPercent !== undefined ? (
                        <span className={`inline-flex items-center gap-0.5 font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{h.unrealizedProfitLossPercent.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-4 bg-slate-800/30 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <span>{displayedHoldings.length} posições monitoradas</span>
          <div className="flex items-center gap-4">
            <span>Total da seleção:</span>
            <span className="text-base font-bold text-slate-100">
              {formatCurrency(displayedHoldings.reduce((sum, h) => sum + h.currentValueCHF, 0), baseCurrency)}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
