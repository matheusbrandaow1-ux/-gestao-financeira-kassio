# Arquitetura e Fluxo de Dados

Este documento descreve detalhadamente a topologia de arquitetura, o fluxo de dados de ponta a ponta e os mecanismos de segurança implementados no sistema.

---

## 1. Diagrama de Fluxo de Dados de Ponta a Ponta

```text
[ Lunch Money API v2 ]
        │  (HTTPS Bearer Auth)
        ▼
[ Server-Side: LunchMoneyClient ]
        │  (Extração de Accounts, Categories, Tags, Transactions, Recurring)
        ▼
[ Server-Side: Mapper & Normalizador ] ───► CHF Intacto / Sinais Corretos / externalId Único
        │
        ▼
[ Differential Calculation / SyncService ] ───► Compara com existingTransactions por externalId
        │                                      (Preserva revisões e recategorizações humanas)
        ▼
[ Firestore Database (Persistência) ] ────────► /clients/{clientId}/transactions/{txId}
        │                                      /clients/{clientId}/accounts/{accId}
        │                                      /clients/{clientId}/categories/{catId}
        ▼
[ Pipeline de Classificação Inteligente ]
  ├── 1. Regras Determinísticas (Rules Engine)
  ├── 2. Base de Merchants Conhecidos
  ├── 3. Aprendizado por Correção Humana
  ├── 4. Gemini 3.7 Flash API (com JSON Schema)
  └── 5. Google Search Grounding (Validação de estabelecimentos locais)
        │
        ▼
[ Filtro de Confiança Financeira ]
  ├── Confiança >= 85%: Auto-classificação
  └── Confiança < 85%: Mantém Não-Categorizado ──► [ Central de Pendências / Revisão Humana ]
        │
        ▼
[ Camada de Consumo: React UI / Dashboard ]
  ├── Perfil CONSULTANT: Visão de todos os clientes vinculados, gestão de regras e tokens
  └── Perfil CLIENT: Visão restrita e isolada estritamente aos seus próprios dados
```

---

## 2. Componentes da Arquitetura

### A. Integração com Lunch Money (`/server/integrations/lunchmoney`)
- **`client.ts`**: Cliente HTTP seguro para comunicação com a API REST v2 do Lunch Money (`https://dev.lunchmoney.app/v2/`). Gerencia paginação, timeouts e tratamento estruturado de erros (`LunchMoneyAuthError`, `LunchMoneyRateLimitError`).
- **`mapper.ts`**: Realiza o parsing de dados bancários respeitando os contratos de dados:
  - Preserva a moeda base (`CHF`).
  - Normaliza os valores numéricos com precisão de 2 casas decimais sem arredondamento com perda de ponto flutuante (`roundMoney`).
  - Mapeia o sinal de valores conforme convenção do Lunch Money (onde valor positivo na API é débito e valor negativo é crédito).
  - Associa IDs externos canônicos (`tx-lm-${id}`).
- **`store.ts`**: Armazena e gerencia os tokens de integração por cliente no backend, retornando para a interface apenas metadados mascarados (`tokenLast4`).
- **`sync.ts`**: Executa o processo diferencial de sincronização. Se uma transação já foi importada anteriormente e categorizada ou revisada manualmente pelo usuário (`reviewStatus === 'REVISADA'`), a classificação manual é **estritamente preservada**.

---

### B. Motor de Inteligência Artificial (`/server/ai`)
- **`GeminiProvider.ts`**: Encapsula chamadas ao SDK `@google/genai` utilizando `gemini-2.5-flash` ou `gemini-3.7-flash`.
- **`categorizationEngine.ts`**: Coordena as 5 camadas de classificação. Se o Gemini falhar ou a chave de API não estiver disponível, o sistema não é interrompido; as transações permanecem com status `PENDENTE` para classificação manual.
- **`correctionStore.ts`**: Registra quando o consultor ou cliente altera uma categoria sugerida pela IA, permitindo que futuras transações semelhantes aproveitem a correção humana.

---

### C. Camada de Autenticação e Controle de Acesso (`/server/routes/auth.ts`)
- Utiliza tokens de sessão assinados com `HMAC-SHA256` enviados via cookie seguro `HttpOnly` (`wp_session`) ou header `Authorization: Bearer <token>`.
- Permissões estritas:
  - **`requireAuth`**: Garante que o usuário possua sessão ativa válida.
  - **`requireConsultant`**: Restringe rotas de gestão de regras, configurações de integração e acesso amplo a consultores.
  - **CLIENT Isolation**: O cliente recebe dados unicamente filtrados pelo seu próprio `clientId`.

---

### D. Persistência de Dados (`Firestore`)
O banco de dados segue a estrutura modular orientada a documentos:

```text
/clients/{clientId}
   ├── accounts/{id}
   ├── transactions/{id}
   ├── categories/{id}
   ├── monthlyPlans/{month}
   ├── goals/{id}
   ├── assets/{id}
   ├── rules/{id}
   ├── pendingItems/{id}
   └── auditLogs/{id}
```

As regras de segurança (`firestore.rules`) bloqueiam qualquer tentativa de leitura ou escrita direta na subcoleção `/clients/{clientId}/integrations` por clientes no navegador, garantindo que credenciais e tokens nunca transitem no frontend.
