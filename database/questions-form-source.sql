-- Separate outpatient vs inpatient question banks.
alter table public.questions
  add column if not exists form_source text not null default 'outpatient';

alter table public.questions
  drop constraint if exists questions_form_source_check;
alter table public.questions
  add constraint questions_form_source_check
  check (form_source in ('outpatient', 'inpatient'));

alter table public.questions
  add column if not exists slug text;

create unique index if not exists questions_form_source_slug_uidx
  on public.questions (form_source, slug)
  where slug is not null;
