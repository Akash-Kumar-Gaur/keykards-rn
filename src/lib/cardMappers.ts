/**
 * Map Supabase card / benefit / milestone rows ↔ domain types.
 */

import { DEFAULT_CARD_THEME, isValidCardTheme } from '@/lib/cardThemes';
import type {
  BenefitCategory,
  CardBenefit,
  CardColorTheme,
  CardMilestone,
  CardNetwork,
  VaultCard,
} from '@/types/card';

export type CardRow = {
  id: string;
  user_id: string;
  nickname: string | null;
  bank_name: string | null;
  network: string | null;
  last_four: string | null;
  cardholder_name?: string | null;
  card_number_encrypted: string | null;
  card_number_iv: string | null;
  card_number_auth_tag: string | null;
  cvv_encrypted: string | null;
  cvv_iv: string | null;
  cvv_auth_tag: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  card_color_theme: string | null;
  annual_fee: number | string | null;
  fee_due_date: string | null;
  renewal_date_estimated: string | null;
  renewal_date_confirmed: string | null;
  card_opened_approx: string | null;
  needs_refresh?: boolean | null;
  created_at: string;
  updated_at: string;
};

export type BenefitRow = {
  id: string;
  card_id: string;
  title: string;
  category: string;
  description: string | null;
  value_estimate: number | string | null;
  created_at: string;
  updated_at: string;
};

export type MilestoneRow = {
  id: string;
  card_id: string;
  target_spend: number | string;
  current_spend: number | string;
  reward_description: string | null;
  period_start: string;
  period_end: string;
  cycle_started_at?: string | null;
  created_at: string;
  updated_at: string;
};

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapCardRow(row: CardRow): VaultCard {
  const holder = row.cardholder_name?.trim() || null;
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname ?? 'Card',
    bankName: row.bank_name ?? '',
    network: (row.network as CardNetwork) ?? 'Visa',
    lastFour: row.last_four ?? '0000',
    cardholderName: holder,
    cardNumberEncrypted: row.card_number_encrypted ?? '',
    cardNumberIv: row.card_number_iv ?? '',
    cardNumberAuthTag: row.card_number_auth_tag ?? '',
    cvvEncrypted: row.cvv_encrypted,
    cvvIv: row.cvv_iv,
    cvvAuthTag: row.cvv_auth_tag,
    expiryMonth: row.expiry_month ?? 1,
    expiryYear: row.expiry_year ?? new Date().getFullYear(),
    cardColorTheme:
      row.card_color_theme && isValidCardTheme(row.card_color_theme)
        ? row.card_color_theme
        : DEFAULT_CARD_THEME,
    annualFee: num(row.annual_fee),
    feeDueDate: row.fee_due_date,
    renewalDateEstimated: row.renewal_date_estimated,
    renewalDateConfirmed: row.renewal_date_confirmed,
    cardOpenedApprox: row.card_opened_approx,
    txnLinkBlocked: Boolean(row.needs_refresh),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBenefitRow(row: BenefitRow): CardBenefit {
  return {
    id: row.id,
    cardId: row.card_id,
    title: row.title,
    category: row.category as BenefitCategory,
    description: row.description ?? '',
    valueEstimate: num(row.value_estimate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMilestoneRow(row: MilestoneRow): CardMilestone {
  return {
    id: row.id,
    cardId: row.card_id,
    targetSpend: num(row.target_spend) ?? 0,
    currentSpend: num(row.current_spend) ?? 0,
    rewardDescription: row.reward_description ?? '',
    periodStart: row.period_start,
    periodEnd: row.period_end,
    cycleStartedAt: row.cycle_started_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const CARD_SELECT =
  'id, user_id, nickname, bank_name, network, last_four, cardholder_name, card_number_encrypted, card_number_iv, card_number_auth_tag, cvv_encrypted, cvv_iv, cvv_auth_tag, expiry_month, expiry_year, card_color_theme, annual_fee, fee_due_date, renewal_date_estimated, renewal_date_confirmed, card_opened_approx, needs_refresh, created_at, updated_at';
