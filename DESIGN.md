---
name: apurato
description: Painel de gestão patrimonial dark-first — todo número tem origem.
colors:
  ardosia: "#14111B"        # fundo base (slate-950)
  ardosia-2: "#1C1826"      # cartões e superfícies (slate-900)
  ardosia-3: "#262133"      # superfícies elevadas, hover (slate-800)
  fio: "#322C42"            # linhas, bordas, divisores (slate-700)
  pergaminho: "#F0EDE4"     # texto principal (slate-100)
  lapis: "#9A94A8"          # legendas e apoios (slate-400)
  purpura-mil: "#9B7FDB"    # origem do dado + ação primária (blue-500/indigo-500)
  purpura-tinta: "#5A4197"  # púrpura sobre fundos claros (blue-800)
  verde-conferido: "#5CAD8C" # conciliado, variação positiva (emerald-500)
  vermelho-estorno: "#C56A6A" # despesa, estorno, negativo (rose-500)
  ambar-pendente: "#C9A45C"  # pendência, aguardando (amber-500)
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontWeight: 500
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontWeight: 400
  mono:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontWeight: 400
components:
  button-primary:
    backgroundColor: "{colors.purpura-mil}"
    textColor: "{colors.ardosia}"
    rounded: "8px"
---

# Design System: apurato

## Overview

**Norte criativo: "todo número tem origem."** A interface é um livro-razão escuro: cada valor carrega fonte, data e estado. Sem cartões decorativos, sem euforia — a raridade do púrpura é o ponto.

- Dark-first: Ardósia é o único fundo do produto; Papel-Razão (#EEF0E7) existe no kit só para impressos.
- Grafia da marca: sempre **apurato** em caixa-baixa junto ao símbolo; nunca "APURATO".
- Fonte da verdade visual: `src/index.css` (tokens) · `docs/kit de marca/` (kit pinado) · `src/lib/chartColors.ts` (gráficos).

## Colors

**Arquitetura: o rebrand vive no `@theme` do `src/index.css`.** As escalas padrão do Tailwind são REDEFINIDAS com a paleta apurato; as views usam o vocabulário Tailwind normal (`bg-slate-900`, `text-blue-400`…) e a marca troca por baixo. Nunca reintroduza hex cru em componente nem override `body .class` — quebra a fonte única de cor.

| Escala Tailwind | Família da marca | Uso |
|---|---|---|
| `slate` (+ `gray-500`) | Ardósia / Pergaminho / Lápis / Fio | fundos, superfícies, texto, bordas |
| `blue` e `indigo` | Púrpura-Mil → Púrpura-Tinta | ação primária, origem do dado, eyebrows |
| `emerald` | Verde-Conferido | conciliado, variação positiva |
| `rose` | Vermelho-Estorno | despesa, estorno, variação negativa |
| `amber` | Âmbar-Pendente | pendência, aguardando classificação |

Aliases nomeados (`--ap-ardosia`, `--ap-purpura`…) existem em `:root` para CSS próprio (classes `.ap-*`).

**A Regra do Um Destaque.** Púrpura-Mil marca a origem do dado e a ação primária — um destaque por tela, nunca em massa (fundos extensos, séries de gráfico).

**A Regra da Semântica Real.** Verde/vermelho/âmbar só com significado financeiro verdadeiro no dado; nunca decoração, nunca em série categórica de gráfico.

**Gráficos (`src/lib/chartColors.ts`).** SVG não resolve `var()` em atributos, então os hex ficam centralizados ali — único lugar fora do CSS com hex permitido. A rampa categórica (`CHART_SERIES_COLORS`) é um conjunto neutro derivado do mundo apurato (azul-lápis, ciano-apagado, areia…); púrpura e semânticas ficam reservados a `CHART_PRIMARY`/`CHART_POSITIVE`/`CHART_NEGATIVE`/`CHART_WARNING`, usados só com esse significado.

Decisão registrada: verde também sinaliza estado de sincronização/conexão **verificado** (Header: `text-emerald-400` quando `syncStatus === 'Sincronizado' | 'Conectado'`) — é o sentido literal de Verde-Conferido, "verificado contra a fonte", e só aparece quando o estado é real no dado.

## Typography

Trio fixo, carregado via Google Fonts no `index.html`:

- **Fraunces** (serif, pesos 400/500/600): títulos e números de destaque. `h1`/`h2` recebem Fraunces globalmente via `index.css` (peso 500); `.ap-title`/`.ap-display` para destaques fora de heading. Só os três pesos carregados — não usar `font-bold` (700) em serif.
- **Schibsted Grotesk** (sans, pesos 400/500/700): padrão da UI (`--font-sans`, aplicado no `body`).
- **Spline Sans Mono** (mono, pesos 400/500): TODOS os valores monetários, tabelas, chips de marcador e eyebrows. `.font-mono`, `.ap-number` e células de `.ap-table` recebem `font-variant-numeric: tabular-nums` — números alinham em coluna.

**A Regra do Número Mono.** Valor financeiro nunca em sans: sempre `font-mono` (tabular), para que colunas de dinheiro se leiam como razão contábil.

Eyebrow (assinatura de contexto no topo das views): `font-mono text-[10px] text-blue-400 uppercase tracking-[0.2em]`.

## Layout

- Shell: `div.ap-shell h-dvh flex flex-col` → Header sticky → `flex-1 overflow-hidden` com Sidebar fixa + **`<main>` como único container de scroll** (`overflow-y-auto`, `max-w-[1440px]`). O scroll reseta na troca de aba (`mainRef.scrollTo({top:0})` em `App.tsx`) — sem isso a posição vaza entre views.
- Views: raiz `.ap-view space-y-8` (entrada com `ap-reveal` 420ms, respeita `prefers-reduced-motion`); cabeçalho `.ap-page-header` com eyebrow + `h1` Fraunces + subtítulo `text-slate-400`.
- Utilitários `.ap-*` em `index.css`: `.ap-toolbar` (controles min-height 40px), `.ap-table` (th com tracking, scroll horizontal no mobile), `.ap-metric`/`.ap-finance-summary` (gradiente sutil de Ardósia-2, radius 0.75rem), `.ap-shell`/`.ap-sidebar`/`.ap-header`.
- Mobile (<768px): sidebar vira drawer com backdrop; toolbar empilha; tabelas rolam dentro de `.ap-table`.

## Elevation & Depth

Sistema plano com camadas tonais: Ardósia → Ardósia-2 (cartões) → Ardósia-3 (elevado/hover), separadas por bordas Fio — não por sombras. O header usa `backdrop-blur` sobre Ardósia 88%.

## Components

### Botão primário
`bg-blue-500 hover:bg-blue-400 text-slate-950 rounded-lg text-xs font-semibold` — Púrpura-Mil com texto Ardósia (contraste no escuro). É o gasto do "um destaque por tela"; um por view.

### Pills / abas / nav selecionadas
Estado selecionado é neutro, não púrpura: `bg-slate-800 text-slate-100`. Não-selecionado: `text-slate-400 hover:text-slate-200 hover:bg-slate-800/60`.

### Ponto de origem (navegação e header)
O item ativo da Sidebar ganha um ponto `w-1.5 h-1.5 rounded-full bg-blue-500` — a mesma linguagem do ponto do logo. O Header repete o ponto junto ao cliente ativo (o cliente é a fonte dos dados em tela).

### Linha de origem `.ap-origem`
Assinatura da marca: ponto púrpura de 8px de onde parte uma linha (gradiente púrpura→fio, máx. 18rem) que se traça em 1.2s. Usada sob números de destaque; **é o único ornamento que a identidade permite**. Respeita `prefers-reduced-motion`.

### ProvenanceTag (`src/components/common/ProvenanceTag.tsx`)
Chip mono `text-[10px] uppercase tracking-[0.12em] text-blue-300 border-slate-700 bg-slate-950/60` com 4 tipos: SINCRONIZADO · MANUAL · CONVERTIDO · CONCILIADO.

**A Regra do Rastro.** Marcador só aparece quando a condição é verdadeira no dado persistido (`provider`, `reviewStatus`, campos FX) — derive via `transactionProvenance`/`accountProvenance`, nunca hardcode. CONVERTIDO sempre acompanha o valor original exibido ao lado; original e convertido jamais se somam.

### MetricValue (padrão do DashboardView)
**Status nunca se veste de número.** Quando o dado não existe, renderiza texto discreto em sans (`font-sans text-sm text-slate-500`: "Nenhum dado registrado", "Conversão indisponível") no lugar do valor — nunca "0" fantasma, nunca em mono, nunca na escala de destaque.

### Formulários
Bordas Fio; foco troca a borda para púrpura com anel suave (`box-shadow` 55% púrpura) — definido globalmente em `index.css`. `:focus-visible` global: outline 2px púrpura, offset 3px.

### Logo (`src/components/common/Brand.tsx`)
`ApuratoSymbol` ("A" como linha de lançamento; ponto de origem sempre #9B7FDB, traço em `currentColor`) e `ApuratoLogo` (símbolo + wordmark Fraunces). Nunca recolorir o traço com cores semânticas. Abaixo de 110px em tela, só o símbolo.

## Do's and Don'ts

### Do:
- **Do** usar vocabulário Tailwind padrão (`slate/blue/emerald/rose/amber`) — o `@theme` resolve para a marca.
- **Do** formatar moeda via `formatCurrency` (`src/lib/money.ts`): CHF 12'345.60 (de-CH) · R$ 12.345,60 (pt-BR) · € 12.345,60 — sempre com o código/símbolo junto.
- **Do** acompanhar todo número de fonte e data (tooltip do marcador, "sincronizado em …", timestamp do FX).
- **Do** escrever na voz de auditor: preciso, calmo, sem euforia, sem urgência, sem promessa de rentabilidade.

### Don't:
- **Don't** reintroduzir hex cru em componentes (exceção única: `chartColors.ts`) nem overrides `body .class`.
- **Don't** usar púrpura em massa, semânticas como decoração, ou qualquer uma delas em série categórica de gráfico.
- **Don't** exibir marcador de proveniência por estética, valor sem fonte, ou status disfarçado de número.
- **Don't** grafar "APURATO"/"Apurato" junto ao símbolo — sempre caixa-baixa.
