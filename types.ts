export interface LunchMoneyTransaction {
  id: number;
  date: string;
  payee: string;
  amount: string | number; // LM v2 returns decimal string or number
  currency: string;
  to_base?: number;
  category_id?: number | null;
  category_name?: string | null;
  category_group_name?: string | null;
  is_income?: boolean;
  exclude_from_budget?: boolean;
  exclude_from_totals?: boolean;
  created_at?: string;
  updated_at?: string;
  status?: string; // 'cleared' | 'uncleared' | 'recurring'
  is_pending?: boolean;
  notes?: string | null;
  original_name?: string | null;
  plaid_account_id?: number | null;
  manual_account_id?: number | null;
  recurring_id?: number | null;
  has_children?: boolean;
  parent_id?: number | null;
  is_group?: boolean;
  group_id?: number | null;
  tags?: Array<{ id: number; name: string }>;
  external_id?: string | null;
}

export interface LunchMoneyTag {
  id: number;
  name: string;
  description?: string | null;
  archived?: boolean;
}

export interface LunchMoneyAccount {
  id: number;
  name: string;
  display_name?: string;
  type_name?: string; // 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'other'
  subtype_name?: string;
  institution_name?: string;
  balance: string | number;
  currency: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  last_import?: string;
}

export interface LunchMoneyCategory {
  id: number;
  name: string;
  description?: string;
  is_income?: boolean;
  exclude_from_budget?: boolean;
  exclude_from_totals?: boolean;
  group_id?: number | null;
  group_name?: string | null;
  is_group?: boolean;
  order?: number;
  archived?: boolean;
  collapsed?: boolean;
  children?: LunchMoneyCategory[];
}

export interface LunchMoneyRecurringItem {
  id: number;
  start_date: string;
  end_date?: string | null;
  cadence: string; // 'monthly' | 'twice a month' | 'yearly' | 'weekly'
  payee: string;
  amount: string | number;
  currency: string;
  to_base?: number;
  billing_date?: string;
  type?: string; // 'cleared' | 'suggested' | 'dismissed'
  category_id?: number | null;
  manual_account_id?: number | null;
  plaid_account_id?: number | null;
}

export interface LunchMoneyUser {
  user_name?: string;
  name?: string;
  user_email?: string;
  email?: string;
  user_id?: number;
  id?: number;
  account_id: number;
  budget_name?: string;
  primary_currency: string;
  api_key_label?: string;
}

export interface LunchMoneyTransactionsResponse {
  transactions: LunchMoneyTransaction[];
  has_more?: boolean;
}

export interface LunchMoneyCategoriesResponse {
  categories: LunchMoneyCategory[];
}

export interface LunchMoneyManualAccountsResponse {
  manual_accounts: LunchMoneyAccount[];
}

export interface LunchMoneyPlaidAccountsResponse {
  plaid_accounts: LunchMoneyAccount[];
}

export interface LunchMoneyRecurringResponse {
  recurring_expenses: LunchMoneyRecurringItem[];
}

export interface LunchMoneyTagsResponse {
  tags: LunchMoneyTag[];
}
