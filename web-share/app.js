/**
 * Lightweight share viewer — calls resolve/view-card-share, never caches.
 * E2E: ciphertext comes from the server; the AES key is read ONLY from the
 * URL fragment (`#k=…`) and never sent in the fetch body.
 *
 * reveal_scope:
 *   - 'full' → decrypt locally, masked + tap to reveal
 *   - 'last_four_only' → show last 4 directly, no key / ciphertext needed
 */
(function () {
  const cfg = window.INWALLET_SHARE || {};
  const statusEl = document.getElementById('status');
  const cardEl = document.getElementById('card');
  const expiresEl = document.getElementById('expires');
  const cardholderEl = document.getElementById('cardholder');
  const numberEl = document.getElementById('number');
  const eyeEl = document.getElementById('eye');
  const revealBtn = document.getElementById('reveal');
  const scopeNoteEl = document.getElementById('scope-note');

  let revealed = false;
  let masked = '';
  let full = '';
  let canReveal = false;

  function shareIdFromPath() {
    const parts = location.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'shared');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    const q = new URLSearchParams(location.search).get('id');
    return q || parts[parts.length - 1] || '';
  }

  /** Fragment-only — never included in network requests. */
  function shareKeyFromHash() {
    const hash = (location.hash || '').replace(/^#/, '');
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const k = params.get('k');
    if (k && /^[A-Za-z0-9_-]+$/.test(k)) return k;
    return null;
  }

  function b64ToBytes(b64) {
    const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (normalized.length % 4)) % 4;
    const bin = atob(normalized + '='.repeat(pad));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function formatPanGroups(digits) {
    const d = String(digits).replace(/\D/g, '');
    return d.replace(/(.{4})/g, '$1 ').trim();
  }

  async function decryptPan(field, keyB64Url) {
    const rawKey = b64ToBytes(keyB64Url);
    if (rawKey.length !== 32) throw new Error('bad key');
    const key = await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );
    rawKey.fill(0);
    const iv = b64ToBytes(field.iv);
    const ciphertext = b64ToBytes(field.ciphertext);
    const authTag = b64ToBytes(field.authTag);
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      key,
      combined,
    );
    return new TextDecoder().decode(buf);
  }

  function showUnavailable(message) {
    statusEl.classList.add('error');
    statusEl.textContent =
      message || 'This link is no longer available';
    cardEl.classList.add('hidden');
    expiresEl.classList.add('hidden');
    if (cardholderEl) cardholderEl.classList.add('hidden');
    if (scopeNoteEl) scopeNoteEl.classList.add('hidden');
  }

  function themeGradient(themeId) {
    const map = {
      'hdfc-maroon': ['#6B1D2A', '#2A0A10'],
      'amex-gunmetal': ['#3A3F47', '#1A1C20'],
      'generic-emerald': ['#0F5C4C', '#062A22'],
      'sbi-blue': ['#1B3A6B', '#0A1628'],
      'axis-burgundy': ['#5C1A2E', '#1E080F'],
      'icici-orange': ['#C45C1A', '#2A1206'],
    };
    return map[themeId] || ['#2a2a4a', '#1a1a2e'];
  }

  function render(share) {
    statusEl.classList.add('hidden');
    cardEl.classList.remove('hidden');
    expiresEl.classList.remove('hidden');

    const [c0, c1] = themeGradient(share.card_color_theme);
    cardEl.style.background = `linear-gradient(135deg, ${c0}, ${c1})`;

    document.getElementById('bank').textContent = share.bank_name || '';
    document.getElementById('nick').textContent = share.nickname || '';
    document.getElementById('network').textContent = share.network || '';
    const mm = String(share.expiry_month).padStart(2, '0');
    const yy = String(share.expiry_year).slice(-2);
    document.getElementById('exp').textContent = `EXP ${mm}/${yy}`;

    masked = share.number_masked;
    full = share._decryptedFull || '';
    const scope = share.reveal_scope === 'last_four_only' ? 'last_four_only' : 'full';
    canReveal = scope === 'full' && Boolean(full);

    numberEl.textContent = masked;
    revealed = false;

    if (canReveal) {
      revealBtn.disabled = false;
      revealBtn.classList.remove('disabled');
      eyeEl.textContent = '👁';
      eyeEl.hidden = false;
      revealBtn.setAttribute('aria-label', 'Show card number');
      if (scopeNoteEl) {
        scopeNoteEl.textContent =
          'View-only · tap the number to reveal · decrypted on this device · CVV is never shared';
        scopeNoteEl.classList.remove('hidden');
      }
    } else {
      revealBtn.disabled = true;
      revealBtn.classList.add('disabled');
      eyeEl.hidden = true;
      revealBtn.removeAttribute('aria-label');
      if (scopeNoteEl) {
        scopeNoteEl.textContent =
          'The sender shared only the last 4 digits and expiry for this card. CVV is never shared.';
        scopeNoteEl.classList.remove('hidden');
      }
    }

    expiresEl.textContent = share.expires_at
      ? `Expires ${new Date(share.expires_at).toLocaleString()}`
      : '';

    // Only show cardholder when a real name is present — never "—".
    const holder = String(
      share.cardholderName || share.cardholder_name || '',
    ).trim();
    if (cardholderEl) {
      if (holder && holder !== '-' && holder !== '—') {
        cardholderEl.textContent = `Name on card · ${holder}`;
        cardholderEl.classList.remove('hidden');
      } else {
        cardholderEl.textContent = '';
        cardholderEl.classList.add('hidden');
      }
    }
  }

  revealBtn.addEventListener('click', () => {
    if (!canReveal) return;
    revealed = !revealed;
    numberEl.textContent = revealed ? full : masked;
    eyeEl.textContent = revealed ? '🙈' : '👁';
    revealBtn.setAttribute(
      'aria-label',
      revealed ? 'Hide card number' : 'Show card number',
    );
  });

  async function load() {
    const id = shareIdFromPath();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      showUnavailable();
      return;
    }

    const base = (cfg.SHARE_FUNCTIONS_BASE || '').replace(/\/$/, '');
    const anon = cfg.ANON_KEY || '';
    if (!base || !anon) {
      showUnavailable(
        'This share page is not configured yet. Set SHARE_FUNCTIONS_BASE and ANON_KEY in config.js.',
      );
      return;
    }

    // Read key from fragment BEFORE fetch — never put it in the request.
    const fragmentKey = shareKeyFromHash();

    try {
      const endpoints = [`${base}/resolve-card-share`, `${base}/view-card-share`];
      let data = null;
      for (const url of endpoints) {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anon}`,
            apikey: anon,
            'Cache-Control': 'no-store',
          },
          cache: 'no-store',
          body: JSON.stringify({
            share_id: id,
            access_method: 'web',
            fingerprint: `web:${navigator.userAgent.slice(0, 48)}`,
          }),
        });
        if (res.status === 404) continue;
        data = await res.json();
        break;
      }

      if (!data || !data.ok || !data.share) {
        showUnavailable(data && data.message);
        return;
      }

      const share = data.share;
      const scope =
        share.reveal_scope === 'last_four_only' ? 'last_four_only' : 'full';

      if (scope === 'full') {
        if (!fragmentKey) {
          showUnavailable(
            'This link is missing its decryption key. Ask the sender for the full link (it includes a #k=… fragment).',
          );
          return;
        }
        if (!share.pan_encrypted || !share.pan_iv || !share.pan_auth_tag) {
          showUnavailable();
          return;
        }
        try {
          const digits = await decryptPan(
            {
              ciphertext: share.pan_encrypted,
              iv: share.pan_iv,
              authTag: share.pan_auth_tag,
            },
            fragmentKey,
          );
          share._decryptedFull = formatPanGroups(digits);
        } catch {
          showUnavailable(
            'Could not decrypt this share. The link may be incomplete or corrupted.',
          );
          return;
        }
      }

      render(share);
    } catch {
      showUnavailable();
    }
  }

  load();
})();
