import React from 'react';

/*
 * apurato · marca v1.0
 * Símbolo: "A" traçado como linha de lançamento — nasce num ponto
 * Púrpura-Mil (a origem do dado) e a barra do A é a linha do livro-razão.
 * O ponto de origem é sempre púrpura; o traço nunca recebe cores semânticas.
 */

interface SymbolProps {
  className?: string;
  /** Cor do traço; o ponto de origem é sempre púrpura. */
  stroke?: string;
  size?: number;
}

export const ApuratoSymbol: React.FC<SymbolProps> = ({ className, stroke = '#F0EDE4', size }) => (
  <svg
    viewBox="0 0 96 96"
    className={className}
    style={size ? { width: size, height: size } : undefined}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 24 74 L 48 26 L 72 74" />
      <path d="M 33 56 L 82 56" strokeWidth="6" />
    </g>
    <circle cx="24" cy="74" r="7" fill="#9B7FDB" />
  </svg>
);

interface LogoProps {
  className?: string;
  /** Altura do símbolo em px; o wordmark escala junto. */
  size?: number;
}

/** Logotipo completo: símbolo + wordmark "apurato" em Fraunces. */
export const ApuratoLogo: React.FC<LogoProps> = ({ className, size = 28 }) => (
  <span className={`inline-flex items-center gap-2 ${className ?? ''}`} aria-label="apurato">
    <ApuratoSymbol className="shrink-0" stroke="currentColor" size={size} />
    <span
      className="font-serif font-medium leading-none text-current"
      style={{ fontSize: size * 0.82, letterSpacing: '0.01em' }}
    >
      apurato
    </span>
  </span>
);
