-- Apply to the existing shared Supabase project before deploying the inpatient form.
alter table public.submissions
  add column if not exists source text not null default 'outpatient';

alter table public.submissions
  add column if not exists inpatient_answers jsonb not null default '{}'::jsonb;

alter table public.submissions
  drop constraint if exists submissions_source_check;
alter table public.submissions
  add constraint submissions_source_check
  check (source in ('outpatient', 'inpatient'));

alter table public.submissions
  drop constraint if exists submissions_inpatient_answers_object_check;
alter table public.submissions
  add constraint submissions_inpatient_answers_object_check
  check (jsonb_typeof(inpatient_answers) = 'object');
