create table public.user_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose = 'rand36_processing'),
  policy_version text not null check (char_length(policy_version) between 1 and 80),
  granted boolean not null,
  recorded_at timestamptz not null default timezone('utc', now())
);

create table public.rand36_assessments (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  consent_event_id uuid not null references public.user_consent_events(id) on delete restrict,
  instrument_version text not null default 'RAND-36-1.0',
  language text not null default 'en',
  scoring_method text not null default 'RAND-simple-1.0',
  completed_at timestamptz not null default timezone('utc', now())
);

create table public.rand36_responses (
  attempt_id uuid not null references public.rand36_assessments(id) on delete cascade,
  item_number smallint not null check (item_number between 1 and 36),
  response_code smallint not null check (response_code between 1 and 6),
  recoded_score numeric not null check (recoded_score between 0 and 100),
  primary key (attempt_id, item_number)
);

create table public.rand36_scale_scores (
  attempt_id uuid not null references public.rand36_assessments(id) on delete cascade,
  scale_code text not null check (scale_code in (
    'physical_functioning',
    'role_physical',
    'role_emotional',
    'energy_fatigue',
    'emotional_wellbeing',
    'social_functioning',
    'bodily_pain',
    'general_health'
  )),
  score numeric,
  answered_items smallint not null check (answered_items >= 0),
  item_count smallint not null check (item_count > 0),
  check (answered_items <= item_count),
  check ((answered_items = 0 and score is null) or (answered_items > 0 and score between 0 and 100)),
  primary key (attempt_id, scale_code)
);

create index user_consent_events_latest_idx on public.user_consent_events(user_id, purpose, recorded_at desc);
create index rand36_assessments_candidate_idx on public.rand36_assessments(candidate_id, completed_at desc);

alter table public.user_consent_events enable row level security;
alter table public.rand36_assessments enable row level security;
alter table public.rand36_responses enable row level security;
alter table public.rand36_scale_scores enable row level security;

grant select on public.user_consent_events, public.rand36_assessments, public.rand36_responses, public.rand36_scale_scores to authenticated;

create policy user_consent_events_select_own on public.user_consent_events
for select to authenticated using (user_id = (select auth.uid()));

create policy rand36_assessments_select_own on public.rand36_assessments
for select to authenticated using (candidate_id = (select auth.uid()));

create policy rand36_responses_select_own on public.rand36_responses
for select to authenticated using (exists (
  select 1 from public.rand36_assessments
  where rand36_assessments.id = rand36_responses.attempt_id
    and rand36_assessments.candidate_id = (select auth.uid())
));

create policy rand36_scale_scores_select_own on public.rand36_scale_scores
for select to authenticated using (exists (
  select 1 from public.rand36_assessments
  where rand36_assessments.id = rand36_scale_scores.attempt_id
    and rand36_assessments.candidate_id = (select auth.uid())
));

create or replace function public.submit_rand36_assessment(
  p_candidate_id uuid,
  p_consent_event_id uuid,
  p_responses jsonb,
  p_scale_scores jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_attempt_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if not exists (
    select 1 from public.user_consent_events
    where id = p_consent_event_id
      and user_id = p_candidate_id
      and purpose = 'rand36_processing'
      and granted = true
  ) then
    raise exception 'RAND-36 processing consent is required';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_candidate_id and role = 'candidate'
  ) then
    raise exception 'candidate profile required';
  end if;

  insert into public.rand36_assessments (candidate_id, consent_event_id)
  values (p_candidate_id, p_consent_event_id)
  returning id into new_attempt_id;

  insert into public.rand36_responses (attempt_id, item_number, response_code, recoded_score)
  select new_attempt_id, item_number, response_code, recoded_score
  from jsonb_to_recordset(coalesce(p_responses, '[]'::jsonb)) as response(
    item_number smallint, response_code smallint, recoded_score numeric
  );

  insert into public.rand36_scale_scores (attempt_id, scale_code, score, answered_items, item_count)
  select new_attempt_id, scale_code, score, answered_items, item_count
  from jsonb_to_recordset(coalesce(p_scale_scores, '[]'::jsonb)) as scale_score(
    scale_code text, score numeric, answered_items smallint, item_count smallint
  );

  return new_attempt_id;
end;
$$;

create or replace function public.set_rand36_processing_consent(p_candidate_id uuid, p_policy_version text, p_granted boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_consent_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_candidate_id and role = 'candidate'
  ) then
    raise exception 'candidate profile required';
  end if;
  insert into public.user_consent_events (user_id, purpose, policy_version, granted)
  values (p_candidate_id, 'rand36_processing', p_policy_version, p_granted)
  returning id into new_consent_id;
  if not p_granted then
    delete from public.rand36_assessments where candidate_id = p_candidate_id;
  end if;
  return new_consent_id;
end;
$$;

revoke all on function public.submit_rand36_assessment(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.set_rand36_processing_consent(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.submit_rand36_assessment(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.set_rand36_processing_consent(uuid, text, boolean) to service_role;
