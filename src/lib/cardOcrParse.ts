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
 * Words that never belong to a cardholder name but are common on card faces:
 * legal boilerplate, product tiers, and company suffixes.
 *
 * Deliberately biased towards rejection. A wrong name is a fabricated fact,
 * whereas no name just means the user types it — and the form already offers
 * their profile name as a suggestion. A rare real name caught by this list is a
 * far better outcome than printing "Electronic Use Only" as someone's name.
 */
const NON_NAME_WORDS = new Set([
  // Legal / usage boilerplate
  'ELECTRONIC', 'ELECTRONICALLY', 'USE', 'USES', 'ONLY', 'FOR', 'THIS', 'THAT',
  'THE', 'AND', 'NOT', 'ALL', 'ANY', 'YOUR', 'YOURS', 'ARE', 'WITH', 'FROM',
  'UPON', 'AUTHORIZED', 'AUTHORISED', 'SIGN', 'SIGNED', 'HOLDER', 'CARDHOLDER',
  'CUSTOMER', 'CARE', 'SERVICE', 'SERVICES', 'HELPLINE', 'TOLL', 'FREE',
  'CALL', 'CONTACT', 'LOST', 'STOLEN', 'REPORT', 'TERMS', 'CONDITIONS',
  'SUBJECT', 'PROPERTY', 'RETURN', 'ISSUED', 'ISSUER', 'ISSUING',
  'TRANSFERABLE', 'NONTRANSFERABLE', 'ACCEPTED', 'ACCEPTANCE', 'AUTHORIZATION',
  // Scope / network wording
  'WORLDWIDE', 'INTERNATIONAL', 'DOMESTIC', 'GLOBAL', 'NETWORK', 'PAYMENT',
  'PAYMENTS', 'ATM', 'POS', 'ONLINE', 'OFFLINE', 'CONTACTLESS', 'CHIP', 'PIN',
  'SECURE', 'SECURITY', 'PROTECTED', 'ENABLED',
  // Company suffixes
  'LIMITED', 'LTD', 'PVT', 'PRIVATE', 'INC', 'LLP', 'CORP', 'CORPORATION',
  'COMPANY', 'SOLUTIONS', 'TECHNOLOGIES', 'TECHNOLOGY', 'TECH', 'SYSTEMS',
  'GROUP', 'ENTERPRISES', 'INDUSTRIES', 'VENTURES', 'LABS', 'WWW', 'COM',
  // Product tiers / marketing
  'GOLD', 'SILVER', 'TITANIUM', 'CLASSIC', 'WORLD', 'ELITE', 'SELECT',
  'PRIORITY', 'BUSINESS', 'CORPORATE', 'PRIME', 'PLUS', 'ROYALE', 'REGALIA',
  'MILLENNIA', 'MONEYBACK', 'CASHBACK', 'FREEDOM', 'COINS', 'EDGE', 'SMART',
  'VALUE', 'SUPER', 'INFINIA', 'MAGNUS', 'REWARD', 'POINTS',
]);

/** Trim punctuation so "LTD." and "LTD" are treated alike. */
function nameWords(upper: string): string[] {
  return upper
    .split(' ')
    .map((w) => w.replace(/^[.'-]+|[.'-]+$/g, ''))
    .filter(Boolean);
}

/**
 * Find Luhn-valid PANs in OCR text (spaces/dashes allowed between digits).
 * Prefers the longest valid match; skips digit runs that look like CVV context.
 */
export function extractPanCandidates(text: string): string[] {
  const normalized = text.replace(/[–—]/g, '-');
  const found: string[] = [];

  // Grouped digits are matched per line. A PAN is never printed across two
  // lines, and a separator that spans newlines lets the line below (the expiry
  // sits directly under the number on most cards) get pulled into the greedy
  // match, which loses the real PAN entirely.
  for (const rawLine of normalized.split(/\r?\n/)) {
    // Grouped: 4 4 4 4 or 4-4-4-4, also Amex-ish 4 6 5
    const grouped =
      /\b(?:\d{4}[ \t-]?){2,4}\d{1,7}\b|\b\d{4}[ \t-]?\d{6}[ \t-]?\d{5}\b/g;
    for (const m of rawLine.matchAll(grouped)) {
      const digits = digitsOnly(m[0]!);
      if (digits.length >= 13 && digits.length <= 19 && isValidLuhn(digits)) {
        found.push(digits);
      }
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
 * Heuristic cardholder name: uppercase letter lines that are not bank/network
 * fluff, boilerplate, or a company name. Skips digit-heavy and CVV lines.
 *
 * Returns null unless a line looks positively like a person's name — cards
 * without a printed name must yield nothing rather than a nearby phrase.
 */
export function extractCardholderName(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const scored: { name: string; score: number; index: number }[] = [];

  lines.forEach((line, index) => {
    if (CVV_NEAR.test(line)) return;
    if (/\d/.test(line)) return; // a printed name carries no digits
    const upper = line.toUpperCase().replace(/\s+/g, ' ').trim();
    if (!NAME_LINE.test(upper)) return;
    if (BANKISH.test(upper)) return;
    if (upper.length < 4) return;

    const words = nameWords(upper);
    if (words.length < 2 || words.length > 5) return;

    // Any boilerplate / company / tier word disqualifies the whole line.
    if (words.some((w) => NON_NAME_WORDS.has(w))) return;

    // At least one real word, so "A B" style noise is rejected.
    if (!words.some((w) => w.length >= 3)) return;

    // Name-shaped text has vowels; runs like "XZQW MNBV" are OCR noise.
    const letters = upper.replace(/[^A-Z]/g, '');
    const vowels = letters.match(/[AEIOU]/g)?.length ?? 0;
    if (letters.length === 0 || vowels / letters.length < 0.2) return;

    // Prefer 2–3 word names
    const score = words.length === 2 || words.length === 3 ? 2 : 1;
    scored.push({ name: toTitleCase(words.join(' ')), score, index });
  });

  if (scored.length === 0) return null;
  // Later lines win ties — the printed name sits below the bank and product
  // wording on a card face.
  scored.sort((a, b) => b.score - a.score || b.index - a.index);
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
