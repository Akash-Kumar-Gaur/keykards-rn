# InWallet catalog scraper (Railway)

Scheduled Node/TypeScript worker that scrapes bank card benefit pages, structures
them with an LLM, and upserts into Supabase `card_catalog` (high confidence only).

## Pipeline

1. **Fetch** — `SOURCES` URL list in `src/sources.ts` + static HTML strip;
   Playwright fallback when the page is thin or `preferPlaywright` is set.
2. **LLM** — OpenAI or Anthropic extracts JSON
   `{ card_name, bank_name, annual_fee, benefits[{…, value_estimate, period_raw}], confidence }`.
   Prompt requires `value_estimate` to be **annual INR**; `period_raw` keeps the
   source figure (e.g. `₹240/month`).
3. **Normalize** — `annualizeBenefits.ts` post-processes monthly/quarterly figures
   the model left un-annualized, then flags any single benefit whose annual
   estimate is **>10× the card’s annual fee** as implausible.
4. **Write** — `confidence: high` and value-sane → upsert with `source: 'auto'`;
   implausible values → upsert with `source: 'needs_review'` (and scrape log
   status `needs_review`). Never overwrites `source: 'manual'`.
   Medium/low confidence → `catalog_scrape_log` only (no catalog write).

## Discovery crawl (monthly)

Listing pages → LLM card list → `known_cards` queue:

```bash
npm run discover                 # all listing sources
npm run discover -- --limit 4    # first N sources
npm run discover -- --ids paisabazaar-credit,hdfc-credit-list
npm run seed-known               # one-shot: seed queue from legacy SOURCES
```

Railway: second cron (e.g. `0 4 1 * *` monthly) with `npm run start:discover`.

Extraction cron (`npm start`) prefers `known_cards` where `extraction_status=pending`
(bounded by `MAX_CARDS_PER_RUN`). After `EXTRACTION_FAIL_THRESHOLD` (default 3) failures
→ `failed` (shown on Discovery tab in Catalog review). Use `--legacy-only` to scrape
hardcoded `SOURCES` instead.

## Refresh priority

`card_catalog.refresh_priority` is `'standard' | 'high'`.

| Tier | Typical products | Stale after (env) |
|------|------------------|-------------------|
| `high` | Fintech / app-first (Scapia, Kiwi, Tata Neu, Swiggy BLCK, Tiger, …) | `STALE_DAYS_HIGH` (default **14**) |
| `standard` | Legacy bank cards | `STALE_DAYS` (default **90**) |

A **single** Railway cron (`npm start`) picks the next stale sources, preferring
`high` first. No second cron required — age thresholds differ by priority.

## Local run

```bash
cd workers/catalog-scraper
cp .env.example .env   # fill secrets
npm install
npx playwright install chromium   # if USE_PLAYWRIGHT=true

npm run scrape:dry                # 3 cards, no writes
npm run scrape -- --limit 5       # live write, capped
npm run scrape -- --ids hdfc-regalia,sbi-elite --force
npm run scrape -- --ids scapia-federal,kiwi-yes,hdfc-tata-neu-infinity,indusind-tiger,hdfc-swiggy-blck,sbi-cashback --force
npm run serve                     # POST /run with Bearer $CRON_SECRET
```

## Railway

1. New service from `workers/catalog-scraper`
2. Set env vars from `.env.example` (include `STALE_DAYS` / `STALE_DAYS_HIGH`)
3. Build installs Playwright Chromium (see `railway.toml`)
4. Cron schedule (e.g. `0 3 * * 0` weekly) with command `npm start`
   — high-priority cards still refresh ~biweekly because of the 14-day threshold
5. Optional always-on HTTP: start command `npm run serve`

## Source URL notes

| Change | Why |
|--------|-----|
| Benefit Radar URLs reused as base | Same registry |
| **Scapia, Kiwi, Tata Neu Infinity, Tiger, Swiggy BLCK** | Trending fintech / co-brand expansions |
| **SBI Cashback** | Already in registry (re-scrape with `--force` when needed) |
| **SBI Gold Debit** primary/fallback swapped | Radar primary was SBI Collect (unrelated) |
| **`preferPlaywright`** on SBI Gold Debit, Amex Gold, Scapia, Kiwi | Thin/JS-heavy pages |
| **`refreshPriority: 'high'`** on fintech / app-first entries | Shorter re-scrape cycle |

## Review UI

In the Expo app: Profile → Catalog review (visible when `EXPO_PUBLIC_ADMIN_EMAILS`
includes the signed-in email). Approve / Reject / Edit-then-approve low-confidence logs.
