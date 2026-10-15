begin;

-- Keep business-rule writes behind the authenticated API routes. Browser
-- clients may read visible records, but may not create or alter trusted scores,
-- statuses, employer openings, or assessment requirements directly.
revoke insert, update, delete on table public.jobs from public, anon, authenticated;
revoke insert, update, delete on table public.job_skills from public, anon, authenticated;
revoke insert, update, delete on table public.applications from public, anon, authenticated;

grant select, insert, update, delete on table public.jobs to service_role;
grant select, insert, update, delete on table public.job_skills to service_role;
grant select, insert, update, delete on table public.applications to service_role;

drop policy if exists jobs_insert_employer on public.jobs;
drop policy if exists jobs_update_own on public.jobs;
drop policy if exists jobs_delete_own on public.jobs;
drop policy if exists job_skills_write_own on public.job_skills;
drop policy if exists applications_insert_candidate on public.applications;
drop policy if exists applications_update_employer on public.applications;

commit;
