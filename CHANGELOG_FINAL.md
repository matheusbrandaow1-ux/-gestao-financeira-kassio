# Gestão Financeira Kássio — Entrega final

## Núcleo financeiro
- Fonte canônica compartilhada para receitas, despesas líquidas, estornos, investimentos, resgates e resultado.
- Receita e despesa continuam entrando nos totais mesmo sem categoria.
- Transferências e pagamentos internos não distorcem o P&L.
- Estornos reduzem despesas líquidas.
- Estados de conversão ausente não são apresentados como patrimônio zero.

## Multimoeda e patrimônio
- Preservação da moeda e do valor original.
- Consolidação em CHF sem transformar a conversão em um segundo ativo.
- Falta de FX é sinalizada como indisponível/incompleta.

## Lunch Money
- Atualizar Money disponível para CONSULTANT e CLIENT no mesmo cabeçalho.
- CLIENT sincroniza somente o próprio clientId.
- CONSULTANT sincroniza somente o cliente autorizado/selecionado.
- Sync server-side e idempotente.
- Preserva dados manuais, categorias locais, recorrências e correções humanas.
- Meses fechados permanecem imutáveis durante o sync.
- Categorização de alta confiança pode ser aplicada; baixa/média confiança vira sugestão pendente.

## Categorização e IA
- Prioridade para correção humana, memória de merchant, regras, conhecimento local e IA somente quando necessário.
- Correções humanas persistem em aiCorrections e são reidratadas no servidor.
- OpenAI opcional no backend, com fallback para Gemini quando configurado.
- Pesquisa web de merchant só é usada para estabelecimentos públicos desconhecidos; transferências pessoais/bancárias são protegidas.
- O app continua funcionando sem chave de IA.
- Processamento retroativo de sem-categoria passa a ler e persistir o dataset server-side.

## Persistência e segurança
- A camada de dados do frontend usa a API server-side; Firestore continua fechado para acesso direto do navegador.
- CLIENT pode gravar apenas no próprio clientId; CONSULTANT continua limitado ao escopo autorizado.
- Rotas de IA verificam clientId.
- Secrets permanecem apenas em variáveis de ambiente.

## Planejamento, Dashboard e Relatórios
- Mesmo motor financeiro para as telas principais.
- Mudança de mês recalcula o período.
- Meta zero não gera Infinity/NaN e aparece como "Sem meta".

## Validação local desta entrega
- 83 arquivos TypeScript/TSX analisados: 0 erros sintáticos.
- 0 imports locais quebrados.
- canonical_finance_regression: PASS.
- regression_financial: PASS.
- Varredura de secrets: nenhum secret real encontrado.
- O teste HTTP/build completo depende das dependências npm; a instalação integral do registry não concluiu neste ambiente, portanto a validação final de build deve ser observada no log do Render.
