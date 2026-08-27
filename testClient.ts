import { LunchMoneyClient } from './client';
import { LunchMoneyTransaction } from './types';

const transactions: LunchMoneyTransaction[] = [
  { id: 7001, date: '2026-08-01', payee: 'Pagamento recebido', amount: '-100', currency: 'CHF', notes: 'Pagamento recebido' },
  { id: 7002, date: '2026-08-02', payee: 'Compra de mercado', amount: '50', currency: 'CHF', category_id: 9001, category_name: 'Alimentação' }
];

export class LunchMoneyTestClient extends LunchMoneyClient {
  public override async getMe() { return { account_id: 1, primary_currency: 'CHF', user_name: 'Teste', user_email: 'test@example.invalid' }; }
  public override async getCategories() { return { categories: [{ id: 9001, name: 'Alimentação', is_group: false, is_income: false }] }; }
  public override async getSummary() { return { categories: [] }; }
  public override async getManualAccounts() { return { manual_accounts: [{ id: 1, name: 'Conta teste', display_name: 'Conta teste', balance: '1000', currency: 'CHF', type_name: 'checking' }] }; }
  public override async getPlaidAccounts() { return { plaid_accounts: [] }; }
  public override async getTags() { return { tags: [] }; }
  public override async fetchAllTransactions() { return transactions.map(transaction => ({ ...transaction })); }
  public override async getRecurringExpenses() { return { recurring_expenses: [] }; }
  public override async updateTransaction() { return { updated: true }; }
}
