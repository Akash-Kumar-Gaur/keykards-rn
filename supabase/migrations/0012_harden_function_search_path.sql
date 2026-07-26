-- KeyKards — pin search_path on every public function that was missing it
-- (or only had `public`) so the Supabase function_search_path_mutable lint
-- stays clear. Preferred form: public, pg_temp.
--
-- Audit (grep migrations for SECURITY DEFINER + any create function without
-- set search_path):
--   handle_new_user              SECURITY DEFINER — had search_path = public
--   purge_transaction_raw_text   SECURITY DEFINER — had search_path = public
--   reset_card_milestones        SECURITY INVOKER — mutable (0010/0011)
--   set_updated_at               SECURITY INVOKER — mutable (0001/0002)
-- findings_dedup_* lives outside this repo's migrations and is left alone.

alter function public.reset_card_milestones(
  uuid,
  public.milestone_closed_reason,
  integer
) set search_path = public, pg_temp;

alter function public.set_updated_at()
  set search_path = public, pg_temp;

alter function public.handle_new_user()
  set search_path = public, pg_temp;

alter function public.purge_transaction_raw_text()
  set search_path = public, pg_temp;
