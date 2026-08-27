import 'dotenv/config';
import { LunchMoneyClient } from '../server/integrations/lunchmoney/client';
import { categorizationEngine } from '../server/ai/categorizationEngine';
import { AssignableCategoryInfo, ClassifyTransactionInput } from '../server/ai/types';

async function diagnoseJune2026() {
  console.log('================================================================================');
  console.log('DIAGNÓSTICO E EXECUÇÃO END-TO-END: TRANSAÇÕES DE JUNHO DE 2026 (kassio-pf)');
  console.log('================================================================================');

  const apiKey = process.env.LUNCH_MONEY_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    console.error('ERRO: LUNCH_MONEY_API_KEY ausente.');
    process.exit(1);
  }
  if (!geminiKey || !geminiKey.trim()) {
    console.error('ERRO: GEMINI_API_KEY ausente.');
    process.exit(1);
  }

  const client = new LunchMoneyClient();

  // 1. Etapa 1: Leitura Lunch Money
  console.log('\n[Etapa 1: Leitura Lunch Money] Verificando conexão e buscando dados...');
  const me = await client.getMe();
  console.log(`- Usuário Lunch Money autenticado: ${me.user_name || me.user_email} (Moeda: ${me.primary_currency})`);

  const categoriesRes = await client.getCategories({ format: 'flattened' });
  const rawCategories = categoriesRes.categories || [];
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
  console.log(`- Categorias atribuíveis no Lunch Money: ${assignableCategories.length}`);

  // Fetch transactions for June 2026
  console.log('- Buscando transações de Junho de 2026 (2026-06-01 a 2026-06-30)...');
  const juneRes = await client.getTransactions({
    start_date: '2026-06-01',
    end_date: '2026-06-30'
  });
  const juneTxs = juneRes.transactions || [];
  console.log(`- Total de transações encontradas em Junho/2026: ${juneTxs.length}`);

  const uncategorizedJune = juneTxs.filter((tx: any) => {
    const hasCategory = tx.category_id !== null && tx.category_id !== undefined && tx.category_id !== 0;
    if (!hasCategory) return true;
    const cat = rawCategories.find((c: any) => c.id === tx.category_id);
    return !cat || cat.name.toLowerCase() === 'sem categoria' || cat.name.toLowerCase() === 'uncategorized';
  });

  console.log(`- Transações SEM CATEGORIA em Junho/2026: ${uncategorizedJune.length}`);

  let researchedCount = 0;
  let categorizedCount = 0;
  let writtenCount = 0;
  let pendingCount = 0;

  console.log('\n[Etapa 2 a 6: CategorizationEngine, Gemini AI, Resolução e Write-Back]');
  for (const tx of uncategorizedJune) {
    const rawPayee = tx.payee || tx.notes || tx.original_name || 'Desconhecido';
    const classifyInput: ClassifyTransactionInput = {
      id: String(tx.id),
      merchant: rawPayee,
      payee: tx.payee,
      description: tx.notes || tx.original_name || tx.payee,
      notes: tx.notes,
      amount: Math.abs(parseFloat(String(tx.amount || '0'))),
      currency: tx.currency ? tx.currency.toUpperCase() : 'CHF',
      date: tx.date,
      country: 'Suíça'
    };

    try {
      // Small spacing between AI calls to respect RPM rate limits
      await new Promise(r => setTimeout(r, 400));

      const result = await categorizationEngine.classifyTransaction(
        classifyInput,
        assignableCategories,
        [],
        'kassio-pf'
      );

      if (result.researchUsed || result.source === 'MERCHANT_RESEARCH') {
        researchedCount++;
      }

      if (result.isTransferOrPersonal) {
        pendingCount++;
        console.log(`  [PENDENTE/TRANSF] ID ${tx.id} (${tx.date}) "${rawPayee}" CHF ${classifyInput.amount} -> Motivo: Movimentação interna / P2P / Transferência`);
        continue;
      }

      const isEligible = (result.isAutoClassified || result.confidenceScore >= 70) && Boolean(result.categoryId);
      if (isEligible && result.categoryId) {
        categorizedCount++;
        const targetLmCatId = parseInt(result.categoryId.replace(/[^\d]/g, ''), 10);
        
        // Write-back to Lunch Money
        const updateRes = await client.updateTransaction(tx.id, {
          category_id: targetLmCatId
        });

        if (updateRes.updated) {
          writtenCount++;
          console.log(`  [WRITE-BACK SUCESSO] ID ${tx.id} (${tx.date}) "${rawPayee}" CHF ${classifyInput.amount} -> Categoria: "${result.categoryName}" (ID: ${targetLmCatId}) [Confiança: ${result.confidenceScore}%, Fonte: ${result.source}]`);
        } else {
          pendingCount++;
          console.error(`  [WRITE-BACK FALHA] ID ${tx.id} - Não foi atualizado na API do Lunch Money.`);
        }
      } else {
        pendingCount++;
        console.log(`  [PENDENTE/REVISÃO] ID ${tx.id} (${tx.date}) "${rawPayee}" CHF ${classifyInput.amount} -> ${result.reasoningShort || result.reasoning} (Confiança: ${result.confidenceScore}%)`);
      }
    } catch (err: any) {
      pendingCount++;
      console.error(`  [ERRO PIPELINE] ID ${tx.id} (${rawPayee}):`, err?.message || err);
    }
  }

  // Etapa 7: Re-leitura e verificação direta
  console.log('\n[Etapa 7: Re-leitura direta do Lunch Money]');
  const juneResAfter = await client.getTransactions({
    start_date: '2026-06-01',
    end_date: '2026-06-30'
  });
  const juneTxsAfter = juneResAfter.transactions || [];

  let uncategorizedRemaining = 0;
  let categorizedTotal = 0;
  for (const tx of juneTxsAfter) {
    const hasCat = tx.category_id !== null && tx.category_id !== undefined && tx.category_id !== 0;
    if (hasCat) {
      categorizedTotal++;
    } else {
      uncategorizedRemaining++;
    }
  }

  console.log(`- Total de transações em Junho/2026: ${juneTxsAfter.length}`);
  console.log(`- Transações com category_id PREENCHIDO (não nulo): ${categorizedTotal}`);
  console.log(`- Transações mantidas sem categoria (para revisão): ${uncategorizedRemaining}`);

  console.log('\n================================================================================');
  console.log('SUMÁRIO FINAL DE JUNHO DE 2026:');
  console.log(`FOUND: ${uncategorizedJune.length}`);
  console.log(`RESEARCHED: ${researchedCount}`);
  console.log(`CATEGORIZED: ${categorizedCount}`);
  console.log(`WRITTEN TO LUNCH MONEY: ${writtenCount}`);
  console.log(`PENDING HUMAN REVIEW: ${pendingCount}`);
  console.log('================================================================================');
}

diagnoseJune2026().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
