/**
 * Supabase access for the catalog scraper (service role).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { mapBenefitCategory, mapNetwork, coerceCatalogTheme } from './categoryMap.js';
import { serializeError } from './errors.js';
import { normalizeExtractionBenefits } from './annualizeBenefits.js';
import type { CatalogSource } from './sources.js';
import type { LlmExtraction, ScrapeStatus } from './types.js';

let client: SupabaseClient | null = null;

function throwDb(error: unknown): never {
  throw new Error(serializeError(error));
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      throw new Error('Supabase service credentials missing');
    }
    client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export type CatalogRow = {
  id: string;
  bank_name: string;
  card_name: string;
  source: string;
  last_verified_at: string | null;
  raw_source_url: string | null;
  refresh_priority?: string | null;
};

export async function loadCatalogIndex(): Promise<CatalogRow[]> {
  const { data, error } = await getSupabase()
    .from('card_catalog')
    .select(
      'id, bank_name, card_name, source, last_verified_at, raw_source_url, refresh_priority',
    );
  if (error) throwDb(error);
  return (data as CatalogRow[]) ?? [];
}

export function findCatalogMatch(
  rows: CatalogRow[],
  bank: string,
  card: string,
): CatalogRow | undefined {
  const b = bank.toLowerCase();
  const c = card.toLowerCase();
  return rows.find(
    (r) =>
      r.bank_name.toLowerCase() === b && r.card_name.toLowerCase() === c,
  );
}

export async function writeScrapeLog(input: {
  source_url: string | null;
  bank_name: string;
  card_name: string;
  status: ScrapeStatus;
  confidence?: string | null;
  raw_snippet?: string | null;
  proposed_json?: unknown;
  error_message?: string | null;
}): Promise<void> {
  const { error } = await getSupabase().from('catalog_scrape_log').insert({
    run_at: new Date().toISOString(),
    source_url: input.source_url,
    bank_name: input.bank_name,
    card_name: input.card_name,
    status: input.status,
    confidence: input.confidence ?? null,
    raw_snippet: input.raw_snippet ?? null,
    proposed_json: input.proposed_json ?? null,
    error_message: input.error_message ?? null,
  });
  if (error) throwDb(error);
}

export async function upsertAutoCatalog(opts: {
  source: CatalogSource;
  extraction: LlmExtraction;
  sourceUrl: string;
  dryRun: boolean;
  /** When true (CLI --force --ids), refresh even protected manual seed rows. */
  overwriteManual?: boolean;
}): Promise<
  | { outcome: 'inserted' | 'updated'; catalogId: string; needsReview: boolean }
  | { outcome: 'skipped_manual' | 'dry_run'; catalogId: null; needsReview: false }
> {
  const bank = opts.extraction.bank_name || opts.source.issuer;
  const card = opts.extraction.card_name || opts.source.name;
  const network = mapNetwork(
    opts.extraction.network ?? opts.source.network,
    opts.source.network,
  );
  // Bank-inspired default wins unless LLM returns a known allowed theme key.
  const theme = coerceCatalogTheme(opts.extraction.card_color_theme, bank);
  const annualFee =
    opts.extraction.annual_fee ?? opts.source.annualFee ?? null;
  const normalized = normalizeExtractionBenefits(
    opts.extraction.benefits.map((b) => ({
      title: b.title,
      category: b.category,
      description: b.description,
      value_estimate:
        b.value_estimate != null && Number.isFinite(b.value_estimate)
          ? b.value_estimate
          : null,
      period_raw: b.period_raw ?? null,
    })),
    annualFee,
  );

  if (normalized.flags.length > 0) {
    console.warn(
      '  [value-sanity]',
      normalized.flags.join('; '),
    );
  }

  const benefits = normalized.benefits.map((b) => ({
    title: b.title,
    category: mapBenefitCategory(b.category),
    description: b.description,
    value_estimate:
      b.value_estimate != null && Number.isFinite(b.value_estimate)
        ? b.value_estimate
        : null,
    period_raw: b.period_raw ?? null,
  }));

  // Implausible annualized value vs fee → park as needs_review, do not auto-publish.
  const sourceTag = normalized.implausibleVsFee
    ? ('needs_review' as const)
    : ('auto' as const);

  const row = {
    bank_name: bank,
    card_name: card,
    network,
    default_benefits: benefits,
    default_annual_fee: annualFee,
    card_color_theme: theme,
    default_color_theme: theme,
    source: sourceTag,
    last_verified_at: new Date().toISOString(),
    raw_source_url: opts.sourceUrl,
    refresh_priority: opts.source.refreshPriority ?? 'standard',
  };

  if (opts.dryRun) {
    console.log('  [dry-run] would upsert', row.bank_name, row.card_name, sourceTag);
    return { outcome: 'dry_run', catalogId: null, needsReview: false };
  }

  const existing = await getSupabase()
    .from('card_catalog')
    .select('id, source')
    .eq('bank_name', bank)
    .eq('card_name', card)
    .maybeSingle();

  if (existing.error) throwDb(existing.error);

  if (existing.data?.source === 'manual' && !opts.overwriteManual) {
    console.log('  [skip] manual row protected', bank, card);
    return { outcome: 'skipped_manual', catalogId: null, needsReview: false };
  }

  if (existing.data?.id) {
    const { error } = await getSupabase()
      .from('card_catalog')
      .update(row)
      .eq('id', existing.data.id);
    if (error) throwDb(error);
    return {
      outcome: 'updated',
      catalogId: existing.data.id,
      needsReview: sourceTag === 'needs_review',
    };
  }

  const inserted = await getSupabase()
    .from('card_catalog')
    .insert(row)
    .select('id')
    .single();
  if (inserted.error) throwDb(inserted.error);
  return {
    outcome: 'inserted',
    catalogId: inserted.data.id as string,
    needsReview: sourceTag === 'needs_review',
  };
}
