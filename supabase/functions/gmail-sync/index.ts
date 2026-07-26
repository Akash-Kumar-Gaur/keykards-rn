/**
 * gmail-sync — scheduled Edge Function.
 * Reads gmail.readonly for connected users, filters by bank sender domains,
 * runs the shared parser conceptually (TS mirror in Deno), inserts pending
 * transactions, and never retains raw bodies beyond raw_text_expires_at.
 *
 * Deploy: supabase functions deploy gmail-sync
 * Cron:   every 6h via supabase/config.toml or Dashboard schedules
 *
 * Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const BANK_DOMAINS = [
  'hdfcbank.net',
  'hdfcbank.com',
  'sbicard.com',
  'axisbank.com',
  'icicibank.com',
];

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret) {
    const hdr = req.headers.get('x-cron-secret');
    if (hdr !== cronSecret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Purge expired raw_text every run
  const { data: purged } = await supabase.rpc('purge_transaction_raw_text');

  const { data: connections } = await supabase
    .from('gmail_connections')
    .select('user_id, refresh_token_encrypted, status')
    .eq('status', 'connected');

  // Auto-finalize high-confidence Gmail pendings past grace
  const now = new Date().toISOString();
  await supabase
    .from('transactions')
    .update({ status: 'confirmed', auto_finalize_at: null })
    .eq('status', 'pending')
    .eq('source', 'gmail')
    .eq('source_confidence', 'high')
    .lte('auto_finalize_at', now);

  return new Response(
    JSON.stringify({
      ok: true,
      connections: connections?.length ?? 0,
      purged: purged ?? 0,
      note:
        'Wire Google token refresh + Gmail users.messages.list with query from bank domains, then insert pending rows. Parser lives in app src/lib/transactionParser.ts — port rules here or call a shared package.',
      bankDomains: BANK_DOMAINS,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
