/**
 * purge-raw-text — daily cron to clear transaction raw_text past retention.
 * Can also be invoked from gmail-sync.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('purge_transaction_raw_text');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ purged: data ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
