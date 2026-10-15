begin;

create table if not exists public.api_rate_limit_buckets (
  bucket_key text primary key check (bucket_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  last_request_at timestamptz not null
);

create index if not exists api_rate_limit_buckets_last_request_idx
  on public.api_rate_limit_buckets(last_request_at);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on table public.api_rate_limit_buckets from public, anon, authenticated, service_role;

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_window interval;
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_bucket_key is null or p_bucket_key !~ '^[a-f0-9]{64}$'
     or p_limit is null or p_limit < 1 or p_limit > 100000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit parameters' using errcode = '22023';
  end if;

  v_window := pg_catalog.make_interval(secs => p_window_seconds);

  -- Keep the shared counter table bounded without requiring pg_cron. This
  -- opportunistic cleanup is indexed and only runs on a small fraction of calls.
  if pg_catalog.random() < 0.005 then
    delete from public.api_rate_limit_buckets bucket
    where bucket.bucket_key in (
      select expired.bucket_key
      from public.api_rate_limit_buckets expired
      where expired.last_request_at < v_now - interval '24 hours'
      order by expired.last_request_at
      limit 1000
    );
  end if;

  insert into public.api_rate_limit_buckets as current_bucket (
    bucket_key,
    window_started_at,
    request_count,
    last_request_at
  ) values (
    p_bucket_key,
    v_now,
    1,
    v_now
  )
  on conflict (bucket_key) do update
    set window_started_at = case
          when current_bucket.window_started_at + v_window <= v_now then v_now
          else current_bucket.window_started_at
        end,
        request_count = case
          when current_bucket.window_started_at + v_window <= v_now then 1
          else current_bucket.request_count + 1
        end,
        last_request_at = v_now
  returning current_bucket.window_started_at, current_bucket.request_count
  into v_window_started_at, v_request_count;

  return query
  select
    v_request_count <= p_limit,
    greatest(1, ceil(extract(epoch from (v_window_started_at + v_window - v_now)))::integer);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

commit;
