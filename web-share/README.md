# InWallet standalone share viewer

Lightweight static page for `https://inwallet.redevolve.in/shared/{share_id}`.
**Not** the Expo / React Native app — deploy this folder alongside the marketing
site (or under `/shared`) and rewrite `/shared/*` → `index.html`.

## Setup

1. Copy `config.example.js` → `config.js` (or edit `config.js` in place).
2. Set:
   - `SHARE_FUNCTIONS_BASE` → `https://<project>.supabase.co/functions/v1`
   - `ANON_KEY` → your Supabase anon key
3. Deploy the folder so `/shared/:id` serves this viewer (SPA fallback / rewrite).
4. Edge secrets already point here:
   ```bash
   supabase secrets set SHARE_PUBLIC_BASE_URL=https://inwallet.redevolve.in
   ```
5. Apply migration `0016_card_shares.sql` if not already applied.

## Behavior

- On load, POSTs to `view-card-share` with `Cache-Control: no-store`.
- Server checks `revoked_at` **before** `expires_at` on every request.
- Card number is masked by default; tap to reveal. CVV is never returned.
- Failed / revoked / expired links all show “This link is no longer available”.
