/**
 * Owner-device only: remember share keys so “Copy link” on Manage shares can
 * rebuild `#k=…`. Never synced / never sent to Supabase.
 */

import { SECURE_KEYS, secureGet, secureSet } from '@/lib/secureStore';

type KeyMap = Record<string, string>;

async function readMap(): Promise<KeyMap> {
  try {
    const raw = await secureGet(SECURE_KEYS.shareLinkKeys);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as KeyMap;
  } catch {
    return {};
  }
}

async function writeMap(map: KeyMap): Promise<void> {
  await secureSet(SECURE_KEYS.shareLinkKeys, JSON.stringify(map));
}

export async function rememberShareLinkKey(
  shareId: string,
  keyB64Url: string,
): Promise<void> {
  if (!shareId || !keyB64Url) return;
  const map = await readMap();
  map[shareId] = keyB64Url;
  await writeMap(map);
}

export async function recallShareLinkKey(
  shareId: string,
): Promise<string | null> {
  const map = await readMap();
  return map[shareId] ?? null;
}

export async function forgetShareLinkKey(shareId: string): Promise<void> {
  const map = await readMap();
  if (!(shareId in map)) return;
  delete map[shareId];
  await writeMap(map);
}
