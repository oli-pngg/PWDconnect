update storage.buckets
set public = false
where id = 'profile-photos';

drop policy if exists "profile_photos_public_read" on storage.objects;
drop policy if exists "profile_photos_read_own" on storage.objects;
create policy "profile_photos_read_own" on storage.objects
for select to authenticated using (
  bucket_id = 'profile-photos'
  and name like ((select auth.uid())::text || '/%')
);
