/**
 * One-time "add your name" nudge dismiss flag (per user, per install).
 */

import { SECURE_KEYS, secureGet, secureSet } from './secureStore';

async function readMap(): Promise<Record<string, string>> {
  const raw = await secureGet(SECURE_KEYS.nameNudgeDismissed);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore corrupt
  }
  return {};
}

export async function isNameNudgeDismissed(userId: string): Promise<boolean> {
  const map = await readMap();
  return map[userId] === '1';
}

export async function setNameNudgeDismissed(userId: string): Promise<void> {
  const map = await readMap();
  map[userId] = '1';
  await secureSet(SECURE_KEYS.nameNudgeDismissed, JSON.stringify(map));
}
