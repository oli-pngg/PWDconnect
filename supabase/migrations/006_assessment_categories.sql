alter table public.jobs add column if not exists assessment_category text;

update public.jobs
set assessment_category = 'General'
where assessment_category is null or char_length(btrim(assessment_category)) = 0;

alter table public.jobs alter column assessment_category set default 'General';
alter table public.jobs alter column assessment_category set not null;

alter table public.assessment_questions add column if not exists job_id uuid;
alter table public.assessment_questions add column if not exists assessment_category text;

update public.assessment_questions
set assessment_category = 'General'
where assessment_category is null or char_length(btrim(assessment_category)) = 0;

alter table public.assessment_questions alter column assessment_category set default 'General';
alter table public.assessment_questions alter column assessment_category set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_questions_job_id_fkey'
      and conrelid = 'public.assessment_questions'::regclass
  ) then
    alter table public.assessment_questions
      add constraint assessment_questions_job_id_fkey
      foreign key (job_id) references public.jobs(id) on delete cascade;
  end if;
end;
$$;

alter table public.assessment_attempts add column if not exists assessment_category text;
alter table public.assessment_attempts add column if not exists job_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_attempts_job_id_fkey'
      and conrelid = 'public.assessment_attempts'::regclass
  ) then
    alter table public.assessment_attempts
      add constraint assessment_attempts_job_id_fkey
      foreign key (job_id) references public.jobs(id) on delete set null;
  end if;
end;
$$;

create index if not exists assessment_questions_job_idx
  on public.assessment_questions(job_id, active);
create index if not exists assessment_questions_category_idx
  on public.assessment_questions(assessment_category, active);
create index if not exists assessment_attempts_job_idx
  on public.assessment_attempts(job_id, completed_at);

drop policy if exists "assessment_questions_select_active" on public.assessment_questions;
create policy "assessment_questions_select_active" on public.assessment_questions
for select to authenticated using (
  active = true
  and (
    job_id is null
    or exists (
      select 1 from public.jobs
      where jobs.id = assessment_questions.job_id
        and jobs.status = 'published'
    )
  )
);
