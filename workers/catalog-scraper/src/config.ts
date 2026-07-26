/**
 * Worker config from env.
 * Loads workers/catalog-scraper/.env automatically for local CLI runs.
 *
 * LLM: set OPENAI_API_KEY and/or ANTHROPIC_API_KEY.
 * LLM_PROVIDER=auto|openai|anthropic (default auto: prefer OpenAI if both set).
 */

import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, '../.env') });

export type LlmProvider = 'openai' | 'anthropic';

function resolveLlmProvider(): LlmProvider | null {
  const forced = (process.env.LLM_PROVIDER ?? 'auto').toLowerCase();
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  if (forced === 'openai') return hasOpenAI ? 'openai' : null;
  if (forced === 'anthropic') return hasAnthropic ? 'anthropic' : null;

  // auto
  if (hasOpenAI) return 'openai';
  if (hasAnthropic) return 'anthropic';
  return null;
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
  llmProvider: resolveLlmProvider(),
  /** Max LLM calls (and cards processed) per run. */
  maxCardsPerRun: Number(process.env.MAX_CARDS_PER_RUN ?? 8),
  /** Prefer cards with last_verified_at older than this many days (or null). */
  staleDays: Number(process.env.STALE_DAYS ?? 90),
  /** Shorter cycle for refresh_priority=high (fintech / app-first). */
  staleDaysHigh: Number(process.env.STALE_DAYS_HIGH ?? 14),
  /** Pending known_cards → failed after this many consecutive extraction errors. */
  extractionFailThreshold: Number(process.env.EXTRACTION_FAIL_THRESHOLD ?? 3),
  /** Max listing sources per discovery crawl. */
  maxDiscoverySourcesPerRun: Number(process.env.MAX_DISCOVERY_SOURCES_PER_RUN ?? 20),
  /** Delay between bank page fetches (ms). */
  fetchDelayMs: Number(process.env.FETCH_DELAY_MS ?? 2500),
  /** Max chars of cleaned page text sent to the LLM. */
  maxPromptChars: Number(process.env.MAX_PROMPT_CHARS ?? 24_000),
  /** Truncated snippet stored in scrape_log. */
  snippetChars: Number(process.env.SNIPPET_CHARS ?? 4000),
  usePlaywright: (process.env.USE_PLAYWRIGHT ?? 'true') === 'true',
  cronSecret: process.env.CRON_SECRET ?? '',
  port: Number(process.env.PORT ?? 8080),
  dryRun: false,
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    // Allow build/typecheck without secrets; runtime entrypoints check again.
    return process.env[`_${name}_OPTIONAL`] ?? '';
  }
  return v;
}

export function assertRuntimeConfig(): void {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    throw new Error(
      `Missing required env: ${missing.join(', ')}\n` +
        `Create workers/catalog-scraper/.env (see .env.example) and fill those keys.`,
    );
  }
  if (!config.llmProvider) {
    throw new Error(
      'Missing LLM key: set OPENAI_API_KEY and/or ANTHROPIC_API_KEY in workers/catalog-scraper/.env\n' +
        'Optional: LLM_PROVIDER=openai|anthropic|auto',
    );
  }
}
