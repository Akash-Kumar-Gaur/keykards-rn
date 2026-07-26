/**
 * Persist all extracted line items (structured only) so category drill-down
 * can list merchants without re-reading a PDF. Still never stores the PDF.
 */

alter table public.statement_imports
  add column if not exists line_items jsonb not null default '[]'::jsonb;

alter table public.statement_imports
  add column if not exists payment_due_date date;

comment on column public.statement_imports.line_items is
  'Structured debit line items from the statement (no raw PDF / statement text).';
comment on column public.statement_imports.payment_due_date is
  'Payment due date printed on the statement, when present.';
