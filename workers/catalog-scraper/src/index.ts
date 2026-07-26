/**
 * Cron / one-shot entry — Railway scheduled job runs `npm start`.
 */

import { assertRuntimeConfig } from './config.js';
import { runCatalogScrape } from './pipeline.js';

async function main() {
  assertRuntimeConfig();
  const summary = await runCatalogScrape();
  const failed =
    summary.fetchFailed + summary.parseFailed + summary.errors.length;
  // Exit non-zero only if everything failed hard
  if (summary.processed > 0 && summary.success === 0 && failed === summary.processed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
