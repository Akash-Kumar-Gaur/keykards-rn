-- InWallet — bank-inspired card color themes + catalog default_color_theme.

-- ---------------------------------------------------------------------------
-- Widen allowed theme keys on cards + card_catalog
-- ---------------------------------------------------------------------------

alter table public.cards drop constraint if exists cards_color_theme_check;
alter table public.card_catalog drop constraint if exists card_catalog_theme_check;

alter table public.card_catalog
  add column if not exists default_color_theme text;

do $$ begin
  alter table public.cards
    add constraint cards_color_theme_check
    check (
      card_color_theme is null
      or card_color_theme in (
        'generic-violet',
        'generic-slate',
        'generic-emerald',
        'indigo',
        'midnight',
        'obsidian',
        'slate',
        'emerald',
        'amber',
        'hdfc-maroon',
        'sbi-indigo',
        'axis-burgundy',
        'icici-amber',
        'kotak-crimson',
        'idfc-copper',
        'amex-gunmetal',
        'diners-navy'
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.card_catalog
    add constraint card_catalog_theme_check
    check (
      card_color_theme in (
        'generic-violet',
        'generic-slate',
        'generic-emerald',
        'indigo',
        'midnight',
        'obsidian',
        'slate',
        'emerald',
        'amber',
        'hdfc-maroon',
        'sbi-indigo',
        'axis-burgundy',
        'icici-amber',
        'kotak-crimson',
        'idfc-copper',
        'amex-gunmetal',
        'diners-navy'
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.card_catalog
    add constraint card_catalog_default_theme_check
    check (
      default_color_theme is null
      or default_color_theme in (
        'generic-violet',
        'generic-slate',
        'generic-emerald',
        'indigo',
        'midnight',
        'obsidian',
        'slate',
        'emerald',
        'amber',
        'hdfc-maroon',
        'sbi-indigo',
        'axis-burgundy',
        'icici-amber',
        'kotak-crimson',
        'idfc-copper',
        'amex-gunmetal',
        'diners-navy'
      )
    );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Backfill default_color_theme (+ sync card_color_theme) from bank_name
-- ---------------------------------------------------------------------------

update public.card_catalog
set
  default_color_theme = case
    when lower(bank_name) like '%hdfc%' then 'hdfc-maroon'
    when lower(bank_name) like '%sbi card%'
      or lower(bank_name) like '%state bank%'
      or lower(bank_name) like '%sbi%' then 'sbi-indigo'
    when lower(bank_name) like '%axis%' then 'axis-burgundy'
    when lower(bank_name) like '%icici%' then 'icici-amber'
    when lower(bank_name) like '%kotak%' then 'kotak-crimson'
    when lower(bank_name) like '%idfc%' then 'idfc-copper'
    when lower(bank_name) like '%american express%'
      or lower(bank_name) like '%amex%' then 'amex-gunmetal'
    when lower(bank_name) like '%diner%' then 'diners-navy'
    when lower(bank_name) like '%yes bank%' then 'generic-slate'
    when lower(bank_name) like '%indusind%' then 'axis-burgundy'
    when lower(bank_name) like '%rbl%' then 'generic-emerald'
    when lower(bank_name) like '%standard chartered%' then 'generic-slate'
    else 'generic-violet'
  end,
  card_color_theme = case
    when lower(bank_name) like '%hdfc%' then 'hdfc-maroon'
    when lower(bank_name) like '%sbi card%'
      or lower(bank_name) like '%state bank%'
      or lower(bank_name) like '%sbi%' then 'sbi-indigo'
    when lower(bank_name) like '%axis%' then 'axis-burgundy'
    when lower(bank_name) like '%icici%' then 'icici-amber'
    when lower(bank_name) like '%kotak%' then 'kotak-crimson'
    when lower(bank_name) like '%idfc%' then 'idfc-copper'
    when lower(bank_name) like '%american express%'
      or lower(bank_name) like '%amex%' then 'amex-gunmetal'
    when lower(bank_name) like '%diner%' then 'diners-navy'
    when lower(bank_name) like '%yes bank%' then 'generic-slate'
    when lower(bank_name) like '%indusind%' then 'axis-burgundy'
    when lower(bank_name) like '%rbl%' then 'generic-emerald'
    when lower(bank_name) like '%standard chartered%' then 'generic-slate'
    else 'generic-violet'
  end;

-- Prefer default_color_theme going forward; keep card_color_theme in sync for older clients.
alter table public.card_catalog
  alter column default_color_theme set default 'generic-violet';

update public.card_catalog
set default_color_theme = coalesce(default_color_theme, card_color_theme, 'generic-violet')
where default_color_theme is null;
