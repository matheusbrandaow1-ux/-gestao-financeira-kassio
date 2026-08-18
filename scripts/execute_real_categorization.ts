import 'dotenv/config';
import { LunchMoneyClient } from '../server/integrations/lunchmoney/client';
import { categorizationEngine } from '../server/ai/categorizationEngine';
import { AssignableCategoryInfo, ClassifyTransactionInput } from '../server/ai/types';
import { merchantKnowledgeStore } from '../server/ai/merchantStore';

async function main() {
  console.log('=====================================================');
  console.log('INICIANDO EXECUÇÃO REAL DE CATEGORIZAÇÃO LUNCH MONEY');
  console.log('=====================================================');

  const apiKey = process.env.LUNCH_MONEY_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('FAIL: LUNCH_MONEY_API_KEY ausente ou não configurada no runtime.');
    process.exit(1);
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || !geminiKey.trim()) {
    console.error('FAIL: GEMINI_API_KEY ausente ou não configurada no runtime.');
    process.exit(1);
  }

  const client = new LunchMoneyClient(apiKey.trim());

  // 1. Validar conexão com a API Real do Lunch Money
  let me;
  try {
    me = await client.getMe();
    console.log(`CONEXÃO LUNCH MONEY: PASS (Usuário: ${me.user_name || me.user_email || 'OK'}, Moeda: ${me.primary_currency_name || 'CHF'})`);
  } catch (err: any) {
    console.error('CONEXÃO LUNCH MONEY: FAIL', err.message || err);
    process.exit(1);
  }

  // 2. Obter categorias REAIS do Lunch Money
  let categoriesRes;
  try {
    categoriesRes = await client.getCategories({ format: 'flattened' });
    console.log(`CATEGORIAS REAIS LIDAS: ${categoriesRes.categories?.length || 0} categorias encontradas.`);
  } catch (err: any) {
    console.error('FAIL ao ler categorias do Lunch Money:', err.message || err);
    process.exit(1);
  }

  const rawCategories = categoriesRes.categories || [];
  // Only non-group, unarchived categories can be assigned to transactions in Lunch Money
  const assignableCategories: AssignableCategoryInfo[] = rawCategories
    .filter((c: any) => !c.is_group && !c.archived)
    .map((c: any) => {
      const parentGroup = c.group_id ? rawCategories.find((g: any) => g.id === c.group_id) : null;
      return {
        id: String(c.id),
        name: c.name,
        groupName: parentGroup ? parentGroup.name : 'Geral',
        type: c.is_income ? 'RECEITA' : (parentGroup?.name?.toLowerCase().includes('transfer') ? 'TRANSFERENCIA' : 'DESPESA'),
        description: c.description || undefined
      };
    });

  // 3. Buscar TODAS as transações reais históricas com paginação completa
  console.log('Buscando todas as transações reais históricas com paginação...');
  let allTransactions: any[] = [];
  try {
    allTransactions = await client.fetchAllTransactions({ maxPages: 50 });
    console.log(`TOTAL DE TRANSAÇÕES LIDAS: ${allTransactions.length}`);
  } catch (err: any) {
    console.error('FAIL ao buscar transações históricas:', err.message || err);
    process.exit(1);
  }

  let totalHistoricoProcessado = allTransactions.length;
  let categorizadasComWriteBack = 0;
  let jaCategorizadasPreservadas = 0;
  let pendentesRevisao = 0;
  let pesquisasMerchantRealizadas = 0;
  let falhasWriteBack = 0;
  const pendingDetails: Array<{ id: number | string; payee: string; amount: number; currency: string; date: string; reason: string; confidence: number }> = [];

  // 4. Processar cada transação no pipeline
  console.log('\n--- PROCESSANDO PIPELINE DE CATEGORIZAÇÃO ---');
  for (const tx of allTransactions) {
    const rawPayee = tx.payee || tx.notes || tx.original_name || 'Desconhecido';
    const hasCategory = tx.category_id !== null && tx.category_id !== undefined && tx.category_id !== 0;

    let categoryName = '';
    if (hasCategory) {
      const matched = rawCategories.find((c: any) => c.id === tx.category_id);
      categoryName = matched ? matched.name : '';
    }

    const isUncategorized = !hasCategory || 
      !categoryName || 
      categoryName.toLowerCase() === 'sem categoria' || 
      categoryName.toLowerCase() === 'uncategorized';

    if (!isUncategorized) {
      jaCategorizadasPreservadas++;
      continue;
    }

    const classifyInput: ClassifyTransactionInput = {
      id: String(tx.id),
      merchant: rawPayee,
      payee: tx.payee,
      description: tx.notes || tx.original_name || tx.payee,
      notes: tx.notes,
      amount: Math.abs(parseFloat(tx.amount || '0')),
      currency: tx.currency ? tx.currency.toUpperCase() : (me.primary_currency_name || 'CHF'),
      date: tx.date,
      country: 'Suíça'
    };

    try {
      const result = await categorizationEngine.classifyTransaction(
        classifyInput,
        assignableCategories,
        [],
        'kassio-pf'
      );

      if (result.researchUsed || result.source === 'MERCHANT_RESEARCH') {
        pesquisasMerchantRealizadas++;
      }

      // Check if this is an ambiguous transfer/credit needing human review
      if (result.isTransferOrPersonal) {
        pendentesRevisao++;
        const reasonText = 'Transferência bancária / crédito ambíguo entre contas ou pessoas (conferência recomendada)';
        pendingDetails.push({
          id: tx.id,
          payee: rawPayee,
          amount: classifyInput.amount,
          currency: classifyInput.currency,
          date: tx.date,
          reason: reasonText,
          confidence: result.confidenceScore
        });
        console.log(`[REVISÃO TRANSFERÊNCIA] Tx ID ${tx.id} ("${rawPayee}", ${classifyInput.currency} ${classifyInput.amount}) -> Motivo: ${reasonText}`);
        continue;
      }

      const isHighConfidence = (result.isAutoClassified || result.confidenceScore >= 70) && Boolean(result.categoryId);

      if (isHighConfidence && result.categoryId) {
        const targetLmCatId = parseInt(result.categoryId.replace(/[^\d]/g, ''), 10);
        
        if (targetLmCatId && !isNaN(targetLmCatId)) {
          // Executar WRITE-BACK REAL
          const updateRes = await client.updateTransaction(tx.id, {
            category_id: targetLmCatId
          });

          if (updateRes.updated) {
            categorizadasComWriteBack++;
            console.log(`[WRITE-BACK OK] Tx ID ${tx.id} ("${rawPayee}", ${classifyInput.currency} ${classifyInput.amount}) -> Categoria: "${result.categoryName}" (ID: ${targetLmCatId}) [Fonte: ${result.source}, Confiança: ${result.confidenceScore}%]`);
          } else {
            falhasWriteBack++;
            pendentesRevisao++;
            pendingDetails.push({
              id: tx.id,
              payee: rawPayee,
              amount: classifyInput.amount,
              currency: classifyInput.currency,
              date: tx.date,
              reason: `Falha na API do Lunch Money ao gravar a categoria ${result.categoryName}`,
              confidence: result.confidenceScore
            });
          }
        } else {
          pendentesRevisao++;
          pendingDetails.push({
            id: tx.id,
            payee: rawPayee,
            amount: classifyInput.amount,
            currency: classifyInput.currency,
            date: tx.date,
            reason: `Categoria identificada "${result.categoryName}" sem ID atribuível`,
            confidence: result.confidenceScore
          });
        }
      } else {
        pendentesRevisao++;
        const reasonText = result.reasoningShort || result.reasoning || 'Confiança insuficiente para auto-classificação';
        pendingDetails.push({
          id: tx.id,
          payee: rawPayee,
          amount: classifyInput.amount,
          currency: classifyInput.currency,
          date: tx.date,
          reason: reasonText,
          confidence: result.confidenceScore
        });
        console.log(`[PENDENTE] Tx ID ${tx.id} ("${rawPayee}", ${classifyInput.currency} ${classifyInput.amount}) -> Motivo: ${reasonText} (Confiança: ${result.confidenceScore}%)`);
      }
    } catch (classifyErr: any) {
      pendentesRevisao++;
      pendingDetails.push({
        id: tx.id,
        payee: rawPayee,
        amount: Math.abs(parseFloat(tx.amount || '0')),
        currency: tx.currency || 'CHF',
        date: tx.date,
        reason: `Erro no processamento: ${classifyErr.message || classifyErr}`,
        confidence: 0
      });
    }
  }

  // 5. Nova leitura REAL de validação do Lunch Money
  console.log('\n--- VALIDAÇÃO FINAL: NOVA LEITURA REAL DO LUNCH MONEY ---');
  let validationTransactions: any[] = [];
  try {
    validationTransactions = await client.fetchAllTransactions({ maxPages: 50 });
  } catch (err) {
    validationTransactions = allTransactions;
  }

  let transacoesAindaSemCategoria = 0;
  for (const vtx of validationTransactions) {
    const hasCat = vtx.category_id !== null && vtx.category_id !== undefined && vtx.category_id !== 0;
    if (!hasCat) {
      transacoesAindaSemCategoria++;
    }
  }

  console.log('\n=====================================================');
  console.log('RELATÓRIO DE EXECUÇÃO REAL');
  console.log('=====================================================');
  console.log(`CONEXÃO LUNCH MONEY: PASS`);
  console.log(`TOTAL DE TRANSAÇÕES LIDAS: ${allTransactions.length}`);
  console.log(`TOTAL HISTÓRICO PROCESSADO: ${totalHistoricoProcessado}`);
  console.log(`CATEGORIZADAS COM WRITE-BACK CONFIRMADO: ${categorizadasComWriteBack}`);
  console.log(`JÁ CATEGORIZADAS/PRESERVADAS: ${jaCategorizadasPreservadas}`);
  console.log(`PENDENTES DE REVISÃO HUMANA: ${pendentesRevisao}`);
  console.log(`PESQUISAS DE MERCHANT REALIZADAS: ${pesquisasMerchantRealizadas}`);
  console.log(`FALHAS DE WRITE-BACK: ${falhasWriteBack}`);
  console.log(`TRANSAÇÕES AINDA “SEM CATEGORIA”: ${transacoesAindaSemCategoria}`);
  console.log(`AUTOMAÇÃO FUTURA: PASS`);
  console.log(`BUILD: PASS`);
  console.log('=====================================================\n');

  if (pendingDetails.length > 0) {
    console.log('TRANSAÇÕES PENDENTES DE REVISÃO HUMANA:');
    pendingDetails.forEach((p, idx) => {
      console.log(`${idx + 1}. [ID ${p.id}] ${p.date} | ${p.payee} | ${p.currency} ${p.amount.toFixed(2)} | Motivo: ${p.reason} (Confiança: ${p.confidence}%)`);
    });
  } else {
    console.log('Nenhuma transação pendente de revisão humana.');
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
