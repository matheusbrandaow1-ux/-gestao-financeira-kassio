# apurato · Kit de Marca v1.0

Pacote de identidade do apurato — painel de gestão patrimonial para consultoria.
Conceito: **todo número tem origem.**

Nome cunhado a partir de "apurar" — apuração é o ato contábil de consolidar e
verificar resultados. Em italiano, *appurato* significa "verificado, comprovado".

## Conteúdo

```
apurato-kit/
├── guia/
│   └── kit-de-marca-apurato.html      ← O guia completo. Abra no navegador. Comece por aqui.
├── logo/
│   ├── apurato-logotipo-escuro.svg    ← Versão principal (fundos Ardósia — o produto é dark-first)
│   ├── apurato-logotipo-claro.svg     ← Para fundos Papel-Razão / impressos
│   ├── apurato-simbolo-escuro.svg     ← Símbolo isolado (favicon, avatar, app icon)
│   ├── apurato-simbolo-claro.svg
│   ├── apurato-monograma-escuro.svg   ← Símbolo em selo circular (carimbo, avatar alternativo)
│   ├── apurato-monograma-claro.svg
│   └── png/                           ← Símbolo em PNG 512/1024 px (fundo transparente)
├── marcadores/
│   ├── marcador-sincronizado-*.svg    ← Dado veio da integração (Lunch Money)
│   ├── marcador-manual-*.svg          ← Registro ou classificação humana
│   ├── marcador-convertido-*.svg      ← Valor convertido por FX (sempre exibir o original junto)
│   └── marcador-conciliado-*.svg      ← Verificado contra a fonte canônica
└── cores/
    ├── tokens.css                     ← Variáveis CSS prontas para o sistema React
    └── paleta.json                    ← Paleta e tipografia em formato de dados
```

## Regras essenciais (resumo)

1. **Área de respiro** do logotipo: altura da barra do "A" em todos os lados.
   Tamanho mínimo: 110 px em tela, 28 mm em impresso. Abaixo disso, use só o símbolo.
2. **Púrpura-Mil (#9B7FDB) marca a origem e a ação primária** — um destaque por
   tela, nunca fundos extensos. Referência da cor: a cédula de CHF 1000.
3. **Cores semânticas não decoram**: Verde-Conferido, Vermelho-Estorno e
   Âmbar-Pendente só aparecem com significado financeiro real.
4. **Marcador é rastro, não enfeite**: os marcadores de proveniência só são
   exibidos quando a condição é verdadeira no dado persistido. Convertido
   sempre acompanha o valor original — original e convertido jamais se somam.
5. **Trio tipográfico fixo**: Fraunces (títulos e números de destaque) ·
   Schibsted Grotesk (texto/UI) · Spline Sans Mono (valores e tabelas, com
   numerais tabulares). Link do Google Fonts em cores/paleta.json.
6. **Voz**: número sem fonte não se publica. Sem euforia, sem urgência, sem
   promessa de rentabilidade. Formatos por moeda: CHF 12'345.60 · R$ 12.345,60 · € 12.345,60.

## Domínios (verificados por DNS em ago/2026 — confirmar no registrador)

apurato.finance (principal) · apura.to (hack) · apurato.com / apurato.ch /
apurato.app (defensivos). Antes do lançamento: busca INPI (BR) e Swissreg (CH).

## Observação sobre os SVGs com texto

O logotipo e os marcadores referenciam as fontes por nome. Para produção
gráfica (impressão, terceiros), converta o texto em curvas num editor vetorial
com as fontes instaladas. O símbolo isolado não tem texto e já está em PNG.

---
apurato · v1.0 · 2026
