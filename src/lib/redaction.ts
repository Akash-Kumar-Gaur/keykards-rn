/**
 * Redaction utility.
 *
 * Scrubs card-number / CVV / expiry shaped patterns out of ANY value before it
 * is allowed near a log sink, crash reporter, or analytics event. This is a
 * defense-in-depth layer: plaintext card data is *also* never intentionally
 * logged (see SENSITIVE annotations in lib/crypto), but this guarantees that
 * even accidental leaks (e.g. an error object echoing a request body) are
 * neutralized.
 *
 * Pure, dependency-free, and unit-testable.
 */

const REDACTED = '[REDACTED]';

/**
 * Matches 13–19 digit sequences (optionally separated by spaces or dashes in
 * groups) — i.e. anything shaped like a PAN (Primary Account Number).
 */
const PAN_REGEX = /\b\d(?:[ -]?\d){12,18}\b/g;

/** Matches 3–4 digit CVV values that are explicitly labelled. */
const LABELLED_CVV_REGEX =
  /\b(cvv|cvc|cvv2|cid|security\s*code)\b\s*[:=]?\s*\d{3,4}\b/gi;

/** Matches MM/YY or MM/YYYY expiry values that are explicitly labelled. */
const LABELLED_EXPIRY_REGEX =
  /\b(exp(?:iry|iration)?|valid\s*thru)\b\s*[:=]?\s*(0[1-9]|1[0-2])\s*[/\-]\s*\d{2,4}\b/gi;

/** Keys whose values should always be fully redacted, regardless of shape. */
const SENSITIVE_KEY_REGEX =
  /(card[_-]?number|pan|cvv|cvc|cvv2|cid|security[_-]?code|expiry|exp[_-]?date|card[_-]?data|plaintext|data[_-]?key|share[_-]?master[_-]?key|share[_-]?key|number[_-]?full|access[_-]?token|refresh[_-]?token|password|secret|pdf[_-]?base64|statement[_-]?text|raw[_-]?model|raw[_-]?text)/i;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Redact card / CVV / expiry shaped substrings inside a string. */
export function redactString(input: string): string {
  return input
    .replace(LABELLED_CVV_REGEX, (m) => m.replace(/\d{3,4}\b/, REDACTED))
    .replace(LABELLED_EXPIRY_REGEX, (m, label) => `${label} ${REDACTED}`)
    .replace(PAN_REGEX, (match) => {
      const digits = match.replace(/[ -]/g, '');
      // Only redact if it passes Luhn (real card) OR is a 15–16 digit run,
      // to avoid clobbering unrelated long numbers like timestamps.
      if (digits.length >= 15 || luhnValid(digits)) return REDACTED;
      return match;
    });
}

/**
 * Deep-redact an arbitrary value (string / object / array). Returns a new
 * structure — never mutates the input. Keys matching SENSITIVE_KEY_REGEX have
 * their entire value replaced.
 */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((v) => redact(v, seen));
    }

    // Error objects: redact message + stack, keep name.
    if (value instanceof Error) {
      return {
        name: value.name,
        message: redactString(value.message),
        stack: value.stack ? redactString(value.stack) : undefined,
      };
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_REGEX.test(k) ? REDACTED : redact(v, seen);
    }
    return out;
  }

  return String(value);
}

/** Convenience: redact every argument passed to a log-style call. */
export function redactArgs(args: unknown[]): unknown[] {
  return args.map((a) => redact(a));
}
