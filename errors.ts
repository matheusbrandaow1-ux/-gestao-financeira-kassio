export class LunchMoneyError extends Error {
  public statusCode?: number;
  public code: string;
  public details?: any;

  constructor(message: string, code = 'LUNCH_MONEY_ERROR', statusCode?: number, details?: any) {
    super(message);
    this.name = 'LunchMoneyError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, LunchMoneyError.prototype);
  }
}

export class LunchMoneyAuthError extends LunchMoneyError {
  constructor(message = 'Credencial da API Lunch Money inválida ou não configurada.') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'LunchMoneyAuthError';
  }
}

export class LunchMoneyRateLimitError extends LunchMoneyError {
  constructor(message = 'Limite de requisições excedido na API Lunch Money. Tente novamente em alguns segundos.') {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'LunchMoneyRateLimitError';
  }
}

export class LunchMoneyNetworkError extends LunchMoneyError {
  constructor(message = 'Não foi possível conectar ao serviço Lunch Money. Verifique a conexão.') {
    super(message, 'NETWORK_ERROR', 503);
    this.name = 'LunchMoneyNetworkError';
  }
}

export class LunchMoneySyncError extends LunchMoneyError {
  constructor(message: string, details?: any) {
    super(message, 'SYNC_ERROR', 500, details);
    this.name = 'LunchMoneySyncError';
  }
}
