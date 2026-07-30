/**
 * Account display name helpers — profiles.display_name is canonical.
 * Email local-part (legacy trigger default) is treated as unset, not a real name.
 */

import type { User } from '@supabase/supabase-js';
import { suggestedCardholderName } from './cardholderName';

export const DISPLAY_NAME_MAX = 80;

export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, DISPLAY_NAME_MAX);
}

export function emailLocalPart(email: string | null | undefined): string | null {
  const local = email?.split('@')[0]?.trim();
  return local || null;
}

/**
 * True when the stored/suggested name is missing or just the old auto email
 * local-part — not a user-provided full name.
 */
export function isUnsetDisplayName(
  displayName: string | null | undefined,
  email: string | null | undefined,
): boolean {
  const name = displayName?.trim();
  if (!name) return true;
  const local = emailLocalPart(email);
  if (local && name.toLowerCase() === local.toLowerCase()) return true;
  return false;
}

/** Resolved real display name, or null when unset / email-prefix placeholder. */
export function resolveDisplayName(
  user: User | null | undefined,
  profileDisplayName?: string | null,
): string | null {
  const resolved = suggestedCardholderName(user, profileDisplayName);
  if (!resolved) return null;
  if (isUnsetDisplayName(resolved, user?.email)) return null;
  return resolved;
}

/** First token for Home greeting; full string if single word. */
export function greetingFirstName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? displayName.trim();
}

export function validateDisplayNameInput(raw: string): string | null {
  const name = normalizeDisplayName(raw);
  if (!name) return 'Enter your full name.';
  if (name.length < 2) return 'Name is too short.';
  return null;
}
