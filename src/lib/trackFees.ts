/**
 * Annual fee totals for Track — only real card.annualFee / feeDueDate values.
 */

import type { VaultCard } from '@/types/card';

function daysUntilFee(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

/** Sum of positive annual fees across the vault. */
export function totalAnnualFees(cards: VaultCard[]): number {
  return cards.reduce((sum, c) => {
    const fee = c.annualFee;
    return sum + (fee != null && fee > 0 ? fee : 0);
  }, 0);
}

/**
 * Sum of annualFee for cards whose fee_due_date is approaching
 * (overdue ≤7 days or due within `withinDays`). Traceable to card rows only.
 */
export function annualFeesDueSoon(
  cards: VaultCard[],
  withinDays = 60,
): number {
  return cards.reduce((sum, c) => {
    const fee = c.annualFee;
    if (fee == null || fee <= 0) return sum;
    const days = daysUntilFee(c.feeDueDate);
    if (days == null) return sum;
    if (days >= -7 && days <= withinDays) return sum + fee;
    return sum;
  }, 0);
}
