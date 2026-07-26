/**
 * Track / transaction domain types — mirrors Phase 3 Supabase tables.
 */

export const TRANSACTION_SOURCES = [
  'gmail',
  'clipboard',
  'ocr',
  'manual',
  'statement_pdf',
] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const SOURCE_CONFIDENCE = ['high', 'medium', 'low'] as const;
export type SourceConfidence = (typeof SOURCE_CONFIDENCE)[number];

export const TRANSACTION_STATUSES = ['pending', 'confirmed', 'dismissed'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_LINK_STATUSES = [
  'linked',
  'unmatched',
  'pending_sync',
] as const;
export type TransactionLinkStatus = (typeof TRANSACTION_LINK_STATUSES)[number];

export type CardHint = {
  last_four?: string | null;
  bank_name_guess?: string | null;
};

export const TRANSACTION_TYPES = [
  'debit',
  'credit',
  'points_credit',
  'points_expiry_notice',
  'annual_fee_debit',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const EXPIRY_DATE_SOURCES = ['parsed_email', 'estimated_policy'] as const;
export type ExpiryDateSource = (typeof EXPIRY_DATE_SOURCES)[number];

export interface ParsedTransaction {
  amount: number;
  merchantRaw: string;
  merchantNormalized: string | null;
  cardLastFour: string | null;
  transactionDate: string; // YYYY-MM-DD
  transactionType: TransactionType;
  pointsAmount?: number | null;
  expiryDate?: string | null;
  bankHint?: string | null;
  sourceConfidence: SourceConfidence;
  matchedRuleId: string | null;
}

export interface VaultTransaction {
  id: string;
  userId: string;
  cardId: string | null;
  amount: number;
  merchantRaw: string;
  merchantNormalized: string | null;
  transactionDate: string;
  source: TransactionSource;
  sourceConfidence: SourceConfidence;
  status: TransactionStatus;
  transactionType: TransactionType;
  pointsAmount: number | null;
  pointsExpiryDate: string | null;
  rawText: string | null;
  rawTextExpiresAt: string | null;
  autoFinalizeAt: string | null;
  linkStatus: TransactionLinkStatus;
  cardHint: CardHint | null;
  /** From statement MCC / LLM; null when only derived client-side. */
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PointsLedgerEntry {
  id: string;
  userId: string;
  cardId: string;
  pointsAmount: number;
  earnDate: string;
  expiryDate: string | null;
  expiryDateSource: ExpiryDateSource | null;
  source: TransactionSource;
  createdAt: string;
}

export interface CatalogPolicyFields {
  milestoneThreshold: number | null;
  milestonePeriodMonths: number | null;
  milestoneRewardDescription: string | null;
  feeWaiverSpendThreshold: number | null;
  pointsExpiryPolicyMonths: number | null;
}

/** Match context passed into the parser for confidence scoring. */
export interface ParserMatchContext {
  cards: Array<{ id: string; lastFour: string; bankName: string }>;
}

export interface ParseResult {
  parsed: ParsedTransaction | null;
  /** Why parse failed or confidence was lowered (never log raw PAN). */
  reason?: string;
  /** Suggested vault card id when last-four matched. */
  suggestedCardId?: string | null;
}

/** Derived Track views (computed, not stored). */
export interface MilestoneProgress {
  cardId: string;
  cardNickname: string;
  bankName: string;
  spent: number;
  threshold: number;
  remaining: number;
  periodMonths: number;
  rewardDescription: string;
  progress: number;
  source: 'catalog_policy' | 'manual_milestone';
}

export interface FeePaybackStatus {
  cardId: string;
  cardNickname: string;
  bankName: string;
  annualFee: number;
  benefitValueSum: number;
  paybackRatio: number;
  periodSpend: number;
  waiverThreshold: number | null;
  likelyWaiver: boolean;
  advisoryCopy: string;
}

export interface PointsExpiryItem {
  id: string;
  cardId: string;
  cardNickname: string;
  bankName: string;
  pointsAmount: number;
  expiryDate: string;
  daysUntil: number;
  isEstimated: boolean;
  label: string;
}

export interface RenewalStatus {
  cardId: string;
  cardNickname: string;
  bankName: string;
  renewalDate: string;
  isConfirmed: boolean;
  daysUntil: number | null;
}

export interface TrackSnapshot {
  milestones: MilestoneProgress[];
  feePayback: FeePaybackStatus[];
  pointsExpiring: PointsExpiryItem[];
  renewals: RenewalStatus[];
  pendingCount: number;
  gmailConnected: boolean;
}
