/**
 * Shared share-resolution handler used by BOTH `view-card-share` and
 * `resolve-card-share` (the website historically calls the latter name).
 *
 * On every request (no caching):
 *   1. Rate-limit by client fingerprint
 *   2. consume_card_share_view() — checks revoked_at FIRST, then expiry, then max_views
 *   3. Return metadata + (for full shares) ciphertext envelope ONLY
 *      — NO server-side decrypt; the client decrypts with the key from the
 *        URL fragment (`#k=…`), which is never sent to this function.
 *
 * CVV is never stored or returned. Plaintext PAN never appears here.
 *
 * Diagnostics: the "unavailable" response is intentionally generic in
 * production (no enumeration). Set SHARE_DEBUG_REASONS=true on a dev/staging
 * project to include a precise `reason` in the response. The reason is ALWAYS
 * logged server-side regardless of the flag.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-share-fingerprint',
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_ATTEMPTS = 30; // per fingerprint per minute (valid + invalid)

const NO_STORE = {
  ...CORS,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0',
};

type Reason =
  | 'not_found'
  | 'revoked'
  | 'expired'
  | 'exhausted'
  | 'rate_limited'
  | 'missing_ciphertext'
  | 'error';

function debugReasonsEnabled(): boolean {
  return (Deno.env.get('SHARE_DEBUG_REASONS') ?? '').toLowerCase() === 'true';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: NO_STORE });
}

function maskPan(lastFour: string): string {
  const four = lastFour.replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `•••• •••• •••• ${four}`;
}

/**
 * Same generic "unavailable" body for every failure in production — no
 * enumeration. `reason` is always logged; it is only echoed to the client
 * when SHARE_DEBUG_REASONS=true (dev/staging).
 */
function unavailable(reason: Reason, shareId?: string) {
  console.error(
    `resolve-share unavailable reason=${reason}` +
      (shareId ? ` share_id=${shareId}` : ''),
  );
  const body: Record<string, unknown> = {
    ok: false,
    unavailable: true,
    message: 'This link is no longer available',
  };
  if (debugReasonsEnabled()) {
    body.reason = reason;
    body.message =
      reason === 'not_found'
        ? 'Share not found (wrong project / query bug / never created)'
        : reason === 'revoked'
          ? 'Share was revoked'
          : reason === 'expired'
            ? 'Share has expired'
            : reason === 'exhausted'
              ? 'Share view limit reached'
              : reason === 'rate_limited'
                ? 'Rate limited — too many attempts'
                : reason === 'missing_ciphertext'
                  ? 'Share is missing ciphertext envelope'
                  : 'Unexpected error resolving share';
  }
  return json(body);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function diagnoseReason(
  admin: ReturnType<typeof createClient>,
  shareId: string,
): Promise<Reason> {
  const { data } = await admin
    .from('card_shares')
    .select('revoked_at, expires_at, max_views, view_count')
    .eq('id', shareId)
    .maybeSingle();
  if (!data) return 'not_found';
  if (data.revoked_at != null) return 'revoked';
  if (
    typeof data.expires_at === 'string' &&
    new Date(data.expires_at).getTime() <= Date.now()
  ) {
    return 'expired';
  }
  if (data.max_views != null && data.view_count >= data.max_views) {
    return 'exhausted';
  }
  return 'not_found';
}

export async function handleResolveShare(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(req.url);
    let shareId =
      url.searchParams.get('id') ??
      url.pathname.split('/').filter(Boolean).pop() ??
      '';

    let accessMethod: 'web' | 'app' = 'web';
    let clientHint = req.headers.get('x-share-fingerprint') ?? '';

    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      if (typeof body.share_id === 'string') shareId = body.share_id;
      else if (typeof body.shareId === 'string') shareId = body.shareId;
      if (body.access_method === 'app' || body.access_method === 'web') {
        accessMethod = body.access_method;
      }
      if (typeof body.fingerprint === 'string') {
        clientHint = body.fingerprint;
      }
      // Reject accidental key leakage into the resolve body.
      if (
        body.share_key != null ||
        body.key != null ||
        body.k != null ||
        body.shareKey != null
      ) {
        console.error('resolve-share rejected: share key must not be sent to server');
        return unavailable('error', shareId);
      }
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        shareId,
      )
    ) {
      return unavailable('not_found', shareId);
    }

    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const ua = req.headers.get('user-agent') ?? '';
    const fingerprint = await sha256Hex(
      `${clientHint || 'anon'}|${forwarded}|${ua.slice(0, 80)}`,
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: rateRow } = await admin
      .from('card_share_rate_limits')
      .select('fingerprint, window_started_at, attempt_count')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    const now = Date.now();
    if (rateRow) {
      const started = new Date(rateRow.window_started_at).getTime();
      if (now - started < RATE_WINDOW_MS && rateRow.attempt_count >= RATE_MAX_ATTEMPTS) {
        return unavailable('rate_limited', shareId);
      }
      if (now - started >= RATE_WINDOW_MS) {
        await admin
          .from('card_share_rate_limits')
          .upsert({
            fingerprint,
            window_started_at: new Date().toISOString(),
            attempt_count: 1,
          });
      } else {
        await admin
          .from('card_share_rate_limits')
          .update({ attempt_count: rateRow.attempt_count + 1 })
          .eq('fingerprint', fingerprint);
      }
    } else {
      await admin.from('card_share_rate_limits').insert({
        fingerprint,
        window_started_at: new Date().toISOString(),
        attempt_count: 1,
      });
    }

    const { data: share, error: consumeErr } = await admin.rpc(
      'consume_card_share_view',
      { p_share_id: shareId },
    );

    if (consumeErr || !share) {
      const reason = debugReasonsEnabled()
        ? await diagnoseReason(admin, shareId)
        : 'not_found';
      return unavailable(reason, shareId);
    }

    const row = Array.isArray(share) ? share[0] : share;
    if (!row || typeof row !== 'object') {
      return unavailable('not_found', shareId);
    }

    const s = row as Record<string, unknown>;

    if (s.revoked_at != null) return unavailable('revoked', shareId);
    if (typeof s.expires_at === 'string' && new Date(s.expires_at).getTime() <= Date.now()) {
      return unavailable('expired', shareId);
    }

    const revealScope =
      s.reveal_scope === 'last_four_only' ? 'last_four_only' : 'full';

    const lastFour = String(s.last_four ?? '').replace(/\D/g, '').slice(-4);
    const numberMasked = maskPan(lastFour);
    const holderRaw =
      typeof s.cardholder_name === 'string' ? s.cardholder_name.trim() : '';
    // Omit empty / dash placeholders — never send a fake "-" to viewers.
    const cardholderName =
      holderRaw && holderRaw !== '-' && holderRaw !== '—' && holderRaw !== '–'
        ? holderRaw
        : null;

    let panEncrypted: string | null = null;
    let panIv: string | null = null;
    let panAuthTag: string | null = null;

    if (revealScope === 'full') {
      panEncrypted =
        typeof s.pan_encrypted === 'string' && s.pan_encrypted.length > 0
          ? s.pan_encrypted
          : null;
      panIv =
        typeof s.pan_iv === 'string' && s.pan_iv.length > 0 ? s.pan_iv : null;
      panAuthTag =
        typeof s.pan_auth_tag === 'string' && s.pan_auth_tag.length > 0
          ? s.pan_auth_tag
          : null;
      if (!panEncrypted || !panIv || !panAuthTag) {
        return unavailable('missing_ciphertext', shareId);
      }
    }

    const approxLocation =
      req.headers.get('x-vercel-ip-city') ||
      req.headers.get('cf-ipcity') ||
      null;

    await admin.from('card_share_access_log').insert({
      share_id: shareId,
      access_method: accessMethod,
      approximate_location: approxLocation,
      client_fingerprint: fingerprint,
    });

    const mm = String(Number(s.expiry_month)).padStart(2, '0');
    const yy = String(Number(s.expiry_year)).slice(-2);
    const expiryLabel = `${mm}/${yy}`;

    // number_full / cardNumber stay null — client decrypts with fragment key.
    // cardholderName is omitted entirely when unset so viewers don't show "—".
    const payload = {
      ok: true as const,
      unavailable: false as const,
      status: 'valid' as const,
      share: {
        id: shareId,
        nickname: String(s.nickname),
        bank_name: String(s.bank_name),
        network: String(s.network),
        last_four: lastFour,
        expiry_month: Number(s.expiry_month),
        expiry_year: Number(s.expiry_year),
        card_color_theme: String(s.card_color_theme),
        expires_at: String(s.expires_at),
        reveal_scope: revealScope,
        number_masked: numberMasked,
        number_full: null,
        pan_encrypted: panEncrypted,
        pan_iv: panIv,
        pan_auth_tag: panAuthTag,
        cvv: null,
        cardNumber: null,
        last4: lastFour,
        expiresAt: String(s.expires_at),
        expiry: expiryLabel,
        bankName: String(s.bank_name),
        ...(cardholderName
          ? { cardholderName, cardholder_name: cardholderName }
          : {}),
      },
      card: {
        cardNumber: null,
        last4: lastFour,
        expiresAt: String(s.expires_at),
        expiry: expiryLabel,
        bankName: String(s.bank_name),
        nickname: String(s.nickname),
        network: String(s.network),
        card_color_theme: String(s.card_color_theme),
        reveal_scope: revealScope,
        number_masked: numberMasked,
        number_full: null,
        pan_encrypted: panEncrypted,
        pan_iv: panIv,
        pan_auth_tag: panAuthTag,
        ...(cardholderName
          ? { cardholderName, cardholder_name: cardholderName }
          : {}),
      },
    };

    return json(payload);
  } catch (err) {
    console.error(
      'resolve-share failed',
      err instanceof Error ? err.message : 'unknown',
    );
    return unavailable('error');
  }
}
