-- Permisos de tablas (RLS sigue filtrando).
-- quote-images público para que el PDF pueda pintar las fotos de concepto.

grant select, insert, update, delete on public.catalog_items to authenticated;
grant select on public.catalog_items_public to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.quotations to authenticated;
grant select, insert, update, delete on public.quotation_lines to authenticated;
grant select, insert, update, delete on public.quotation_public_items to authenticated;
grant select, insert, update, delete on public.quotation_events to authenticated;
grant select, insert, update, delete on public.quotation_visit_photos to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_departments to authenticated;
grant select, insert, update, delete on public.project_installments to authenticated;
grant select, insert, update, delete on public.project_events to authenticated;
grant select, insert, update, delete on public.payment_events to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.treasury_months to authenticated;
grant select, insert, update, delete on public.treasury_separados to authenticated;
grant select, insert, update, delete on public.apartado_movements to authenticated;
grant select, insert, update, delete on public.inbox_events to authenticated;

update storage.buckets
set public = true
where id = 'quote-images';

drop policy if exists quote_images_select_public on storage.objects;
create policy quote_images_select_public
  on storage.objects for select
  to public
  using (bucket_id = 'quote-images');
