/**
 * Statement PDF extraction types + defensive JSON parse (mirrors catalog LLM).
 * Pure — safe to unit-test without Anthropic / PDF libs.
 */

import type { BenefitCategory } from '@/types/card';

export const STATEMENT_CATEGORIES = [
  'lounge',
  'dining',
  'travel',
  'shopping',
  'fuel',
  'entertainment',
  'other',
] as const;

export type StatementCategory = (typeof STATEMENT_CATEGORIES)[number];

export type StatementLineItem = {
  date: string; // YYYY-MM-DD
  merchant: string;
  amount: number;
  category: StatementCategory;
};

export type StatementExtraction = {
  statement_period_start: string;
  statement_period_end: string;
  total_spend: number | null;
  minimum_due: number | null;
  total_due: number | null;
  payment_due_date: string | null;
  reward_points_earned: number | null;
  line_items: StatementLineItem[];
};

export type StatementParseResult =
  | { ok: true; data: StatementExtraction }
  | { ok: false; error: string; raw?: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asCategory(v: unknown): StatementCategory {
  const s = String(v ?? 'other').toLowerCase().trim();
  return (STATEMENT_CATEGORIES as readonly string[]).includes(s)
    ? (s as StatementCategory)
    : 'other';
}

function asIsoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, 10);
  return ISO_DATE.test(t) ? t : null;
}

/**
 * Defensive parse of Claude JSON — strip fences, recover brace match, validate
 * shape field-by-field, drop malformed line items instead of rejecting all.
 */
export function parseStatementLlmJson(raw: string): StatementParseResult {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1]!.trim();

  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    const brace = text.match(/\{[\s\S]*\}/);
    if (!brace) {
      return { ok: false, error: 'No JSON object in model response', raw };
    }
    try {
      obj = JSON.parse(brace[0]);
    } catch (e) {
      return {
        ok: false,
        error: `JSON parse failed: ${e instanceof Error ? e.message : e}`,
        raw,
      };
    }
  }

  if (!obj || typeof obj !== 'object') {
    return { ok: false, error: 'Parsed value is not an object', raw };
  }

  const o = obj as Record<string, unknown>;
  const periodStart = asIsoDate(o.statement_period_start);
  const periodEnd = asIsoDate(o.statement_period_end);
  if (!periodStart || !periodEnd) {
    return {
      ok: false,
      error: 'Missing/invalid statement_period_start or statement_period_end',
      raw,
    };
  }

  if (!Array.isArray(o.line_items)) {
    return { ok: false, error: 'Missing line_items array', raw };
  }

  const line_items: StatementLineItem[] = [];
  for (const row of o.line_items) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const date = asIsoDate(r.date);
    const merchant = String(r.merchant ?? '').trim();
    const amount = numOrNull(r.amount);
    if (!date || !merchant || amount == null || amount <= 0) continue;
    line_items.push({
      date,
      merchant: merchant.slice(0, 120),
      amount,
      category: asCategory(r.category),
    });
  }

  if (line_items.length === 0) {
    return { ok: false, error: 'No valid line_items extracted', raw };
  }

  const summed = line_items.reduce((s, i) => s + i.amount, 0);
  const totalSpend = numOrNull(o.total_spend);

  return {
    ok: true,
    data: {
      statement_period_start: periodStart,
      statement_period_end: periodEnd,
      total_spend:
        totalSpend != null && totalSpend > 0 ? totalSpend : Math.round(summed * 100) / 100,
      minimum_due: numOrNull(o.minimum_due),
      total_due: numOrNull(o.total_due),
      payment_due_date: asIsoDate(o.payment_due_date),
      reward_points_earned: numOrNull(o.reward_points_earned),
      line_items,
    },
  };
}

export const STATEMENT_SYSTEM_PROMPT = `You extract credit-card statement data from bank statement text.
Return ONLY valid JSON (no markdown fences) matching this exact shape:
{
  "statement_period_start": "YYYY-MM-DD",
  "statement_period_end": "YYYY-MM-DD",
  "total_spend": number | null,
  "minimum_due": number | null,
  "total_due": number | null,
  "payment_due_date": "YYYY-MM-DD" | null,
  "reward_points_earned": number | null,
  "line_items": [
    {
      "date": "YYYY-MM-DD",
      "merchant": string,
      "amount": number,
      "category": "lounge" | "dining" | "travel" | "shopping" | "fuel" | "entertainment" | "other"
    }
  ]
}

Rules:
- Extract purchase / debit line items only. Skip payments, credits, reversals, and fee waivers unless they are clearly billed charges.
- amount is always a positive INR number (no commas, no currency symbol).
- Prefer the statement's printed period dates when present.
- total_spend should match the statement's purchase total when stated; otherwise null (caller will sum line items).
- reward_points_earned only when the statement explicitly shows points earned this period; otherwise null.
- payment_due_date when the statement prints a payment due date; otherwise null.
- category: map from MCC / merchant type. Use "other" when unsure.
- Do NOT invent merchants or amounts. Skip unreadable rows.
- Never include the full card number or CVV in any field. Merchants only.`;

export function isBenefitCategory(c: string): c is BenefitCategory {
  return (STATEMENT_CATEGORIES as readonly string[]).includes(c);
}
