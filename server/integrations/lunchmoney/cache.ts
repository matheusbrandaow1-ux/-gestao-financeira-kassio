import { LunchMoneyAccount, LunchMoneyCategory, LunchMoneyTag } from './types';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

export class LunchMoneyCache {
  private static instance: LunchMoneyCache;
  private accountsCache: Map<string, CacheEntry<LunchMoneyAccount[]>> = new Map();
  private categoriesCache: Map<string, CacheEntry<LunchMoneyCategory[]>> = new Map();
  private tagsCache: Map<string, CacheEntry<LunchMoneyTag[]>> = new Map();
  private categoryMap: Map<string, Map<number, LunchMoneyCategory>> = new Map();
  private accountMap: Map<string, Map<number, LunchMoneyAccount>> = new Map();
  private tagMap: Map<string, Map<number, LunchMoneyTag>> = new Map();
  private TTL_MS = 10 * 60 * 1000; // 10 minutes cache

  private constructor() {}

  public static getInstance(): LunchMoneyCache {
    if (!LunchMoneyCache.instance) {
      LunchMoneyCache.instance = new LunchMoneyCache();
    }
    return LunchMoneyCache.instance;
  }

  public setAccounts(clientId: string, accounts: LunchMoneyAccount[]): void {
    this.accountsCache.set(clientId, { data: accounts, cachedAt: Date.now() });
    const accMap = new Map<number, LunchMoneyAccount>();
    accounts.forEach(a => accMap.set(a.id, a));
    this.accountMap.set(clientId, accMap);
  }

  public getAccounts(clientId: string): LunchMoneyAccount[] | null {
    const entry = this.accountsCache.get(clientId);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.TTL_MS) {
      return null;
    }
    return entry.data;
  }

  public getAccountById(clientId: string, id: number): LunchMoneyAccount | undefined {
    return this.accountMap.get(clientId)?.get(id);
  }

  public setCategories(clientId: string, categories: LunchMoneyCategory[]): void {
    this.categoriesCache.set(clientId, { data: categories, cachedAt: Date.now() });
    const catMap = new Map<number, LunchMoneyCategory>();
    
    const indexCategory = (cat: LunchMoneyCategory) => {
      catMap.set(cat.id, cat);
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach(indexCategory);
      }
    };
    
    categories.forEach(indexCategory);
    this.categoryMap.set(clientId, catMap);
  }

  public getCategories(clientId: string): LunchMoneyCategory[] | null {
    const entry = this.categoriesCache.get(clientId);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.TTL_MS) {
      return null;
    }
    return entry.data;
  }

  public getCategoryById(clientId: string, id: number): LunchMoneyCategory | undefined {
    return this.categoryMap.get(clientId)?.get(id);
  }

  public setTags(clientId: string, tags: LunchMoneyTag[]): void {
    this.tagsCache.set(clientId, { data: tags, cachedAt: Date.now() });
    const tMap = new Map<number, LunchMoneyTag>();
    tags.forEach(t => tMap.set(t.id, t));
    this.tagMap.set(clientId, tMap);
  }

  public getTags(clientId: string): LunchMoneyTag[] | null {
    const entry = this.tagsCache.get(clientId);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.TTL_MS) {
      return null;
    }
    return entry.data;
  }

  public getTagById(clientId: string, id: number): LunchMoneyTag | undefined {
    return this.tagMap.get(clientId)?.get(id);
  }

  public clear(clientId?: string): void {
    if (clientId) {
      this.accountsCache.delete(clientId);
      this.categoriesCache.delete(clientId);
      this.tagsCache.delete(clientId);
      this.categoryMap.delete(clientId);
      this.accountMap.delete(clientId);
      this.tagMap.delete(clientId);
    } else {
      this.accountsCache.clear();
      this.categoriesCache.clear();
      this.tagsCache.clear();
      this.categoryMap.clear();
      this.accountMap.clear();
      this.tagMap.clear();
    }
  }
}

export const lunchMoneyCache = LunchMoneyCache.getInstance();

