import { HumanCorrectionRecord } from './types';

class HumanCorrectionStore {
  // Map: key = `${clientId}:::${normalizedMerchantOrDesc}` -> record
  private corrections = new Map<string, HumanCorrectionRecord>();
  // List of all historical corrections
  private history: HumanCorrectionRecord[] = [];

  private normalizeKey(text: string): string {
    return text
      .toUpperCase()
      .trim()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, ' ');
  }

  public recordCorrection(params: Omit<HumanCorrectionRecord, 'id' | 'timestamp'>): HumanCorrectionRecord {
    const id = `corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: HumanCorrectionRecord = {
      ...params,
      id,
      timestamp: new Date().toISOString()
    };

    const clientPrefix = params.clientId || 'kassio-pf';

    if (params.merchant) {
      const merchantKey = `${clientPrefix}:::M:::${this.normalizeKey(params.merchant)}`;
      this.corrections.set(merchantKey, record);
    }

    if (params.originalDescription) {
      const descKey = `${clientPrefix}:::D:::${this.normalizeKey(params.originalDescription)}`;
      this.corrections.set(descKey, record);
    }

    this.history.unshift(record);
    if (this.history.length > 2000) {
      this.history.pop();
    }

    return record;
  }

  public findCorrectionForTransaction(
    clientId: string,
    merchant?: string,
    description?: string
  ): HumanCorrectionRecord | null {
    const clientPrefix = clientId || 'kassio-pf';

    // 1. Try exact merchant match
    if (merchant) {
      const merchantKey = `${clientPrefix}:::M:::${this.normalizeKey(merchant)}`;
      const match = this.corrections.get(merchantKey);
      if (match) return match;
    }

    // 2. Try description match
    if (description) {
      const descKey = `${clientPrefix}:::D:::${this.normalizeKey(description)}`;
      const match = this.corrections.get(descKey);
      if (match) return match;

      // Also try finding if description contains normalized merchant key in corrections
      const normalizedDesc = this.normalizeKey(description);
      for (const [key, record] of this.corrections.entries()) {
        if (key.startsWith(`${clientPrefix}:::M:::`)) {
          const mKey = key.replace(`${clientPrefix}:::M:::`, '');
          if (mKey.length > 3 && normalizedDesc.includes(mKey)) {
            return record;
          }
        }
      }
    }

    return null;
  }

  public getClientCorrections(clientId: string): HumanCorrectionRecord[] {
    return this.history.filter(h => h.clientId === clientId);
  }
}

export const humanCorrectionStore = new HumanCorrectionStore();
