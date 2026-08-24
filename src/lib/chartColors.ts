/*
 * apurato · cores de gráficos v1.0
 * Fonte única para recharts (SVG não resolve var() em atributos,
 * então os hex da marca ficam centralizados aqui).
 */

/**
 * Série categórica: distinguível em fundo Ardósia, harmonizada com a marca.
 * Regra do kit: Púrpura-Mil e as cores semânticas (verde/vermelho/âmbar)
 * NÃO entram em série categórica — púrpura nunca em massa, semântica nunca
 * decorativa. A rampa usa apenas tons neutros derivados do mundo apurato.
 */
export const CHART_SERIES_COLORS = [
  '#7FA3DB', // azul-lápis
  '#6FB8C4', // ciano-apagado
  '#B8A98F', // areia-razão
  '#C29BB4', // rosa-empoeirado
  '#9A94A8', // cinza-lápis
  '#5E86A8', // azul-profundo
  '#8C8471', // oliva-apagada
];

export const CHART_PRIMARY = '#9B7FDB';   // púrpura-mil
export const CHART_POSITIVE = '#5CAD8C';  // verde-conferido
export const CHART_NEGATIVE = '#C56A6A';  // vermelho-estorno
export const CHART_WARNING = '#C9A45C';   // âmbar-pendente

export const CHART_GRID = '#322C42';      // fio
export const CHART_AXIS = '#746E84';      // lápis escurecido
export const CHART_TOOLTIP_BG = '#1C1826'; // ardósia-2
export const CHART_TOOLTIP_BORDER = '#322C42';
