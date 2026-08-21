import { 
  LunchMoneyTransaction, 
  LunchMoneyAccount, 
  LunchMoneyCategory, 
  LunchMoneyTag,
  LunchMoneyRecurringItem 
} from './types';
import { 
  CanonicalTransaction, 
  CanonicalAccount, 
  Category, 
  RecurringItem, 
  CurrencyCode, 
  AccountType, 
  TransactionType 
} from '../../../src/types';
import { lunchMoneyCache } from './cache';

/**
 * Safe currency rounding without floating point drift
 */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Maps Lunch Money account type string to internal canonical AccountType
 */
export function mapAccountType(typeName?: string): AccountType {
  if (!typeName) return 'CHECKING';
  const t = typeName.toLowerCase();
  if (t.includes('credit') || t.includes('card')) return 'CREDIT_CARD';
  if (t.includes('saving')) return 'SAVINGS';
  if (t.includes('invest') || t.includes('broker') || t.includes('etf')) return 'INVESTMENT';
  if (t.includes('3a') || t.includes('pension')) return 'PENSION_3A';
  if (t.includes('cash') || t.includes('wallet')) return 'CASH';
  if (t.includes('crypto')) return 'CRYPTO';
  return 'CHECKING';
}

/**
 * Maps a single Lunch Money account to CanonicalAccount
 */
export function mapLunchMoneyAccount(
  clientId: string,
  acc: LunchMoneyAccount
): CanonicalAccount {
  const rawBalance = typeof acc.balance === 'string' ? parseFloat(acc.balance) : (acc.balance || 0);
  const balance = isNaN(rawBalance) ? 0 : roundMoney(rawBalance);

  return {
    id: `acc-lm-${acc.id}`,
    clientId,
    name: acc.display_name || acc.name,
    institution: acc.institution_name || 'Lunch Money Conectado',
    type: mapAccountType(acc.type_name || acc.subtype_name),
    currency: (acc.currency ? acc.currency.toUpperCase() : 'CHF') as CurrencyCode,
    balance,
    originalBalance: balance,
    originalCurrency: (acc.currency ? acc.currency.toUpperCase() : 'CHF') as CurrencyCode,
    balanceBase: undefined,
    baseCurrency: 'CHF',
    fxRate: undefined,
    fxRateTimestamp: undefined,
    fxSource: 'LUNCH_MONEY_ACCOUNT_BALANCE',
    isActive: acc.status !== 'inactive' && acc.status !== 'closed',
    provider: 'LUNCH_MONEY',
    externalId: String(acc.id),
    lastSyncedAt: new Date().toISOString()
  };
}

export const GROUP_COLORS: Record<string, string> = {
  'alimentação': '#10B981',
  'alimentacao': '#10B981',
  'assinatura': '#8B5CF6',
  'assinaturas': '#8B5CF6',
  'filha/familia': '#EC4899',
  'familia': '#EC4899',
  'financeiro': '#6366F1',
  'habitacão': '#3B82F6',
  'habitacao': '#3B82F6',
  'moradia': '#3B82F6',
  'impostos/seguros': '#EF4444',
  'impostos': '#EF4444',
  'seguros': '#EF4444',
  'investimentos': '#0D9488',
  'lazer': '#F59E0B',
  'outros': '#64748B',
  'pessoal': '#A855F7',
  'receitas': '#059669',
  'saúde': '#14B8A6',
  'saude': '#14B8A6',
  'transferencias': '#0284C7',
  'transporte': '#F97316',
  'viagens': '#06B6D4'
};

export function getCategoryGroupColor(groupName: string, isIncome?: boolean): string {
  if (isIncome) return '#059669';
  const clean = (groupName || '').toLowerCase().trim();
  for (const [k, v] of Object.entries(GROUP_COLORS)) {
    if (clean.includes(k)) return v;
  }
  return '#2563EB';
}

/**
 * Maps Lunch Money category hierarchy to internal Category list
 * Preserves both groups and assignable child categories, with summary/budget data
 */
export function mapAllLunchMoneyCategories(
  clientId: string,
  rawCategories: LunchMoneyCategory[],
  summaryTotalsMap?: Map<number, any>
): Category[] {
  const allCategories: Category[] = [];

  for (const item of rawCategories) {
    const isGroup = !!item.is_group;
    const groupColor = getCategoryGroupColor(item.name, item.is_income);

    if (isGroup) {
      const groupTotals = summaryTotalsMap?.get(item.id);
      const childCategories: Category[] = [];

      if (item.children && Array.isArray(item.children)) {
        for (const child of item.children) {
          const childTotals = summaryTotalsMap?.get(child.id);
          const childBudgetPlanned = (childTotals?.budgeted !== null && childTotals?.budgeted !== undefined) ? childTotals.budgeted : null;
          const childBudgetSpent = childTotals ? ((childTotals.other_activity || 0) + (childTotals.recurring_activity || 0)) : 0;
          const childBudgetRemaining = childTotals ? childTotals.available : null;
          const hasBudget = childBudgetPlanned !== null;

          const mappedChild: Category = {
            id: `cat-lm-${child.id}`,
            lunchMoneyCategoryId: child.id,
            clientId,
            groupId: `cat-lm-${item.id}`,
            groupName: item.name.trim(),
            name: child.name.trim(),
            type: child.is_income ? 'RECEITA' : (item.name.toLowerCase().includes('invest') ? 'INVESTIMENTO' : 'DESPESA'),
            subcategories: [],
            color: groupColor,
            isSystem: false,
            isGroup: false,
            order: child.order ?? null,
            collapsed: !!child.collapsed,
            isIncome: !!child.is_income,
            excludeFromBudget: !!child.exclude_from_budget,
            excludeFromTotals: !!child.exclude_from_totals,
            archived: !!child.archived,
            parentId: `cat-lm-${item.id}`,
            budgetPlanned: childBudgetPlanned,
            budgetSpent: childBudgetSpent,
            budgetRemaining: childBudgetRemaining,
            hasBudget,
            description: child.description || undefined
          };

          childCategories.push(mappedChild);
          allCategories.push(mappedChild);
        }
      }

      const groupBudgetPlanned = (groupTotals?.budgeted !== null && groupTotals?.budgeted !== undefined) ? groupTotals.budgeted : null;
      const groupBudgetSpent = groupTotals ? ((groupTotals.other_activity || 0) + (groupTotals.recurring_activity || 0)) : 0;
      const groupBudgetRemaining = groupTotals ? groupTotals.available : null;
      const hasGroupBudget = groupBudgetPlanned !== null;

      const mappedGroup: Category = {
        id: `cat-lm-${item.id}`,
        lunchMoneyCategoryId: item.id,
        clientId,
        groupId: 'grp-root',
        groupName: item.name.trim(),
        name: item.name.trim(),
        type: item.is_income ? 'RECEITA' : (item.name.toLowerCase().includes('invest') ? 'INVESTIMENTO' : 'DESPESA'),
        subcategories: childCategories.map(c => c.name),
        children: childCategories,
        color: groupColor,
        isSystem: false,
        isGroup: true,
        order: item.order ?? null,
        collapsed: !!item.collapsed,
        isIncome: !!item.is_income,
        excludeFromBudget: !!item.exclude_from_budget,
        excludeFromTotals: !!item.exclude_from_totals,
        archived: !!item.archived,
        parentId: null,
        budgetPlanned: groupBudgetPlanned,
        budgetSpent: groupBudgetSpent,
        budgetRemaining: groupBudgetRemaining,
        hasBudget: hasGroupBudget,
        description: item.description || undefined
      };

      allCategories.push(mappedGroup);
    } else {
      const totals = summaryTotalsMap?.get(item.id);
      const budgetPlanned = (totals?.budgeted !== null && totals?.budgeted !== undefined) ? totals.budgeted : null;
      const budgetSpent = totals ? ((totals.other_activity || 0) + (totals.recurring_activity || 0)) : 0;
      const budgetRemaining = totals ? totals.available : null;
      const hasBudget = budgetPlanned !== null;

      const mappedCat: Category = {
        id: `cat-lm-${item.id}`,
        lunchMoneyCategoryId: item.id,
        clientId,
        groupId: 'grp-root',
        groupName: item.is_income ? 'Receitas' : 'Geral',
        name: item.name.trim(),
        type: item.is_income ? 'RECEITA' : 'DESPESA',
        subcategories: [],
        color: groupColor,
        isSystem: false,
        isGroup: false,
        order: item.order ?? null,
        collapsed: !!item.collapsed,
        isIncome: !!item.is_income,
        excludeFromBudget: !!item.exclude_from_budget,
        excludeFromTotals: !!item.exclude_from_totals,
        archived: !!item.archived,
        parentId: null,
        budgetPlanned,
        budgetSpent,
        budgetRemaining,
        hasBudget,
        description: item.description || undefined
      };

      allCategories.push(mappedCat);
    }
  }

  return allCategories;
}

/**
 * Maps single Lunch Money category (legacy support)
 */
export function mapLunchMoneyCategory(
  clientId: string,
  cat: LunchMoneyCategory
): Category {
  const subcategories: string[] = [];
  if (cat.children && cat.children.length > 0) {
    cat.children.forEach(c => subcategories.push(c.name));
  }

  return {
    id: `cat-lm-${cat.id}`,
    lunchMoneyCategoryId: cat.id,
    clientId,
    groupId: cat.group_id ? `cat-lm-${cat.group_id}` : 'grp-root',
    groupName: cat.group_name || (cat.is_income ? 'Receitas' : 'Despesas'),
    name: cat.name,
    type: cat.is_income ? 'RECEITA' : 'DESPESA',
    subcategories,
    color: getCategoryGroupColor(cat.group_name || cat.name, cat.is_income),
    isSystem: false,
    isGroup: !!cat.is_group,
    order: cat.order ?? null,
    collapsed: !!cat.collapsed,
    isIncome: !!cat.is_income,
    excludeFromBudget: !!cat.exclude_from_budget,
    excludeFromTotals: !!cat.exclude_from_totals,
    archived: !!cat.archived,
    description: cat.description || undefined
  };
}

/**
 * Maps a Lunch Money transaction to CanonicalTransaction
 * Follows Lunch Money API v2 convention:
 * Positive amount = Débito/Saída (DESPESA)
 * Negative amount = Crédito/Entrada (RECEITA)
 */
export function mapLunchMoneyTransaction(
  clientId: string,
  tx: LunchMoneyTransaction
): CanonicalTransaction {
  const rawAmount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : (tx.amount || 0);
  const isNegative = !isNaN(rawAmount) && rawAmount < 0;
  const absAmount = isNaN(rawAmount) ? 0 : roundMoney(Math.abs(rawAmount));

  const currency = (tx.currency ? tx.currency.toUpperCase() : 'CHF') as CurrencyCode;

  // Normalize provider sign and labels before any income/expense aggregation.
  const searchableText = [tx.payee, tx.original_name, tx.notes]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('pt-BR');
  let transactionType: TransactionType = isNegative ? 'RECEITA' : 'DESPESA';
  if (!tx.is_income && /pagamento recebido|pagamento de fatura|fatura|cr[eé]dit|bcn mobile banking|bcn-netbanking|versement|ordre permanent|transfer/.test(searchableText)) {
    transactionType = 'TRANSFERÊNCIA';
  } else if (/iof de volta|estorno|reembolso|refund/.test(searchableText)) {
    transactionType = 'ESTORNO';
  } else if (tx.is_income || isNegative) {
    transactionType = 'RECEITA';
  }

  // Base amount calculation
  const hasProviderBaseAmount = tx.to_base !== undefined && tx.to_base !== null;
  const toBase = hasProviderBaseAmount
    ? roundMoney(Math.abs(tx.to_base as number))
    : currency === 'CHF' ? absAmount : undefined;

  // Find linked category from cache if not attached
  let categoryName = tx.category_name || undefined;
  let categoryId = tx.category_id ? `cat-lm-${tx.category_id}` : undefined;
  if (tx.category_id && !categoryName) {
    const cachedCat = lunchMoneyCache.getCategoryById(clientId, tx.category_id);
    if (cachedCat) {
      categoryName = cachedCat.name;
    }
  }

  // Find linked account
  let accountId = 'acc-default';
  let accountName = 'Conta Principal';
  const targetAccId = tx.manual_account_id || tx.plaid_account_id;
  if (targetAccId) {
    accountId = `acc-lm-${targetAccId}`;
    const cachedAcc = lunchMoneyCache.getAccountById(clientId, targetAccId);
    if (cachedAcc) {
      accountName = cachedAcc.display_name || cachedAcc.name;
    }
  }

  // Tags resolution
  const tagNames: string[] = [];
  const tagIds: string[] = [];
  if (tx.tags && Array.isArray(tx.tags)) {
    tx.tags.forEach(t => {
      tagNames.push(t.name);
      tagIds.push(String(t.id));
    });
  }

  // Review status
  const reviewStatus = categoryId ? 'REVISADA' : 'PENDENTE';

  return {
    id: `tx-lm-${tx.id}`,
    clientId,
    provider: 'LUNCH_MONEY',
    externalId: String(tx.id),
    lunchMoneyTransactionId: tx.id,
    accountId,
    accountName,
    manualAccountId: tx.manual_account_id ? String(tx.manual_account_id) : undefined,
    plaidAccountId: tx.plaid_account_id ? String(tx.plaid_account_id) : undefined,
    date: tx.date,
    description: tx.notes || tx.original_name || tx.payee || 'Transação',
    merchant: tx.payee || tx.original_name || 'Desconhecido',
    payee: tx.payee || tx.original_name || undefined,
    amount: absAmount,
    amountOriginal: !isNaN(rawAmount) ? roundMoney(rawAmount) : 0,
    currencyOriginal: currency,
    amountBase: toBase,
    baseCurrency: 'CHF',
    currency,
    convertedAmount: toBase,
    transactionType,
    categoryId,
    categoryName,
    notes: tx.notes || undefined,
    tagIds,
    tags: tagNames,
    status: tx.status || 'cleared',
    isPending: !!tx.is_pending,
    reviewStatus,
    isRecurring: !!tx.recurring_id,
    recurringItemId: tx.recurring_id ? `rec-lm-${tx.recurring_id}` : undefined,
    hasChildren: !!tx.has_children,
    parentId: tx.parent_id ? String(tx.parent_id) : undefined,
    isGroup: !!tx.is_group,
    groupId: tx.group_id ? String(tx.group_id) : undefined,
    createdAtProvider: tx.created_at,
    updatedAtProvider: tx.updated_at,
    createdAt: tx.created_at || new Date().toISOString(),
    updatedAt: tx.updated_at || new Date().toISOString(),
    lastSyncedAt: new Date().toISOString()
  };
}

/**
 * Maps Lunch Money recurring item to Canonical RecurringItem
 */
export function mapLunchMoneyRecurringItem(
  clientId: string,
  item: LunchMoneyRecurringItem
): RecurringItem {
  const rawAmount = typeof item.amount === 'string' ? parseFloat(item.amount) : (item.amount || 0);
  const amount = isNaN(rawAmount) ? 0 : roundMoney(Math.abs(rawAmount));
  
  let frequency: any = 'MENSAL';
  if (item.cadence === 'yearly') frequency = 'ANUAL';
  if (item.cadence === 'weekly') frequency = 'SEMANAL';

  const dayOfMonth = item.billing_date ? parseInt(item.billing_date.split('-')[2] || '1', 10) : 1;

  return {
    id: `rec-lm-${item.id}`,
    clientId,
    name: item.payee,
    type: 'DESPESA',
    amount,
    currency: (item.currency ? item.currency.toUpperCase() : 'CHF') as CurrencyCode,
    frequency,
    dayOfMonth,
    nextDueDate: item.billing_date || new Date().toISOString().split('T')[0],
    status: item.type === 'cleared' ? 'PAGO' : 'PREVISTO',
    accountId: item.manual_account_id ? `acc-lm-${item.manual_account_id}` : undefined,
    categoryId: item.category_id ? `cat-lm-${item.category_id}` : undefined,
    provider: 'LUNCH_MONEY',
    externalId: String(item.id)
  };
}

