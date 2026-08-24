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
import { CHART_SERIES_COLORS } from '../lib/chartColors';
import { AssetOrLiability, InvestmentPortfolio, InvestmentHolding, CurrencyCode } from '../types';
import { formatCurrency, formatPercent } from '../lib/money';
import { fxService } from '../lib/fxService';
import { getDefaultPortfolios, getOriginalInvestmentValue, getInvestmentSummary, isInvestmentAsset } from '../lib/investmentData';

const ALLOCATION_COLORS = CHART_SERIES_COLORS;

export const InvestmentsView: React.FC = () => {
  const { activeClient, assets, assetsLoadState } = useClient();
  const baseCurrency = activeClient.baseCurrency || 'CHF';
  const investmentSummaryGroups = useMemo(() => getInvestmentSummary(assets), [assets]);

  const portfolios = useMemo(() => {
    const investmentAssets = assets.filter(isInvestmentAsset);
    const portfoliosByInstitution = new Map<string, InvestmentPortfolio>();

    investmentAssets.forEach((asset: AssetOrLiability) => {
      const institution = asset.institution || 'Custódia não informada';
      const originalValue = getOriginalInvestmentValue(asset);
      const storedBaseValue = asset.baseValue;
      const rate = asset.currency === 'CHF' ? 1 : fxService.getRateToCHF(asset.currency);
      const hasStoredBaseValue = storedBaseValue !== undefined && (storedBaseValue !== 0 || originalValue === 0);
      const currentValueCHF = hasStoredBaseValue
        ? storedBaseValue
        : (rate > 0 ? Math.round(originalValue * rate * 100) / 100 : 0);
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

    return Array.from(portfoliosByInstitution.values());
  }, [assets]);
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
        const chfVal = hRate > 0 ? Math.round(h.currentValueOriginal * hRate * 100) / 100 : 0;
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
  }, [portfolios, fxTable.lastUpdated]);

  // Aggregate Metrics in CHF
  const totalInvestedCHF = useMemo(() => {
    return investmentSummaryGroups.reduce((sum, group) => sum + group.convertedTotal, 0);
  }, [investmentSummaryGroups]);

  const hasCompleteFX = investmentSummaryGroups.some(group => group.positions > 0) && investmentSummaryGroups.every(group =>
    group.positions === 0 || group.conversionAvailable
  );
  const investmentSummary = assetsLoadState === 'error'
    ? 'Não foi possível carregar os dados'
    : assetsLoadState === 'loading'
      ? 'Carregando dados...'
      : enrichedPortfolios.length === 0
        ? 'Nenhuma posição registrada'
        : hasCompleteFX
          ? formatCurrency(totalInvestedCHF, baseCurrency)
          : 'Conversão CHF indisponível';

  // Specific portfolio values
  const brlPortfolio = investmentSummaryGroups.find(group => group.currency === 'BRL');
  const eurPortfolio = investmentSummaryGroups.find(group => group.currency === 'EUR');
  const chfPortfolio = investmentSummaryGroups.find(group => group.currency === 'CHF');

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
    return investmentSummaryGroups.filter(group => group.positions > 0).map(group => ({
      name: group.currency,
      value: group.convertedTotal,
      originalValue: group.originalTotal,
      percent: totalInvestedCHF > 0 ? (group.convertedTotal / totalInvestedCHF) * 100 : 0
    }));
  }, [investmentSummaryGroups, totalInvestedCHF]);

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
    <div className="ap-view space-y-8 pb-12">
      
      {/* Top Header */}
      <div className="ap-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-slate-800/80 pb-7">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-medium text-blue-400 uppercase tracking-[0.2em]">
            <span>Gestão de Investimentos Globais</span>
            <span>•</span>
            <span>Residência Fiscal: {activeClient.residenceCountry}</span>
          </div>
          <h1 className="ap-title text-2xl sm:text-3xl font-semibold text-slate-100 mt-2">
            Carteira & Patrimônio Investido
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
            <span className="font-semibold text-slate-200">{fxService.hasRateToCHF('EUR') ? fxTable.rates['EUR'] : 'indisponível'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <span className="text-emerald-400 font-bold">R$</span>
            <span className="text-slate-400">BRL/CHF:</span>
            <span className="font-semibold text-slate-200">{fxService.hasRateToCHF('BRL') ? fxTable.rates['BRL'] : 'indisponível'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{fxTable.source === 'PROVIDER' ? 'FX do provedor' : fxTable.source === 'CACHED' ? 'FX em cache' : 'FX indisponível'}</span>
          </div>
          <span className="text-[10px] text-slate-500">Atualizada em: {fxTable.source === 'FALLBACK' ? 'sem provedor' : new Date(fxTable.lastUpdated).toLocaleString('pt-BR')}</span>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Invested (CHF) */}
        <div className="ap-finance-summary border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Investido Consolidado
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-100">
              {investmentSummary}
            </div>
            <div className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{hasCompleteFX ? '100% dos ativos em custódia' : 'Alocação consolidada aguardando FX'}</span>
            </div>
          </div>
        </div>

        {/* BRL Portfolio */}
        <div className="ap-finance-summary border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Carteira Brasil (BRL)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              BRL
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-100">
              {assetsLoadState === 'error'
                ? 'Não foi possível carregar os dados'
                : brlPortfolio ? `R$ ${brlPortfolio.originalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Sem posição BRL'}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{brlPortfolio?.conversionAvailable ? `Eq. ${formatCurrency(brlPortfolio.convertedTotal, baseCurrency)}` : 'Conversão indisponível'}</span>
              <span className="text-slate-500 font-medium">Rentabilidade na posição</span>
            </div>
          </div>
        </div>

        {/* EUR Portfolio */}
        <div className="ap-finance-summary border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              ETFs Globais (EUR)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              EUR
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-100">
              {assetsLoadState === 'error'
                ? 'Não foi possível carregar os dados'
                : eurPortfolio ? `€ ${eurPortfolio.originalTotal.toLocaleString('de-CH', { minimumFractionDigits: 2 })}` : 'Sem posição EUR'}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{eurPortfolio?.conversionAvailable ? `Eq. ${formatCurrency(eurPortfolio.convertedTotal, baseCurrency)}` : 'Conversão indisponível'}</span>
              <span className="text-emerald-400 font-semibold flex items-center">
                <ArrowUpRight className="w-3 h-3" />
                P/L na posição
              </span>
            </div>
          </div>
        </div>

        {/* Swiss Pillar 3a (CHF) */}
        <div className="ap-finance-summary border-l border-slate-700 pl-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Previdência 3a (CHF)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              CHF
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-100">
              {assetsLoadState === 'error'
                ? 'Não foi possível carregar os dados'
                : chfPortfolio ? formatCurrency(chfPortfolio.originalTotal, 'CHF') : 'Sem posição CHF'}
            </div>
            {/* sem número inventado: rendimento só quando vier de dado persistido */}
            <div className="text-xs text-slate-400 mt-1">
              {chfPortfolio && chfPortfolio.institutions.length > 0
                ? chfPortfolio.institutions.join(' · ')
                : 'Aportes em francos suíços'}
            </div>
          </div>
        </div>

      </div>

      {/* Allocation & Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Asset Class Allocation Chart */}
        <div className="ap-section border-b border-slate-800/80 pb-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-300" />
            <span>Alocação por Classe de Ativo (CHF)</span>
          </h2>
          {hasCompleteFX ? <>
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
                  contentStyle={{ backgroundColor: '#1C1826', borderColor: '#322C42', borderRadius: '8px', fontSize: '12px' }}
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
          </> : <div className="h-48 flex items-center justify-center text-center text-xs text-amber-300 border-y border-slate-800/70">Conversão CHF indisponível.<br />A alocação será exibida quando houver taxa válida.</div>}
        </div>

        {/* Currency Exposure Breakdown */}
        <div className="ap-section border-b border-slate-800/80 pb-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-emerald-400" />
            <span>Exposição Cambial Global</span>
          </h2>
          {hasCompleteFX ? <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currencyBreakdownData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#9A94A8" fontSize={11} width={40} />
                <Tooltip 
                  formatter={(val: number) => [formatCurrency(val, baseCurrency), 'Equivalente CHF']}
                  contentStyle={{ backgroundColor: '#1C1826', borderColor: '#322C42', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="value" fill="#9B7FDB" radius={[0, 4, 4, 0]} barSize={20}>
                  {currencyBreakdownData.map((entry, index) => (
                    <Cell 
                      key={`curr-${index}`} 
                      fill={entry.name === 'CHF' ? '#5CAD8C' : entry.name === 'EUR' ? '#9B7FDB' : '#C9A45C'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div> : <div className="h-48 flex items-center justify-center text-center text-xs text-amber-300 border-y border-slate-800/70">Conversão CHF indisponível.<br />Valores originais permanecem preservados.</div>}
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
        <div className="ap-section border-b border-slate-800/80 pb-6 flex flex-col justify-between">
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
            <span className="font-bold text-slate-200">{hasCompleteFX ? formatCurrency(totalInvestedCHF, 'CHF') : 'Conversão indisponível'}</span>
          </div>
        </div>

      </div>

      {/* Holdings Table */}
      <div className="ap-table border-y border-slate-800/80 overflow-hidden">
        
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
                    ? 'bg-slate-800 text-slate-100 shadow-sm'
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
              {displayedHoldings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-slate-500">
                    {assetsLoadState === 'error'
                      ? 'Não foi possível carregar os dados'
                      : assetsLoadState === 'loading'
                        ? 'Carregando dados...'
                        : 'Nenhuma posição registrada'}
                  </td>
                </tr>
              ) : displayedHoldings.map((h) => {
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
                      {fxService.hasRateToCHF(h.currency) || h.currency === baseCurrency
                        ? formatCurrency(h.currentValueCHF, baseCurrency)
                        : 'Conversão indisponível'}
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
              {hasCompleteFX
                ? formatCurrency(displayedHoldings.reduce((sum, h) => sum + h.currentValueCHF, 0), baseCurrency)
                : 'Conversão indisponível'}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
