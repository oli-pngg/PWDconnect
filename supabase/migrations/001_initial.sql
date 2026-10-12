create extension if not exists pgcrypto;

create type public.user_role as enum ('candidate', 'employer', 'admin');
create type public.job_status as enum ('draft', 'published', 'closed');
create type public.application_status as enum ('submitted', 'shortlisted', 'interview', 'rejected', 'hired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  role public.user_role not null default 'candidate',
  full_name text not null default '' check (char_length(full_name) <= 100),
  organization_name text check (organization_name is null or char_length(organization_name) <= 140),
  headline text check (headline is null or char_length(headline) <= 160),
  bio text check (bio is null or char_length(bio) <= 1500),
  disability_description text,
  location text not null default 'Legazpi City, Albay' check (char_length(location) <= 120),
  work_mode text not null default 'Flexible' check (char_length(work_mode) <= 50),
  availability text not null default 'Open to opportunities' check (char_length(availability) <= 80),
  years_experience integer not null default 0 check (years_experience between 0 and 80),
  accessibility_needs text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 2 and 80),
  name text not null check (char_length(name) between 2 and 120),
  category text not null check (char_length(category) between 2 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.profile_skills (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  proficiency integer not null default 2 check (proficiency between 1 and 5),
  source text not null default 'self_reported' check (source in ('self_reported', 'assessment_verified')),
  verified_at timestamptz,
  primary key (profile_id, skill_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 20 and 5000),
  location text not null default 'Legazpi City, Albay' check (char_length(location) <= 120),
  work_mode text not null default 'Flexible' check (char_length(work_mode) <= 50),
  employment_type text not null default 'Full-time' check (char_length(employment_type) <= 50),
  salary_min numeric(12, 2) check (salary_min is null or salary_min >= 0),
  salary_max numeric(12, 2) check (salary_max is null or salary_max >= 0),
  accommodations text check (accommodations is null or char_length(accommodations) <= 1000),
  status public.job_status not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (salary_min is null or salary_max is null or salary_min <= salary_max)
);

create table public.job_skills (
  job_id uuid not null references public.jobs(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  required_level integer not null default 3 check (required_level between 1 and 5),
  importance integer not null default 1 check (importance between 1 and 5),
  primary key (job_id, skill_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  fit_score numeric(5, 2) not null default 0 check (fit_score between 0 and 100),
  matched_skills text[] not null default '{}',
  status public.application_status not null default 'submitted',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (job_id, candidate_id)
);

create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 2 and 160),
  skill_id uuid not null references public.skills(id) on delete restrict,
  prompt text not null check (char_length(btrim(prompt)) between 3 and 1000),
  options jsonb not null default '[]'::jsonb,
  points integer not null default 1 check (points between 1 and 10),
  sort_order integer not null default 1 check (sort_order > 0),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.assessment_answer_keys (
  question_id uuid primary key references public.assessment_questions(id) on delete cascade,
  correct_option text not null check (char_length(btrim(correct_option)) between 1 and 300)
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score >= 0),
  total_points integer not null check (total_points > 0),
  accommodation_notes text check (accommodation_notes is null or char_length(accommodation_notes) <= 500),
  completed_at timestamptz not null default timezone('utc', now())
);

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete restrict,
  selected_option text not null check (char_length(selected_option) between 1 and 500),
  is_correct boolean not null,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  unique (attempt_id, question_id)
);

create table public.platform_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  event_name text not null check (char_length(event_name) between 2 and 40),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 120000),
  created_at timestamptz not null default timezone('utc', now())
);

create index profiles_role_idx on public.profiles(role);
create index profile_skills_skill_idx on public.profile_skills(skill_id);
create index jobs_employer_status_idx on public.jobs(employer_id, status, created_at desc);
create index jobs_published_created_idx on public.jobs(status, created_at desc);
create index job_skills_skill_idx on public.job_skills(skill_id);
create index applications_candidate_created_idx on public.applications(candidate_id, created_at desc);
create index applications_job_status_idx on public.applications(job_id, status, created_at desc);
create index assessment_questions_active_idx on public.assessment_questions(active, sort_order);
create index assessment_attempts_candidate_idx on public.assessment_attempts(candidate_id, completed_at desc);
create index assessment_responses_attempt_idx on public.assessment_responses(attempt_id);
create index platform_events_actor_created_idx on public.platform_events(actor_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and old.role is distinct from new.role then
    raise exception 'profile role cannot be changed by the account owner';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'candidate');
  safe_role public.user_role := case
    when requested_role = 'employer' then 'employer'::public.user_role
    else 'candidate'::public.user_role
  end;
begin
  insert into public.profiles (id, email, role, full_name)
  values (new.id, coalesce(new.email, ''), safe_role, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.profile_skills enable row level security;
alter table public.jobs enable row level security;
alter table public.job_skills enable row level security;
alter table public.applications enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_answer_keys enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.platform_events enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.skills to authenticated;
grant select, insert, update, delete on public.profile_skills to authenticated;
grant select, insert, update, delete on public.jobs to authenticated;
grant select, insert, update, delete on public.job_skills to authenticated;
grant select, insert, update on public.applications to authenticated;
grant select on public.assessment_questions to authenticated;
grant select on public.assessment_attempts, public.assessment_responses to authenticated;
grant insert on public.platform_events to authenticated;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = (select auth.uid()));

create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (id = (select auth.uid()) and role <> 'admin');

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()) and role <> 'admin');

create policy skills_select_active on public.skills
for select to authenticated using (is_active = true);

create policy profile_skills_select_own on public.profile_skills
for select to authenticated using (profile_id = (select auth.uid()));

create policy profile_skills_insert_own on public.profile_skills
for insert to authenticated
with check (profile_id = (select auth.uid()) and source = 'self_reported');

create policy profile_skills_update_own on public.profile_skills
for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()) and source = 'self_reported');

create policy profile_skills_delete_own on public.profile_skills
for delete to authenticated using (profile_id = (select auth.uid()));

create policy jobs_select_visible on public.jobs
for select to authenticated
using (status = 'published' or employer_id = (select auth.uid()));

create policy jobs_insert_employer on public.jobs
for insert to authenticated
with check (
  employer_id = (select auth.uid())
  and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'employer')
);

create policy jobs_update_own on public.jobs
for update to authenticated using (employer_id = (select auth.uid()));

create policy jobs_delete_own on public.jobs
for delete to authenticated using (employer_id = (select auth.uid()));

create policy job_skills_select_visible on public.job_skills
for select to authenticated
using (exists (
  select 1 from public.jobs
  where jobs.id = job_skills.job_id
    and (jobs.status = 'published' or jobs.employer_id = (select auth.uid()))
));

create policy job_skills_write_own on public.job_skills
for all to authenticated
using (exists (select 1 from public.jobs where jobs.id = job_skills.job_id and jobs.employer_id = (select auth.uid())))
with check (exists (select 1 from public.jobs where jobs.id = job_skills.job_id and jobs.employer_id = (select auth.uid())));

create policy applications_select_participant on public.applications
for select to authenticated
using (
  candidate_id = (select auth.uid())
  or exists (select 1 from public.jobs where jobs.id = applications.job_id and jobs.employer_id = (select auth.uid()))
);

create policy applications_insert_candidate on public.applications
for insert to authenticated
with check (
  candidate_id = (select auth.uid())
  and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'candidate')
  and exists (select 1 from public.jobs where jobs.id = applications.job_id and jobs.status = 'published')
);

create policy applications_update_employer on public.applications
for update to authenticated
using (exists (select 1 from public.jobs where jobs.id = applications.job_id and jobs.employer_id = (select auth.uid())))
with check (exists (select 1 from public.jobs where jobs.id = applications.job_id and jobs.employer_id = (select auth.uid())));

create policy assessment_questions_select_active on public.assessment_questions
for select to authenticated using (active = true);

create policy assessment_attempts_select_own on public.assessment_attempts
for select to authenticated using (candidate_id = (select auth.uid()));

create policy assessment_responses_select_own on public.assessment_responses
for select to authenticated using (exists (select 1 from public.assessment_attempts where assessment_attempts.id = assessment_responses.attempt_id and assessment_attempts.candidate_id = (select auth.uid())));

create policy platform_events_insert_own on public.platform_events
for insert to authenticated with check (actor_id = (select auth.uid()));

insert into public.skills (slug, name, category)
values
  ('written-communication', 'Written communication', 'Communication'),
  ('customer-service', 'Customer service', 'People skills'),
  ('data-entry', 'Data entry', 'Digital skills'),
  ('spreadsheets', 'Spreadsheets', 'Digital skills'),
  ('social-media', 'Social media', 'Digital skills'),
  ('graphic-design', 'Graphic design', 'Creative skills'),
  ('time-management', 'Time management', 'Work habits'),
  ('problem-solving', 'Problem solving', 'Work habits')
on conflict (slug) do nothing;
