create type public.offer_status as enum ('pending', 'accepted', 'declined', 'withdrawn');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  employer_id uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  employer_id uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  compensation text check (compensation is null or char_length(compensation) <= 200),
  start_date date,
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz
);

create index messages_application_created_idx on public.messages(application_id, created_at);
create index messages_unread_idx on public.messages(application_id, read_at);
create index messages_participant_idx on public.messages(employer_id, candidate_id);
create index job_offers_candidate_idx on public.job_offers(candidate_id, status);
create index job_offers_employer_idx on public.job_offers(employer_id, status);

alter table public.messages enable row level security;
alter table public.job_offers enable row level security;

create policy "messages_select_participant" on public.messages
for select to authenticated using (candidate_id = (select auth.uid()) or employer_id = (select auth.uid()));

create policy "job_offers_select_participant" on public.job_offers
for select to authenticated using (candidate_id = (select auth.uid()) or employer_id = (select auth.uid()));

grant select on table public.messages, public.job_offers to authenticated;

alter publication supabase_realtime add table public.messages, public.job_offers;
