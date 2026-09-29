-- Portadas de taller para colaboradores (solo lectura de fotos).
-- Pegar en el SQL editor de Supabase.

update public.projects p
set cover_image_path = q.cover_image_path
from public.quotations q
where p.quotation_id = q.id
  and coalesce(p.cover_image_path, '') = ''
  and coalesce(q.cover_image_path, '') <> '';

drop policy if exists quote_images_select on storage.objects;
create policy quote_images_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'quote-images' and public.is_staff());

drop policy if exists visit_photos_select on storage.objects;
create policy visit_photos_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'visit-photos' and public.is_staff());

drop policy if exists quotation_visit_photos_select on public.quotation_visit_photos;
create policy quotation_visit_photos_select
  on public.quotation_visit_photos for select
  to authenticated
  using (public.is_staff());

create or replace function public.workshop_project_covers()
returns table (project_id text, cover_path text)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(p.cover_image_path, ''), nullif(q.cover_image_path, ''))
  from public.projects p
  left join public.quotations q on q.id = p.quotation_id
  where public.is_staff();
$$;

grant execute on function public.workshop_project_covers() to authenticated;
