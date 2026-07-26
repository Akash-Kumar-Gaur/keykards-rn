/**
 * known_cards queue access for discovery + extraction.
 */

import { getSupabase } from './supabase.js';
import { discoveryKey } from './normalize.js';
import { serializeError } from './errors.js';
import type { DiscoveredCard } from './discoveryLlm.js';

function throwDb(error: unknown): never {
  throw new Error(serializeError(error));
}

export type KnownCardRow = {
  id: string;
  bank_name: string;
  card_name: string;
  bank_name_norm: string;
  card_name_norm: string;
  card_type: 'credit' | 'debit';
  detail_url: string;
  discovered_from: string;
  extraction_status: 'pending' | 'extracted' | 'failed' | 'skipped';
  failure_count: number;
  last_error: string | null;
  card_catalog_id: string | null;
};

export async function upsertDiscoveredCards(opts: {
  cards: DiscoveredCard[];
  discoveredFrom: string;
  dryRun?: boolean;
}): Promise<{ inserted: number; refreshed: number }> {
  let inserted = 0;
  let refreshed = 0;
  const now = new Date().toISOString();

  for (const card of opts.cards) {
    const { bank_name_norm, card_name_norm } = discoveryKey(
      card.bank_name,
      card.card_name,
    );
    if (!bank_name_norm || !card_name_norm) continue;

    if (opts.dryRun) {
      inserted += 1;
      continue;
    }

    const sb = getSupabase();
    const existing = await sb
      .from('known_cards')
      .select('id, extraction_status')
      .eq('bank_name_norm', bank_name_norm)
      .eq('card_name_norm', card_name_norm)
      .maybeSingle();

    if (existing.error) throwDb(existing.error);

    if (existing.data?.id) {
      const { error } = await sb
        .from('known_cards')
        .update({
          last_seen_at: now,
          updated_at: now,
          // Prefer a fresher detail URL when rediscovered
          detail_url: card.detail_url,
          discovered_from: opts.discoveredFrom,
        })
        .eq('id', existing.data.id);
      if (error) throwDb(error);
      refreshed += 1;
    } else {
      const { error } = await sb.from('known_cards').insert({
        bank_name: card.bank_name,
        card_name: card.card_name,
        bank_name_norm,
        card_name_norm,
        card_type: card.card_type,
        detail_url: card.detail_url,
        discovered_from: opts.discoveredFrom,
        first_seen_at: now,
        last_seen_at: now,
        extraction_status: 'pending',
        failure_count: 0,
        updated_at: now,
      });
      if (error) throwDb(error);
      inserted += 1;
    }
  }

  return { inserted, refreshed };
}

export async function loadPendingKnownCards(limit: number): Promise<KnownCardRow[]> {
  const { data, error } = await getSupabase()
    .from('known_cards')
    .select(
      'id, bank_name, card_name, bank_name_norm, card_name_norm, card_type, detail_url, discovered_from, extraction_status, failure_count, last_error, card_catalog_id',
    )
    .eq('extraction_status', 'pending')
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (error) throwDb(error);
  return (data as KnownCardRow[]) ?? [];
}

export async function markKnownCardExtracted(opts: {
  id: string;
  catalogId: string | null;
}): Promise<void> {
  const { error } = await getSupabase()
    .from('known_cards')
    .update({
      extraction_status: 'extracted',
      card_catalog_id: opts.catalogId,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.id);
  if (error) throwDb(error);
}

export async function markKnownCardFailure(opts: {
  id: string;
  error: string;
  failThreshold?: number;
}): Promise<'pending' | 'failed'> {
  const threshold = opts.failThreshold ?? 3;
  const sb = getSupabase();
  const cur = await sb
    .from('known_cards')
    .select('failure_count')
    .eq('id', opts.id)
    .maybeSingle();
  if (cur.error) throwDb(cur.error);
  const next = (cur.data?.failure_count ?? 0) + 1;
  const status = next >= threshold ? 'failed' : 'pending';
  const { error } = await sb
    .from('known_cards')
    .update({
      failure_count: next,
      last_error: opts.error.slice(0, 500),
      extraction_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.id);
  if (error) throwDb(error);
  return status;
}

export async function setKnownCardStatus(
  id: string,
  status: 'pending' | 'extracted' | 'failed' | 'skipped',
): Promise<void> {
  const { error } = await getSupabase()
    .from('known_cards')
    .update({
      extraction_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throwDb(error);
}

export async function knownCardsStatusCounts(): Promise<
  Record<'pending' | 'extracted' | 'failed' | 'skipped', number>
> {
  const counts = { pending: 0, extracted: 0, failed: 0, skipped: 0 };
  for (const status of Object.keys(counts) as Array<keyof typeof counts>) {
    const { count, error } = await getSupabase()
      .from('known_cards')
      .select('id', { count: 'exact', head: true })
      .eq('extraction_status', status);
    if (error) throwDb(error);
    counts[status] = count ?? 0;
  }
  return counts;
}
