begin;

create table public.employer_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete cascade,
  submission_number integer not null check (submission_number > 0),
  registered_business_name text not null check (char_length(btrim(registered_business_name)) between 2 and 200),
  trading_name text check (trading_name is null or char_length(trading_name) <= 200),
  business_type text not null check (business_type in (
    'sole_proprietorship', 'partnership', 'corporation', 'cooperative', 'nonprofit', 'government', 'other'
  )),
  registration_authority text not null check (char_length(btrim(registration_authority)) between 2 and 200),
  registration_number text check (registration_number is null or char_length(registration_number) <= 120),
  business_address text not null check (char_length(btrim(business_address)) between 5 and 500),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  contact_phone text not null check (char_length(contact_phone) between 7 and 40),
  website text check (website is null or (char_length(website) <= 2048 and website ~* '^https?://')),
  representative_name text not null check (char_length(btrim(representative_name)) between 2 and 160),
  representative_role text not null check (char_length(btrim(representative_role)) between 2 and 120),
  representative_is_owner_or_officer boolean not null,
  local_permit_applicable boolean not null,
  submitted_at timestamptz not null default clock_timestamp(),
  unique (employer_id, submission_number),
  unique (id, employer_id)
);

create table public.employer_verifications (
  employer_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'not_submitted' check (status in (
    'not_submitted', 'pending', 'needs_information', 'approved', 'rejected', 'suspended'
  )),
  current_submission_id uuid,
  registered_business_name text,
  trading_name text,
  business_type text,
  registration_authority text,
  registration_number text,
  business_address text,
  contact_email text,
  contact_phone text,
  website text,
  representative_name text,
  representative_role text,
  representative_is_owner_or_officer boolean,
  local_permit_applicable boolean,
  material_change_requires_evidence boolean not null default false,
  evidence_erasure_in_progress boolean not null default false,
  revision integer not null default 0 check (revision >= 0),
  employer_feedback text check (employer_feedback is null or char_length(employer_feedback) <= 2000),
  approved_at timestamptz,
  last_submitted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint employer_verifications_approval_timestamp_check
    check ((status = 'approved' and approved_at is not null) or (status <> 'approved' and approved_at is null))
);

create table public.employer_verification_documents (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete restrict,
  submission_id uuid,
  document_type text not null check (document_type in (
    'business_registration', 'local_permit', 'representative_authorization', 'other_evidence'
  )),
  storage_path text not null unique,
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 4194304),
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default clock_timestamp(),
  constraint employer_verification_documents_submission_owner_fkey
    foreign key (submission_id, employer_id)
    references public.employer_verification_submissions(id, employer_id)
    on delete restrict,
  constraint employer_verification_documents_safe_path_check
    check (storage_path ~ ('^' || employer_id::text || '/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'))
);

create or replace function public.guard_employer_verification_document_upload()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_status text;
  erasure_in_progress boolean;
begin
  select verification.status, verification.evidence_erasure_in_progress
    into current_status, erasure_in_progress
  from public.employer_verifications verification
  where verification.employer_id = new.employer_id
  for share;
  if not found or erasure_in_progress or current_status in ('pending', 'suspended') then
    raise exception 'evidence upload is unavailable in the current verification state' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger employer_verification_documents_guard_upload
before insert on public.employer_verification_documents
for each row execute function public.guard_employer_verification_document_upload();

create table public.employer_verification_events (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid references public.employer_verification_submissions(id) on delete set null,
  event_type text not null check (event_type in ('submission', 'review', 'material_identity_change', 'evidence_erasure_pending', 'evidence_erasure')),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null check (actor_role in ('employer', 'admin', 'system')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  previous_status text check (previous_status is null or previous_status in (
    'not_submitted', 'pending', 'needs_information', 'approved', 'rejected', 'suspended'
  )),
  new_status text not null check (new_status in (
    'not_submitted', 'pending', 'needs_information', 'approved', 'rejected', 'suspended'
  )),
  reason text check (reason is null or char_length(reason) <= 1000),
  employer_feedback text check (employer_feedback is null or char_length(employer_feedback) <= 2000),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 2000),
  source_name text check (source_name is null or char_length(source_name) <= 500),
  source_checked_at timestamptz,
  business_check_result text check (business_check_result is null or business_check_result in ('matched', 'not_matched', 'inconclusive')),
  representative_check_method text check (representative_check_method is null or char_length(representative_check_method) <= 1000),
  created_at timestamptz not null default clock_timestamp(),
  constraint employer_verification_review_identity_check check (
    (event_type = 'review' and actor_role = 'admin' and reviewer_id is not null and reviewer_id = actor_id)
    or (event_type <> 'review' and reviewer_id is null)
  )
);

create index employer_verifications_status_updated_idx
  on public.employer_verifications(status, updated_at desc);
create index employer_verification_submissions_employer_idx
  on public.employer_verification_submissions(employer_id, submitted_at desc);
create index employer_verification_documents_employer_idx
  on public.employer_verification_documents(employer_id, uploaded_at desc);
create index employer_verification_events_employer_idx
  on public.employer_verification_events(employer_id, created_at desc);

alter table public.employer_verifications enable row level security;
alter table public.employer_verification_submissions enable row level security;
alter table public.employer_verification_documents enable row level security;
alter table public.employer_verification_events enable row level security;

revoke all on public.employer_verifications from public, anon, authenticated, service_role;
revoke all on public.employer_verification_submissions from public, anon, authenticated, service_role;
revoke all on public.employer_verification_documents from public, anon, authenticated, service_role;
revoke all on public.employer_verification_events from public, anon, authenticated, service_role;

grant select on public.employer_verifications, public.employer_verification_submissions,
  public.employer_verification_documents, public.employer_verification_events to authenticated;
grant select on public.employer_verifications, public.employer_verification_submissions,
  public.employer_verification_documents, public.employer_verification_events to service_role;
grant insert, delete on public.employer_verification_documents to service_role;

insert into public.employer_verifications(employer_id, status, trading_name)
select id, 'not_submitted', nullif(btrim(organization_name), '')
from public.profiles
where role = 'employer'
on conflict (employer_id) do nothing;

-- Existing published jobs are closed for review at cutover. Their records,
-- applications, offers, and messages are preserved; approved employers can
-- republish them through the normal status endpoint.
update public.jobs
set status = 'closed', updated_at = clock_timestamp()
where status = 'published'
  and not exists (
    select 1 from public.employer_verifications verification
    where verification.employer_id = jobs.employer_id and verification.status = 'approved'
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employer-verification',
  'employer-verification',
  false,
  4194304,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Client credentials cannot read or write this bucket directly. The server
-- routes authorize owners/admins and use short-lived signed URLs after checks.
drop policy if exists employer_verification_storage_restrict_direct_access on storage.objects;
create policy employer_verification_storage_restrict_direct_access on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'employer-verification')
with check (bucket_id <> 'employer-verification');

create or replace function public.employer_is_approved(p_employer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.employer_verifications verification
    where verification.employer_id = p_employer_id
      and verification.status = 'approved'
      and verification.approved_at is not null
  );
$$;

revoke all on function public.employer_is_approved(uuid) from public, anon;
grant execute on function public.employer_is_approved(uuid) to authenticated, service_role;

create policy employer_verifications_select_owner_or_admin on public.employer_verifications
for select to authenticated using (
  (employer_id = (select auth.uid()) and exists (
    select 1 from public.profiles owner_profile
    where owner_profile.id = (select auth.uid()) and owner_profile.role = 'employer'
  ))
  or exists (
    select 1 from public.profiles admin_profile
    where admin_profile.id = (select auth.uid()) and admin_profile.role = 'admin'
  )
);

create policy employer_verification_submissions_select_owner_or_admin on public.employer_verification_submissions
for select to authenticated using (
  (employer_id = (select auth.uid()) and exists (
    select 1 from public.profiles owner_profile
    where owner_profile.id = (select auth.uid()) and owner_profile.role = 'employer'
  ))
  or exists (
    select 1 from public.profiles admin_profile
    where admin_profile.id = (select auth.uid()) and admin_profile.role = 'admin'
  )
);

create policy employer_verification_documents_select_owner_or_admin on public.employer_verification_documents
for select to authenticated using (
  (employer_id = (select auth.uid()) and exists (
    select 1 from public.profiles owner_profile
    where owner_profile.id = (select auth.uid()) and owner_profile.role = 'employer'
  ))
  or exists (
    select 1 from public.profiles admin_profile
    where admin_profile.id = (select auth.uid()) and admin_profile.role = 'admin'
  )
);

create policy employer_verification_events_select_admin on public.employer_verification_events
for select to authenticated using (
  exists (
    select 1 from public.profiles admin_profile
    where admin_profile.id = (select auth.uid()) and admin_profile.role = 'admin'
  )
);

create or replace function public.submit_employer_verification(
  p_registered_business_name text,
  p_trading_name text,
  p_business_type text,
  p_registration_authority text,
  p_registration_number text,
  p_business_address text,
  p_contact_email text,
  p_contact_phone text,
  p_website text,
  p_representative_name text,
  p_representative_role text,
  p_representative_is_owner_or_officer boolean,
  p_local_permit_applicable boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  verification public.employer_verifications%rowtype;
  new_submission_id uuid;
  next_submission_number integer;
  next_status text;
  has_business_record boolean;
  has_draft_business_record boolean;
  has_local_permit boolean;
  has_draft_local_permit boolean;
  has_representative_authorization boolean;
  has_draft_representative_authorization boolean;
  is_registered_type boolean;
  material_change boolean := false;
  business_identity_change boolean := false;
  representative_change boolean := false;
  local_permit_change boolean := false;
begin
  if actor_id is null or not exists (
    select 1 from public.profiles where id = actor_id and role = 'employer'
  ) then
    raise exception 'employer account required' using errcode = '42501';
  end if;

  insert into public.employer_verifications(employer_id, status)
  values (actor_id, 'not_submitted')
  on conflict (employer_id) do nothing;

  select * into verification
  from public.employer_verifications
  where employer_id = actor_id
  for update;

  if verification.evidence_erasure_in_progress then
    raise exception 'evidence erasure is in progress' using errcode = '55000';
  end if;
  if verification.status = 'suspended' then
    raise exception 'suspended employers must contact PWDconnect support before resubmitting' using errcode = '42501';
  end if;
  if verification.status = 'pending' then
    raise exception 'verification is already pending review' using errcode = '55000';
  end if;

  if nullif(btrim(p_registered_business_name), '') is null
     or char_length(btrim(p_registered_business_name)) > 200
     or nullif(btrim(p_business_address), '') is null
     or char_length(btrim(p_business_address)) > 500
     or nullif(btrim(p_contact_email), '') is null
     or p_contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or char_length(p_contact_email) > 254
     or char_length(btrim(coalesce(p_contact_phone, ''))) not between 7 and 40
     or nullif(btrim(p_representative_name), '') is null
     or char_length(btrim(p_representative_name)) > 160
     or nullif(btrim(p_representative_role), '') is null
     or char_length(btrim(p_representative_role)) > 120
     or p_representative_is_owner_or_officer is null
     or p_local_permit_applicable is null then
    raise exception 'required verification fields are missing or invalid' using errcode = '22023';
  end if;

  if p_trading_name is not null and char_length(btrim(p_trading_name)) > 200 then
    raise exception 'trading name is too long' using errcode = '22023';
  end if;
  if p_registration_authority is null or char_length(btrim(p_registration_authority)) not between 2 and 200 then
    raise exception 'registration authority or official source is required' using errcode = '22023';
  end if;
  if p_registration_number is not null and char_length(btrim(p_registration_number)) > 120 then
    raise exception 'registration number is too long' using errcode = '22023';
  end if;
  if p_website is not null and (char_length(p_website) > 2048 or p_website !~* '^https?://') then
    raise exception 'website must be an http or https URL' using errcode = '22023';
  end if;
  if p_business_type is null or p_business_type not in ('sole_proprietorship', 'partnership', 'corporation', 'cooperative', 'nonprofit', 'government', 'other') then
    raise exception 'choose a supported business type' using errcode = '22023';
  end if;

  is_registered_type := p_business_type in ('sole_proprietorship', 'partnership', 'corporation', 'cooperative', 'nonprofit');
  if is_registered_type and (nullif(btrim(p_registration_number), '') is null or nullif(btrim(p_registration_authority), '') is null) then
    raise exception 'registered business types require an authority and registration number' using errcode = '22023';
  end if;

  select
    coalesce(bool_or(document_type in ('business_registration', 'other_evidence')), false),
    coalesce(bool_or(document_type = 'local_permit'), false),
    coalesce(bool_or(document_type = 'representative_authorization'), false),
    coalesce(bool_or(submission_id is null and document_type in ('business_registration', 'other_evidence')), false),
    coalesce(bool_or(submission_id is null and document_type = 'local_permit'), false),
    coalesce(bool_or(submission_id is null and document_type = 'representative_authorization'), false)
  into has_business_record, has_local_permit, has_representative_authorization,
       has_draft_business_record, has_draft_local_permit, has_draft_representative_authorization
  from public.employer_verification_documents
  where employer_id = actor_id;

  if is_registered_type and not exists (
    select 1 from public.employer_verification_documents
    where employer_id = actor_id and document_type = 'business_registration'
  ) then
    raise exception 'upload a relevant business-registration record for this business type' using errcode = '22023';
  elsif not has_business_record then
    raise exception 'upload a relevant registration record or equivalent official-source evidence' using errcode = '22023';
  end if;
  if p_local_permit_applicable and not has_local_permit then
    raise exception 'upload the applicable permit evidence or mark that no permit applies' using errcode = '22023';
  end if;
  if not p_representative_is_owner_or_officer and not has_representative_authorization then
    raise exception 'upload representative-authorization evidence' using errcode = '22023';
  end if;

  business_identity_change := verification.material_change_requires_evidence or (
    verification.status = 'approved' and (
      verification.registered_business_name is distinct from btrim(p_registered_business_name)
      or verification.trading_name is distinct from nullif(btrim(p_trading_name), '')
      or verification.business_type is distinct from p_business_type
      or verification.registration_authority is distinct from btrim(p_registration_authority)
      or verification.registration_number is distinct from nullif(btrim(p_registration_number), '')
      or verification.business_address is distinct from btrim(p_business_address)
    )
  );
  representative_change := verification.status = 'approved' and (
    verification.representative_name is distinct from btrim(p_representative_name)
    or verification.representative_role is distinct from btrim(p_representative_role)
    or verification.representative_is_owner_or_officer is distinct from p_representative_is_owner_or_officer
  );
  local_permit_change := verification.status = 'approved'
    and verification.local_permit_applicable is distinct from p_local_permit_applicable;
  material_change := business_identity_change or representative_change or local_permit_change
    or (verification.status = 'approved' and exists (
      select 1 from public.employer_verification_documents where employer_id = actor_id and submission_id is null
    ));

  if business_identity_change and not has_draft_business_record then
    raise exception 'upload new registration or official-source evidence for the material change' using errcode = '22023';
  end if;
  if representative_change and not p_representative_is_owner_or_officer and not has_draft_representative_authorization then
    raise exception 'upload current representative-authorization evidence for the material change' using errcode = '22023';
  end if;
  if local_permit_change and p_local_permit_applicable and not has_draft_local_permit then
    raise exception 'upload current local permit evidence for the material change' using errcode = '22023';
  end if;

  next_status := case
    when verification.status = 'approved' and not material_change then 'approved'
    else 'pending'
  end;
  if next_status = 'pending' then
    select coalesce(max(submission_number), 0) + 1 into next_submission_number
    from public.employer_verification_submissions
    where employer_id = actor_id;

    insert into public.employer_verification_submissions(
      employer_id, submission_number, registered_business_name, trading_name, business_type,
      registration_authority, registration_number, business_address, contact_email,
      contact_phone, website, representative_name, representative_role,
      representative_is_owner_or_officer, local_permit_applicable
    ) values (
      actor_id, next_submission_number, btrim(p_registered_business_name), nullif(btrim(p_trading_name), ''), p_business_type,
      btrim(p_registration_authority), nullif(btrim(p_registration_number), ''), btrim(p_business_address),
      lower(btrim(p_contact_email)), btrim(p_contact_phone), nullif(btrim(p_website), ''), btrim(p_representative_name),
      btrim(p_representative_role), p_representative_is_owner_or_officer, p_local_permit_applicable
    ) returning id into new_submission_id;

    update public.employer_verification_documents
    set submission_id = new_submission_id
    where employer_id = actor_id and submission_id is null;
  else
    new_submission_id := verification.current_submission_id;
  end if;

  update public.employer_verifications
  set status = next_status,
      current_submission_id = coalesce(new_submission_id, verification.current_submission_id),
      registered_business_name = btrim(p_registered_business_name),
      trading_name = nullif(btrim(p_trading_name), ''),
      business_type = p_business_type,
      registration_authority = btrim(p_registration_authority),
      registration_number = nullif(btrim(p_registration_number), ''),
      business_address = btrim(p_business_address),
      contact_email = lower(btrim(p_contact_email)),
      contact_phone = btrim(p_contact_phone),
      website = nullif(btrim(p_website), ''),
      representative_name = btrim(p_representative_name),
      representative_role = btrim(p_representative_role),
      representative_is_owner_or_officer = p_representative_is_owner_or_officer,
      local_permit_applicable = p_local_permit_applicable,
      material_change_requires_evidence = false,
      revision = verification.revision + 1,
      employer_feedback = case when next_status = 'pending' then null else employer_verifications.employer_feedback end,
      approved_at = case when next_status = 'approved' then employer_verifications.approved_at else null end,
      last_submitted_at = case when next_status = 'pending' then clock_timestamp() else employer_verifications.last_submitted_at end,
      updated_at = clock_timestamp()
  where employer_id = actor_id;

  if next_status = 'pending' then
    insert into public.employer_verification_events(
      employer_id, submission_id, event_type, actor_id, actor_role,
      previous_status, new_status, reason, internal_notes
    ) values (
      actor_id, new_submission_id, 'submission', actor_id, 'employer',
      verification.status, next_status, 'Employer submitted verification information.',
      case when material_change then 'Material identity change triggered a new review.' else null end
    );
  end if;

  if next_status <> 'approved' then
    update public.jobs set status = 'closed', updated_at = clock_timestamp()
    where employer_id = actor_id and status = 'published';
  end if;

  return new_submission_id;
end;
$$;

create or replace function public.review_employer_verification(
  p_employer_id uuid,
  p_expected_revision integer,
  p_action text,
  p_reason text,
  p_employer_feedback text,
  p_internal_notes text,
  p_source_name text,
  p_source_checked_at timestamptz,
  p_business_check_result text,
  p_representative_check_method text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  reviewer uuid := auth.uid();
  verification public.employer_verifications%rowtype;
  current_submission public.employer_verification_submissions%rowtype;
  next_status text;
  is_registered_type boolean;
  safe_reason text := nullif(btrim(p_reason), '');
  safe_feedback text := nullif(btrim(p_employer_feedback), '');
begin
  if reviewer is null or not exists (
    select 1 from public.profiles where id = reviewer and role = 'admin'
  ) then
    raise exception 'authorized admin access required' using errcode = '42501';
  end if;

  select * into verification
  from public.employer_verifications
  where employer_id = p_employer_id
  for update;
  if not found or verification.status = 'not_submitted' or verification.current_submission_id is null then
    raise exception 'employer has no submitted verification to review' using errcode = '55000';
  end if;
  if p_expected_revision is null or verification.revision <> p_expected_revision then
    raise exception 'verification changed while you were reviewing it; reload before making a decision' using errcode = '40001';
  end if;
  if verification.evidence_erasure_in_progress then
    raise exception 'evidence erasure is in progress' using errcode = '55000';
  end if;
  if verification.status not in ('pending', 'needs_information', 'approved', 'suspended') then
    raise exception 'this verification status cannot be reviewed' using errcode = '55000';
  end if;
  if (verification.status = 'approved' and p_action = 'approve')
     or (verification.status = 'suspended' and p_action = 'suspend') then
    raise exception 'this decision is not an allowed transition from the current status' using errcode = '55000';
  end if;

  if p_action = 'approve' then
    next_status := 'approved';
    if nullif(btrim(p_source_name), '') is null or p_source_checked_at is null
       or p_source_checked_at > clock_timestamp()
       or p_business_check_result is distinct from 'matched'
       or nullif(btrim(p_representative_check_method), '') is null then
      raise exception 'approval requires a source, check time, matched business result, and representative-check method' using errcode = '22023';
    end if;
    select * into current_submission
    from public.employer_verification_submissions
    where id = verification.current_submission_id and employer_id = p_employer_id;
    if not found then raise exception 'current verification submission was not found' using errcode = '55000'; end if;
    is_registered_type := current_submission.business_type in ('sole_proprietorship', 'partnership', 'corporation', 'cooperative', 'nonprofit');
    if is_registered_type and not exists (
      select 1 from public.employer_verification_documents
      where employer_id = p_employer_id and document_type = 'business_registration'
    ) then
      raise exception 'current business-registration evidence is required before approval' using errcode = '22023';
    elsif not is_registered_type and not exists (
      select 1 from public.employer_verification_documents
      where employer_id = p_employer_id and document_type in ('business_registration', 'other_evidence')
    ) then
      raise exception 'current official-source evidence is required before approval' using errcode = '22023';
    end if;
    if current_submission.local_permit_applicable and not exists (
      select 1 from public.employer_verification_documents
      where employer_id = p_employer_id and document_type = 'local_permit'
    ) then
      raise exception 'applicable permit evidence is required before approval' using errcode = '22023';
    end if;
    if not current_submission.representative_is_owner_or_officer and not exists (
      select 1 from public.employer_verification_documents
      where employer_id = p_employer_id and document_type = 'representative_authorization'
    ) then
      raise exception 'representative authorization is required before approval' using errcode = '22023';
    end if;
    safe_reason := coalesce(safe_reason, 'Approved after manual review.');
  elsif p_action = 'request_information' then
    next_status := 'needs_information';
    if safe_reason is null or safe_feedback is null then
      raise exception 'requesting information requires a reason and employer-visible feedback' using errcode = '22023';
    end if;
  elsif p_action = 'reject' then
    next_status := 'rejected';
    if safe_reason is null or safe_feedback is null then
      raise exception 'rejection requires a reason and employer-visible feedback' using errcode = '22023';
    end if;
  elsif p_action = 'suspend' then
    next_status := 'suspended';
    if safe_reason is null or safe_feedback is null then
      raise exception 'suspension requires a reason and employer-visible feedback' using errcode = '22023';
    end if;
  else
    raise exception 'invalid verification decision' using errcode = '22023';
  end if;

  update public.employer_verifications
  set status = next_status,
      approved_at = case when next_status = 'approved' then clock_timestamp() else null end,
      employer_feedback = safe_feedback,
      material_change_requires_evidence = false,
      revision = verification.revision + 1,
      updated_at = clock_timestamp()
  where employer_id = p_employer_id;

  insert into public.employer_verification_events(
    employer_id, submission_id, event_type, actor_id, actor_role, reviewer_id,
    previous_status, new_status, reason, employer_feedback, internal_notes,
    source_name, source_checked_at, business_check_result, representative_check_method
  ) values (
    p_employer_id, verification.current_submission_id, 'review', reviewer, 'admin', reviewer,
    verification.status, next_status, safe_reason, safe_feedback,
    nullif(btrim(p_internal_notes), ''), nullif(btrim(p_source_name), ''),
    p_source_checked_at, p_business_check_result, nullif(btrim(p_representative_check_method), '')
  );

  if next_status <> 'approved' then
    update public.jobs set status = 'closed', updated_at = clock_timestamp()
    where employer_id = p_employer_id and status = 'published';
  end if;

  return next_status;
end;
$$;

create or replace function public.admin_list_employer_verifications(
  p_search text default '',
  p_status text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table(
  employer_id uuid,
  status text,
  full_name text,
  email text,
  organization_name text,
  registered_business_name text,
  trading_name text,
  business_type text,
  last_submitted_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  search_term text := lower(btrim(coalesce(p_search, '')));
  page_number integer := greatest(1, coalesce(p_page, 1));
  page_size integer := least(50, greatest(1, coalesce(p_page_size, 20)));
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and role = 'admin') then
    raise exception 'authorized admin access required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('not_submitted', 'pending', 'needs_information', 'approved', 'rejected', 'suspended') then
    raise exception 'invalid verification status filter' using errcode = '22023';
  end if;

  return query
  select verification.employer_id, verification.status, profile.full_name, profile.email,
         profile.organization_name, verification.registered_business_name, verification.trading_name,
         verification.business_type, verification.last_submitted_at, verification.updated_at,
         count(*) over ()
  from public.employer_verifications verification
  join public.profiles profile on profile.id = verification.employer_id
  where profile.role = 'employer'
    and (p_status is null or verification.status = p_status)
    and (search_term = '' or position(search_term in lower(concat_ws(' ',
      profile.full_name, profile.email, profile.organization_name,
      verification.registered_business_name, verification.trading_name
    ))) > 0)
  order by verification.updated_at desc, verification.employer_id
  limit page_size offset ((page_number - 1) * page_size);
end;
$$;

create or replace function public.admin_employer_verification_status_counts()
returns table(status text, total bigint)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and role = 'admin') then
    raise exception 'authorized admin access required' using errcode = '42501';
  end if;
  return query
  select statuses.status, count(profile.id)::bigint
  from (values ('not_submitted'), ('pending'), ('needs_information'), ('approved'), ('rejected'), ('suspended')) as statuses(status)
  left join public.employer_verifications verification on verification.status = statuses.status
  left join public.profiles profile on profile.id = verification.employer_id and profile.role = 'employer'
  group by statuses.status
  order by statuses.status;
end;
$$;

create or replace function public.admin_begin_employer_evidence_erasure(
  p_employer_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  verification public.employer_verifications%rowtype;
  next_status text;
  safe_reason text := nullif(btrim(p_reason), '');
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and role = 'admin') then
    raise exception 'authorized admin access required' using errcode = '42501';
  end if;
  if safe_reason is null or char_length(safe_reason) > 1000 then
    raise exception 'an erasure reason is required' using errcode = '22023';
  end if;
  select * into verification from public.employer_verifications
  where employer_id = p_employer_id for update;
  if not found then raise exception 'employer verification was not found' using errcode = 'P0002'; end if;
  if verification.evidence_erasure_in_progress then return verification.revision; end if;
  if p_expected_revision is null or verification.revision <> p_expected_revision then
    raise exception 'verification changed; reload before erasing evidence' using errcode = '40001';
  end if;

  next_status := case when verification.status = 'approved' then 'needs_information' else verification.status end;
  update public.employer_verifications
  set status = next_status,
      approved_at = case when next_status = 'approved' then approved_at else null end,
      material_change_requires_evidence = verification.status = 'approved' or material_change_requires_evidence,
      evidence_erasure_in_progress = true,
      revision = revision + 1,
      employer_feedback = case
        when verification.status = 'approved' then 'Supporting evidence erasure is in progress. Submit current evidence again before the business can be approved.'
        else employer_feedback
      end
  where employer_id = p_employer_id;
  if next_status <> 'approved' then
    update public.jobs set status = 'closed', updated_at = clock_timestamp()
    where employer_id = p_employer_id and status = 'published';
  end if;

  insert into public.employer_verification_events(
    employer_id, event_type, actor_id, actor_role, previous_status, new_status,
    reason, employer_feedback, internal_notes
  ) values (
    p_employer_id, 'evidence_erasure_pending', actor, 'admin', verification.status, next_status,
    safe_reason,
    case when verification.status = 'approved' then 'Supporting evidence erasure is in progress; re-review is required.' else null end,
    'Evidence erasure is in progress. Publication and additional submissions are blocked until cleanup completes.'
  );
  return verification.revision + 1;
end;
$$;

create or replace function public.admin_complete_employer_evidence_erasure(p_employer_id uuid, p_admin_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_status text;
  deleted_count integer;
begin
  if p_admin_id is null or not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then
    raise exception 'authorized admin access required' using errcode = '42501';
  end if;
  select status into current_status from public.employer_verifications
  where employer_id = p_employer_id and evidence_erasure_in_progress
  for update;
  if not found then raise exception 'no evidence erasure is in progress' using errcode = '55000'; end if;

  delete from public.employer_verification_documents where employer_id = p_employer_id;
  get diagnostics deleted_count = row_count;
  update public.employer_verifications
  set evidence_erasure_in_progress = false,
      revision = revision + 1
  where employer_id = p_employer_id;
  insert into public.employer_verification_events(
    employer_id, event_type, actor_id, actor_role, previous_status, new_status,
    reason, internal_notes
  ) values (
    p_employer_id, 'evidence_erasure', p_admin_id, 'admin', current_status, current_status,
    'Approved evidence erasure completed.', 'Private storage objects and document metadata were removed.'
  );
  return deleted_count;
end;
$$;

create or replace function public.employer_verification_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger employer_verifications_set_updated_at
before update on public.employer_verifications
for each row execute function public.employer_verification_set_updated_at();

create or replace function public.enforce_verified_job_publication()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  employer_status text;
begin
  if new.status = 'published' then
    select verification.status into employer_status
    from public.employer_verifications verification
    where verification.employer_id = new.employer_id
    for share;
    if employer_status is distinct from 'approved' then
      raise exception 'employer verification approval is required before publication' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_require_approved_employer
before insert or update of status, employer_id on public.jobs
for each row execute function public.enforce_verified_job_publication();

create or replace function public.enforce_verified_application_opening()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  job_employer_id uuid;
  employer_status text;
  job_status public.job_status;
begin
  select job.employer_id into job_employer_id
  from public.jobs job
  where job.id = new.job_id;
  if not found then
    raise exception 'application opening was not found' using errcode = '23503';
  end if;

  select verification.status into employer_status
  from public.employer_verifications verification
  where verification.employer_id = job_employer_id
  for share;
  if employer_status is distinct from 'approved' then
    raise exception 'applications require an approved employer' using errcode = '42501';
  end if;

  select job.status into job_status
  from public.jobs job
  where job.id = new.job_id and job.employer_id = job_employer_id
  for share;
  if job_status is distinct from 'published'::public.job_status then
    raise exception 'applications require a published opening' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger applications_require_approved_employer
before insert on public.applications
for each row execute function public.enforce_verified_application_opening();

create or replace function public.profiles_create_employer_verification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.role = 'employer' then
    insert into public.employer_verifications(employer_id, status, trading_name)
    values (new.id, 'not_submitted', nullif(btrim(new.organization_name), ''))
    on conflict (employer_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger profiles_employer_verification_init
after insert on public.profiles
for each row execute function public.profiles_create_employer_verification();

create or replace function public.profiles_employer_identity_changed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_status text;
  new_status text;
  actor uuid := auth.uid();
  feedback text := 'Your organization name changed. Submit updated business-registration evidence so PWDconnect can review the change.';
begin
  if old.role <> 'employer' or new.role <> 'employer'
     or old.organization_name is not distinct from new.organization_name then
    return new;
  end if;

  select verification.status into old_status
  from public.employer_verifications verification
  where verification.employer_id = new.id
  for update;
  if not found then
    insert into public.employer_verifications(employer_id, status, trading_name)
    values (new.id, 'not_submitted', nullif(btrim(new.organization_name), ''))
    on conflict (employer_id) do nothing;
    return new;
  end if;

  new_status := case when old_status in ('approved', 'pending') then 'needs_information' else old_status end;
  if old_status <> 'not_submitted' then
    update public.employer_verifications
    set status = new_status,
        trading_name = nullif(btrim(new.organization_name), ''),
        approved_at = case when new_status = 'approved' then approved_at else null end,
        material_change_requires_evidence = true,
        revision = revision + 1,
        employer_feedback = feedback
    where employer_id = new.id;
    if new_status <> 'approved' then
      update public.jobs set status = 'closed', updated_at = clock_timestamp()
      where employer_id = new.id and status = 'published';
    end if;
    insert into public.employer_verification_events(
      employer_id, event_type, actor_id, actor_role, previous_status, new_status,
      reason, employer_feedback, internal_notes
    ) values (
      new.id, 'material_identity_change', actor,
      case when actor = new.id then 'employer' else 'system' end,
      old_status, new_status,
      'The organization name changed; renewed verification is required.',
      feedback, case when old_status in ('approved', 'pending') then 'Published jobs were closed; related records were retained.' else null end
    );
  else
    update public.employer_verifications
    set trading_name = nullif(btrim(new.organization_name), ''),
        revision = revision + 1
    where employer_id = new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_employer_identity_recheck
after update of organization_name on public.profiles
for each row execute function public.profiles_employer_identity_changed();

drop policy if exists jobs_select_visible on public.jobs;
create policy jobs_select_visible on public.jobs
for select to authenticated
using (
  employer_id = (select auth.uid())
  or (status = 'published' and public.employer_is_approved(employer_id))
);

drop policy if exists applications_select_participant on public.applications;
create policy applications_select_participant on public.applications
for select to authenticated
using (
  candidate_id = (select auth.uid())
  or exists (
    select 1 from public.jobs job
    where job.id = applications.job_id
      and job.employer_id = (select auth.uid())
      and public.employer_is_approved(job.employer_id)
  )
);

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages
for select to authenticated
using (
  candidate_id = (select auth.uid())
  or (employer_id = (select auth.uid()) and public.employer_is_approved(employer_id))
);

drop policy if exists job_offers_select_participant on public.job_offers;
create policy job_offers_select_participant on public.job_offers
for select to authenticated
using (
  candidate_id = (select auth.uid())
  or (employer_id = (select auth.uid()) and public.employer_is_approved(employer_id))
);

revoke all on function public.employer_verification_set_updated_at() from public, anon, authenticated;
revoke all on function public.guard_employer_verification_document_upload() from public, anon, authenticated;
revoke all on function public.enforce_verified_job_publication() from public, anon, authenticated;
revoke all on function public.enforce_verified_application_opening() from public, anon, authenticated;
revoke all on function public.profiles_create_employer_verification() from public, anon, authenticated;
revoke all on function public.profiles_employer_identity_changed() from public, anon, authenticated;
revoke all on function public.submit_employer_verification(text, text, text, text, text, text, text, text, text, text, text, boolean, boolean) from public, anon;
revoke all on function public.review_employer_verification(uuid, integer, text, text, text, text, text, timestamptz, text, text) from public, anon;
revoke all on function public.admin_list_employer_verifications(text, text, integer, integer) from public, anon;
revoke all on function public.admin_employer_verification_status_counts() from public, anon;
revoke all on function public.admin_begin_employer_evidence_erasure(uuid, integer, text) from public, anon;
revoke all on function public.admin_complete_employer_evidence_erasure(uuid, uuid) from public, anon, authenticated;

grant execute on function public.submit_employer_verification(text, text, text, text, text, text, text, text, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.review_employer_verification(uuid, integer, text, text, text, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.admin_list_employer_verifications(text, text, integer, integer) to authenticated;
grant execute on function public.admin_employer_verification_status_counts() to authenticated;
grant execute on function public.admin_begin_employer_evidence_erasure(uuid, integer, text) to authenticated;
grant execute on function public.admin_complete_employer_evidence_erasure(uuid, uuid) to service_role;

comment on table public.employer_verification_documents is
  'Private verification evidence. Retained while the employer account exists; remove objects through the authorized erasure endpoint before account deletion. No automatic expiry is configured.';

commit;
