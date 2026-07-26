/**
 * Discovery crawl — listing pages → LLM card list → known_cards upsert.
 * Scheduled separately from benefit extraction (e.g. monthly Railway cron).
 */

import { config } from './config.js';
import { fetchListingPage, sleep } from './fetch.js';
import { DISCOVERY_SOURCES, type DiscoverySource } from './discoverySources.js';
import { extractCardsFromListing } from './discoveryLlm.js';
import { upsertDiscoveredCards, knownCardsStatusCounts } from './knownCards.js';
import { serializeError } from './errors.js';

export type DiscoveryRunOptions = {
  limitSources?: number;
  sourceIds?: string[];
  dryRun?: boolean;
};

export type DiscoverySourceResult = {
  id: string;
  name: string;
  ok: boolean;
  usedPlaywright: boolean;
  cardsFound: number;
  inserted: number;
  refreshed: number;
  error?: string;
  pageUrl?: string | null;
};

export type DiscoverySummary = {
  sourcesProcessed: number;
  cardsFound: number;
  inserted: number;
  refreshed: number;
  fetchFailed: number;
  parseFailed: number;
  results: DiscoverySourceResult[];
  queueCounts?: Record<string, number>;
};

export async function runDiscoveryCrawl(
  opts: DiscoveryRunOptions = {},
): Promise<DiscoverySummary> {
  const dryRun = opts.dryRun ?? false;
  let list = [...DISCOVERY_SOURCES];
  if (opts.sourceIds?.length) {
    const set = new Set(opts.sourceIds);
    list = list.filter((s) => set.has(s.id));
  }
  if (opts.limitSources != null) {
    list = list.slice(0, opts.limitSources);
  }

  const summary: DiscoverySummary = {
    sourcesProcessed: 0,
    cardsFound: 0,
    inserted: 0,
    refreshed: 0,
    fetchFailed: 0,
    parseFailed: 0,
    results: [],
  };

  console.log(
    `[discovery] crawling ${list.length} listing sources (dryRun=${dryRun})`,
  );

  for (const source of list) {
    summary.sourcesProcessed += 1;
    console.log(`\n→ discover ${source.id} — ${source.name}`);
    try {
      const fetched = await fetchListingPage({
        urls: source.urls,
        preferPlaywright: source.preferPlaywright,
      });
      if (!fetched.text || fetched.charCount < 400) {
        summary.fetchFailed += 1;
        summary.results.push({
          id: source.id,
          name: source.name,
          ok: false,
          usedPlaywright: fetched.usedPlaywright,
          cardsFound: 0,
          inserted: 0,
          refreshed: 0,
          error: 'Listing page text too short',
          pageUrl: fetched.url,
        });
        await sleep(config.fetchDelayMs);
        continue;
      }

      const extracted = await extractCardsFromListing(
        source,
        fetched.text,
        fetched.url ?? source.urls[0]!,
      );
      if (!extracted.ok) {
        summary.parseFailed += 1;
        summary.results.push({
          id: source.id,
          name: source.name,
          ok: false,
          usedPlaywright: fetched.usedPlaywright,
          cardsFound: 0,
          inserted: 0,
          refreshed: 0,
          error: extracted.error,
          pageUrl: fetched.url,
        });
        await sleep(config.fetchDelayMs);
        continue;
      }

      const { inserted, refreshed } = await upsertDiscoveredCards({
        cards: extracted.cards,
        discoveredFrom: source.id,
        dryRun,
      });

      summary.cardsFound += extracted.cards.length;
      summary.inserted += inserted;
      summary.refreshed += refreshed;
      summary.results.push({
        id: source.id,
        name: source.name,
        ok: true,
        usedPlaywright: fetched.usedPlaywright,
        cardsFound: extracted.cards.length,
        inserted,
        refreshed,
        pageUrl: fetched.url,
      });
      console.log(
        `  [discovery] ${extracted.cards.length} cards (insert=${inserted}, refresh=${refreshed}, playwright=${fetched.usedPlaywright})`,
      );
    } catch (e) {
      summary.parseFailed += 1;
      summary.results.push({
        id: source.id,
        name: source.name,
        ok: false,
        usedPlaywright: false,
        cardsFound: 0,
        inserted: 0,
        refreshed: 0,
        error: serializeError(e),
      });
      console.error('  [discovery error]', serializeError(e));
    }

    await sleep(config.fetchDelayMs);
  }

  if (!dryRun) {
    try {
      summary.queueCounts = await knownCardsStatusCounts();
    } catch (e) {
      console.warn('  [warn] could not load queue counts', serializeError(e));
    }
  }

  console.log('\n[discovery] done', {
    sourcesProcessed: summary.sourcesProcessed,
    cardsFound: summary.cardsFound,
    inserted: summary.inserted,
    refreshed: summary.refreshed,
    fetchFailed: summary.fetchFailed,
    parseFailed: summary.parseFailed,
    queueCounts: summary.queueCounts,
    playwrightSources: summary.results
      .filter((r) => r.usedPlaywright)
      .map((r) => r.id),
    staticSources: summary.results
      .filter((r) => r.ok && !r.usedPlaywright)
      .map((r) => r.id),
  });

  return summary;
}

/** Seed known_cards from legacy hardcoded SOURCES (optional one-shot). */
export async function seedKnownFromLegacySources(
  sources: Array<{
    id: string;
    name: string;
    issuer: string;
    urls: string[];
    type?: string;
  }>,
  dryRun = false,
): Promise<{ inserted: number; refreshed: number }> {
  const cards = sources
    .filter((s) => s.urls[0])
    .map((s) => ({
      bank_name: s.issuer,
      card_name: s.name,
      card_type: (s.type === 'debit-card' ? 'debit' : 'credit') as
        | 'credit'
        | 'debit',
      detail_url: s.urls[0]!,
    }));
  return upsertDiscoveredCards({
    cards,
    discoveredFrom: 'legacy-sources',
    dryRun,
  });
}

export function listDiscoverySourceIds(): string[] {
  return DISCOVERY_SOURCES.map((s: DiscoverySource) => s.id);
}
