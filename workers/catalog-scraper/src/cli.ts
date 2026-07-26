/**
 * Manual "run now" CLI.
 *
 *   npm run scrape
 *   npm run scrape -- --limit 3 --dry-run
 *   npm run scrape -- --ids hdfc-regalia,sbi-elite --force
 *   npm run scrape -- --legacy-only
 *   npm run discover
 *   npm run discover -- --limit 4 --dry-run
 *   npm run discover -- --ids paisabazaar-credit,hdfc-credit-list
 */

import { assertRuntimeConfig, config } from './config.js';
import { runCatalogScrape } from './pipeline.js';
import { runDiscoveryCrawl, seedKnownFromLegacySources } from './discovery.js';
import { SOURCES } from './sources.js';

function parseArgs(argv: string[]) {
  const opts: {
    mode: 'scrape' | 'discover' | 'seed-known';
    limit?: number;
    dryRun?: boolean;
    force?: boolean;
    sourceIds?: string[];
    legacyOnly?: boolean;
    fromQueue?: boolean;
  } = { mode: 'scrape' };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === 'discover' || a === '--discover') opts.mode = 'discover';
    else if (a === 'seed-known' || a === '--seed-known') opts.mode = 'seed-known';
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--legacy-only') opts.legacyOnly = true;
    else if (a === '--from-queue') opts.fromQueue = true;
    else if (a === '--limit') opts.limit = Number(argv[++i]);
    else if (a === '--ids') {
      opts.sourceIds = (argv[++i] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return opts;
}

async function main() {
  assertRuntimeConfig();
  const opts = parseArgs(process.argv.slice(2));
  if (opts.dryRun) config.dryRun = true;
  console.log('[cli] options', opts);

  if (opts.mode === 'discover') {
    const summary = await runDiscoveryCrawl({
      dryRun: opts.dryRun,
      limitSources: opts.limit ?? config.maxDiscoverySourcesPerRun,
      sourceIds: opts.sourceIds,
    });
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (opts.mode === 'seed-known') {
    const result = await seedKnownFromLegacySources(SOURCES, opts.dryRun);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const summary = await runCatalogScrape({
    limit: opts.limit,
    dryRun: opts.dryRun,
    force: opts.force,
    sourceIds: opts.sourceIds,
    legacyOnly: opts.legacyOnly,
    fromQueue: opts.fromQueue,
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
