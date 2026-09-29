-- Colaboradores ven todos los proyectos (etapa e info de taller).
-- No escriben proyectos. Cuotas y cobros quedan solo para administración.
-- Pegar en el SQL editor de Supabase si no corre por migraciones.

drop policy if exists projects_select on public.projects;
create policy projects_select
  on public.projects for select
  to authenticated
  using (public.is_staff());

drop policy if exists projects_update_staff on public.projects;

drop policy if exists project_departments_select on public.project_departments;
create policy project_departments_select
  on public.project_departments for select
  to authenticated
  using (public.is_staff());

drop policy if exists installments_select on public.project_installments;
create policy installments_select
  on public.project_installments for select
  to authenticated
  using (public.is_admin());

drop policy if exists payment_events_select on public.payment_events;
create policy payment_events_select
  on public.payment_events for select
  to authenticated
  using (public.is_admin());
