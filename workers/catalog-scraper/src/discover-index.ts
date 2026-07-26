/**
 * Discovery cron entry — Railway monthly job: `npm run start:discover`
 */

import { assertRuntimeConfig, config } from './config.js';
import { runDiscoveryCrawl } from './discovery.js';

async function main() {
  assertRuntimeConfig();
  const summary = await runDiscoveryCrawl({
    limitSources: config.maxDiscoverySourcesPerRun,
  });
  if (
    summary.sourcesProcessed > 0 &&
    summary.cardsFound === 0 &&
    summary.fetchFailed + summary.parseFailed === summary.sourcesProcessed
  ) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
