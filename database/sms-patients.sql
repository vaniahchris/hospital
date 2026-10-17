create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  do_not_message boolean not null default false,
  source_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patients_phone_unique unique (phone)
);

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('broadcast', 'single', 'feedback_invite')),
  body text not null,
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'partial', 'failed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.sms_messages (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  phone text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  error text,
  cost text
);

create index if not exists sms_recipients_message_id_idx on public.sms_recipients (message_id);
create index if not exists patients_name_idx on public.patients (name);

alter table public.patients enable row level security;
alter table public.sms_messages enable row level security;
alter table public.sms_recipients enable row level security;

create policy "Authenticated users manage patients"
  on public.patients for all to authenticated
  using (true) with check (true);

create policy "Authenticated users manage sms_messages"
  on public.sms_messages for all to authenticated
  using (true) with check (true);

create policy "Authenticated users manage sms_recipients"
  on public.sms_recipients for all to authenticated
  using (true) with check (true);
