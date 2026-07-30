/**
 * Card-share domain helpers — durations, status, URL shaping.
 * Pure / unit-testable. No React Native imports.
 */

export const SHARE_TTL_PRESETS = [
  { id: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { id: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '3d', label: '3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

export type ShareTtlId = (typeof SHARE_TTL_PRESETS)[number]['id'];

export const DEFAULT_SHARE_TTL_ID: ShareTtlId = '24h';

export const SHARE_TTL_MIN_MS = SHARE_TTL_PRESETS[0].ms;
export const SHARE_TTL_MAX_MS = SHARE_TTL_PRESETS[3].ms;

export function ttlMsForPreset(id: ShareTtlId): number {
  return SHARE_TTL_PRESETS.find((p) => p.id === id)?.ms ?? SHARE_TTL_PRESETS[1].ms;
}

export type CardShareStatus = 'active' | 'revoked' | 'expired' | 'exhausted';

/** Sender-chosen what the recipient can see. Always set explicitly at create. */
export type ShareRevealScope = 'full' | 'last_four_only';

export const DEFAULT_REVEAL_SCOPE: ShareRevealScope = 'full';

export const SHARE_REVEAL_OPTIONS: Array<{
  id: ShareRevealScope;
  label: string;
  hint: string;
}> = [
  {
    id: 'full',
    label: 'Full number + expiry',
    hint: 'Masked by default — they can tap to reveal. Anyone with the full link can reveal it. CVV is never shared.',
  },
  {
    id: 'last_four_only',
    label: 'Last 4 digits + expiry only',
    hint: 'Enough to confirm which card — the full number is never shown or uploaded.',
  },
];

export function parseRevealScope(raw: unknown): ShareRevealScope {
  return raw === 'last_four_only' ? 'last_four_only' : 'full';
}

export type CardShareRow = {
  id: string;
  cardId: string;
  ownerUserId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  maxViews: number | null;
  viewCount: number;
  lastViewedAt: string | null;
  recipientLabel: string | null;
  revealScope: ShareRevealScope;
};

/**
 * Status for owner list UI. Revoked wins over expired — matches server check order.
 */
export function cardShareStatus(
  share: Pick<
    CardShareRow,
    'revokedAt' | 'expiresAt' | 'maxViews' | 'viewCount'
  >,
  nowMs: number = Date.now(),
): CardShareStatus {
  if (share.revokedAt != null) return 'revoked';
  if (new Date(share.expiresAt).getTime() <= nowMs) return 'expired';
  if (share.maxViews != null && share.viewCount >= share.maxViews) {
    return 'exhausted';
  }
  return 'active';
}

export function isShareAccessible(
  share: Pick<
    CardShareRow,
    'revokedAt' | 'expiresAt' | 'maxViews' | 'viewCount'
  >,
  nowMs: number = Date.now(),
): boolean {
  return cardShareStatus(share, nowMs) === 'active';
}

/**
 * Public web / universal link. When `keyB64Url` is set (full-number shares),
 * it is placed in the URL *fragment* (`#k=…`) so browsers never send it to
 * the server. last_four_only shares omit the fragment.
 */
export function shareWebUrl(
  shareId: string,
  base = process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://inwallet.redevolve.in',
  keyB64Url?: string | null,
): string {
  const path = `${base.replace(/\/$/, '')}/shared/${shareId}`;
  return keyB64Url ? `${path}#k=${keyB64Url}` : path;
}

/** Custom-scheme deep link for installed app. */
export function shareAppUrl(
  shareId: string,
  keyB64Url?: string | null,
): string {
  const path = `inwallet://shared/${shareId}`;
  return keyB64Url ? `${path}#k=${keyB64Url}` : path;
}

/** Extract `#k=` / `?k=` share key from a full link (fragment preferred). */
export function parseShareKeyFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  try {
    const cleaned = url.trim();
    const hashIdx = cleaned.indexOf('#');
    if (hashIdx >= 0) {
      const hash = cleaned.slice(hashIdx + 1);
      const params = new URLSearchParams(hash);
      const fromHash = params.get('k');
      if (fromHash && /^[A-Za-z0-9_-]+$/.test(fromHash)) return fromHash;
    }
    // Fallback: some native linkers move the key into the query string.
    const qMatch = cleaned.match(/[?&]k=([A-Za-z0-9_-]+)/);
    return qMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

export function parseShareIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const cleaned = url.trim();
    const m =
      cleaned.match(/[/:]shared\/([0-9a-f-]{36})/i) ||
      cleaned.match(/share_id=([0-9a-f-]{36})/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export function mapShareRow(row: Record<string, unknown>): CardShareRow {
  return {
    id: String(row.id),
    cardId: String(row.card_id),
    ownerUserId: String(row.owner_user_id),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
    maxViews: row.max_views == null ? null : Number(row.max_views),
    viewCount: Number(row.view_count ?? 0),
    lastViewedAt:
      row.last_viewed_at == null ? null : String(row.last_viewed_at),
    recipientLabel:
      row.recipient_label == null ? null : String(row.recipient_label),
    revealScope: parseRevealScope(row.reveal_scope),
  };
}
