/**
 * delete-account — permanently delete the authenticated user's account.
 *
 * Auth: caller's Supabase JWT. Service role performs cascade wipe + auth.users
 * delete. This cannot be done from the client SDK alone.
 *
 * Order:
 *  1. Revoke active card_shares (set revoked_at) so live links die immediately
 *  2. Explicitly delete user-owned rows (defensive; FKs also CASCADE)
 *  3. Delete auth.users — cascades profiles + any remaining owned rows
 *
 * On any failure before auth deletion completes, returns 5xx so the client can
 * surface a clear error (never silently leave a half-deleted account).
 *
 * Deploy: supabase functions deploy delete-account
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: 'Server misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

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

  const uid = user.id;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const counts: Record<string, number> = {};

  const fail = (step: string, message: string) =>
    json(
      {
        ok: false,
        error: `Account deletion failed at step "${step}": ${message}. Your account was not fully removed. Contact support@redevolve.in with this message so we can finish the wipe.`,
        step,
        counts,
      },
      500,
    );

  try {
    // 1) Revoke live shares first — resolve-card-share checks revoked_at.
    {
      const { data, error } = await admin
        .from('card_shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('owner_user_id', uid)
        .is('revoked_at', null)
        .select('id');
      if (error) return fail('revoke_card_shares', error.message);
      counts.shares_revoked = data?.length ?? 0;
    }

    const { data: cardRows, error: cardsLookupErr } = await admin
      .from('cards')
      .select('id')
      .eq('user_id', uid);
    if (cardsLookupErr) return fail('list_cards', cardsLookupErr.message);
    const cardIds = (cardRows ?? []).map((c: { id: string }) => c.id);
    counts.cards_found = cardIds.length;

    let milestoneIds: string[] = [];
    if (cardIds.length > 0) {
      const { data: milRows, error: milLookupErr } = await admin
        .from('card_milestones')
        .select('id')
        .in('card_id', cardIds);
      if (milLookupErr) return fail('list_milestones', milLookupErr.message);
      milestoneIds = (milRows ?? []).map((m: { id: string }) => m.id);
    }

    // 2) Explicit deletes (children → parents). Auth delete also CASCADEs;
    // doing these first makes partial failures attributable.
    if (milestoneIds.length > 0) {
      const { data, error } = await admin
        .from('milestone_cycles')
        .delete()
        .in('milestone_id', milestoneIds)
        .select('id');
      if (error) return fail('milestone_cycles', error.message);
      counts.milestone_cycles = data?.length ?? 0;
    }

    if (cardIds.length > 0) {
      {
        const { data, error } = await admin
          .from('card_milestones')
          .delete()
          .in('card_id', cardIds)
          .select('id');
        if (error) return fail('card_milestones', error.message);
        counts.card_milestones = data?.length ?? 0;
      }
      {
        const { data, error } = await admin
          .from('card_benefits')
          .delete()
          .in('card_id', cardIds)
          .select('id');
        if (error) return fail('card_benefits', error.message);
        counts.card_benefits = data?.length ?? 0;
      }
    }

    {
      const { data, error } = await admin
        .from('card_shares')
        .delete()
        .eq('owner_user_id', uid)
        .select('id');
      if (error) return fail('card_shares', error.message);
      counts.card_shares = data?.length ?? 0;
    }
    {
      const { data, error } = await admin
        .from('points_ledger')
        .delete()
        .eq('user_id', uid)
        .select('id');
      if (error) return fail('points_ledger', error.message);
      counts.points_ledger = data?.length ?? 0;
    }
    {
      const { data, error } = await admin
        .from('statement_imports')
        .delete()
        .eq('user_id', uid)
        .select('id');
      if (error) return fail('statement_imports', error.message);
      counts.statement_imports = data?.length ?? 0;
    }
    {
      const { data, error } = await admin
        .from('transactions')
        .delete()
        .eq('user_id', uid)
        .select('id');
      if (error) return fail('transactions', error.message);
      counts.transactions = data?.length ?? 0;
    }
    {
      const { data, error } = await admin
        .from('cards')
        .delete()
        .eq('user_id', uid)
        .select('id');
      if (error) return fail('cards', error.message);
      counts.cards = data?.length ?? 0;
    }
    {
      const { data, error } = await admin
        .from('purchase_protection_logs')
        .delete()
        .eq('user_id', uid)
        .select('id');
      if (error) return fail('purchase_protection_logs', error.message);
      counts.purchase_protection_logs = data?.length ?? 0;
    }
    {
      const { data, error } = await admin
        .from('benefit_checklist_checks')
        .delete()
        .eq('user_id', uid)
        .select('id');
      if (error) return fail('benefit_checklist_checks', error.message);
      counts.benefit_checklist_checks = data?.length ?? 0;
    }
    {
      const { data, error } = await admin
        .from('gmail_connections')
        .delete()
        .eq('user_id', uid)
        .select('user_id');
      if (error) return fail('gmail_connections', error.message);
      counts.gmail_connections = data?.length ?? 0;
    }
    {
      const { data, error } = await admin
        .from('key_recovery')
        .delete()
        .eq('user_id', uid)
        .select('id');
      if (error) return fail('key_recovery', error.message);
      counts.key_recovery = data?.length ?? 0;
    }
    {
      const { data, error } = await admin
        .from('key_recovery_attempts')
        .delete()
        .eq('user_id', uid)
        .select('user_id');
      if (error) return fail('key_recovery_attempts', error.message);
      counts.key_recovery_attempts = data?.length ?? 0;
    }
    {
      const { data, error } = await admin
        .from('profiles')
        .delete()
        .eq('id', uid)
        .select('id');
      if (error) return fail('profiles', error.message);
      counts.profiles = data?.length ?? 0;
    }

    // 3) Delete the auth user — remaining CASCADE cleanup + removes login.
    const { error: authDelErr } = await admin.auth.admin.deleteUser(uid);
    if (authDelErr) {
      return fail('delete_auth_user', authDelErr.message);
    }
    counts.auth_user_deleted = 1;

    return json({ ok: true, counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return fail('unexpected', message);
  }
});
