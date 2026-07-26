/**
 * Shared transaction-parsing engine.
 * Adapters (Gmail / clipboard / OCR) only supply raw text — all extraction
 * happens here via bank rule definitions.
 */

import {
  BANK_PARSE_RULES,
  normalizeMerchant,
} from '@/lib/bankParserRules';
import type {
  ParseResult,
  ParsedTransaction,
  ParserMatchContext,
  SourceConfidence,
} from '@/types/track';

/** Cheap pre-filter before running full parse (clipboard foreground check). */
export function looksLikeTransaction(text: string): boolean {
  const t = text.trim();
  // Allow multi-snippet pastes (several SMS/emails concatenated).
  if (t.length < 20 || t.length > 16_000) return false;
  const hasCurrency = /(?:INR|Rs\.?|₹)/i.test(t);
  const hasDigits = /\d{2,}/.test(t);
  const hasTxnVerb =
    /spent|debited|credited|charged|paid|purchase|txn|transaction|points?/i.test(
      t,
    );
  return (hasCurrency || /points?/i.test(t)) && hasDigits && hasTxnVerb;
}

/**
 * Start of a bank alert / spend / points line — used to split concatenated
 * clipboard pastes that lack blank-line boundaries.
 */
const TXN_SEGMENT_START =
  /(?:(?:INR|Rs\.?|₹)\s*[\d,]+\.?\d*\s*(?:was\s+)?(?:has\s+been\s+)?(?:spent|debited|credited|charged|paid|used)|(?:spent|debited|charged|paid)\s+(?:INR|Rs\.?|₹)\s*[\d,]+\.?\d*|(?:\d[\d,]*)\s*(?:reward\s+)?points?\s+(?:have\s+been\s+)?(?:credited|earned))/gi;

function findTxnStartIndices(block: string): number[] {
  const indices: number[] = [];
  const re = new RegExp(TXN_SEGMENT_START.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    // Avoid tiny overlaps / same-start duplicates
    if (indices.length === 0 || m.index > indices[indices.length - 1] + 8) {
      indices.push(m.index);
    }
  }
  return indices;
}

/**
 * Split clipboard / paste content into candidate transaction segments BEFORE
 * per-bank extraction. Prefers blank-line boundaries; within a block, splits
 * on repeated currency+debit/credit (or points credit) pattern starts.
 */
export function splitIntoTransactionSegments(text: string): string[] {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return [];

  const blocks = trimmed
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const segments: string[] = [];

  for (const block of blocks.length > 0 ? blocks : [trimmed]) {
    const starts = findTxnStartIndices(block);
    if (starts.length <= 1) {
      segments.push(block);
      continue;
    }
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i];
      const end = i + 1 < starts.length ? starts[i + 1] : block.length;
      // Include any preamble before the first match with the first segment.
      const sliceStart = i === 0 ? 0 : start;
      const seg = block.slice(sliceStart, end).trim();
      if (seg.length >= 12) segments.push(seg);
    }
  }

  return segments.length > 0 ? segments : [trimmed];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function scoreConfidence(
  parsed: Omit<ParsedTransaction, 'sourceConfidence'>,
  _ctx: ParserMatchContext,
  matchedCard: boolean,
): SourceConfidence {
  const hasSignal =
    parsed.amount > 0 ||
    (parsed.transactionType === 'points_credit' && (parsed.pointsAmount ?? 0) > 0);
  if (matchedCard && hasSignal && parsed.merchantRaw) return 'high';
  if (parsed.cardLastFour || (hasSignal && parsed.merchantRaw)) {
    return 'medium';
  }
  return 'low';
}

/**
 * Parse a single bank alert / SMS / email body into one structured transaction.
 * Never logs `text` (may contain account hints).
 */
export function parseTransactionText(
  text: string,
  ctx: ParserMatchContext = { cards: [] },
): ParseResult {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) {
    return { parsed: null, reason: 'empty' };
  }

  for (const rule of BANK_PARSE_RULES) {
    if (!rule.match.test(trimmed)) continue;
    const extracted = rule.extract(trimmed);
    if (!extracted) continue;

    const cardLastFour = extracted.cardLastFour;
    const matched = cardLastFour
      ? ctx.cards.find((c) => c.lastFour === cardLastFour)
      : undefined;

    const base: Omit<ParsedTransaction, 'sourceConfidence'> = {
      amount: extracted.amount,
      merchantRaw: extracted.merchantRaw || 'Unknown merchant',
      merchantNormalized: normalizeMerchant(extracted.merchantRaw || ''),
      cardLastFour,
      transactionDate: extracted.transactionDate ?? todayIso(),
      transactionType: extracted.transactionType,
      pointsAmount: extracted.pointsAmount ?? null,
      expiryDate: extracted.expiryDate ?? null,
      bankHint: rule.bankHint,
      matchedRuleId: rule.id,
    };

    // Prefer bank-hint card if last-four missing but only one card for that bank.
    let suggestedCardId = matched?.id ?? null;
    if (!suggestedCardId && base.bankHint && base.bankHint !== 'Unknown') {
      const bankCards = ctx.cards.filter((c) =>
        c.bankName.toLowerCase().includes(base.bankHint!.split(' ')[0].toLowerCase()),
      );
      if (bankCards.length === 1) suggestedCardId = bankCards[0].id;
    }

    const sourceConfidence = scoreConfidence(base, ctx, Boolean(matched));

    return {
      parsed: { ...base, sourceConfidence },
      suggestedCardId,
    };
  }

  return { parsed: null, reason: 'no_rule_matched' };
}

/**
 * Split clipboard/paste content into segments, then run per-bank rules on each
 * independently so confidence scores do not cross-contaminate.
 */
export function parseAllTransactions(
  text: string,
  ctx: ParserMatchContext = { cards: [] },
): ParseResult[] {
  const segments = splitIntoTransactionSegments(text);
  const out: ParseResult[] = [];
  for (const segment of segments) {
    const r = parseTransactionText(segment, ctx);
    if (r.parsed) out.push(r);
  }
  return out;
}

/** Truncate raw text kept for short-lived re-parse debugging (not long-term). */
export function truncateRawForStorage(text: string, max = 1500): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function rawTextExpiresAt(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function autoFinalizeAt(hours = 24): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}
