import { CanonicalRule, CanonicalTransaction, RuleCondition } from '../types';

/**
 * Checks if a single transaction satisfies a single condition
 */
export function evaluateCondition(condition: RuleCondition, tx: CanonicalTransaction): boolean {
  let txValue: any = null;

  switch (condition.field) {
    case 'merchant':
      txValue = tx.merchant || '';
      break;
    case 'description':
      txValue = tx.description || '';
      break;
    case 'accountId':
      txValue = tx.accountId || '';
      break;
    case 'amount':
      txValue = tx.amount;
      break;
    case 'currency':
      txValue = tx.currency;
      break;
    case 'tag':
      txValue = tx.tags || [];
      break;
    default:
      return false;
  }

  const strTx = String(txValue).toLowerCase().trim();
  const strCond = String(condition.value).toLowerCase().trim();

  switch (condition.operator) {
    case 'contains':
      if (Array.isArray(txValue)) {
        return txValue.some(t => String(t).toLowerCase().includes(strCond));
      }
      return strTx.includes(strCond);
    case 'equals':
      if (typeof condition.value === 'number') {
        return Number(txValue) === Number(condition.value);
      }
      return strTx === strCond;
    case 'startsWith':
      return strTx.startsWith(strCond);
    case 'endsWith':
      return strTx.endsWith(strCond);
    case 'greaterThan':
      return Number(txValue) > Number(condition.value);
    case 'lessThan':
      return Number(txValue) < Number(condition.value);
    default:
      return false;
  }
}

/**
 * Applies active rules to a transaction in order of priority (1 = highest priority).
 * Returns modified transaction and rule that matched, if any.
 */
export function applyRulesToTransaction(
  tx: CanonicalTransaction,
  rules: CanonicalRule[]
): { updatedTx: CanonicalTransaction; matchedRule: CanonicalRule | null } {
  // Sort rules by priority ascending (1, 2, 3...)
  const activeRules = rules
    .filter(r => r.isActive)
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  for (const rule of activeRules) {
    // All conditions in a rule must match (AND logic)
    const matchesAll = rule.conditions.length > 0 && rule.conditions.every(c => evaluateCondition(c, tx));

    if (matchesAll) {
      const clonedTx = { ...tx };
      
      if (rule.actions.categoryId) {
        clonedTx.categoryId = rule.actions.categoryId;
      }
      if (rule.actions.subcategoryId) {
        clonedTx.subcategoryId = rule.actions.subcategoryId;
      }
      if (rule.actions.transactionType) {
        clonedTx.transactionType = rule.actions.transactionType;
      }
      if (rule.actions.tagsToAdd && rule.actions.tagsToAdd.length > 0) {
        const existingTags = clonedTx.tags || [];
        clonedTx.tags = Array.from(new Set([...existingTags, ...rule.actions.tagsToAdd]));
      }
      if (rule.actions.requestReview) {
        clonedTx.reviewStatus = 'PENDENTE';
      } else {
        clonedTx.reviewStatus = 'AUTO_REGRAS';
      }

      return {
        updatedTx: clonedTx,
        matchedRule: rule
      };
    }
  }

  return {
    updatedTx: tx,
    matchedRule: null
  };
}

/**
 * Checks if a merchant is repeated in manual categorization without an existing rule.
 * Suggests creating a deterministic rule if frequent.
 */
export function checkForRuleSuggestion(
  merchant: string,
  transactions: CanonicalTransaction[],
  existingRules: CanonicalRule[]
): boolean {
  if (!merchant || merchant.trim().length < 3) return false;
  
  const cleanMerchant = merchant.trim().toLowerCase();
  
  // Check if a rule already covers this merchant
  const hasExistingRule = existingRules.some(r => 
    r.conditions.some(c => 
      c.field === 'merchant' && 
      (c.operator === 'contains' || c.operator === 'equals') &&
      String(c.value).toLowerCase() === cleanMerchant
    )
  );

  if (hasExistingRule) return false;

  // Count how many transactions have this merchant
  const count = transactions.filter(t => 
    t.merchant && t.merchant.trim().toLowerCase() === cleanMerchant
  ).length;

  // Suggest if 2 or more transactions with same merchant
  return count >= 2;
}
