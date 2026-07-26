/**
 * Card number helpers — Luhn, formatting, last4.
 * Never log the raw number; callers must keep plaintext out of logger args.
 */

import type { CardNetwork } from '@/types/card';

/** Strip everything except digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Format as groups of 4 for display while typing (masked or plain digits). */
export function formatCardNumberGroups(digits: string): string {
  const d = digitsOnly(digits).slice(0, 19);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function lastFourFromNumber(digits: string): string {
  const d = digitsOnly(digits);
  return d.slice(-4);
}

/**
 * Luhn check — required before save. Accepts 13–19 digit PANs.
 */
export function isValidLuhn(digits: string): boolean {
  const d = digitsOnly(digits);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i -= 1) {
    let n = Number(d[i]);
    if (Number.isNaN(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function detectNetwork(digits: string): CardNetwork | null {
  const d = digitsOnly(digits);
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  if (/^36|^38|^30[0-5]/.test(d)) return 'Diners';
  if (/^60|^65|^81|^82/.test(d)) return 'RuPay';
  return null;
}

export function maskCardNumber(lastFour: string): string {
  const four = digitsOnly(lastFour).slice(-4).padStart(4, '0');
  return `•••• •••• •••• ${four}`;
}

/**
 * Live typing mask: bullet every digit except the last 4, keep 4-digit groups.
 * e.g. 4111111111114821 → "•••• •••• •••• 4821"
 */
export function formatMaskedCardNumber(digits: string): string {
  const d = digitsOnly(digits).slice(0, 19);
  if (!d) return '';
  const chars = d.split('').map((ch, i) => (i < d.length - 4 ? '•' : ch));
  return chars.join('').replace(/(.{4})(?=.)/g, '$1 ').trim();
}

export function formatExpiry(month: number, year: number): string {
  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(-2);
  return `${mm}/${yy}`;
}

export function isValidCvv(cvv: string, network?: CardNetwork | null): boolean {
  const d = digitsOnly(cvv);
  if (network === 'Amex') return d.length === 4;
  return d.length === 3 || d.length === 4;
}

export function formatInr(amount: number): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${Math.round(amount)}`;
  }
}
