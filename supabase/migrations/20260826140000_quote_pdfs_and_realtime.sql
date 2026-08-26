-- PDFs enviados (reenvío sin recapturar) + Realtime por fila.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-pdfs',
  'quote-pdfs',
  false,
  8388608,
  array['application/pdf']
)
on conflict (id) do nothing;

drop policy if exists quote_pdfs_select on storage.objects;
create policy quote_pdfs_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'quote-pdfs'
    and (
      public.is_admin()
      or exists (
        select 1 from public.quotations q
        where q.id = (storage.foldername(name))[1]
          and q.created_by = auth.uid()
      )
    )
  );

drop policy if exists quote_pdfs_write_admin on storage.objects;
create policy quote_pdfs_write_admin
  on storage.objects for all
  to authenticated
  using (bucket_id = 'quote-pdfs' and public.is_admin())
  with check (bucket_id = 'quote-pdfs' and public.is_admin());

do $$
begin
  begin
    alter publication supabase_realtime add table public.quotations;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.inbox_events;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.projects;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.quotation_visit_photos;
  exception
    when duplicate_object then null;
  end;
end $$;
