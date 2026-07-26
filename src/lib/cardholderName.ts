/**
 * Suggest a default "Name on card" from the signed-in user's profile.
 * Editable prefill only — never locked. Returns null when nothing sensible.
 */

import type { User } from '@supabase/supabase-js';

export function suggestedCardholderName(
  user: User | null | undefined,
  profileDisplayName?: string | null,
): string | null {
  const fromProfile = profileDisplayName?.trim();
  if (fromProfile) return fromProfile.slice(0, 80);

  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const candidates = [
    meta?.full_name,
    meta?.name,
    meta?.display_name,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim().slice(0, 80);
  }
  return null;
}

/** True when a cardholder string is worth showing (not empty / dash placeholders). */
export function hasDisplayableCardholderName(
  value: string | null | undefined,
): boolean {
  if (value == null) return false;
  const t = value.trim();
  if (!t) return false;
  if (t === '-' || t === '—' || t === '–') return false;
  return true;
}
