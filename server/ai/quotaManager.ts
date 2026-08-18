/**
 * AIQuotaManager
 * 
 * Centralized rate limit, concurrency control, exponential backoff,
 * and circuit breaker for Gemini AI & Google Search Grounding calls.
 * 
 * Prevents 429 RESOURCE_EXHAUSTED cascading failures and provides instant deterministic
 * fallbacks when quota limits are reached so banking sync, dashboard calculations,
 * and deterministic categorization are never blocked or broken.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class AIQuotaManager {
  private static instance: AIQuotaManager;

  private state: CircuitState = 'CLOSED';
  private cooldownUntil: number = 0;
  private defaultCooldownMs: number = 60000; // 60 seconds cooldown on 429
  private totalThrottledCount: number = 0;
  private totalSuccessCount: number = 0;
  private activeExecutions: number = 0;
  private maxConcurrency: number = 1; // Strict serial/low-concurrency to respect RPM limits
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue: boolean = false;
  private lastCallTimestamp: number = 0;
  private minSpacingMs: number = 250; // Minimum interval between successive requests

  private constructor() {}

  public static getInstance(): AIQuotaManager {
    if (!AIQuotaManager.instance) {
      AIQuotaManager.instance = new AIQuotaManager();
    }
    return AIQuotaManager.instance;
  }

  public isAvailable(): boolean {
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now >= this.cooldownUntil) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true;
  }

  public getCooldownRemainingSeconds(): number {
    const remaining = this.cooldownUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  public recordQuotaExceeded(retryAfterSeconds?: number, errorDetail?: string) {
    const delayMs = (retryAfterSeconds && retryAfterSeconds > 0)
      ? retryAfterSeconds * 1000
      : this.defaultCooldownMs;

    this.state = 'OPEN';
    this.cooldownUntil = Date.now() + delayMs;
    this.totalThrottledCount++;

    console.warn(`[AIQuotaManager] Circuit breaker ABERTO (429/RESOURCE_EXHAUSTED). Entrando em cooldown por ${Math.round(delayMs / 1000)}s. Motivo: ${errorDetail || 'Quota exceeded'}`);
  }

  public recordSuccess() {
    this.totalSuccessCount++;
    if (this.state === 'HALF_OPEN') {
      console.log('[AIQuotaManager] Probe bem-sucedida. Circuit breaker FECHADO (operações normais restabelecidas).');
      this.state = 'CLOSED';
    }
  }

  public resetCooldown() {
    this.state = 'CLOSED';
    this.cooldownUntil = 0;
  }

  /**
   * Enqueues a task and executes it with concurrency limits, spacing, backoff, and circuit-breaker.
   * If circuit is OPEN or quota fails, executes the provided fallback immediately.
   */
  public async executeWithQuotaControl<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T> | T,
    options: { maxRetries?: number; taskName?: string } = {}
  ): Promise<T> {
    const { maxRetries = 2, taskName = 'AI Task' } = options;

    if (!this.isAvailable()) {
      console.warn(`[AIQuotaManager] ${taskName}: Circuit breaker aberto (cooldown: ${this.getCooldownRemainingSeconds()}s). Executando fallback determinístico instantâneo.`);
      return await fallback();
    }

    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try {
          // Ensure minimum spacing
          const now = Date.now();
          const elapsed = now - this.lastCallTimestamp;
          if (elapsed < this.minSpacingMs) {
            await new Promise(r => setTimeout(r, this.minSpacingMs - elapsed));
          }

          let attempt = 0;
          let lastError: any = null;

          while (attempt <= maxRetries) {
            attempt++;
            try {
              if (!this.isAvailable()) {
                console.warn(`[AIQuotaManager] ${taskName}: Cooldown ativo durante tentativa ${attempt}. Usando fallback.`);
                const fallbackRes = await fallback();
                resolve(fallbackRes);
                return;
              }

              this.lastCallTimestamp = Date.now();
              const result = await fn();
              this.recordSuccess();
              resolve(result);
              return;
            } catch (err: any) {
              lastError = err;
              const status = err?.status || err?.code || (err?.message?.includes('429') ? 429 : 0);
              const isQuota = status === 429 ||
                err?.message?.includes('RESOURCE_EXHAUSTED') ||
                err?.message?.includes('quota') ||
                err?.message?.includes('rate limit');

              if (isQuota) {
                // Extract retry-after if present
                let retrySec = 45;
                if (err?.message) {
                  const match = err.message.match(/retry in (\d+(?:\.\d+)?)s/i);
                  if (match) retrySec = Math.ceil(parseFloat(match[1]));
                }
                this.recordQuotaExceeded(retrySec, err?.message);
                console.warn(`[AIQuotaManager] ${taskName} falhou com 429 Quota Exceeded. Executando fallback.`);
                const fallbackRes = await fallback();
                resolve(fallbackRes);
                return;
              }

              const isTransient = status === 500 || status === 502 || status === 503 || status === 504 ||
                err?.message?.includes('UNAVAILABLE') ||
                err?.message?.includes('high demand');

              if (isTransient && attempt <= maxRetries) {
                const backoffDelay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 300;
                console.warn(`[AIQuotaManager] ${taskName} transitório (${status}). Tentativa ${attempt} falhou. Aguardando ${Math.round(backoffDelay)}ms...`);
                await new Promise(r => setTimeout(r, backoffDelay));
                continue;
              }

              // Non-recoverable error
              break;
            }
          }

          // If all attempts failed with non-quota error, use fallback if possible
          console.warn(`[AIQuotaManager] ${taskName} falhou após ${attempt} tentativas. Recorrendo ao fallback determinístico. Erro:`, lastError?.message || lastError);
          const fallbackRes = await fallback();
          resolve(fallbackRes);
        } catch (fatalErr) {
          reject(fatalErr);
        } finally {
          this.activeExecutions--;
          this.processNextInQueue();
        }
      };

      this.requestQueue.push(task);
      this.processNextInQueue();
    });
  }

  private processNextInQueue() {
    if (this.activeExecutions < this.maxConcurrency && this.requestQueue.length > 0) {
      this.activeExecutions++;
      const nextTask = this.requestQueue.shift();
      if (nextTask) {
        nextTask().catch(err => console.error('[AIQuotaManager] Erro na fila:', err));
      }
    }
  }

  public getStatus() {
    return {
      state: this.state,
      isAvailable: this.isAvailable(),
      cooldownRemainingSeconds: this.getCooldownRemainingSeconds(),
      activeExecutions: this.activeExecutions,
      queueLength: this.requestQueue.length,
      totalSuccess: this.totalSuccessCount,
      totalThrottled: this.totalThrottledCount
    };
  }
}

export const aiQuotaManager = AIQuotaManager.getInstance();
