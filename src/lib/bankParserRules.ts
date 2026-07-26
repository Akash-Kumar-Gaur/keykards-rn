/**
 * Per-bank regex rules for the shared transaction parser.
 * Start with banks common in Vault (HDFC, SBI Card, Axis, ICICI).
 */

import type { TransactionType } from '@/types/track';

export interface BankParseRule {
  id: string;
  bankHint: string;
  /** Case-insensitive test that the message belongs to this bank/rule set. */
  match: RegExp;
  /** Extract groups — implement extract() for flexibility. */
  extract: (text: string) => BankRuleExtract | null;
}

export interface BankRuleExtract {
  amount: number;
  merchantRaw: string;
  cardLastFour: string | null;
  transactionDate: string | null; // YYYY-MM-DD if parsed
  transactionType: TransactionType;
  pointsAmount?: number | null;
  expiryDate?: string | null;
}

function parseInrAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/\s/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD */
function parseIndianDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  const d = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  let y = m[3];
  if (y.length === 2) y = `20${y}`;
  return `${y}-${mo}-${d}`;
}

function lastFourFrom(text: string): string | null {
  const m =
    text.match(
      /(?:card|xx|ending|a\/c|account)[^\d]{0,12}(?:xx+|X+|\*{2,})?(\d{4})\b/i,
    ) ?? text.match(/\b(?:xx|XX|\*{2,})(\d{4})\b/);
  return m?.[1] ?? null;
}

function merchantAfter(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ').slice(0, 120);
  }
  return 'Unknown merchant';
}

const HDFC_DEBIT: BankParseRule = {
  id: 'hdfc-debit-v1',
  bankHint: 'HDFC Bank',
  match: /hdfc/i,
  extract: (text) => {
    if (!/hdfc/i.test(text)) return null;
    const fee =
      /annual\s+(?:membership\s+)?fee|membership\s+fee|renewal\s+fee/i.test(text);
    const amtM =
      text.match(
        /(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)\s*(?:was\s+)?(?:spent|debited|paid|charged)/i,
      ) ??
      text.match(
        /(?:spent|debited|paid|charged)\s+(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)/i,
      );
    if (!amtM) return null;
    const amount = parseInrAmount(amtM[1]);
    if (amount == null) return null;
    const merchant = merchantAfter(text, [
      /(?:at|to|towards)\s+([A-Za-z0-9 &.'\-]{2,60})(?:\s+on\s+|\s+using|\s*\.|$)/i,
      /Info:\s*([^\n.]+)/i,
    ]);
    const dateM = text.match(/on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    return {
      amount,
      merchantRaw: fee ? 'Annual fee' : merchant,
      cardLastFour: lastFourFrom(text),
      transactionDate: dateM ? parseIndianDate(dateM[1]) : null,
      transactionType: fee ? 'annual_fee_debit' : 'debit',
    };
  },
};

const HDFC_POINTS: BankParseRule = {
  id: 'hdfc-points-v1',
  bankHint: 'HDFC Bank',
  match: /hdfc/i,
  extract: (text) => {
    if (!/hdfc/i.test(text)) return null;
    const pts = text.match(
      /(\d[\d,]*)\s*(?:reward\s+)?points?\s+(?:have\s+been\s+)?(?:credited|earned)/i,
    );
    if (!pts) return null;
    const pointsAmount = Number(pts[1].replace(/,/g, ''));
    if (!Number.isFinite(pointsAmount) || pointsAmount <= 0) return null;
    const exp = text.match(
      /expir(?:e|y|ing)\s+(?:on\s+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    );
    return {
      amount: 0,
      merchantRaw: 'Reward points credit',
      cardLastFour: lastFourFrom(text),
      transactionDate: null,
      transactionType: 'points_credit',
      pointsAmount,
      expiryDate: exp ? parseIndianDate(exp[1]) : null,
    };
  },
};

const SBI_DEBIT: BankParseRule = {
  id: 'sbi-debit-v1',
  bankHint: 'SBI Card',
  match: /sbi\s*card|sbicard/i,
  extract: (text) => {
    if (!/sbi\s*card|sbicard/i.test(text)) return null;
    const fee = /annual\s+fee|membership\s+fee/i.test(text);
    const amtM =
      text.match(
        /(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)\s*(?:spent|debited|charged)/i,
      ) ??
      text.match(
        /(?:spent|debited|charged)\s+(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)/i,
      );
    if (!amtM) return null;
    const amount = parseInrAmount(amtM[1]);
    if (amount == null) return null;
    const merchant = merchantAfter(text, [
      /(?:at|towards)\s+([A-Za-z0-9 &.'\-]{2,60})(?:\s+on\s+|\.|$)/i,
    ]);
    const dateM = text.match(/on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    return {
      amount,
      merchantRaw: fee ? 'Annual fee' : merchant,
      cardLastFour: lastFourFrom(text),
      transactionDate: dateM ? parseIndianDate(dateM[1]) : null,
      transactionType: fee ? 'annual_fee_debit' : 'debit',
    };
  },
};

const AXIS_DEBIT: BankParseRule = {
  id: 'axis-debit-v1',
  bankHint: 'Axis Bank',
  match: /axis\s*bank|axisbank/i,
  extract: (text) => {
    if (!/axis\s*bank|axisbank/i.test(text)) return null;
    const fee = /annual\s+fee|membership\s+fee/i.test(text);
    const amtM =
      text.match(
        /(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)\s*(?:has\s+been\s+)?(?:spent|debited|used)/i,
      ) ??
      text.match(
        /(?:spent|debited|used)\s+(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)/i,
      );
    if (!amtM) return null;
    const amount = parseInrAmount(amtM[1]);
    if (amount == null) return null;
    const merchant = merchantAfter(text, [
      /(?:at|on)\s+([A-Za-z0-9 &.'\-]{2,60})(?:\s+on\s+\d|\.|$)/i,
    ]);
    const dateM = text.match(/on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    return {
      amount,
      merchantRaw: fee ? 'Annual fee' : merchant,
      cardLastFour: lastFourFrom(text),
      transactionDate: dateM ? parseIndianDate(dateM[1]) : null,
      transactionType: fee ? 'annual_fee_debit' : 'debit',
    };
  },
};

const ICICI_DEBIT: BankParseRule = {
  id: 'icici-debit-v1',
  bankHint: 'ICICI Bank',
  match: /icici/i,
  extract: (text) => {
    if (!/icici/i.test(text)) return null;
    const fee = /annual\s+fee|membership\s+fee/i.test(text);
    const amtM =
      text.match(
        /(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)\s*(?:spent|debited|paid)/i,
      ) ??
      text.match(
        /(?:spent|debited|paid)\s+(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)/i,
      );
    if (!amtM) return null;
    const amount = parseInrAmount(amtM[1]);
    if (amount == null) return null;
    const merchant = merchantAfter(text, [
      /(?:at|towards)\s+([A-Za-z0-9 &.'\-]{2,60})(?:\s+on\s+|\.|$)/i,
    ]);
    const dateM = text.match(/on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    return {
      amount,
      merchantRaw: fee ? 'Annual fee' : merchant,
      cardLastFour: lastFourFrom(text),
      transactionDate: dateM ? parseIndianDate(dateM[1]) : null,
      transactionType: fee ? 'annual_fee_debit' : 'debit',
    };
  },
};

/** Generic INR + last-four fallback when bank-specific rules miss. */
const GENERIC_INR: BankParseRule = {
  id: 'generic-inr-v1',
  bankHint: 'Unknown',
  match: /(?:INR|Rs\.?|₹)\s*[\d,]+/,
  extract: (text) => {
    const amtM = text.match(/(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)/i);
    if (!amtM) return null;
    const amount = parseInrAmount(amtM[1]);
    if (amount == null) return null;
    const fee = /annual\s+fee|membership\s+fee/i.test(text);
    const dateM = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    return {
      amount,
      merchantRaw: fee
        ? 'Annual fee'
        : merchantAfter(text, [
            /(?:at|to|towards)\s+([A-Za-z0-9 &.'\-]{2,60})/i,
          ]),
      cardLastFour: lastFourFrom(text),
      transactionDate: dateM ? parseIndianDate(dateM[1]) : null,
      transactionType: fee ? 'annual_fee_debit' : 'debit',
    };
  },
};

/** Ordered: bank-specific first, generic last. */
export const BANK_PARSE_RULES: BankParseRule[] = [
  HDFC_POINTS,
  HDFC_DEBIT,
  SBI_DEBIT,
  AXIS_DEBIT,
  ICICI_DEBIT,
  GENERIC_INR,
];

export function normalizeMerchant(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9 &.'\-]/g, '')
    .trim()
    .slice(0, 80);
}
