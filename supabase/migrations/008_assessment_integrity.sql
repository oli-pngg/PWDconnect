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
