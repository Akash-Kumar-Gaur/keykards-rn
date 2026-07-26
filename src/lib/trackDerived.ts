/**
 * Derived Track views from confirmed transactions + points_ledger + catalog policy.
 */

import { formatInr } from '@/lib/cardUtils';
import type {
  CatalogPolicyFields,
  FeePaybackStatus,
  MilestoneProgress,
  PointsExpiryItem,
  PointsLedgerEntry,
  RenewalStatus,
  VaultTransaction,
} from '@/types/track';

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z').getTime();
  const b = new Date(toIso + 'T00:00:00Z').getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Export for milestone reset cycle math. */
export function addMonthsToIsoDate(isoDate: string, months: number): string {
  return addMonths(isoDate, months);
}

export function todayIsoUtc(today = new Date()): string {
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

export function periodStartForMonths(periodMonths: number, today = new Date()): string {
  const d = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  d.setUTCMonth(d.getUTCMonth() - periodMonths);
  return d.toISOString().slice(0, 10);
}

export function sumSpendInPeriod(
  txns: VaultTransaction[],
  cardId: string,
  periodStart: string,
  /**
   * Timestamp the active cycle began (set by a reset). Transactions recorded
   * before it belong to the archived cycle, even when their transaction_date
   * still falls inside the new window — which is the common case for a reset
   * done on the same day the spend was logged.
   */
  cycleStartedAt?: string | null,
): number {
  const cutoff = cycleStartedAt ? Date.parse(cycleStartedAt) : NaN;
  const hasCutoff = Number.isFinite(cutoff);
  const afterCutoff = (t: VaultTransaction) => {
    if (!hasCutoff) return true;
    const recordedAt = Date.parse(t.createdAt);
    // Unknown record time — count it rather than silently hiding spend.
    return Number.isFinite(recordedAt) ? recordedAt >= cutoff : true;
  };
  return txns
    .filter(
      (t) =>
        t.status === 'confirmed' &&
        t.cardId === cardId &&
        (t.transactionType === 'debit' || t.transactionType === 'annual_fee_debit') &&
        t.transactionDate >= periodStart &&
        afterCutoff(t),
    )
    .reduce((s, t) => s + t.amount, 0);
}

export function computeMilestoneProgress(args: {
  cardId: string;
  cardNickname: string;
  bankName: string;
  policy: CatalogPolicyFields | null;
  manual?: {
    target: number;
    current: number;
    reward: string;
    periodMonths?: number;
    /** When set, spend window uses this cycle start (after manual/auto reset). */
    periodStart?: string;
    /** When set, spend recorded before this instant belongs to a closed cycle. */
    cycleStartedAt?: string | null;
  } | null;
  txns: VaultTransaction[];
}): MilestoneProgress | null {
  const { cardId, cardNickname, bankName, policy, manual, txns } = args;

  if (policy?.milestoneThreshold && policy.milestonePeriodMonths) {
    const periodMonths = policy.milestonePeriodMonths;
    const periodStart =
      manual?.periodStart ?? periodStartForMonths(periodMonths);
    const spent = sumSpendInPeriod(
      txns,
      cardId,
      periodStart,
      manual?.cycleStartedAt,
    );
    const threshold = policy.milestoneThreshold;
    const remaining = Math.max(0, threshold - spent);
    return {
      cardId,
      cardNickname,
      bankName,
      spent,
      threshold,
      remaining,
      periodMonths,
      rewardDescription:
        policy.milestoneRewardDescription ?? 'Milestone reward',
      progress: threshold > 0 ? Math.min(1, spent / threshold) : 0,
      source: 'catalog_policy',
    };
  }

  if (manual && manual.target > 0) {
    const periodStart =
      manual.periodStart ?? periodStartForMonths(manual.periodMonths ?? 12);
    // Prefer live txn sum in the active cycle; fall back to stored current_spend
    // when there are no matching debits (user-entered progress).
    const fromTxns = sumSpendInPeriod(
      txns,
      cardId,
      periodStart,
      manual.cycleStartedAt,
    );
    const spent = fromTxns > 0 ? fromTxns : manual.current;
    const threshold = manual.target;
    return {
      cardId,
      cardNickname,
      bankName,
      spent,
      threshold,
      remaining: Math.max(0, threshold - spent),
      periodMonths: manual.periodMonths ?? 12,
      rewardDescription: manual.reward || 'Milestone reward',
      progress: Math.min(1, spent / threshold),
      source: 'manual_milestone',
    };
  }

  return null;
}

export function computeFeePayback(args: {
  cardId: string;
  cardNickname: string;
  bankName: string;
  annualFee: number | null;
  benefitValueSum: number;
  waiverThreshold: number | null;
  periodSpend: number;
}): FeePaybackStatus | null {
  const {
    cardId,
    cardNickname,
    bankName,
    annualFee,
    benefitValueSum,
    waiverThreshold,
    periodSpend,
  } = args;
  if (annualFee == null || annualFee <= 0) return null;

  const paybackRatio = benefitValueSum / annualFee;
  const likelyWaiver =
    waiverThreshold != null && waiverThreshold > 0 && periodSpend >= waiverThreshold;

  // Potential value, not money back — benefit estimates are a ceiling and are
  // unrelated to spend, so avoid any "recovered" phrasing here.
  let advisoryCopy =
    paybackRatio >= 2
      ? `Listed benefits are estimated at about ${paybackRatio.toFixed(1)}× the annual fee if fully used.`
      : `Listed benefits are estimated at about ${Math.round(paybackRatio * 100)}% of the annual fee if fully used.`;
  if (likelyWaiver) {
    advisoryCopy = `You've likely qualified for a fee waiver based on your spend — confirm with ${bankName}. This is advisory, not a guarantee.`;
  } else if (waiverThreshold != null && waiverThreshold > 0) {
    const left = Math.max(0, waiverThreshold - periodSpend);
    advisoryCopy = `${formatInr(left)} more spend may help toward ${bankName}'s typical fee-waiver threshold — confirm with your bank.`;
  }

  return {
    cardId,
    cardNickname,
    bankName,
    annualFee,
    benefitValueSum,
    paybackRatio,
    periodSpend,
    waiverThreshold,
    likelyWaiver,
    advisoryCopy,
  };
}

export function computePointsExpiring(args: {
  entries: PointsLedgerEntry[];
  cards: Array<{
    id: string;
    nickname: string;
    bankName: string;
    policyMonths: number | null;
  }>;
  today?: string;
}): PointsExpiryItem[] {
  const today = args.today ?? new Date().toISOString().slice(0, 10);
  const byCard = new Map(args.cards.map((c) => [c.id, c]));
  const items: PointsExpiryItem[] = [];

  for (const e of args.entries) {
    if (e.pointsAmount <= 0) continue;
    const card = byCard.get(e.cardId);
    if (!card) continue;

    let expiryDate = e.expiryDate;
    let isEstimated = e.expiryDateSource === 'estimated_policy';

    if (!expiryDate && card.policyMonths) {
      expiryDate = addMonths(e.earnDate, card.policyMonths);
      isEstimated = true;
    }
    if (!expiryDate) continue;

    const daysUntil = daysBetween(today, expiryDate);
    if (daysUntil < -7) continue; // already expired (grace)

    items.push({
      id: e.id,
      cardId: e.cardId,
      cardNickname: card.nickname,
      bankName: card.bankName,
      pointsAmount: e.pointsAmount,
      expiryDate,
      daysUntil,
      isEstimated,
      label: isEstimated
        ? `Estimated — based on ${card.bankName}'s typical policy`
        : 'Confirmed from bank notice',
    });
  }

  return items.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function computeRenewals(args: {
  cards: Array<{
    id: string;
    nickname: string;
    bankName: string;
    renewalDateEstimated: string | null;
    renewalDateConfirmed: string | null;
  }>;
  today?: string;
}): RenewalStatus[] {
  const today = args.today ?? new Date().toISOString().slice(0, 10);
  const out: RenewalStatus[] = [];
  for (const c of args.cards) {
    const confirmed = c.renewalDateConfirmed;
    const estimated = c.renewalDateEstimated;
    const renewalDate = confirmed ?? estimated;
    if (!renewalDate) continue;
    out.push({
      cardId: c.id,
      cardNickname: c.nickname,
      bankName: c.bankName,
      renewalDate,
      isConfirmed: Boolean(confirmed),
      daysUntil: daysBetween(today, renewalDate),
    });
  }
  return out.sort((a, b) => (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999));
}

/** Rough "Jun 2023" / "2023-06" / "06/2023" → estimated renewal (+1 year). */
export function estimateRenewalFromOpenedApprox(approx: string): string | null {
  const t = approx.trim();
  if (!t) return null;

  let y: number | null = null;
  let m: number | null = null;

  const iso = t.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
  }

  const slash = t.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (!y && slash) {
    m = Number(slash[1]);
    y = Number(slash[2]);
  }

  const named = t.match(
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-]+(\d{4})$/i,
  );
  if (!y && named) {
    const months: Record<string, number> = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };
    m = months[named[1].slice(0, 3).toLowerCase()] ?? null;
    y = Number(named[2]);
  }

  const yearOnly = t.match(/^(\d{4})$/);
  if (!y && yearOnly) {
    y = Number(yearOnly[1]);
    m = 1;
  }

  if (!y || !m || m < 1 || m > 12) return null;
  // Anniversary next cycle from opened month: opened + 1 year
  const renewal = new Date(Date.UTC(y + 1, m - 1, 1));
  return renewal.toISOString().slice(0, 10);
}
