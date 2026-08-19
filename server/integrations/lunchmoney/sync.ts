import { LunchMoneyClient } from './client';
import { lunchMoneyCache } from './cache';
import { 
  mapLunchMoneyAccount, 
  mapAllLunchMoneyCategories, 
  mapLunchMoneyTransaction, 
  mapLunchMoneyRecurringItem 
} from './mapper';
import { 
  CanonicalAccount, 
  CanonicalTransaction, 
  Category, 
  RecurringItem, 
  CanonicalRule,
  SyncJob 
} from '../../../src/types';
import { LunchMoneyTag } from './types';
import { LunchMoneyAuthError } from './errors';
import { categorizationEngine } from '../../ai/categorizationEngine';
import { AssignableCategoryInfo, ClassifyTransactionInput } from '../../ai/types';
import { merchantKnowledgeStore } from '../../ai/merchantStore';
import { aiQuotaManager } from '../../ai/quotaManager';

export interface SyncResult {
  job: SyncJob;
  accounts: CanonicalAccount[];
  categories: Category[];
  tags: LunchMoneyTag[];
  transactions: CanonicalTransaction[];
  recurringItems: RecurringItem[];
  accountsToPersist: CanonicalAccount[];
  categoriesToPersist: Category[];
  tagsToPersist: LunchMoneyTag[];
  transactionsToPersist: CanonicalTransaction[];
  user: {
    userName: string;
    userEmail: string;
    primaryCurrency: string;
    budgetName?: string;
    accountId: number;
  };
  metrics?: {
    uncategorizedFound: number;
    categorizedCount: number;
    pendingCount: number;
    researchedCount: number;
    writeBackCount: number;
  };
}

export class LunchMoneySyncService {
  private client: LunchMoneyClient;

  constructor(client: LunchMoneyClient = new LunchMoneyClient()) {
    this.client = client;
  }

  public async runSync(
    clientId: string,
    options: {
      startDate?: string;
      endDate?: string;
      updatedSince?: string;
      existingTransactions?: CanonicalTransaction[];
      existingAccounts?: CanonicalAccount[];
      existingCategories?: Category[];
      existingTags?: LunchMoneyTag[];
      existingRules?: CanonicalRule[];
      existingRecurring?: RecurringItem[];
    } = {}
  ): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const jobId = `sync_${Date.now()}`;

    const job: SyncJob = {
      id: jobId,
      clientId,
      provider: 'lunch_money',
      startedAt,
      status: 'SINCRONIZANDO',
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      accountsCreated: 0,
      accountsUpdated: 0,
      accountsSkipped: 0,
      categoriesCreated: 0,
      categoriesUpdated: 0,
      categoriesSkipped: 0,
      tagsCreated: 0,
      tagsUpdated: 0,
      tagsSkipped: 0,
      transactionsCreated: 0,
      transactionsUpdated: 0,
      transactionsSkipped: 0
    };

    let userMeta = {
      userName: '',
      userEmail: '',
      primaryCurrency: 'CHF',
      budgetName: undefined as string | undefined,
      accountId: 0
    };

    try {
      // 1. Verify connection and user identity (Deterministic HTTP - 0 AI dependencies)
      const user = await this.client.getMe();
      userMeta = {
        userName: user.user_name || user.name || 'Kássio',
        userEmail: user.user_email || user.email || '',
        primaryCurrency: (user.primary_currency ? user.primary_currency.toUpperCase() : 'CHF'),
        budgetName: user.budget_name,
        accountId: user.account_id
      };

      // 2. Fetch and Cache Categories & Budget/Summary Data (Deterministic HTTP)
      const [categoriesRes, summaryRes] = await Promise.allSettled([
        this.client.getCategories(),
        this.client.getSummary({
          start_date: options.startDate || '2026-01-01',
          end_date: options.endDate || new Date().toISOString().split('T')[0]
        })
      ]);

      const rawCategories = categoriesRes.status === 'fulfilled' ? categoriesRes.value.categories || [] : [];
      lunchMoneyCache.setCategories(clientId, rawCategories);

      const summaryTotalsMap = new Map<number, any>();
      if (summaryRes.status === 'fulfilled' && summaryRes.value?.categories) {
        for (const item of summaryRes.value.categories) {
          if (item.category_id) {
            summaryTotalsMap.set(item.category_id, item.totals);
          }
        }
      }

      const mappedCategories: Category[] = mapAllLunchMoneyCategories(
        clientId, 
        rawCategories, 
        summaryTotalsMap
      );

      // 3. Fetch and Cache Accounts (manual + plaid accounts metadata)
      const [manualAccRes, plaidAccRes] = await Promise.allSettled([
        this.client.getManualAccounts(),
        this.client.getPlaidAccounts()
      ]);

      const rawManual = manualAccRes.status === 'fulfilled' ? manualAccRes.value.manual_accounts || [] : [];
      const rawPlaid = plaidAccRes.status === 'fulfilled' ? plaidAccRes.value.plaid_accounts || [] : [];
      const allRawAccounts = [...rawManual, ...rawPlaid];

      lunchMoneyCache.setAccounts(clientId, allRawAccounts);

      const mappedAccounts: CanonicalAccount[] = allRawAccounts.map(acc => 
        mapLunchMoneyAccount(clientId, acc)
      );

      // 4. Fetch and Cache Tags
      let rawTags: LunchMoneyTag[] = [];
      try {
        const tagsRes = await this.client.getTags();
        rawTags = tagsRes.tags || [];
        lunchMoneyCache.setTags(clientId, rawTags);
      } catch {
        // tags fallback
      }

      // 5. Fetch Transactions with pagination across entire requested range
      const rawTransactions = await this.client.fetchAllTransactions({
        start_date: options.startDate || '2026-01-01',
        end_date: options.endDate,
        updated_since: options.updatedSince
      });

      const mappedTransactions: CanonicalTransaction[] = rawTransactions.map(tx => 
        mapLunchMoneyTransaction(clientId, tx)
      );

      // 6. Fetch Recurring Items
      let mappedRecurring: RecurringItem[] = [];
      try {
        const recurringRes = await this.client.getRecurringExpenses();
        const rawRecurring = recurringRes.recurring_expenses || [];
        mappedRecurring = rawRecurring.map(item => 
          mapLunchMoneyRecurringItem(clientId, item)
        );
      } catch {
        // recurring fallback
      }

      // 7. Differential Calculation for Accounts
      const existingAccountsMap = new Map<string, CanonicalAccount>();
      (options.existingAccounts || []).forEach(a => {
        if (a.externalId) existingAccountsMap.set(String(a.externalId), a);
        if (a.id) existingAccountsMap.set(a.id, a);
      });

      let accountsCreated = 0;
      let accountsUpdated = 0;
      let accountsSkipped = 0;
      const accountsToPersist: CanonicalAccount[] = [];

      mappedAccounts.forEach(acc => {
        const oldAcc = (acc.externalId && existingAccountsMap.get(String(acc.externalId))) || existingAccountsMap.get(acc.id);
        if (oldAcc) {
          const hasChanged = 
            oldAcc.name !== acc.name ||
            oldAcc.type !== acc.type ||
            oldAcc.balance !== acc.balance ||
            oldAcc.currency !== acc.currency ||
            oldAcc.institution !== acc.institution ||
            oldAcc.isActive !== acc.isActive ||
            (oldAcc.notes || '') !== (acc.notes || '') ||
            oldAcc.creditLimit !== acc.creditLimit;

          if (hasChanged) {
            accountsUpdated++;
            accountsToPersist.push(acc);
          } else {
            accountsSkipped++;
          }
        } else {
          accountsCreated++;
          accountsToPersist.push(acc);
        }
      });

      // 8. Differential Calculation for Categories
      const existingCategoriesMap = new Map<string, Category>();
      (options.existingCategories || []).forEach(c => {
        existingCategoriesMap.set(c.id, c);
        if (c.lunchMoneyCategoryId) {
          existingCategoriesMap.set(`lm-${c.lunchMoneyCategoryId}`, c);
        }
      });

      let categoriesCreated = 0;
      let categoriesUpdated = 0;
      let categoriesSkipped = 0;
      const categoriesToPersist: Category[] = [];

      mappedCategories.forEach(cat => {
        const oldCat = existingCategoriesMap.get(cat.id) || 
          (cat.lunchMoneyCategoryId ? existingCategoriesMap.get(`lm-${cat.lunchMoneyCategoryId}`) : undefined);
        
        if (oldCat) {
          const hasChanged =
            oldCat.name !== cat.name ||
            oldCat.groupName !== cat.groupName ||
            oldCat.groupId !== cat.groupId ||
            oldCat.type !== cat.type ||
            oldCat.color !== cat.color ||
            oldCat.isGroup !== cat.isGroup ||
            oldCat.isIncome !== cat.isIncome ||
            oldCat.budgetPlanned !== cat.budgetPlanned ||
            oldCat.budgetSpent !== cat.budgetSpent ||
            oldCat.budgetRemaining !== cat.budgetRemaining ||
            oldCat.hasBudget !== cat.hasBudget ||
            (oldCat.description || '') !== (cat.description || '') ||
            JSON.stringify(oldCat.subcategories || []) !== JSON.stringify(cat.subcategories || []);

          if (hasChanged) {
            categoriesUpdated++;
            categoriesToPersist.push(cat);
          } else {
            categoriesSkipped++;
          }
        } else {
          categoriesCreated++;
          categoriesToPersist.push(cat);
        }
      });

      // 9. Differential Calculation for Tags
      const existingTagsMap = new Map<number, LunchMoneyTag>();
      (options.existingTags || []).forEach(t => existingTagsMap.set(t.id, t));

      let tagsCreated = 0;
      let tagsUpdated = 0;
      let tagsSkipped = 0;
      const tagsToPersist: LunchMoneyTag[] = [];

      rawTags.forEach(t => {
        const oldTag = existingTagsMap.get(t.id);
        if (oldTag) {
          const hasChanged = 
            oldTag.name !== t.name || 
            (oldTag.description || '') !== (t.description || '');

          if (hasChanged) {
            tagsUpdated++;
            tagsToPersist.push(t);
          } else {
            tagsSkipped++;
          }
        } else {
          tagsCreated++;
          tagsToPersist.push(t);
        }
      });

      // 10. Differential Calculation for Transactions (strictly preserving human corrections)
      const existingTxMap = new Map<string, CanonicalTransaction>();
      (options.existingTransactions || []).forEach(t => {
        if (t.externalId) existingTxMap.set(String(t.externalId), t);
        if (t.id) existingTxMap.set(t.id, t);
      });

      const processedTxIds = new Set<string>();
      let txCreated = 0;
      let txUpdated = 0;
      let txSkipped = 0;
      const transactionsToPersist: CanonicalTransaction[] = [];
      const finalTransactions: CanonicalTransaction[] = [];

      mappedTransactions.forEach(newTx => {
        const oldTx = (newTx.externalId && existingTxMap.get(String(newTx.externalId))) || existingTxMap.get(newTx.id);
        if (oldTx) {
          if (oldTx.id) processedTxIds.add(oldTx.id);
          if (oldTx.externalId) processedTxIds.add(String(oldTx.externalId));

          // If the user locally confirmed or recategorized this transaction, preserve it
          if (oldTx.reviewStatus === 'REVISADA' && oldTx.categoryId) {
            newTx.categoryId = oldTx.categoryId;
            newTx.categoryName = oldTx.categoryName;
            newTx.subcategoryId = oldTx.subcategoryId;
            newTx.reviewStatus = 'REVISADA';
          }

          const hasChanged =
            oldTx.amount !== newTx.amount || 
            oldTx.date !== newTx.date || 
            oldTx.merchant !== newTx.merchant ||
            oldTx.payee !== newTx.payee ||
            oldTx.description !== newTx.description ||
            oldTx.categoryId !== newTx.categoryId ||
            oldTx.categoryName !== newTx.categoryName ||
            oldTx.transactionType !== newTx.transactionType ||
            oldTx.currency !== newTx.currency ||
            oldTx.status !== newTx.status ||
            oldTx.notes !== newTx.notes ||
            JSON.stringify(oldTx.tags || []) !== JSON.stringify(newTx.tags || []);

          if (hasChanged) {
            txUpdated++;
            transactionsToPersist.push(newTx);
          } else {
            txSkipped++;
          }
          finalTransactions.push(newTx);
        } else {
          txCreated++;
          transactionsToPersist.push(newTx);
          finalTransactions.push(newTx);
        }
      });

      // Preserve existing manual or pre-existing transactions not covered in remote batch
      (options.existingTransactions || []).forEach(existingTx => {
        const wasProcessed = processedTxIds.has(existingTx.id) || (existingTx.externalId && processedTxIds.has(String(existingTx.externalId)));
        if (!wasProcessed) {
          finalTransactions.push(existingTx);
        }
      });

      // =======================================================================
      // 11. DETERMINISTIC & GROUPED CATEGORIZATION PIPELINE WITH WRITE-BACK
      // =======================================================================
      const availableCategories: AssignableCategoryInfo[] = mappedCategories
        .filter(c => !c.isGroup && !c.archived)
        .map(c => ({
          id: c.id,
          name: c.name,
          groupName: c.groupName || 'Geral',
          type: c.type || 'DESPESA',
          subcategories: c.subcategories || [],
          description: c.description
        }));

      let uncategorizedFoundCount = 0;
      let categorizedCount = 0;
      let pendingCount = 0;
      let researchedCount = 0;
      let writeBackCount = 0;

      // Filter uncategorized transactions needing processing
      const uncategorizedTxs = finalTransactions.filter(tx => {
        const isUncat = 
          !tx.categoryId || 
          tx.categoryId === 'cat-none' || 
          !tx.categoryName || 
          tx.categoryName.trim().toLowerCase() === 'sem categoria' || 
          tx.categoryName.trim().toLowerCase() === 'uncategorized';

        if (tx.reviewStatus === 'REVISADA' && tx.categoryId && !isUncat) {
          return false;
        }
        return isUncat;
      });

      uncategorizedFoundCount = uncategorizedTxs.length;

      if (uncategorizedTxs.length > 0) {
        // Group transactions by normalized merchant for token & call minimization
        const merchantGroups = new Map<string, CanonicalTransaction[]>();
        for (const tx of uncategorizedTxs) {
          const raw = tx.merchant || tx.payee || tx.description || 'UNKNOWN';
          const key = merchantKnowledgeStore.normalizeMerchantKey(raw) || raw;
          const list = merchantGroups.get(key) || [];
          list.push(tx);
          merchantGroups.set(key, list);
        }

        // Process each merchant group
        for (const [groupKey, txList] of merchantGroups.entries()) {
          const repTx = txList.find(t => t.merchant && t.description) || txList[0];

          const classifyInput: ClassifyTransactionInput = {
            id: repTx.id,
            merchant: repTx.merchant || repTx.payee || repTx.description,
            payee: repTx.payee,
            description: repTx.description,
            notes: repTx.notes,
            amount: repTx.amount,
            currency: repTx.currency || 'CHF',
            date: repTx.date,
            accountName: repTx.accountName,
            accountId: repTx.accountId,
            country: 'Suíça'
          };

          let result;
          try {
            result = await categorizationEngine.classifyTransaction(
              classifyInput,
              availableCategories,
              options.existingRules || [],
              clientId
            );
          } catch (classificationError: any) {
            console.warn('[Sync Categorization Notice] Classificação auxiliar indisponível:', classificationError?.message || classificationError);
            result = {
              transactionId: repTx.id,
              rawPayee: repTx.merchant || repTx.description,
              normalizedMerchant: repTx.merchant || repTx.description,
              categoryId: undefined,
              categoryName: undefined,
              confidenceScore: 0,
              reasoning: 'Classificação não disponível; revisão humana necessária.',
              reasoningShort: 'Revisão humana necessária.',
              source: 'AI_REASONING' as const,
              isAutoClassified: false,
              needsReview: true,
              sentToPending: true
            };
          }

          if (result.researchUsed || result.source === 'MERCHANT_RESEARCH') {
            researchedCount++;
          }

          // Apply result to all transactions in the group
          for (const tx of txList) {
            if (result.categoryId && result.categoryName) {
              tx.categoryId = result.categoryId;
              tx.categoryName = result.categoryName;
              if (result.subcategoryId) tx.subcategoryId = result.subcategoryId;
              if (result.subcategoryName) tx.subcategoryName = result.subcategoryName;
              if (result.canonicalMerchant && (tx.merchant === 'Desconhecido' || !tx.merchant)) {
                tx.merchant = result.canonicalMerchant;
              }

              const isAuto = result.isAutoClassified && result.confidenceScore >= 90;
              tx.reviewStatus = result.source === 'DETERMINISTIC_RULE' 
                ? 'AUTO_REGRAS' 
                : (isAuto ? 'AI_CLASSIFIED' : 'PENDENTE');

              tx.aiClassification = {
                suggestedCategoryId: result.categoryId,
                suggestedCategoryName: result.categoryName,
                suggestedSubcategoryId: result.subcategoryId,
                suggestedSubcategoryName: result.subcategoryName,
                confidenceScore: result.confidenceScore,
                reasoning: result.reasoning,
                reasoningShort: result.reasoningShort,
                source: result.source,
                isAutoClassified: result.isAutoClassified,
                needsReview: result.needsReview,
                researchUsed: result.researchUsed,
                evidenceSummary: result.evidenceSummary,
                sourceUrls: result.sourceUrls,
                canonicalMerchant: result.canonicalMerchant,
                groundingSources: result.groundingSources
              };

              if (isAuto) {
                categorizedCount++;
              } else {
                pendingCount++;
              }

              // Write-back to Lunch Money for high confidence classifications
              if (isAuto) {
                let lmCatId: number | undefined;
                if (result.categoryId.startsWith('cat-lm-')) {
                  const parsedId = parseInt(result.categoryId.replace('cat-lm-', ''), 10);
                  if (!isNaN(parsedId)) lmCatId = parsedId;
                } else {
                  const matchedCat = mappedCategories.find(c => c.id === result.categoryId);
                  if (matchedCat && matchedCat.lunchMoneyCategoryId) {
                    lmCatId = matchedCat.lunchMoneyCategoryId;
                  }
                }

                const lmTxId = tx.lunchMoneyTransactionId || (tx.externalId ? parseInt(tx.externalId, 10) : undefined);
                if (lmTxId && lmCatId && this.client) {
                  try {
                    await this.client.updateTransaction(lmTxId, {
                      category_id: lmCatId
                    });
                    writeBackCount++;
                  } catch (wbErr: any) {
                    console.warn(`[Sync Write-back Notice] Falha no write-back da transação ${lmTxId}:`, wbErr?.message || wbErr);
                  }
                }
              }

              // Queue for persistence
              if (!transactionsToPersist.some(p => p.id === tx.id)) {
                transactionsToPersist.push(tx);
              }
            } else {
              pendingCount++;
              tx.reviewStatus = 'PENDENTE';
            }
          }
        }
      }

      // Finalize Job Details
      job.accountsCreated = accountsCreated;
      job.accountsUpdated = accountsUpdated;
      job.accountsSkipped = accountsSkipped;

      job.categoriesCreated = categoriesCreated;
      job.categoriesUpdated = categoriesUpdated;
      job.categoriesSkipped = categoriesSkipped;

      job.tagsCreated = tagsCreated;
      job.tagsUpdated = tagsUpdated;
      job.tagsSkipped = tagsSkipped;

      job.transactionsCreated = txCreated;
      job.transactionsUpdated = txUpdated;
      job.transactionsSkipped = txSkipped;

      job.created = txCreated + accountsCreated + categoriesCreated + tagsCreated;
      job.updated = txUpdated + accountsUpdated + categoriesUpdated + tagsUpdated;
      job.skipped = txSkipped + accountsSkipped + categoriesSkipped + tagsSkipped;
      job.status = 'SUCCESS';
      job.finishedAt = new Date().toISOString();
      job.details = {
        accountsCount: mappedAccounts.length,
        transactionsCount: mappedTransactions.length,
        categoriesCount: mappedCategories.length,
        tagsCount: rawTags.length,
        recurringCount: mappedRecurring.length,
        uncategorizedFound: uncategorizedFoundCount,
        categorizedCount,
        pendingCount,
        researchedCount,
        writeBackCount
      };

      return {
        job,
        accounts: mappedAccounts,
        categories: mappedCategories,
        tags: rawTags,
        transactions: finalTransactions,
        recurringItems: mappedRecurring,
        accountsToPersist,
        categoriesToPersist,
        tagsToPersist,
        transactionsToPersist,
        user: userMeta,
        metrics: {
          uncategorizedFound: uncategorizedFoundCount,
          categorizedCount,
          pendingCount,
          researchedCount,
          writeBackCount
        }
      };

    } catch (error: any) {
      job.finishedAt = new Date().toISOString();
      
      if (error instanceof LunchMoneyAuthError) {
        job.status = 'CREDENCIAL_INVALIDA';
        job.errorSummary = error.message;
      } else {
        job.status = 'FAILED';
        job.errorSummary = error.message || 'Falha ao sincronizar com Lunch Money.';
      }
      job.failed = 1;

      // Resilient snapshot recovery: preserve existing valid state so data never vanishes
      return {
        job,
        accounts: options.existingAccounts || [],
        categories: options.existingCategories || [],
        tags: options.existingTags || [],
        transactions: options.existingTransactions || [],
        recurringItems: options.existingRecurring || [],
        accountsToPersist: [],
        categoriesToPersist: [],
        tagsToPersist: [],
        transactionsToPersist: [],
        user: userMeta
      };
    }
  }
}
