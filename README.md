# Sistema de Gestão e Planejamento Financeiro (Wealth Planning)

Plataforma full-stack de **Gestão e Planejamento Patrimonial e Financeiro** para consultoria independente e acompanhamento de clientes com residência fiscal na Suíça (moeda base CHF) e âmbito internacional.

---

## 1. Objetivo do Sistema

Oferecer um ambiente seguro, determinístico e auditável para:
- **Consultores Financeiros (CONSULTANT)**: Realizarem o diagnóstico patrimonial completo, planejamento orçamentário anual/mensal, gestão de contas bancárias, conciliação de extratos, criação de regras determinísticas de categorização e acompanhamento de metas financeiras.
- **Clientes Finais (CLIENT)**: Visualizarem seu patrimônio consolidado, liquidez imediata, acompanhamento orçamentário (planejado vs. realizado), progresso de objetivos e interação com assistente financeiro de IA com total isolamento de dados e confidencialidade.

---

## 2. Arquitetura Geral

O sistema é construído como uma aplicação full-stack moderna dividida em:
- **Client-Side (SPA)**: React 18+, TypeScript, Tailwind CSS, Lucide Icons, Recharts e D3.js.
- **Server-Side API**: Node.js + Express com middleware Vite integrado em desenvolvimento e bundle compilado via esbuild em produção.
- **Camada de Persistência**: Firebase Firestore para persistência de entidades canônicas estruturadas em subcoleções isoladas por cliente (`/clients/{clientId}/*`).
- **Autenticação e Sessão**: Sessão criptográfica com cookies `HttpOnly` assinados com HMAC-SHA256 e RBAC (*Role-Based Access Control*) estrito.
- **Integração Bancária**: Lunch Money API v2 com isolamento de tokens no backend, mapeamento determinístico de valores e sinais de débito/crédito, e sincronização idempotente.
- **Inteligência Artificial (IA)**: Motor híbrido em 5 camadas (Regras → Cache de Merchants → Aprendizado por Correção Humana → Gemini 3.7 → Google Search Grounding) operando 100% no servidor.

---

## 3. Estrutura de Diretórios

```text
├── .data/                                # Armazenamento isolado de integrações locais (ignorado no Git)
├── docs/
│   └── ARCHITECTURE.md                  # Documentação detalhada de fluxo e arquitetura de dados
├── server/
│   ├── ai/                              # Motor de Inteligência Financeira e Categorização
│   │   ├── interfaces/                  # Interfaces de provedores e contratos de IA
│   │   ├── providers/                   # Provedor Gemini com Google Search Grounding
│   │   ├── categorizationEngine.ts      # Pipeline de 5 camadas de classificação
│   │   ├── correctionStore.ts           # Aprendizado a partir de correções humanas
│   │   ├── financialIntelligenceService.ts # Serviços de assistente e relatórios
│   │   ├── merchantStore.ts             # Base de conhecimento de estabelecimentos (Suíça/Global)
│   │   ├── metricsStore.ts              # Métricas e limites operacionais de IA
│   │   └── types.ts                     # Tipos internos do motor de IA
│   ├── integrations/
│   │   └── lunchmoney/                  # Módulo de integração com Lunch Money API v2
│   │       ├── cache.ts                 # Cache em memória por cliente
│   │       ├── client.ts                # Cliente HTTP para API v2 do Lunch Money
│   │       ├── errors.ts                # Classes de erro customizadas
│   │       ├── mapper.ts                # Normalização de contas, categorias e transações
│   │       ├── store.ts                 # Armazenamento e mascaramento de tokens
│   │       ├── sync.ts                  # Serviço de sincronização diferencial e idempotente
│   │       └── types.ts                 # Tipos da API Lunch Money
│   └── routes/
│       ├── ai.ts                        # Endpoints de classificação, chat e relatórios de IA
│       ├── auth.ts                      # Autenticação server-side, login, logout e sessão
│       ├── lunchmoney.ts                # Endpoints de conexão, validação e sincronização bancária
│       └── transactions.ts              # Endpoints para regras e operações em transações
├── src/
│   ├── components/                      # Componentes React reutilizáveis
│   │   └── common/                      # Header, Sidebar e elementos estruturais
│   ├── context/                         # Contextos globais React
│   │   ├── AuthContext.tsx              # Estado de autenticação e sessão do usuário
│   │   └── ClientContext.tsx            # Estado e sincronização de dados do cliente ativo
│   ├── lib/
│   │   ├── firebase.ts                  # Inicialização do Firebase SDK client-side
│   │   ├── money.ts                     # Utilitários matemáticos de precisão monetária
│   │   └── rulesEngine.ts               # Motor determinístico de regras no frontend
│   ├── types/
│   │   └── index.ts                     # Definições TypeScript das entidades canônicas
│   ├── views/                           # Telas da aplicação
│   │   ├── AIAssistantView.tsx          # Chat financeiro e relatórios executivos de IA
│   │   ├── AccountsView.tsx             # Gestão de contas bancárias e saldos
│   │   ├── AssetsView.tsx               # Balanço patrimonial (Ativos vs. Passivos)
│   │   ├── CategoriesView.tsx           # Hierarquia de categorias e orçamento
│   │   ├── DashboardView.tsx            # Painel executivo de indicadores (KPIs e Gráficos)
│   │   ├── GoalsView.tsx                # Objetivos financeiros e rastreamento de progresso
│   │   ├── IntegrationsView.tsx         # Gestão de tokens e status de integrações bancárias
│   │   ├── LoginView.tsx                # Tela de login com seleção de perfil
│   │   ├── PendingView.tsx              # Central de pendências e transações para revisão
│   │   ├── PlanningView.tsx             # Matriz de planejamento anual e mensal
│   │   ├── RecurrencesView.tsx          # Gestão de contas fixas e fluxos recorrentes
│   │   ├── ReportsView.tsx              # Relatórios financeiros e demonstrativos
│   │   ├── RulesView.tsx                # Gestão de regras de categorização automática
│   │   ├── SettingsView.tsx             # Configurações do cliente e parâmetros
│   │   └── TransactionsView.tsx         # Extrato detalhado com filtros e edição
│   ├── App.tsx                          # Componente raiz com controle de rotas por papel
│   ├── index.css                        # Estilos globais e Tailwind CSS
│   └── main.tsx                         # Ponto de entrada React
├── .env.example                         # Modelo de variáveis de ambiente (sem valores reais)
├── .gitignore                           # Regras estritas de exclusão de artefatos e segredos
├── firebase-applet-config.json          # Configuração pública do Firebase Client
├── firebase-blueprint.json              # Especificação do schema de dados Firestore
├── firestore.rules                      # Regras de segurança e autorização Firestore
├── package.json                         # Dependências e scripts do projeto
├── server.ts                            # Ponto de entrada do servidor Express + Vite
├── tsconfig.json                        # Configuração do TypeScript
└── vite.config.ts                       # Configuração do Vite
```

---

## 4. Frontend

- **Arquitetura**: Single Page Application (SPA) modular com renderização condicional protegida por papéis de acesso (`CONSULTANT` vs. `CLIENT`).
- **Design System**: Interface com paleta de neutros sofisticados em modo escuro profundo (`slate-900`/`slate-950`), bordas sutis (`border-slate-800`), tipografia monoespaçada para valores monetários (`font-mono`) e touch-targets de 44px+ para dispositivos móveis.
- **Gráficos e Visualizações**: Recharts e D3 para curvas de evolução patrimonial, decomposição de despesas por categoria (Donut Chart) e matriz Planejado vs. Realizado (Bar Chart).

---

## 5. Backend

- **Servidor**: Node.js com Express e TypeScript.
- **Middleware Vite**: Executado em modo middleware durante o desenvolvimento local para suporte transparente ao TypeScript e HMR.
- **Bundle de Produção**: `esbuild` empacota `server.ts` em `dist/server.cjs` no formato CommonJS, resolvendo módulos externos de forma nativa e segura para contêineres Cloud Run.

---

## 6. Firebase Authentication & Firestore

- **Persistência**: Firestore opera como base de dados estruturada.
- **Hierarquia de Documentos**:
  - `/clients/{clientId}` — Dados cadastrais do cliente.
  - `/clients/{clientId}/accounts/{accountId}` — Contas financeiras.
  - `/clients/{clientId}/transactions/{transactionId}` — Movimentações e transações.
  - `/clients/{clientId}/categories/{categoryId}` — Categorias e grupos.
  - `/clients/{clientId}/rules/{ruleId}` — Regras de automação.
  - `/clients/{clientId}/monthlyPlans/{monthId}` — Orçamentos mensais (ex: `2026-08`).
  - `/clients/{clientId}/goals/{goalId}` — Objetivos financeiros.
  - `/clients/{clientId}/assets/{assetId}` — Ativos e passivos patrimoniais.
  - `/clients/{clientId}/recurringItems/{itemId}` — Contas recorrentes.
  - `/clients/{clientId}/pendingItems/{itemId}` — Pendências de revisão.
  - `/clients/{clientId}/integrations/{integrationId}` — Subcoleção bloqueada contra acesso direto do cliente (`firestore.rules`).

---

## 7. Modelo de Acesso: CONSULTANT vs. CLIENT

| Funcionalidade / Tela | CONSULTANT | CLIENT |
|---|:---:|:---:|
| Visualizar Dashboard Patrimonial | Sim | Sim (apenas seus dados) |
| Visualizar Extrato e Transações | Sim | Sim (apenas seus dados) |
| Recategorizar Transação | Sim | Sim (alimenta aprendizado) |
| Visualizar Planejamento e Metas | Sim | Sim |
| Conversar com Assistente IA | Sim | Sim (contexto isolado) |
| Solicitar Sincronização Bancária | Sim | Sim (dispara sync no backend) |
| Visualizar / Configurar Tokens de API | **Sim** | **Bloqueado (Oculto)** |
| Gerenciar Regras de Automação | **Sim** | **Bloqueado** |
| Central de Pendências Administrativas | **Sim** | **Bloqueado** |
| Configurações Globais e Integrações | **Sim** | **Bloqueado** |
| Trocar de Cliente no Cabeçalho | **Sim** | **Bloqueado (Fixado)** |

---

## 8. Integração Lunch Money API v2

- **Segurança**: Os tokens de acesso são mantidos exclusivamente no backend. O cliente nunca recebe o token bruto, apenas o status de conexão e os últimos 4 dígitos (`tokenLast4`).
- **Convenção de Valores e Sinais**:
  - No Lunch Money API v2: Débito/Saída é positivo (`+`) e Crédito/Entrada é negativo (`-`).
  - No Sistema Canônico: O mapper normaliza os valores absolutos (`amount`), define o sinal e tipo (`RECEITA` vs. `DESPESA`), e armazena o valor original intacto (`amountOriginal`).
  - **Moeda**: Transações em CHF permanecem em CHF sem conversões silenciosas.
- **Idempotência**:
  - O identificador externo único (`externalId` = ID da transação no Lunch Money) é utilizado como chave primária de desduplicação.
  - Sincronizações subsequentes atualizam registros alterados e preservam edições humanas e classificações manuais marcadas como `REVISADA`.

---

## 9. Motor de Inteligência Artificial (Gemini 3.7)

O pipeline de categorização e análise opera em **5 camadas sequenciais**:
1. **Camada 1 — Regras Exatas**: Avaliação de regras configuradas pelo consultor (prioridade máxima).
2. **Camada 2 — Cache de Merchants**: Tabela de correspondência direta com estabelecimentos já conhecidos.
3. **Camada 3 — Aprendizado por Histórico**: Consulta a correções humanas anteriores do mesmo cliente.
4. **Camada 4 — Modelo Gemini 3.7**: Classificação estruturada com justificativa e pontuação de confiança (0 a 100).
5. **Camada 5 — Google Search Grounding**: Pesquisa web para estabelecimentos locais suíços ou descrições bancárias complexas.

> **Princípio de Integridade Financeira**: Se a confiança da IA for inferior a 85%, a transação NÃO é categorizada compulsoriamente — ela é mantida como não categorizada e enviada para a Central de Pendências para revisão humana.

---

## 10. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

```env
# Gemini AI (Server-side)
GEMINI_API_KEY=

# Lunch Money API (Server-side)
LUNCH_MONEY_API_KEY=

# Sessão e Criptografia
SESSION_SECRET=

# Configurações do Servidor
APP_URL=http://localhost:3000
NODE_ENV=development
PORT=3000
```

---

## 11. Execução Local e Build

### Instalação de Dependências
```bash
npm install
```

### Executar em Modo de Desenvolvimento
```bash
npm run dev
```
O servidor será iniciado em `http://localhost:3000`.

### Verificação de Tipagem e Linter
```bash
npm run lint
```

### Build de Produção
```bash
npm run build
```

---

## 12. Regras de Segurança e Boas Práticas

1. **Nenhum Segredo no Frontend**: Nunca utilize variáveis com prefixo `VITE_` para chaves privadas, tokens de banco ou senhas.
2. **Isolamento de Clientes**: Todas as consultas e mutações devem filtrar ou referenciar explicitamente o `clientId` autorizado.
3. **Auditoria de Operações**: Todas as ações críticas (sincronização, criação de regras, alterações orçamentárias) são registradas na coleção de logs de auditoria.
4. **Proteção contra Duplicidade**: As rotas de sincronização utilizam upsert baseado em IDs externos.

---

## 13. Limitações Conhecidas e Próximos Passos

- **Suporte Multi-Instituição no Lunch Money**: Atualmente otimizado para contas manuais e conectadas via Plaid no Lunch Money; instituições com formatos proprietários de extrato dependem do payee normalizado.
- **Relatórios em PDF**: A exportação de relatórios atualmente gera visualizações completas na tela e impressão via navegador; a geração de PDF server-side está prevista para versões futuras.
- **Sincronização em Segundo Plano (Cron)**: A sincronização atual é sob demanda (acionada pelo usuário ou consultor); suporte a agendamento automático periódico pode ser configurado via Cloud Scheduler.
