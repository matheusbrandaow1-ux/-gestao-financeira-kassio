import { AssignableCategoryInfo, GroundingSource, MerchantResearchMetadata } from '../types';

export interface ResearchMerchantParams {
  rawPayee: string;
  description?: string;
  amount?: number;
  currency?: string;
  accountName?: string;
  country?: string;
  city?: string;
  availableCategories: AssignableCategoryInfo[];
}

export interface MerchantResearchResult {
  rawPayee: string;
  normalizedMerchant: string;
  canonicalMerchant: string;
  legalName?: string;
  merchantType?: string;
  country?: string;
  city?: string;
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  suggestedSubcategoryName?: string;
  transactionType?: 'DESPESA' | 'RECEITA' | 'INVESTIMENTO' | 'TRANSFERENCIA' | 'OUTROS';
  confidence: number; // 0 - 100
  researchUsed: boolean;
  evidenceSummary: string;
  sourceUrls?: string[];
  reasoningShort: string;
  needsReview: boolean;
  isTransferOrPersonal?: boolean;
  groundingSources?: GroundingSource[];
  researchMetadata?: MerchantResearchMetadata;
}

export interface MerchantResearchProvider {
  name: string;
  isAvailable(): boolean;
  researchMerchant(params: ResearchMerchantParams): Promise<MerchantResearchResult>;
}
