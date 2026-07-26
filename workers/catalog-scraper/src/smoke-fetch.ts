/**
 * Fetch-only smoke test (no LLM / no Supabase writes).
 * Measures how many Benefit Radar URLs return usable page text.
 *
 *   npx tsx src/smoke-fetch.ts --limit 10
 */

import { SOURCES } from './sources.js';
import { fetchSourcePage, sleep } from './fetch.js';

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit =
    limitArg >= 0 ? Number(process.argv[limitArg + 1]) : SOURCES.length;
  const slice = SOURCES.slice(0, limit);

  let ok = 0;
  let thin = 0;
  let failed = 0;
  const notes: string[] = [];

  for (const s of slice) {
    process.stdout.write(`→ ${s.id} ... `);
    const r = await fetchSourcePage(s);
    if (!r.text || r.charCount < 400) {
      failed += 1;
      console.log(`FAIL (${r.charCount} chars)`);
      notes.push(`${s.id}: fetch_failed`);
    } else if (r.charCount < 1500) {
      thin += 1;
      ok += 1;
      console.log(`OK thin (${r.charCount}${r.usedPlaywright ? ', pw' : ''})`);
      notes.push(`${s.id}: thin`);
    } else {
      ok += 1;
      console.log(`OK (${r.charCount}${r.usedPlaywright ? ', pw' : ''})`);
    }
    await sleep(1200);
  }

  const summary = {
    tested: slice.length,
    ofRegistry: SOURCES.length,
    ok,
    thin,
    failed,
    fetchSuccessRate: `${Math.round((ok / slice.length) * 100)}%`,
    notes,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
