/**
 * Resolve card_catalog policy for a user's card.
 *
 * Milestone programs are per-card, not per-bank. Matching on bank alone made
 * every card of a bank inherit whichever catalog row happened to come back
 * first, so cards with no milestone program (e.g. Axis Neo) still showed a
 * fabricated target and counted as "in progress". A bank-level match now only
 * supplies the genuinely bank-wide fields and never invents a milestone.
 */

import type { CatalogPolicyFields } from '@/types/track';

export type CatalogPolicyRow = {
  bank_name: string;
  card_name?: string | null;
  milestone_threshold?: number | string | null;
  milestone_period_months?: number | null;
  milestone_reward_description?: string | null;
  fee_waiver_spend_threshold?: number | string | null;
  points_expiry_policy_months?: number | null;
};

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** "Axis Flipkart Credit Card" → "axis flipkart" (nicknames vary in punctuation). */
function normalizeCardName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(credit|debit)\b/g, '')
    .replace(/\bcards?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function banksMatch(rowBank: string, bankName: string): boolean {
  const a = rowBank.trim().toLowerCase();
  const b = bankName.trim().toLowerCase();
  if (a === b) return true;
  const firstWord = a.split(' ')[0];
  return Boolean(firstWord) && b.includes(firstWord);
}

function fullPolicy(row: CatalogPolicyRow): CatalogPolicyFields {
  return {
    milestoneThreshold: num(row.milestone_threshold),
    milestonePeriodMonths: row.milestone_period_months ?? null,
    milestoneRewardDescription: row.milestone_reward_description ?? null,
    feeWaiverSpendThreshold: num(row.fee_waiver_spend_threshold),
    pointsExpiryPolicyMonths: row.points_expiry_policy_months ?? null,
  };
}

/** Bank-wide fields only — milestone target is deliberately withheld. */
function bankOnlyPolicy(row: CatalogPolicyRow): CatalogPolicyFields {
  return {
    milestoneThreshold: null,
    milestonePeriodMonths: null,
    milestoneRewardDescription: null,
    feeWaiverSpendThreshold: num(row.fee_waiver_spend_threshold),
    pointsExpiryPolicyMonths: row.points_expiry_policy_months ?? null,
  };
}

export function resolveCatalogPolicy(args: {
  rows: CatalogPolicyRow[];
  bankName: string;
  /** The user's card nickname, compared against catalog card_name. */
  cardName?: string | null;
}): CatalogPolicyFields | null {
  const { rows, bankName, cardName } = args;
  if (rows.length === 0) return null;

  const sameBank = rows.filter((r) => banksMatch(r.bank_name, bankName));
  const wanted = cardName ? normalizeCardName(cardName) : '';

  if (wanted) {
    const byName = (pool: CatalogPolicyRow[]) =>
      pool.find((r) => {
        const candidate = normalizeCardName(r.card_name ?? '');
        if (!candidate) return false;
        return (
          candidate === wanted ||
          candidate.includes(wanted) ||
          wanted.includes(candidate)
        );
      });

    const match = byName(sameBank) ?? byName(rows);
    if (match) return fullPolicy(match);
  }

  const bankRow = sameBank[0];
  return bankRow ? bankOnlyPolicy(bankRow) : null;
}
