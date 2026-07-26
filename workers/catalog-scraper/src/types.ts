export type LlmConfidence = 'high' | 'medium' | 'low';

export type LlmBenefitCategory =
  | 'lounge'
  | 'dining'
  | 'travel'
  | 'shopping'
  | 'milestone'
  | 'other'
  | 'fuel'
  | 'entertainment';

export type CatalogBenefitCategory =
  | 'lounge'
  | 'dining'
  | 'travel'
  | 'shopping'
  | 'fuel'
  | 'entertainment'
  | 'other';

export interface LlmBenefit {
  title: string;
  category: LlmBenefitCategory;
  description: string;
  value_estimate: number | null;
}

export interface LlmExtraction {
  card_name: string;
  bank_name: string;
  annual_fee: number | null;
  benefits: LlmBenefit[];
  confidence: LlmConfidence;
  network?: string;
  card_color_theme?: string;
}

export type ScrapeStatus =
  | 'success'
  | 'parse_failed'
  | 'fetch_failed'
  | 'low_confidence';

export interface FetchResult {
  text: string;
  url: string | null;
  usedPlaywright: boolean;
  charCount: number;
}

export interface RunOptions {
  limit?: number;
  dryRun?: boolean;
  sourceIds?: string[];
  force?: boolean;
  /** Prefer pending known_cards queue over hardcoded SOURCES. Default true when queue has work. */
  fromQueue?: boolean;
  /** Only use hardcoded SOURCES (ignore discovery queue). */
  legacyOnly?: boolean;
}

export interface CardRunResult {
  id: string;
  name: string;
  issuer: string;
  status: ScrapeStatus | 'skipped_manual' | 'dry_run';
  confidence: LlmConfidence | null;
  usedPlaywright: boolean;
  sourceUrl: string | null;
  error?: string;
}

export interface RunSummary {
  processed: number;
  success: number;
  lowConfidence: number;
  fetchFailed: number;
  parseFailed: number;
  skippedManual: number;
  skippedFresh: number;
  errors: string[];
  /** Per-source outcomes (useful for confirming new fintech additions). */
  results: CardRunResult[];
}
