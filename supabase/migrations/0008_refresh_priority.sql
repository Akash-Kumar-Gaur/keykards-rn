-- KeyKards — catalog re-scrape priority tier.
-- high = fintech / app-first products (shorter refresh cycle); standard = legacy bank cards.

alter table public.card_catalog
  add column if not exists refresh_priority text not null default 'standard';

do $$ begin
  alter table public.card_catalog
    add constraint card_catalog_refresh_priority_check
    check (refresh_priority in ('standard', 'high'));
exception when duplicate_object then null; end $$;

create index if not exists card_catalog_refresh_priority_idx
  on public.card_catalog (refresh_priority, last_verified_at);

-- Seed known fintech / app-first catalog rows if already present.
update public.card_catalog
set refresh_priority = 'high'
where refresh_priority = 'standard'
  and (
    lower(card_name) like '%scapia%'
    or lower(card_name) like '%kiwi%'
    or lower(card_name) like '%tata neu%'
    or lower(card_name) like '%swiggy%'
    or lower(card_name) like '%tiger%'
    or lower(bank_name) like '%federal%' and lower(card_name) like '%scapia%'
  );
