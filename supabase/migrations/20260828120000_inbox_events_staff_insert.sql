-- Colaboradores avisan a admin al enviar a revisión.
-- INSERT (no upsert): UPDATE de inbox_events sigue siendo solo admin.

drop policy if exists inbox_events_insert_staff on public.inbox_events;
create policy inbox_events_insert_staff
  on public.inbox_events for insert
  to authenticated
  with check (public.is_staff());

grant insert on public.inbox_events to authenticated;
