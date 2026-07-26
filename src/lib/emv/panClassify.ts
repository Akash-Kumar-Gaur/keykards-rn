/**
 * Classify PAN digits from EMV — full vs bank-masked / truncated.
 * Never logs the digits.
 */

import { isValidLuhn } from '@/lib/cardUtils';

export type PanQuality = 'full' | 'partial' | 'empty';

export interface ClassifiedPan {
  quality: PanQuality;
  /** Digits to prefill (may be last-4 only when partial). */
  digits: string;
  lastFour: string | null;
}

/**
 * Some issuers return masked PANs like ************1234 or 411111******1234
 * (as ASCII '*' or as hex with F fillers already stripped to digits + gaps).
 * We accept raw digit strings that may include non-digits from Track2 parse.
 */
export function classifyPan(raw: string): ClassifiedPan {
  const cleaned = raw.replace(/[^0-9*xX]/g, '');
  if (!cleaned) return { quality: 'empty', digits: '', lastFour: null };

  const hasMaskChar = /[*xX]/.test(cleaned);
  const digitsOnly = cleaned.replace(/\D/g, '');

  if (hasMaskChar) {
    const lastFour = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : digitsOnly || null;
    // Keep any leading visible digits + we'll ask user to complete.
    const leading = cleaned.match(/^\d+/)?.[0] ?? '';
    const digits =
      leading.length >= 6 && lastFour
        ? `${leading}${lastFour}` // still incomplete middle — Luhn will fail → user completes
        : lastFour ?? '';
    return { quality: 'partial', digits, lastFour };
  }

  if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && isValidLuhn(digitsOnly)) {
    return {
      quality: 'full',
      digits: digitsOnly,
      lastFour: digitsOnly.slice(-4),
    };
  }

  // Truncated digit run (e.g. only last 4 or short prefix without Luhn).
  if (digitsOnly.length >= 4 && digitsOnly.length < 13) {
    return {
      quality: 'partial',
      digits: digitsOnly,
      lastFour: digitsOnly.slice(-4),
    };
  }

  if (digitsOnly.length >= 13 && !isValidLuhn(digitsOnly)) {
    // Long but invalid — treat as partial so user can fix rather than reject silently.
    return {
      quality: 'partial',
      digits: digitsOnly,
      lastFour: digitsOnly.slice(-4),
    };
  }

  return { quality: 'empty', digits: '', lastFour: null };
}
