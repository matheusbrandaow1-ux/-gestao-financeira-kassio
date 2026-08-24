# PRODUCT.md — apurato

## O que é

**apurato** — painel de gestão patrimonial para consultoria financeira independente.
Multi-moeda (base CHF, convive com BRL/EUR/USD/GBP), multi-cliente, uma única fonte
da verdade. Conceito de marca e regra de arquitetura são a mesma frase:
**todo número tem origem.**

O nome vem de "apurar" (apuração contábil); em italiano *appurato* = "verificado,
comprovado". Grafia: sempre **apurato** em caixa-baixa junto ao símbolo; "Apurato"
com inicial maiúscula só em texto corrido sem o símbolo. Nunca "APURATO".

## Quem usa

- **Consultor (CONSULTANT/ADMIN)**: diagnóstico patrimonial, planejamento
  orçamentário, conciliação, regras de categorização, gestão de múltiplos clientes.
  Usa o painel diariamente, sessões longas, ambiente de trabalho.
- **Cliente final (CLIENT)**: vê patrimônio consolidado, orçamento planejado ×
  realizado, metas; dados isolados por cliente. Residência fiscal na Suíça.

## Verdades do produto (invioláveis)

1. **Número sem fonte não se publica.** Dado não persistido/rastreável não aparece.
2. **Original e convertido são o mesmo ativo.** Conversão FX é representação, nunca
   duplicação; os dois valores aparecem juntos e jamais se somam.
3. **Decisão humana prevalece.** Automação (motor de 5 camadas com Gemini) sugere;
   a palavra final é do consultor, e o sistema mostra quem decidiu. Confiança < 85%
   → vai para Pendências, nunca categorização compulsória.
4. **Marcador é rastro, não enfeite.** Os 4 marcadores de proveniência
   (SINCRONIZADO · MANUAL · CONVERTIDO · CONCILIADO) só aparecem quando a condição
   é verdadeira no dado persistido (`provider`, `reviewStatus`, campos FX).
5. **Cores semânticas não decoram.** Verde-Conferido, Vermelho-Estorno e
   Âmbar-Pendente só com significado financeiro real.

## Compromissos de marca (brief pinado — docs/kit de marca/)

- Dark-first: Ardósia (#14111B) é o fundo nativo do produto; Papel-Razão só em
  documentos/impressos.
- **Púrpura-Mil #9B7FDB** = origem do dado e ação primária. Um destaque por tela,
  nunca em massa. Referência: cédula de CHF 1000.
- Trio tipográfico fixo: **Fraunces** (títulos e números de destaque) ·
  **Schibsted Grotesk** (texto/UI, pesos 400/500/700) · **Spline Sans Mono**
  (valores, tabelas, marcadores — sempre numerais tabulares).
- Formatos por moeda: CHF 12'345.60 · R$ 12.345,60 · € 12.345,60.
- Voz de auditor de confiança: preciso, calmo, sem euforia, sem promessa de
  rentabilidade, sem urgência. Datas e fontes junto dos números.
- Logo: símbolo "A" com ponto de origem púrpura; área de respiro = altura da barra
  do A; abaixo de 110 px usa só o símbolo; nunca recolorir com cores semânticas.

## Stack e restrições técnicas

React 19 + TypeScript + Tailwind CSS 4 (`@theme`) + Vite; Express no backend;
Firestore; integração Lunch Money v2 (tokens só no servidor); lucide-react para
ícones; recharts para gráficos. SPA com navegação por abas controlada por papel
(RBAC). Idioma da interface: pt-BR.
