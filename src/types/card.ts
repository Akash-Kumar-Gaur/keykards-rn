/**
 * Vault card domain types — mirrors Supabase cards / benefits / milestones.
 * Ciphertext fields never hold plaintext PAN/CVV.
 */

export const CARD_NETWORKS = [
  'Visa',
  'Mastercard',
  'RuPay',
  'Amex',
  'Diners',
] as const;

export type CardNetwork = (typeof CARD_NETWORKS)[number];

export const CARD_COLOR_THEMES = [
  // Generics
  'generic-violet',
  'generic-slate',
  'generic-emerald',
  // Legacy (existing saved cards)
  'indigo',
  'midnight',
  'obsidian',
  'slate',
  'emerald',
  'amber',
  // Bank-inspired
  'hdfc-maroon',
  'sbi-indigo',
  'axis-burgundy',
  'icici-amber',
  'kotak-crimson',
  'idfc-copper',
  'amex-gunmetal',
  'diners-navy',
] as const;

export type CardColorTheme = (typeof CARD_COLOR_THEMES)[number];

export const BENEFIT_CATEGORIES = [
  'lounge',
  'dining',
  'travel',
  'shopping',
  'fuel',
  'entertainment',
  'other',
] as const;

export type BenefitCategory = (typeof BENEFIT_CATEGORIES)[number];

export interface VaultCard {
  id: string;
  userId: string;
  nickname: string;
  bankName: string;
  network: CardNetwork;
  lastFour: string;
  /** Optional name printed on the card — null means omit from UI. */
  cardholderName: string | null;
  cardNumberEncrypted: string;
  cardNumberIv: string;
  cardNumberAuthTag: string;
  cvvEncrypted: string | null;
  cvvIv: string | null;
  cvvAuthTag: string | null;
  expiryMonth: number;
  expiryYear: number;
  cardColorTheme: CardColorTheme;
  annualFee: number | null;
  feeDueDate: string | null;
  renewalDateEstimated: string | null;
  renewalDateConfirmed: string | null;
  cardOpenedApprox: string | null;
  /**
   * True when ciphertext can't be decrypted with the current device key, so
   * transaction↔card linking must stay `pending_sync` until the user re-enters
   * the PAN in Edit. Never gates Vault visibility or biometric reveal —
   * those always use the local ciphertext + SecureStore key.
   * (DB column: `needs_refresh`.)
   */
  txnLinkBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CardBenefit {
  id: string;
  cardId: string;
  title: string;
  category: BenefitCategory;
  description: string;
  valueEstimate: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CardMilestone {
  id: string;
  cardId: string;
  targetSpend: number;
  currentSpend: number;
  rewardDescription: string;
  periodStart: string;
  periodEnd: string;
  /** Instant the active cycle began; spend recorded earlier is archived. */
  cycleStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Form payload before client-side encryption (plaintext never leaves the device). */
export interface CardFormInput {
  nickname: string;
  bankName: string;
  network: CardNetwork;
  /** Optional printed name on card — empty string clears / stores null. */
  cardholderName: string;
  /** Digits only. Empty on edit = keep existing ciphertext. */
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  storeCvv: boolean;
  /** Digits only. Empty + storeCvv false clears CVV; empty + keep = no change on edit. */
  cvv: string;
  cardColorTheme: CardColorTheme;
  annualFee: number | null;
  feeDueDate: string | null;
  /** Rough opened month/year from user (e.g. "2023-06" or "Jun 2023"). */
  cardOpenedApprox: string | null;
  /** Catalog-autofilled benefits to insert after create (editable drafts). */
  draftBenefits?: BenefitFormInput[];
}

export interface CatalogBenefitSeed {
  title: string;
  category: BenefitCategory;
  description: string;
  value_estimate: number | null;
}

export interface CardCatalogEntry {
  id: string;
  bankName: string;
  cardName: string;
  network: CardNetwork;
  defaultBenefits: CatalogBenefitSeed[];
  defaultAnnualFee: number | null;
  /** @deprecated Prefer defaultColorTheme; kept for older rows/clients. */
  cardColorTheme: CardColorTheme;
  /** Suggested preset for Add Card when this catalog entry is selected. */
  defaultColorTheme: CardColorTheme;
  source?: 'auto' | 'manual' | 'needs_review';
  lastVerifiedAt?: string | null;
  rawSourceUrl?: string | null;
}

export interface BenefitFormInput {
  title: string;
  category: BenefitCategory;
  description: string;
  valueEstimate: number | null;
}

export interface MilestoneFormInput {
  targetSpend: number;
  currentSpend: number;
  rewardDescription: string;
  periodStart: string;
  periodEnd: string;
}

export function hasStoredCvv(card: VaultCard): boolean {
  return Boolean(card.cvvEncrypted && card.cvvIv && card.cvvAuthTag);
}
