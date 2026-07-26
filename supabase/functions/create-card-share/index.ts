/**
 * create-card-share — owner creates a time-limited view-only share.
 *
 * Auth: caller's Supabase JWT. Ownership of card_id is verified.
 *
 * E2E model: the client encrypts the PAN under a fresh per-share key BEFORE
 * calling this function. Body may include pan_encrypted / pan_iv / pan_auth_tag
 * (ciphertext only) — NEVER plaintext PAN and NEVER the share key. The key
 * lives only in the client's URL fragment (`#k=…`).
 *
 * For reveal_scope=last_four_only, no ciphertext is stored — only last_four
 * metadata (already non-secret).
 *
 * Deploy: supabase functions deploy create-card-share
 * Secrets: optional SHARE_PUBLIC_BASE_URL (base path only; no key in returned URL)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const MIN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function isB64Field(v: unknown, minLen = 8, maxLen = 512): v is string {
  return (
    typeof v === 'string' &&
    v.length >= minLen &&
    v.length <= maxLen &&
    /^[A-Za-z0-9+/=_-]+$/.test(v)
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const body = (await req.json()) as Record<string, unknown>;
    const cardId = typeof body.card_id === 'string' ? body.card_id : '';
    const recipientLabel =
      typeof body.recipient_label === 'string'
        ? body.recipient_label.trim().slice(0, 80) || null
        : null;
    const maxViews =
      body.max_views == null
        ? null
        : typeof body.max_views === 'number' &&
            Number.isInteger(body.max_views) &&
            body.max_views > 0
          ? Math.min(body.max_views, 100)
          : null;
    const ttlMs =
      typeof body.ttl_ms === 'number' && Number.isFinite(body.ttl_ms)
        ? Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, Math.floor(body.ttl_ms)))
        : DEFAULT_TTL_MS;
    const revealScope =
      body.reveal_scope === 'last_four_only' ? 'last_four_only' : 'full';

    // Hard rule: reject if any CVV-shaped or plaintext-PAN field sneaks in.
    if (
      body.cvv != null ||
      body.CVV != null ||
      body.security_code != null ||
      body.cvc != null
    ) {
      return json({ ok: false, error: 'CVV must never be included in a share' }, 400);
    }
    if (body.pan != null || body.card_number != null || body.number_full != null) {
      return json(
        {
          ok: false,
          error:
            'Plaintext card number must never be sent — encrypt on-device first',
        },
        400,
      );
    }
    // Share key must never arrive server-side.
    if (
      body.share_key != null ||
      body.key != null ||
      body.k != null ||
      body.shareKey != null
    ) {
      return json(
        { ok: false, error: 'Share key must never be sent to the server' },
        400,
      );
    }

    if (!cardId) {
      return json({ ok: false, error: 'card_id required' }, 400);
    }

    let panEncrypted: string | null = null;
    let panIv: string | null = null;
    let panAuthTag: string | null = null;

    if (revealScope === 'full') {
      if (
        !isB64Field(body.pan_encrypted) ||
        !isB64Field(body.pan_iv, 8, 64) ||
        !isB64Field(body.pan_auth_tag, 8, 64)
      ) {
        return json(
          {
            ok: false,
            error: 'Encrypted card number (pan_encrypted, pan_iv, pan_auth_tag) required',
          },
          400,
        );
      }
      panEncrypted = body.pan_encrypted;
      panIv = body.pan_iv;
      panAuthTag = body.pan_auth_tag;
    }

    const { data: card, error: cardErr } = await userClient
      .from('cards')
      .select(
        'id, user_id, nickname, bank_name, network, last_four, cardholder_name, expiry_month, expiry_year, card_color_theme, needs_refresh',
      )
      .eq('id', cardId)
      .maybeSingle();

    if (cardErr || !card) {
      return json({ ok: false, error: 'Card not found' }, 404);
    }
    if (card.user_id !== user.id) {
      return json({ ok: false, error: 'Forbidden' }, 403);
    }
    if (card.needs_refresh) {
      return json(
        {
          ok: false,
          error:
            'This card needs refresh before it can be shared. Re-enter the card number in Edit card.',
        },
        400,
      );
    }

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlMs);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: share, error: insertErr } = await admin
      .from('card_shares')
      .insert({
        card_id: cardId,
        owner_user_id: user.id,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        max_views: maxViews,
        recipient_label: recipientLabel,
        reveal_scope: revealScope,
        nickname: card.nickname,
        bank_name: card.bank_name,
        network: card.network,
        last_four: card.last_four,
        cardholder_name:
          typeof card.cardholder_name === 'string' && card.cardholder_name.trim()
            ? card.cardholder_name.trim().slice(0, 80)
            : null,
        expiry_month: card.expiry_month,
        expiry_year: card.expiry_year,
        card_color_theme: card.card_color_theme,
        pan_encrypted: panEncrypted,
        pan_iv: panIv,
        pan_auth_tag: panAuthTag,
      })
      .select('id, expires_at, max_views, recipient_label, created_at, reveal_scope')
      .single();

    if (insertErr || !share) {
      console.error('create-card-share insert failed', insertErr?.message);
      return json({ ok: false, error: 'Could not create share' }, 500);
    }

    // Base path only — client appends `#k=…` locally. Never embed a key here.
    const base =
      Deno.env.get('SHARE_PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
      'https://keykards.redevolve.in';
    const url = `${base}/shared/${share.id}`;
    const appUrl = `keykards://shared/${share.id}`;

    return json({
      ok: true,
      share: {
        id: share.id,
        expires_at: share.expires_at,
        max_views: share.max_views,
        recipient_label: share.recipient_label,
        created_at: share.created_at,
        reveal_scope: share.reveal_scope ?? revealScope,
        url,
        app_url: appUrl,
      },
    });
  } catch (err) {
    console.error(
      'create-card-share failed',
      err instanceof Error ? err.message : 'unknown',
    );
    return json({ ok: false, error: 'Share creation failed' }, 500);
  }
});
