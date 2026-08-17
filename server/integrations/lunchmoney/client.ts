import { 
  LunchMoneyUser, 
  LunchMoneyTransaction,
  LunchMoneyTransactionsResponse, 
  LunchMoneyCategoriesResponse, 
  LunchMoneyManualAccountsResponse, 
  LunchMoneyPlaidAccountsResponse, 
  LunchMoneyRecurringResponse,
  LunchMoneyTagsResponse 
} from './types';
import { 
  LunchMoneyAuthError, 
  LunchMoneyRateLimitError, 
  LunchMoneyNetworkError, 
  LunchMoneyError 
} from './errors';

export class LunchMoneyClient {
  private readonly baseUrl = 'https://api.lunchmoney.dev/v2';
  private readonly apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LUNCH_MONEY_API_KEY;
  }

  private getAuthHeader(): Record<string, string> {
    if (!this.apiKey || this.apiKey.trim() === '') {
      throw new LunchMoneyAuthError('Secret LUNCH_MONEY_API_KEY não configurado no servidor.');
    }
    return {
      'Authorization': `Bearer ${this.apiKey.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      ...this.getAuthHeader(),
      ...(options.headers as Record<string, string> || {})
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        throw new LunchMoneyAuthError('Token de API do Lunch Money inválido ou expirado.');
      }

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
        throw new LunchMoneyRateLimitError(`Limite de requisições excedido. Aguarde ${retryAfter}s.`);
      }

      if (!response.ok) {
        let errorMsg = `Erro na API Lunch Money (Status ${response.status})`;
        try {
          const body = await response.json();
          if (body.error || body.message) {
            errorMsg = body.error || body.message;
          }
        } catch {
          // ignore parsing error
        }
        throw new LunchMoneyError(errorMsg, 'API_ERROR', response.status);
      }

      const data = await response.json();
      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err instanceof LunchMoneyError) {
        throw err;
      }
      if (err.name === 'AbortError') {
        throw new LunchMoneyNetworkError('Tempo limite (timeout de 10s) esgotado ao conectar à API do Lunch Money.');
      }
      throw new LunchMoneyNetworkError(
        `Falha de conexão com a API do Lunch Money: ${err.message || 'Serviço indisponível'}`
      );
    }
  }

  public async getMe(): Promise<LunchMoneyUser> {
    return this.request<LunchMoneyUser>('/me');
  }

  public async getTransactions(params?: {
    start_date?: string;
    end_date?: string;
    updated_since?: string;
    limit?: number;
    offset?: number;
  }): Promise<LunchMoneyTransactionsResponse> {
    const queryParts: string[] = [];
    
    // Lunch Money API v2 requires start_date and end_date to be supplied together if date range filtering is used
    if (params?.start_date) {
      queryParts.push(`start_date=${encodeURIComponent(params.start_date)}`);
      const endDate = params.end_date || new Date().toISOString().split('T')[0];
      queryParts.push(`end_date=${encodeURIComponent(endDate)}`);
    } else if (params?.end_date) {
      queryParts.push(`start_date=2020-01-01`);
      queryParts.push(`end_date=${encodeURIComponent(params.end_date)}`);
    }

    if (params?.updated_since) queryParts.push(`updated_since=${encodeURIComponent(params.updated_since)}`);
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    if (params?.offset !== undefined) queryParts.push(`offset=${params.offset}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return this.request<LunchMoneyTransactionsResponse>(`/transactions${queryString}`);
  }

  public async fetchAllTransactions(params?: {
    start_date?: string;
    end_date?: string;
    updated_since?: string;
    maxPages?: number;
  }): Promise<LunchMoneyTransaction[]> {
    const allTransactions: LunchMoneyTransaction[] = [];
    const limit = 500;
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = params?.maxPages || 20; // safe cap (10,000 transactions max)

    while (hasMore && pageCount < maxPages) {
      pageCount++;
      const res = await this.getTransactions({
        start_date: params?.start_date,
        end_date: params?.end_date,
        updated_since: params?.updated_since,
        limit,
        offset
      });

      const txs = res.transactions || [];
      allTransactions.push(...txs);

      // Check pagination termination
      if (res.has_more === false || txs.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    return allTransactions;
  }

  public async getCategories(params?: { format?: 'flattened' | 'nested' }): Promise<LunchMoneyCategoriesResponse> {
    const qs = params?.format ? `?format=${params.format}` : '';
    return this.request<LunchMoneyCategoriesResponse>(`/categories${qs}`);
  }

  public async getSummary(params?: { start_date?: string; end_date?: string }): Promise<any> {
    const queryParts: string[] = [];
    if (params?.start_date) queryParts.push(`start_date=${encodeURIComponent(params.start_date)}`);
    if (params?.end_date) queryParts.push(`end_date=${encodeURIComponent(params.end_date)}`);
    const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    try {
      return await this.request<any>(`/summary${qs}`);
    } catch {
      return null;
    }
  }

  public async getBudgets(params?: { start_date?: string; end_date?: string }): Promise<any> {
    const queryParts: string[] = [];
    if (params?.start_date) queryParts.push(`start_date=${encodeURIComponent(params.start_date)}`);
    if (params?.end_date) queryParts.push(`end_date=${encodeURIComponent(params.end_date)}`);
    const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    
    try {
      return await this.request<any>(`/budgets${qs}`);
    } catch {
      try {
        const v1Url = `https://api.lunchmoney.dev/v1/budgets${qs}`;
        const headers = {
          ...this.getAuthHeader(),
        };
        const res = await fetch(v1Url, { headers });
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // ignore
      }
      return null;
    }
  }

  public async getManualAccounts(): Promise<LunchMoneyManualAccountsResponse> {
    return this.request<LunchMoneyManualAccountsResponse>('/manual_accounts');
  }

  public async getPlaidAccounts(): Promise<LunchMoneyPlaidAccountsResponse> {
    return this.request<LunchMoneyPlaidAccountsResponse>('/plaid_accounts');
  }

  public async getTags(): Promise<LunchMoneyTagsResponse> {
    const res = await this.request<any>('/tags');
    if (Array.isArray(res)) {
      return { tags: res };
    }
    if (res && Array.isArray(res.tags)) {
      return res;
    }
    return { tags: [] };
  }

  public async getRecurringExpenses(): Promise<LunchMoneyRecurringResponse> {
    return this.request<LunchMoneyRecurringResponse>('/recurring_expenses');
  }
}
