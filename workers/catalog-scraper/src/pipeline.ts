/**
 * Catalog scrape pipeline — fetch → LLM → Supabase upsert / review log.
 *
 * Work queue (preferred): pending rows in known_cards from discovery crawl.
 * Fallback: hardcoded SOURCES with per-source refresh_priority staleness.
 */

import { config } from './config.js';
import { fetchSourcePage, sleep } from './fetch.js';
import { structureWithLlm } from './llm.js';
import { serializeError } from './errors.js';
import { SOURCES, type CatalogSource, type RefreshPriority } from './sources.js';
import {
  findCatalogMatch,
  loadCatalogIndex,
  upsertAutoCatalog,
  writeScrapeLog,
  type CatalogRow,
} from './supabase.js';
import {
  loadPendingKnownCards,
  markKnownCardExtracted,
  markKnownCardFailure,
  type KnownCardRow,
} from './knownCards.js';
import type { CardRunResult, RunOptions, RunSummary } from './types.js';

function resolvePriority(
  source: CatalogSource,
  row: CatalogRow | undefined,
): RefreshPriority {
  if (source.refreshPriority) return source.refreshPriority;
  if (row?.refresh_priority === 'high') return 'high';
  return 'standard';
}

function staleThresholdDays(priority: RefreshPriority): number {
  return priority === 'high' ? config.staleDaysHigh : config.staleDays;
}

function isStale(
  row: CatalogRow | undefined,
  priority: RefreshPriority,
): boolean {
  if (!row) return true;
  if (row.source === 'manual') return false; // never auto-refresh manual
  if (!row.last_verified_at) return true;
  const ageMs = Date.now() - new Date(row.last_verified_at).getTime();
  return ageMs >= staleThresholdDays(priority) * 86_400_000;
}

function prioritize(
  sources: CatalogSource[],
  catalog: CatalogRow[],
  opts: RunOptions,
): CatalogSource[] {
  let list = [...sources];
  if (opts.sourceIds?.length) {
    const set = new Set(opts.sourceIds);
    list = list.filter((s) => set.has(s.id));
  }

  const scored = list.map((s) => {
    const match =
      findCatalogMatch(catalog, s.issuer, s.name) ??
      catalog.find(
        (r) =>
          r.card_name.toLowerCase().includes(s.name.toLowerCase().slice(0, 12)) ||
          s.name.toLowerCase().includes(r.card_name.toLowerCase().slice(0, 12)),
      );
    const priority = resolvePriority(s, match);
    const stale = opts.force || isStale(match, priority);
    // Explicit --ids --force can refresh manual seed rows; cron never passes both.
    const allowManualOverride = Boolean(opts.force && opts.sourceIds?.length);
    const manual = match?.source === 'manual' && !allowManualOverride;
    return { source: s, match, stale, manual, priority };
  });

  // Prefer high-priority stale, then never-verified, then standard stale.
  const candidates = scored
    .filter((x) => !x.manual && x.stale)
    .sort((a, b) => {
      const pRank = (p: RefreshPriority) => (p === 'high' ? 0 : 1);
      const pr = pRank(a.priority) - pRank(b.priority);
      if (pr !== 0) return pr;
      const aNull = a.match?.last_verified_at ? 1 : 0;
      const bNull = b.match?.last_verified_at ? 1 : 0;
      return aNull - bNull;
    })
    .map((x) => x.source);

  const limit = opts.limit ?? config.maxCardsPerRun;
  return candidates.slice(0, limit);
}

export async function runCatalogScrape(opts: RunOptions = {}): Promise<RunSummary> {
  const dryRun = opts.dryRun ?? config.dryRun;
  const limit = opts.limit ?? config.maxCardsPerRun;

  // Prefer discovery queue unless legacy-only or explicit SOURCES ids.
  if (!opts.legacyOnly && !opts.sourceIds?.length) {
    const pending = await loadPendingKnownCards(limit);
    if (pending.length > 0 || opts.fromQueue) {
      console.log(
        `[pipeline] using known_cards queue (${pending.length} pending, limit=${limit})`,
      );
      return runQueueExtraction(pending, { dryRun, force: opts.force });
    }
    console.log('[pipeline] known_cards queue empty — falling back to SOURCES');
  }

  const catalog = await loadCatalogIndex();
  const queue = prioritize(SOURCES, catalog, opts);

  const summary: RunSummary = {
    processed: 0,
    success: 0,
    lowConfidence: 0,
    fetchFailed: 0,
    parseFailed: 0,
    skippedManual: 0,
    skippedFresh: Math.max(0, SOURCES.length - queue.length),
    errors: [],
    results: [],
  };

  console.log(
    `[pipeline] processing ${queue.length} of ${SOURCES.length} sources ` +
      `(limit=${opts.limit ?? config.maxCardsPerRun}, dryRun=${dryRun}, ` +
      `stale=${config.staleDays}d / high=${config.staleDaysHigh}d)`,
  );

  for (const source of queue) {
    summary.processed += 1;
    console.log(`\n→ ${source.id} — ${source.name} [${source.refreshPriority ?? 'standard'}]`);

    const pushResult = (partial: Omit<CardRunResult, 'id' | 'name' | 'issuer'>) => {
      summary.results.push({
        id: source.id,
        name: source.name,
        issuer: source.issuer,
        ...partial,
      });
    };

    try {
      const fetched = await fetchSourcePage(source);
      if (!fetched.text || fetched.charCount < 400) {
        summary.fetchFailed += 1;
        pushResult({
          status: 'fetch_failed',
          confidence: null,
          usedPlaywright: fetched.usedPlaywright,
          sourceUrl: fetched.url ?? source.urls[0] ?? null,
          error: 'Page text too short or empty after fetch',
        });
        if (!dryRun) {
          await writeScrapeLog({
            source_url: fetched.url ?? source.urls[0] ?? null,
            bank_name: source.issuer,
            card_name: source.name,
            status: 'fetch_failed',
            raw_snippet: fetched.text.slice(0, config.snippetChars) || null,
            error_message: 'Page text too short or empty after fetch',
          });
        }
        await sleep(config.fetchDelayMs);
        continue;
      }

      const lastSnippet = fetched.text.slice(0, config.snippetChars);
      const lastUrl = fetched.url ?? source.urls[0] ?? null;

      try {
        const llm = await structureWithLlm(source, fetched.text);
        if (!llm.ok) {
          summary.parseFailed += 1;
          pushResult({
            status: 'parse_failed',
            confidence: null,
            usedPlaywright: fetched.usedPlaywright,
            sourceUrl: lastUrl,
            error: serializeError(llm.error),
          });
          if (!dryRun) {
            await writeScrapeLog({
              source_url: lastUrl,
              bank_name: source.issuer,
              card_name: source.name,
              status: 'parse_failed',
              raw_snippet: lastSnippet,
              error_message: serializeError(llm.error),
              proposed_json: llm.raw
                ? { raw: String(llm.raw).slice(0, 8000) }
                : null,
            });
          }
          await sleep(config.fetchDelayMs);
          continue;
        }

        const { data } = llm;
        if (data.confidence !== 'high') {
          summary.lowConfidence += 1;
          pushResult({
            status: 'low_confidence',
            confidence: data.confidence,
            usedPlaywright: fetched.usedPlaywright,
            sourceUrl: lastUrl,
          });
          if (!dryRun) {
            await writeScrapeLog({
              source_url: lastUrl,
              bank_name: data.bank_name || source.issuer,
              card_name: data.card_name || source.name,
              status: 'low_confidence',
              confidence: data.confidence,
              raw_snippet: lastSnippet,
              proposed_json: data,
              error_message: `LLM confidence=${data.confidence}`,
            });
          }
          await sleep(config.fetchDelayMs);
          continue;
        }

        try {
          const result = await upsertAutoCatalog({
            source,
            extraction: data,
            sourceUrl: fetched.url!,
            dryRun,
            overwriteManual: Boolean(opts.force && opts.sourceIds?.length),
          });

          if (result.outcome === 'skipped_manual') {
            summary.skippedManual += 1;
            pushResult({
              status: 'skipped_manual',
              confidence: 'high',
              usedPlaywright: fetched.usedPlaywright,
              sourceUrl: lastUrl,
            });
          } else {
            summary.success += 1;
            const status = result.outcome === 'dry_run'
              ? 'dry_run'
              : result.needsReview
                ? 'needs_review'
                : 'success';
            pushResult({
              status,
              confidence: 'high',
              usedPlaywright: fetched.usedPlaywright,
              sourceUrl: lastUrl,
            });
            if (!dryRun) {
              await writeScrapeLog({
                source_url: lastUrl,
                bank_name: data.bank_name,
                card_name: data.card_name,
                status: result.needsReview ? 'needs_review' : 'success',
                confidence: 'high',
                raw_snippet: lastSnippet,
                proposed_json: data,
                error_message: result.needsReview
                  ? 'Value sanity: benefit estimate >10× annual fee — parked as needs_review'
                  : null,
              });
            }
          }
        } catch (upsertErr) {
          summary.parseFailed += 1;
          summary.errors.push(`${source.id}: ${serializeError(upsertErr)}`);
          console.error('  [upsert error]', serializeError(upsertErr));
          pushResult({
            status: 'parse_failed',
            confidence: data.confidence,
            usedPlaywright: fetched.usedPlaywright,
            sourceUrl: lastUrl,
            error: `Upsert failed: ${serializeError(upsertErr)}`,
          });
          if (!dryRun) {
            await writeScrapeLog({
              source_url: lastUrl,
              bank_name: data.bank_name || source.issuer,
              card_name: data.card_name || source.name,
              status: 'parse_failed',
              confidence: data.confidence,
              raw_snippet: lastSnippet,
              proposed_json: data,
              error_message: `Upsert failed: ${serializeError(upsertErr)}`,
            });
          }
        }
      } catch (e) {
        const msg = serializeError(e);
        summary.parseFailed += 1;
        summary.errors.push(`${source.id}: ${msg}`);
        console.error('  [error]', msg);
        pushResult({
          status: 'parse_failed',
          confidence: null,
          usedPlaywright: fetched.usedPlaywright,
          sourceUrl: lastUrl,
          error: msg,
        });
        if (!dryRun) {
          try {
            await writeScrapeLog({
              source_url: lastUrl,
              bank_name: source.issuer,
              card_name: source.name,
              status: 'parse_failed',
              error_message: msg,
              raw_snippet: lastSnippet,
            });
          } catch (logErr) {
            console.error('  [log error]', serializeError(logErr));
          }
        }
      }
    } catch (e) {
      const msg = serializeError(e);
      summary.errors.push(`${source.id}: ${msg}`);
      console.error('  [error]', msg);
      pushResult({
        status: 'parse_failed',
        confidence: null,
        usedPlaywright: false,
        sourceUrl: source.urls[0] ?? null,
        error: msg,
      });
      if (!dryRun) {
        try {
          await writeScrapeLog({
            source_url: source.urls[0] ?? null,
            bank_name: source.issuer,
            card_name: source.name,
            status: 'parse_failed',
            error_message: msg,
            raw_snippet: null,
          });
        } catch (logErr) {
          console.error('  [log error]', serializeError(logErr));
        }
      }
    }

    await sleep(config.fetchDelayMs);
  }

  console.log('\n[pipeline] done', {
    ...summary,
    results: summary.results.map((r) => ({
      id: r.id,
      confidence: r.confidence,
      status: r.status,
      usedPlaywright: r.usedPlaywright,
    })),
  });
  return summary;
}

function knownToSource(row: KnownCardRow): CatalogSource {
  return {
    id: `known-${row.id.slice(0, 8)}`,
    name: row.card_name,
    issuer: row.bank_name,
    network: 'Visa',
    type: row.card_type === 'debit' ? 'debit-card' : 'credit-card',
    urls: [row.detail_url],
    refreshPriority: 'standard',
  };
}

/**
 * Extract benefits for pending known_cards (bounded batch).
 * After EXTRACTION_FAIL_THRESHOLD consecutive failures → status=failed.
 */
async function runQueueExtraction(
  pending: KnownCardRow[],
  opts: { dryRun: boolean; force?: boolean },
): Promise<RunSummary> {
  const dryRun = opts.dryRun;
  const summary: RunSummary = {
    processed: 0,
    success: 0,
    lowConfidence: 0,
    fetchFailed: 0,
    parseFailed: 0,
    skippedManual: 0,
    skippedFresh: 0,
    errors: [],
    results: [],
  };

  for (const row of pending) {
    summary.processed += 1;
    const source = knownToSource(row);
    console.log(`\n→ queue ${row.id.slice(0, 8)} — ${row.card_name} (${row.bank_name})`);

    const pushResult = (partial: Omit<CardRunResult, 'id' | 'name' | 'issuer'>) => {
      summary.results.push({
        id: source.id,
        name: source.name,
        issuer: source.issuer,
        ...partial,
      });
    };

    const fail = async (err: string, status: CardRunResult['status']) => {
      pushResult({
        status,
        confidence: null,
        usedPlaywright: false,
        sourceUrl: row.detail_url,
        error: err,
      });
      if (!dryRun) {
        const next = await markKnownCardFailure({
          id: row.id,
          error: err,
          failThreshold: config.extractionFailThreshold,
        });
        console.log(`  [queue] marked ${next} (fail)`);
      }
    };

    try {
      const fetched = await fetchSourcePage(source);
      if (!fetched.text || fetched.charCount < 400) {
        summary.fetchFailed += 1;
        if (!dryRun) {
          await writeScrapeLog({
            source_url: fetched.url ?? row.detail_url,
            bank_name: row.bank_name,
            card_name: row.card_name,
            status: 'fetch_failed',
            raw_snippet: fetched.text.slice(0, config.snippetChars) || null,
            error_message: 'Page text too short or empty after fetch',
          });
        }
        await fail('Page text too short or empty after fetch', 'fetch_failed');
        await sleep(config.fetchDelayMs);
        continue;
      }

      const lastSnippet = fetched.text.slice(0, config.snippetChars);
      const lastUrl = fetched.url ?? row.detail_url;
      const llm = await structureWithLlm(source, fetched.text);

      if (!llm.ok) {
        summary.parseFailed += 1;
        if (!dryRun) {
          await writeScrapeLog({
            source_url: lastUrl,
            bank_name: row.bank_name,
            card_name: row.card_name,
            status: 'parse_failed',
            raw_snippet: lastSnippet,
            error_message: serializeError(llm.error),
          });
        }
        await fail(serializeError(llm.error), 'parse_failed');
        await sleep(config.fetchDelayMs);
        continue;
      }

      const { data } = llm;
      if (data.confidence !== 'high') {
        summary.lowConfidence += 1;
        pushResult({
          status: 'low_confidence',
          confidence: data.confidence,
          usedPlaywright: fetched.usedPlaywright,
          sourceUrl: lastUrl,
        });
        if (!dryRun) {
          await writeScrapeLog({
            source_url: lastUrl,
            bank_name: data.bank_name || row.bank_name,
            card_name: data.card_name || row.card_name,
            status: 'low_confidence',
            confidence: data.confidence,
            raw_snippet: lastSnippet,
            proposed_json: data,
            error_message: `LLM confidence=${data.confidence}`,
          });
          // Low confidence still counts as an attempt toward fail threshold
          await markKnownCardFailure({
            id: row.id,
            error: `LLM confidence=${data.confidence}`,
            failThreshold: config.extractionFailThreshold,
          });
        }
        await sleep(config.fetchDelayMs);
        continue;
      }

      const result = await upsertAutoCatalog({
        source,
        extraction: data,
        sourceUrl: fetched.url!,
        dryRun,
        overwriteManual: Boolean(opts.force),
      });

      if (result.outcome === 'skipped_manual') {
        summary.skippedManual += 1;
        pushResult({
          status: 'skipped_manual',
          confidence: 'high',
          usedPlaywright: fetched.usedPlaywright,
          sourceUrl: lastUrl,
        });
        if (!dryRun) {
          // Manual catalog row exists — treat as done for discovery queue
          await markKnownCardExtracted({ id: row.id, catalogId: null });
        }
      } else {
        summary.success += 1;
        const status = result.outcome === 'dry_run'
          ? 'dry_run'
          : result.needsReview
            ? 'needs_review'
            : 'success';
        pushResult({
          status,
          confidence: 'high',
          usedPlaywright: fetched.usedPlaywright,
          sourceUrl: lastUrl,
        });
        if (!dryRun) {
          await writeScrapeLog({
            source_url: lastUrl,
            bank_name: data.bank_name,
            card_name: data.card_name,
            status: result.needsReview ? 'needs_review' : 'success',
            confidence: 'high',
            raw_snippet: lastSnippet,
            proposed_json: data,
            error_message: result.needsReview
              ? 'Value sanity: benefit estimate >10× annual fee — parked as needs_review'
              : null,
          });
          await markKnownCardExtracted({
            id: row.id,
            catalogId: result.catalogId,
          });
        }
      }
    } catch (e) {
      const msg = serializeError(e);
      summary.errors.push(`${row.id}: ${msg}`);
      summary.parseFailed += 1;
      console.error('  [queue error]', msg);
      await fail(msg, 'parse_failed');
    }

    await sleep(config.fetchDelayMs);
  }

  console.log('\n[pipeline queue] done', {
    processed: summary.processed,
    success: summary.success,
    lowConfidence: summary.lowConfidence,
    fetchFailed: summary.fetchFailed,
    parseFailed: summary.parseFailed,
  });
  return summary;
}
