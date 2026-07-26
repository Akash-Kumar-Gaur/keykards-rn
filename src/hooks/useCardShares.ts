/**
 * useCardShares — create / list / revoke shares for a card.
 *
 * Create path (E2E):
 *   biometric-decrypt PAN on device → encrypt under a fresh per-share key →
 *   POST only ciphertext (+ metadata) to create-card-share. Plaintext PAN and
 *   the share key never leave the device in a network body; the key is appended
 *   to the link as a URL fragment (`#k=…`).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  BiometricRequiredError,
  decryptFields,
  isUnrecoverableCardError,
} from '@/lib/crypto';
import {
  decryptPanFromShare,
  encryptPanForShare,
  formatPanGroups,
  maskPanLastFour,
} from '@/lib/shareCrypto';
import { rememberShareLinkKey, forgetShareLinkKey } from '@/lib/shareLinkKeys';
import { shareLinkKeyCache } from '@/lib/shareLinkKeyCache';
import { logger } from '@/lib/logger';
import {
  mapShareRow,
  parseRevealScope,
  shareAppUrl,
  shareWebUrl,
  ttlMsForPreset,
  type CardShareRow,
  type ShareRevealScope,
  type ShareTtlId,
} from '@/lib/cardShare';
import type { VaultCard } from '@/types/card';

export const shareKeys = {
  all: ['card-shares'] as const,
  byCard: (cardId: string) => [...shareKeys.all, cardId] as const,
};

export type CreateShareInput = {
  card: VaultCard;
  ttlId: ShareTtlId;
  recipientLabel?: string;
  maxViews?: number | null;
  /** Explicit sender choice — never omit; defaults to 'full' on the server. */
  revealScope: ShareRevealScope;
};

export type CreatedShare = {
  id: string;
  expiresAt: string;
  maxViews: number | null;
  recipientLabel: string | null;
  createdAt: string;
  revealScope: ShareRevealScope;
  url: string;
  appUrl: string;
};

const SHARE_SELECT =
  'id, card_id, owner_user_id, created_at, expires_at, revoked_at, max_views, view_count, last_viewed_at, recipient_label, reveal_scope';

export function useCardShares(cardId: string | undefined) {
  return useQuery({
    queryKey: shareKeys.byCard(cardId ?? ''),
    enabled: Boolean(cardId),
    queryFn: async (): Promise<CardShareRow[]> => {
      const { data, error } = await supabase
        .from('card_shares')
        .select(SHARE_SELECT)
        .eq('card_id', cardId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => mapShareRow(r as Record<string, unknown>));
    },
  });
}

export function useCreateCardShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateShareInput): Promise<CreatedShare> => {
      const { card } = input;
      if (card.txnLinkBlocked) {
        throw new Error(
          'Re-enter this card number in Edit before sharing — the device key can’t unlock it yet.',
        );
      }

      const revealScope = input.revealScope;
      let panEncrypted: string | null = null;
      let panIv: string | null = null;
      let panAuthTag: string | null = null;
      let keyB64Url: string | null = null;

      if (revealScope === 'full') {
        // SENSITIVE: plaintext PAN stays on-device — encrypt before any network call.
        const plain = await decryptFields(
          {
            pan: {
              ciphertext: card.cardNumberEncrypted,
              iv: card.cardNumberIv,
              authTag: card.cardNumberAuthTag,
            },
          },
          'Share this card',
        );
        const pan = plain.pan?.replace(/\D/g, '') ?? '';
        if (!pan) throw new Error('Could not unlock card number');
        if (pan.slice(-4) !== String(card.lastFour).slice(-4)) {
          throw new Error('Card number does not match this card');
        }

        const { field, keyB64Url: k } = await encryptPanForShare(pan);
        panEncrypted = field.ciphertext;
        panIv = field.iv;
        panAuthTag = field.authTag;
        keyB64Url = k;
        // pan goes out of scope — never included in the request body below.
      }

      const { data, error } = await supabase.functions.invoke('create-card-share', {
        body: {
          card_id: card.id,
          ttl_ms: ttlMsForPreset(input.ttlId),
          recipient_label: input.recipientLabel?.trim() || null,
          max_views: input.maxViews ?? null,
          reveal_scope: revealScope,
          // Ciphertext only when full — never plaintext PAN, never the share key.
          pan_encrypted: panEncrypted,
          pan_iv: panIv,
          pan_auth_tag: panAuthTag,
        },
      });

      if (error) {
        logger.warn('create-card-share invoke failed', error);
        throw new Error(error.message || 'Could not create share');
      }
      const body = data as {
        ok?: boolean;
        error?: string;
        share?: {
          id: string;
          expires_at: string;
          max_views: number | null;
          recipient_label: string | null;
          created_at: string;
          reveal_scope?: string;
        };
      };
      if (!body?.ok || !body.share) {
        throw new Error(body?.error || 'Could not create share');
      }

      const id = body.share.id;
      const scope = parseRevealScope(body.share.reveal_scope ?? revealScope);
      const url = shareWebUrl(id, undefined, scope === 'full' ? keyB64Url : null);
      const appUrl = shareAppUrl(id, scope === 'full' ? keyB64Url : null);

      if (scope === 'full' && keyB64Url) {
        await rememberShareLinkKey(id, keyB64Url);
      }

      return {
        id,
        expiresAt: body.share.expires_at,
        maxViews: body.share.max_views,
        recipientLabel: body.share.recipient_label,
        createdAt: body.share.created_at,
        revealScope: scope,
        url,
        appUrl,
      };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: shareKeys.byCard(vars.card.id) });
    },
    onError: (err) => {
      if (err instanceof BiometricRequiredError) return;
      if (isUnrecoverableCardError(err)) {
        logger.warn('Share create blocked — card txn-link blocked');
        return;
      }
      logger.warn('Share create failed', err);
    },
  });
}

export function useRevokeCardShare(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from('card_shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', shareId)
        .is('revoked_at', null);
      if (error) throw error;
      await forgetShareLinkKey(shareId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shareKeys.byCard(cardId) });
    },
  });
}

export type SharedCardPayload = {
  id: string;
  nickname: string;
  bankName: string;
  network: string;
  lastFour: string;
  expiryMonth: number;
  expiryYear: number;
  cardColorTheme: string;
  expiresAt: string;
  numberMasked: string;
  /** Full PAN groups when reveal_scope is 'full' and client decrypted; else null. */
  numberFull: string | null;
  /** Printed name when set — omit from UI when null. */
  cardholderName: string | null;
  revealScope: ShareRevealScope;
};

/**
 * Resolve a share. For full-number shares, `shareKeyB64Url` must come from the
 * URL fragment (or owner cache) — never from the server.
 */
export async function fetchSharedCard(
  shareId: string,
  accessMethod: 'web' | 'app',
  shareKeyB64Url?: string | null,
): Promise<
  | { ok: true; share: SharedCardPayload }
  | { ok: false; unavailable: true; message: string }
> {
  const keyFromCache = shareLinkKeyCache.peek(shareId);
  const key = shareKeyB64Url || keyFromCache;

  const { data, error } = await supabase.functions.invoke('view-card-share', {
    body: {
      share_id: shareId,
      access_method: accessMethod,
      fingerprint: `app:${accessMethod}`,
      // Never send the share key — fragment-only.
    },
  });

  if (error) {
    logger.warn('view-card-share invoke failed', error);
    return {
      ok: false,
      unavailable: true,
      message: 'This link is no longer available',
    };
  }

  const body = data as {
    ok?: boolean;
    unavailable?: boolean;
    message?: string;
    share?: Record<string, unknown>;
  };

  if (!body?.ok || !body.share) {
    return {
      ok: false,
      unavailable: true,
      message: body?.message || 'This link is no longer available',
    };
  }

  const s = body.share;
  const revealScope = parseRevealScope(s.reveal_scope);
  const lastFour = String(s.last_four ?? s.last4 ?? '');
  const numberMasked =
    String(s.number_masked ?? s.numberMasked ?? '') || maskPanLastFour(lastFour);
  const holderRaw = String(s.cardholderName ?? s.cardholder_name ?? '').trim();
  const cardholderName =
    holderRaw && holderRaw !== '-' && holderRaw !== '—' ? holderRaw : null;

  let numberFull: string | null = null;
  if (revealScope === 'full') {
    const ciphertext = String(s.pan_encrypted ?? '');
    const iv = String(s.pan_iv ?? '');
    const authTag = String(s.pan_auth_tag ?? '');
    if (!key) {
      return {
        ok: false,
        unavailable: true,
        message:
          'This link is incomplete. Ask the sender to share the full link again.',
      };
    }
    if (!ciphertext || !iv || !authTag) {
      return {
        ok: false,
        unavailable: true,
        message: 'This link is no longer available',
      };
    }
    try {
      const digits = await decryptPanFromShare(
        { ciphertext, iv, authTag },
        key,
      );
      numberFull = formatPanGroups(digits);
      shareLinkKeyCache.clear(shareId);
    } catch {
      return {
        ok: false,
        unavailable: true,
        message:
          'Could not decrypt this share. The link may be incomplete or corrupted.',
      };
    }
  }

  return {
    ok: true,
    share: {
      id: String(s.id),
      nickname: String(s.nickname),
      bankName: String(s.bank_name ?? s.bankName ?? ''),
      network: String(s.network),
      lastFour,
      expiryMonth: Number(s.expiry_month ?? s.expiryMonth),
      expiryYear: Number(s.expiry_year ?? s.expiryYear),
      cardColorTheme: String(s.card_color_theme ?? s.cardColorTheme ?? ''),
      expiresAt: String(s.expires_at ?? s.expiresAt),
      numberMasked,
      numberFull,
      cardholderName,
      revealScope,
    },
  };
}
