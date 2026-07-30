/**
 * Parse on-device OCR text into card fields (PAN, expiry, optional name).
 * Never extracts CVV — 3–4 digit codes near CVV/CVC labels are ignored.
 */

import {
  detectNetwork,
  digitsOnly,
  isValidLuhn,
} from '@/lib/cardUtils';
import type { CardNetwork } from '@/types/card';

export type CardOcrParseResult = {
  panDigits: string;
  expiryMonth: number | null;
  expiryYear: number | null;
  cardholderName: string | null;
  networkHint: CardNetwork | null;
};

const CVV_NEAR =
  /\b(cvv|cvc|cid|security\s*code|sec\.?\s*code|csc)\b/i;

const BANKISH =
  /\b(visa|mastercard|master\s*card|rupay|amex|american\s*express|diners|discover|bank|credit|debit|valid|thru|good|member|since|platinum|signature|infinite|premium|rewards?|card)\b/i;

const NAME_LINE =
  /^[A-Z][A-Z .'-]{2,39}$/;

/**
 * Find Luhn-valid PANs in OCR text (spaces/dashes allowed between digits).
 * Prefers the longest valid match; skips digit runs that look like CVV context.
 */
export function extractPanCandidates(text: string): string[] {
  const normalized = text.replace(/[–—]/g, '-');
  const found: string[] = [];

  // Grouped: 4 4 4 4 or 4-4-4-4, also Amex-ish 4 6 5
  const grouped =
    /\b(?:\d{4}[\s-]?){2,4}\d{1,7}\b|\b\d{4}[\s-]?\d{6}[\s-]?\d{5}\b/g;
  for (const m of normalized.matchAll(grouped)) {
    const digits = digitsOnly(m[0]!);
    if (digits.length >= 13 && digits.length <= 19 && isValidLuhn(digits)) {
      found.push(digits);
    }
  }

  // Continuous digit runs
  const runs = normalized.match(/\d{13,19}/g) ?? [];
  for (const run of runs) {
    if (isValidLuhn(run)) found.push(run);
  }

  // Dedupe, longest first
  return [...new Set(found)].sort((a, b) => b.length - a.length);
}

/**
 * MM/YY or MM/YYYY near “VALID”, “THRU”, “EXP”, or standalone on a line.
 * Rejects years too far in the past/future.
 */
export function extractExpiry(
  text: string,
  now = new Date(),
): { month: number; year: number } | null {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const patterns: RegExp[] = [
    /(?:valid\s*(?:thru|through|until)|exp(?:iry|ires)?\.?|thru)\s*[:\s]*(\d{1,2})\s*[\/\-.\s]\s*(\d{2,4})/gi,
    /\b(\d{1,2})\s*[\/\-]\s*(\d{2,4})\b/g,
  ];

  const candidates: { month: number; year: number; score: number }[] = [];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const month = Number(m[1]);
      let year = Number(m[2]);
      if (month < 1 || month > 12) continue;
      if (year < 100) year += 2000;
      if (year < currentYear - 1 || year > currentYear + 20) continue;
      if (year === currentYear - 1 && month < currentMonth) continue;

      const ctxStart = Math.max(0, (m.index ?? 0) - 24);
      const ctx = text.slice(ctxStart, (m.index ?? 0) + m[0].length + 8);
      // Skip if this looks like a CVV neighborhood (rare but possible).
      if (CVV_NEAR.test(ctx) && !/valid|thru|exp/i.test(ctx)) continue;

      const labeled = /valid|thru|exp/i.test(ctx) ? 2 : 0;
      const futureBias =
        year > currentYear || (year === currentYear && month >= currentMonth)
          ? 1
          : 0;
      candidates.push({ month, year, score: labeled + futureBias });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || b.year - a.year || b.month - a.month);
  const best = candidates[0]!;
  return { month: best.month, year: best.year };
}

/**
 * Heuristic cardholder name: uppercase letter lines that are not bank/network fluff.
 * Skips lines that are mostly digits or contain CVV labels.
 */
export function extractCardholderName(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const scored: { name: string; score: number }[] = [];

  for (const line of lines) {
    if (CVV_NEAR.test(line)) continue;
    if (/\d{5,}/.test(line)) continue; // digit-heavy (PAN fragments)
    const upper = line.toUpperCase().replace(/\s+/g, ' ').trim();
    if (!NAME_LINE.test(upper)) continue;
    if (BANKISH.test(upper)) continue;
    if (upper.length < 4) continue;

    const words = upper.split(' ').filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;

    // Prefer 2–3 word names
    const score = words.length === 2 || words.length === 3 ? 2 : 1;
    scored.push({ name: toTitleCase(upper), score });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score || b.name.length - a.name.length);
  return scored[0]!.name.slice(0, 80);
}

function toTitleCase(upper: string): string {
  return upper
    .split(' ')
    .map((w) => {
      if (w.length <= 1) return w;
      // Keep short particles lowercase when mid-name
      return w[0] + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Full parse — requires a Luhn-valid PAN. Expiry and name are best-effort.
 * Returns null when no valid PAN is found (caller keeps scanning).
 */
export function parseCardOcrText(text: string): CardOcrParseResult | null {
  if (!text?.trim()) return null;

  // Strip obvious CVV-labeled short codes so they aren't confused with anything.
  const scrubbed = text.replace(
    /\b(cvv|cvc|cid|csc)\b\s*[:#-]?\s*\d{3,4}\b/gi,
    ' ',
  );

  const pans = extractPanCandidates(scrubbed);
  if (pans.length === 0) return null;

  const panDigits = pans[0]!;
  const expiry = extractExpiry(scrubbed);
  const cardholderName = extractCardholderName(scrubbed);

  return {
    panDigits,
    expiryMonth: expiry?.month ?? null,
    expiryYear: expiry?.year ?? null,
    cardholderName,
    networkHint: detectNetwork(panDigits),
  };
}
