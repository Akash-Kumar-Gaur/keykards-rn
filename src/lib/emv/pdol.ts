/**
 * Build GET PROCESSING OPTIONS (GPO) with sensible PDOL defaults.
 * Filling PDOL with all zeros often returns SW 6985 ("conditions not satisfied")
 * on Visa/Mastercard contactless — especially when 9F66 (TTQ) is required.
 *
 * Amex Expresspay (AID A000000025) typically asks for 9F35 + 9F6E. Tag 9F6E is
 * Enhanced Contactless Reader Capabilities and MUST be non-zero — zeros → 6985.
 */

import { hexToBytes } from './tlv';

/** Parse a PDOL (tag 9F38 value) into ordered { tag, length } entries. */
export function parsePdol(pdol: number[]): Array<{ tag: string; length: number }> {
  const out: Array<{ tag: string; length: number }> = [];
  let i = 0;
  while (i < pdol.length) {
    const first = pdol[i++];
    const tagBytes = [first];
    if ((first & 0x1f) === 0x1f) {
      while (i < pdol.length) {
        const b = pdol[i++];
        tagBytes.push(b);
        if ((b & 0x80) === 0) break;
      }
    }
    if (i >= pdol.length) break;
    const length = pdol[i++];
    const tag = tagBytes.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    out.push({ tag, length });
  }
  return out;
}

function yymmddNow(): number[] {
  const d = new Date();
  const yy = d.getFullYear() % 100;
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const bcd = (n: number) => ((Math.floor(n / 10) << 4) | (n % 10)) & 0xff;
  return [bcd(yy), bcd(mm), bcd(dd)];
}

function randomBytes(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(Math.floor(Math.random() * 256));
  return out;
}

/**
 * Amex Enhanced Contactless Reader Capabilities (9F6E) candidates.
 * Magstripe+EMV capable reader bits — zeros always get SW 6985 on Expresspay.
 */
export const AMEX_9F6E_CANDIDATES = [
  'D8E00000',
  '9CE00000',
  'DCE00000',
  'C0000000',
] as const;

/**
 * Default value for a PDOL tag. Length is padded/truncated to match the request.
 * Never logs values that could include sensitive data (these are terminal fields).
 */
export function pdolDefault(
  tag: string,
  length: number,
  overrides?: Record<string, number[]>,
): number[] {
  const fill = (bytes: number[]) => {
    if (bytes.length === length) return bytes;
    if (bytes.length > length) return bytes.slice(0, length);
    return [...bytes, ...new Array(length - bytes.length).fill(0)];
  };

  if (overrides?.[tag]) return fill(overrides[tag]);

  switch (tag) {
    // Terminal Transaction Qualifiers (Visa) — qVSDC / online capable contactless
    case '9F66':
      return fill(hexToBytes('26000000'));
    // Amount Authorized / Other — zero (we're reading, not charging)
    case '9F02':
    case '9F03':
      return fill(new Array(length).fill(0));
    // Terminal Country Code — India
    case '9F1A':
      return fill(hexToBytes('0356'));
    // TVR
    case '95':
      return fill(new Array(length).fill(0));
    // Transaction Currency — INR
    case '5F2A':
      return fill(hexToBytes('0356'));
    // Transaction Date
    case '9A':
      return fill(yymmddNow());
    // Transaction Type — purchase
    case '9C':
      return fill([0x00]);
    // Unpredictable Number
    case '9F37':
      return fill(randomBytes(Math.max(length, 4)));
    // Terminal Type — attended, online only
    case '9F35':
      return fill([0x22]);
    // Amex Enhanced Contactless Reader Capabilities (NOT zeros)
    case '9F6E':
      return fill(hexToBytes(AMEX_9F6E_CANDIDATES[0]));
    // Merchant Category / Category Code
    case '9F15':
      return fill(hexToBytes('0001'));
    // Terminal Capabilities
    case '9F33':
      return fill(hexToBytes('E0F8C8'));
    // Additional Terminal Capabilities
    case '9F40':
      return fill(hexToBytes('8F00F0A001'));
    // Merchant Name / Location — spaces
    case '9F4E':
      return fill(new Array(length).fill(0x20));
    // DS Summary / VLP / misc — zeros are OK
    default:
      return fill(new Array(length).fill(0));
  }
}

/** Build GPO APDU from optional PDOL bytes (tag 9F38 value). */
export function buildGpo(
  pdol: number[] | null,
  overrides?: Record<string, number[]>,
): number[] {
  if (!pdol || pdol.length === 0) {
    // Empty PDOL Related Data
    return [0x80, 0xa8, 0x00, 0x00, 0x02, 0x83, 0x00, 0x00];
  }

  const entries = parsePdol(pdol);
  const dolData: number[] = [];
  for (const e of entries) {
    dolData.push(...pdolDefault(e.tag, e.length, overrides));
  }

  const payload = [0x83, dolData.length, ...dolData];
  return [0x80, 0xa8, 0x00, 0x00, payload.length, ...payload, 0x00];
}

/** Empty-PDOL GPO — useful fallback when a filled PDOL returns 6985. */
export function buildGpoEmpty(): number[] {
  return [0x80, 0xa8, 0x00, 0x00, 0x02, 0x83, 0x00, 0x00];
}

/**
 * Ordered GPO APDU variants to try. Amex cards that request 9F6E get several
 * Enhanced Contactless Reader Capabilities values before empty-PDOL fallback.
 */
export function buildGpoVariants(pdol: number[] | null): number[][] {
  if (!pdol || pdol.length === 0) {
    return [buildGpoEmpty()];
  }

  const entries = parsePdol(pdol);
  const has9F6E = entries.some((e) => e.tag === '9F6E');
  const variants: number[][] = [];
  const seen = new Set<string>();

  const push = (cmd: number[]) => {
    const key = cmd.map((b) => b.toString(16).padStart(2, '0')).join('');
    if (seen.has(key)) return;
    seen.add(key);
    variants.push(cmd);
  };

  push(buildGpo(pdol));

  if (has9F6E) {
    for (const hex of AMEX_9F6E_CANDIDATES) {
      push(buildGpo(pdol, { '9F6E': hexToBytes(hex) }));
    }
    // Alternate terminal type sometimes accepted by Expresspay
    for (const hex of AMEX_9F6E_CANDIDATES.slice(0, 2)) {
      push(buildGpo(pdol, { '9F6E': hexToBytes(hex), '9F35': [0x21] }));
      push(buildGpo(pdol, { '9F6E': hexToBytes(hex), '9F35': [0x25] }));
    }
  }

  push(buildGpoEmpty());
  return variants;
}
