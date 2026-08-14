-- Permitir a staff eliminar clientes (además de admin)
drop policy if exists clients_delete_admin on public.clients;
drop policy if exists clients_delete_staff on public.clients;

create policy clients_delete_staff
  on public.clients for delete
  to authenticated
  using (public.is_staff());
