/**
 * Merge statement line items with existing vault transactions:
 * match → backfill category; no match → insert as statement_pdf.
 */

import type { StatementCategory, StatementLineItem } from '@/lib/statementParse';
import type { VaultTransaction } from '@/types/track';

export type StatementMergeAction =
  | {
      kind: 'insert';
      line: StatementLineItem;
    }
  | {
      kind: 'backfill_category';
      line: StatementLineItem;
      existingId: string;
      previousCategory: string | null;
    }
  | {
      kind: 'skip_duplicate';
      line: StatementLineItem;
      existingId: string;
    };

function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function amountsMatch(a: number, b: number): boolean {
  // Statements sometimes round; allow 1 paise / floating noise.
  return Math.abs(a - b) < 0.02;
}

/**
 * Find the best existing debit for this card on the same date + amount.
 * Prefers rows still missing a category so we can backfill.
 */
export function findStatementOverlap(
  line: StatementLineItem,
  existing: VaultTransaction[],
  cardId: string,
  claimed: Set<string>,
): VaultTransaction | null {
  const candidates = existing.filter(
    (t) =>
      !claimed.has(t.id) &&
      t.cardId === cardId &&
      t.status !== 'dismissed' &&
      (t.transactionType === 'debit' || t.transactionType === 'annual_fee_debit') &&
      sameDay(t.transactionDate, line.date) &&
      amountsMatch(t.amount, line.amount),
  );
  if (candidates.length === 0) return null;
  return (
    candidates.find((t) => !t.category) ??
    candidates.find((t) => t.status === 'confirmed') ??
    candidates[0]
  );
}

export function planStatementMerge(args: {
  lines: StatementLineItem[];
  existing: VaultTransaction[];
  cardId: string;
}): StatementMergeAction[] {
  const claimed = new Set<string>();
  const actions: StatementMergeAction[] = [];

  for (const line of args.lines) {
    const match = findStatementOverlap(line, args.existing, args.cardId, claimed);
    if (!match) {
      actions.push({ kind: 'insert', line });
      continue;
    }
    claimed.add(match.id);
    if (!match.category && line.category) {
      actions.push({
        kind: 'backfill_category',
        line,
        existingId: match.id,
        previousCategory: match.category,
      });
    } else {
      actions.push({
        kind: 'skip_duplicate',
        line,
        existingId: match.id,
      });
    }
  }

  return actions;
}

export type CategoryBreakdown = Record<StatementCategory, number>;

export function emptyCategoryBreakdown(): CategoryBreakdown {
  return {
    lounge: 0,
    dining: 0,
    travel: 0,
    shopping: 0,
    fuel: 0,
    entertainment: 0,
    other: 0,
  };
}

export function buildCategoryBreakdown(
  lines: StatementLineItem[],
): CategoryBreakdown {
  const out = emptyCategoryBreakdown();
  for (const line of lines) {
    out[line.category] = (out[line.category] ?? 0) + line.amount;
  }
  return out;
}

export function pickNotableTransactions(
  lines: StatementLineItem[],
  limit = 5,
): StatementLineItem[] {
  return [...lines].sort((a, b) => b.amount - a.amount).slice(0, limit);
}

/**
 * Rough reward estimate from benefit prose: looks for "N% ... category" patterns
 * and applies the highest matching rate per line. Falls back to 1% on shopping
 * when nothing parses — advisory only.
 */
export function estimateRewardPoints(args: {
  lines: StatementLineItem[];
  benefitDescriptions: string[];
}): number {
  const rates: Partial<Record<StatementCategory, number>> = {};
  for (const desc of args.benefitDescriptions) {
    const lower = desc.toLowerCase();
    const pct = lower.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!pct) continue;
    const rate = Number(pct[1]) / 100;
    if (!Number.isFinite(rate) || rate <= 0) continue;

    const cats: StatementCategory[] = [];
    if (/amazon|flipkart|myntra|shop|online|retail/.test(lower)) cats.push('shopping');
    if (/dining|swiggy|zomato|restaurant|food/.test(lower)) cats.push('dining');
    if (/fuel|petrol/.test(lower)) cats.push('fuel');
    if (/travel|flight|hotel|uber|ola/.test(lower)) cats.push('travel');
    if (/lounge/.test(lower)) cats.push('lounge');
    if (/movie|entertainment|bookmyshow/.test(lower)) cats.push('entertainment');
    if (cats.length === 0 && /cashback|reward|edge|point/.test(lower)) {
      cats.push('other');
    }
    for (const c of cats) {
      rates[c] = Math.max(rates[c] ?? 0, rate);
    }
  }

  let points = 0;
  for (const line of args.lines) {
    const rate = rates[line.category] ?? rates.other ?? (line.category === 'shopping' ? 0.01 : 0);
    points += line.amount * rate;
  }
  return Math.round(points);
}
