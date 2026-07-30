-- Document period_raw on catalog benefit JSON; optional column on vault benefits.
-- Allow needs_review on scrape log status (value-sanity gate).

comment on column public.card_catalog.default_benefits is
  'JSONB array of {title, category, description, value_estimate (ANNUAL INR), period_raw?}';

alter table public.card_benefits
  add column if not exists period_raw text;

comment on column public.card_benefits.period_raw is
  'Original stated period + figure (e.g. ₹240/month) before annualization.';

alter table public.catalog_scrape_log
  drop constraint if exists catalog_scrape_log_status_check;

alter table public.catalog_scrape_log
  add constraint catalog_scrape_log_status_check check (
    status in (
      'success',
      'parse_failed',
      'fetch_failed',
      'low_confidence',
      'needs_review'
    )
  );
