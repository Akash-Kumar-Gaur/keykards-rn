/**
 * Card-share status + URL parsing — verifies revoke-before-expiry ordering
 * and that exhausted / expired / revoked shares are never "accessible".
 */

import {
  cardShareStatus,
  isShareAccessible,
  parseShareIdFromUrl,
  parseShareKeyFromUrl,
  shareAppUrl,
  shareWebUrl,
  ttlMsForPreset,
  SHARE_TTL_MAX_MS,
  SHARE_TTL_MIN_MS,
} from './cardShare';

const base = {
  maxViews: null as number | null,
  viewCount: 0,
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  revokedAt: null as string | null,
};

describe('cardShareStatus', () => {
  it('treats revoked as inaccessible even when not yet expired', () => {
    const share = {
      ...base,
      revokedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    expect(cardShareStatus(share)).toBe('revoked');
    expect(isShareAccessible(share)).toBe(false);
  });

  it('checks revoked_at before expires_at (revoke wins when both true)', () => {
    const share = {
      ...base,
      revokedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    expect(cardShareStatus(share)).toBe('revoked');
  });

  it('marks expired shares after expires_at', () => {
    const share = {
      ...base,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    expect(cardShareStatus(share)).toBe('expired');
    expect(isShareAccessible(share)).toBe(false);
  });

  it('marks exhausted when view_count reaches max_views', () => {
    const share = { ...base, maxViews: 1, viewCount: 1 };
    expect(cardShareStatus(share)).toBe('exhausted');
    expect(isShareAccessible(share)).toBe(false);
  });

  it('keeps active shares accessible', () => {
    expect(cardShareStatus(base)).toBe('active');
    expect(isShareAccessible(base)).toBe(true);
  });

  it('becomes inaccessible the moment revoke is set (in-progress access model)', () => {
    const before = { ...base };
    expect(isShareAccessible(before)).toBe(true);
    const after = { ...before, revokedAt: new Date().toISOString() };
    expect(isShareAccessible(after)).toBe(false);
  });
});

describe('share URLs + parsing', () => {
  const id = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
  const key = 'abcdefghijklmnopqrstuvwxyz0123456789ABCD';

  it('builds web and app URLs without a key', () => {
    expect(shareWebUrl(id, 'https://keykards.redevolve.in')).toBe(
      `https://keykards.redevolve.in/shared/${id}`,
    );
    expect(shareAppUrl(id)).toBe(`keykards://shared/${id}`);
  });

  it('embeds the share key only in the URL fragment', () => {
    expect(shareWebUrl(id, 'https://keykards.redevolve.in', key)).toBe(
      `https://keykards.redevolve.in/shared/${id}#k=${key}`,
    );
    expect(shareAppUrl(id, key)).toBe(`keykards://shared/${id}#k=${key}`);
  });

  it('parses share ids from https and custom-scheme links', () => {
    expect(parseShareIdFromUrl(`https://keykards.redevolve.in/shared/${id}`)).toBe(id);
    expect(parseShareIdFromUrl(`keykards://shared/${id}`)).toBe(id);
    expect(parseShareIdFromUrl(`https://keykards.redevolve.in/shared/${id}?x=1`)).toBe(
      id,
    );
    expect(
      parseShareIdFromUrl(`https://keykards.redevolve.in/shared/${id}#k=${key}`),
    ).toBe(id);
    expect(parseShareIdFromUrl('https://keykards.redevolve.in/vault')).toBeNull();
  });

  it('parses the fragment key without requiring a server round-trip', () => {
    expect(
      parseShareKeyFromUrl(`https://keykards.redevolve.in/shared/${id}#k=${key}`),
    ).toBe(key);
    expect(parseShareKeyFromUrl(`keykards://shared/${id}#k=${key}`)).toBe(key);
    expect(parseShareKeyFromUrl(`https://keykards.redevolve.in/shared/${id}`)).toBeNull();
  });
});

describe('TTL presets', () => {
  it('stays within 1 hour .. 7 days', () => {
    expect(ttlMsForPreset('1h')).toBe(SHARE_TTL_MIN_MS);
    expect(ttlMsForPreset('7d')).toBe(SHARE_TTL_MAX_MS);
    expect(ttlMsForPreset('24h')).toBeGreaterThan(SHARE_TTL_MIN_MS);
    expect(ttlMsForPreset('24h')).toBeLessThan(SHARE_TTL_MAX_MS);
  });
});
