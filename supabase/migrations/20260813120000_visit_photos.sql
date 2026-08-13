-- Fotos de visita (contexto de campo). Bytes en Storage, metadatos en tabla.
-- Paths: visit-photos/{quotation_id}/{photo_id}.jpg
--        visit-photos/{quotation_id}/{photo_id}.thumb.jpg

create table public.quotation_visit_photos (
  id uuid primary key default gen_random_uuid(),
  quotation_id text not null references public.quotations (id) on delete cascade,
  storage_path text not null,
  thumb_path text,
  caption text,
  mime text not null default 'image/jpeg'
    check (mime in ('image/jpeg', 'image/webp')),
  bytes int not null check (bytes > 0 and bytes <= 220000),
  thumb_bytes int check (thumb_bytes is null or (thumb_bytes > 0 and thumb_bytes <= 48000)),
  width int not null check (width > 0),
  height int not null check (height > 0),
  taken_at timestamptz not null default timezone('utc', now()),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index quotation_visit_photos_quote_idx
  on public.quotation_visit_photos (quotation_id, taken_at);

alter table public.quotation_visit_photos enable row level security;

create policy quotation_visit_photos_select
  on public.quotation_visit_photos for select
  to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (public.is_admin() or q.created_by = auth.uid())
    )
  );

create policy quotation_visit_photos_insert
  on public.quotation_visit_photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (
          public.is_admin()
          or (
            q.created_by = auth.uid()
            and q.status in ('draft', 'pending_review')
          )
        )
    )
  );

create policy quotation_visit_photos_update
  on public.quotation_visit_photos for update
  to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (
          public.is_admin()
          or (
            q.created_by = auth.uid()
            and q.status in ('draft', 'pending_review')
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (
          public.is_admin()
          or (
            q.created_by = auth.uid()
            and q.status in ('draft', 'pending_review')
          )
        )
    )
  );

create policy quotation_visit_photos_delete
  on public.quotation_visit_photos for delete
  to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (
          public.is_admin()
          or (
            q.created_by = auth.uid()
            and q.status in ('draft', 'pending_review')
          )
        )
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visit-photos',
  'visit-photos',
  false,
  220000,
  array['image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy visit_photos_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'visit-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.quotations q
        where q.id = (storage.foldername(name))[1]
          and q.created_by = auth.uid()
      )
    )
  );

create policy visit_photos_write
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'visit-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.quotations q
        where q.id = (storage.foldername(name))[1]
          and q.created_by = auth.uid()
          and q.status in ('draft', 'pending_review')
      )
    )
  )
  with check (
    bucket_id = 'visit-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.quotations q
        where q.id = (storage.foldername(name))[1]
          and q.created_by = auth.uid()
          and q.status in ('draft', 'pending_review')
      )
    )
  );
