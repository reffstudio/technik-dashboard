-- Portada visual de cotización (PDF) y de proyecto (listado).
alter table public.quotations
  add column if not exists cover_image_path text;

alter table public.projects
  add column if not exists cover_image_path text;

-- Empleado puede actualizar el proyecto de su cotización (portada, notas).
drop policy if exists projects_update_staff on public.projects;
create policy projects_update_staff
  on public.projects for update
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.quotations q
      where q.id = quotation_id and q.created_by = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.quotations q
      where q.id = quotation_id and q.created_by = auth.uid()
    )
  );

-- Subir portada (cotización / projects/{id}) al bucket público quote-images.
drop policy if exists quote_images_write_staff on storage.objects;
create policy quote_images_write_staff
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'quote-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.quotations q
        where q.id = (storage.foldername(name))[1]
          and q.created_by = auth.uid()
      )
      or (
        (storage.foldername(name))[1] = 'projects'
        and exists (
          select 1 from public.projects p
          where p.id = (storage.foldername(name))[2]
            and (
              public.is_admin()
              or p.created_by = auth.uid()
              or exists (
                select 1 from public.quotations q
                where q.id = p.quotation_id and q.created_by = auth.uid()
              )
            )
        )
      )
    )
  );

drop policy if exists quote_images_update_staff on storage.objects;
create policy quote_images_update_staff
  on storage.objects for update
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
      or (
        (storage.foldername(name))[1] = 'projects'
        and exists (
          select 1 from public.projects p
          where p.id = (storage.foldername(name))[2]
            and (
              public.is_admin()
              or p.created_by = auth.uid()
              or exists (
                select 1 from public.quotations q
                where q.id = p.quotation_id and q.created_by = auth.uid()
              )
            )
        )
      )
    )
  )
  with check (
    bucket_id = 'quote-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.quotations q
        where q.id = (storage.foldername(name))[1]
          and q.created_by = auth.uid()
      )
      or (
        (storage.foldername(name))[1] = 'projects'
        and exists (
          select 1 from public.projects p
          where p.id = (storage.foldername(name))[2]
            and (
              public.is_admin()
              or p.created_by = auth.uid()
              or exists (
                select 1 from public.quotations q
                where q.id = p.quotation_id and q.created_by = auth.uid()
              )
            )
        )
      )
    )
  );

