begin;

alter table public.assessment_attempts
  add column if not exists session_id uuid;

create unique index if not exists assessment_attempts_session_id_unique
  on public.assessment_attempts(session_id)
  where session_id is not null;

create or replace function public.serialize_rand36_consent_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  new.recorded_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

create or replace function public.validate_rand36_assessment_consent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.candidate_id::text, 0));

  if not exists (
    select 1
    from public.user_consent_events consent
    where consent.id = new.consent_event_id
      and consent.user_id = new.candidate_id
      and consent.purpose = 'rand36_processing'
      and consent.granted = true
      and consent.id = (
        select latest.id
        from public.user_consent_events latest
        where latest.user_id = new.candidate_id
          and latest.purpose = 'rand36_processing'
        order by latest.recorded_at desc, latest.id desc
        limit 1
      )
  ) then
    raise exception 'current RAND-36 processing consent is required';
  end if;

  return new;
end;
$$;

drop trigger if exists user_consent_events_serialize_rand36 on public.user_consent_events;
create trigger user_consent_events_serialize_rand36
before insert on public.user_consent_events
for each row execute function public.serialize_rand36_consent_event();

drop trigger if exists rand36_assessments_validate_latest_consent on public.rand36_assessments;
create trigger rand36_assessments_validate_latest_consent
before insert on public.rand36_assessments
for each row execute function public.validate_rand36_assessment_consent();

revoke all on function public.serialize_rand36_consent_event() from public, anon, authenticated;
revoke all on function public.validate_rand36_assessment_consent() from public, anon, authenticated;
grant execute on function public.serialize_rand36_consent_event() to service_role;
grant execute on function public.validate_rand36_assessment_consent() to service_role;

commit;
