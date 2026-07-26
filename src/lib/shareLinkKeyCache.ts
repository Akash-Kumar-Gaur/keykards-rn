/**
 * Ephemeral in-memory cache for share keys extracted from deep-link fragments.
 * Never persisted. Cleared on take() so the key does not linger in navigation state.
 */

const keys = new Map<string, string>();

export const shareLinkKeyCache = {
  set(shareId: string, keyB64Url: string) {
    if (!shareId || !keyB64Url) return;
    keys.set(shareId, keyB64Url);
  },
  /** Read without clearing — useful when the screen remounts once. */
  peek(shareId: string): string | null {
    return keys.get(shareId) ?? null;
  },
  take(shareId: string): string | null {
    const v = keys.get(shareId) ?? null;
    keys.delete(shareId);
    return v;
  },
  clear(shareId?: string) {
    if (shareId) keys.delete(shareId);
    else keys.clear();
  },
};
