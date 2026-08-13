-- Technik Dashboard — Storage buckets
-- Paths sugeridos:
--   avatars/{user_id}/avatar.jpg
--   quote-images/{quotation_id}/{item_id}.webp

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'quote-images',
    'quote-images',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;

-- Avatars: cualquiera autenticado lee; cada user escribe en su carpeta; admin todo
create policy avatars_select_public
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'avatars');

create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_admin_all
  on storage.objects for all
  to authenticated
  using (bucket_id = 'avatars' and public.is_admin())
  with check (bucket_id = 'avatars' and public.is_admin());

-- Quote images: staff con acceso a la cotización (admin o creador)
create policy quote_images_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'quote-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.quotations q
        where q.id = (storage.foldername(name))[1]
          and q.created_by = auth.uid()
      )
    )
  );

create policy quote_images_write_admin
  on storage.objects for all
  to authenticated
  using (bucket_id = 'quote-images' and public.is_admin())
  with check (bucket_id = 'quote-images' and public.is_admin());
