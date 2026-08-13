-- Technik Dashboard — RLS admin / empleado
-- Matriz:
--   admin    → CRUD amplio (costos, billing, usuarios, catálogo, depts)
--   empleado → lee/escribe sus cotizaciones; ve proyectos ligados a ellas;
--              NO ve unit_cost de catálogo ni unit_price de quotation_lines;
--              NO edita billing (installments / payment_events) ni profiles ajenos.

-- ─── Helpers ────────────────────────────────────────────────────

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid();
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  );
$$;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- ─── Enable RLS ─────────────────────────────────────────────────

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.suppliers enable row level security;
alter table public.catalog_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_lines enable row level security;
alter table public.quotation_public_items enable row level security;
alter table public.quotation_events enable row level security;
alter table public.projects enable row level security;
alter table public.project_departments enable row level security;
alter table public.project_installments enable row level security;
alter table public.payment_events enable row level security;
alter table public.project_events enable row level security;
alter table public.code_counters enable row level security;

-- ─── Departments ────────────────────────────────────────────────

create policy departments_select_staff
  on public.departments for select
  to authenticated
  using (public.is_staff());

create policy departments_write_admin
  on public.departments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── Profiles ───────────────────────────────────────────────────

create policy profiles_select_staff
  on public.profiles for select
  to authenticated
  using (public.is_staff());

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and active = (select active from public.profiles where id = auth.uid())
  );

create policy profiles_admin_all
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── Clients ────────────────────────────────────────────────────

create policy clients_select_staff
  on public.clients for select
  to authenticated
  using (public.is_staff());

create policy clients_insert_staff
  on public.clients for insert
  to authenticated
  with check (public.is_staff());

create policy clients_update_staff
  on public.clients for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy clients_delete_admin
  on public.clients for delete
  to authenticated
  using (public.is_admin());

-- ─── Suppliers (admin write; staff read) ────────────────────────

create policy suppliers_select_staff
  on public.suppliers for select
  to authenticated
  using (public.is_staff());

create policy suppliers_write_admin
  on public.suppliers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── Catalog ────────────────────────────────────────────────────
-- Empleado puede SELECT filas (nombre/sku/unidad) pero unit_cost se
-- oculta en la capa app o con vista. RLS no puede ocultar columnas;
-- usar view catalog_items_public para empleados.

create or replace view public.catalog_items_public
with (security_invoker = true)
as
select
  id,
  kind,
  name,
  sku,
  category,
  unit,
  case when public.is_admin() then unit_cost else null end as unit_cost,
  case when public.is_admin() then supplier_id else null end as supplier_id,
  active
from public.catalog_items;

grant select on public.catalog_items_public to authenticated;

create policy catalog_select_staff
  on public.catalog_items for select
  to authenticated
  using (public.is_staff());

create policy catalog_write_admin
  on public.catalog_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── Quotations ─────────────────────────────────────────────────

create policy quotations_select
  on public.quotations for select
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
  );

create policy quotations_insert_staff
  on public.quotations for insert
  to authenticated
  with check (
    public.is_staff()
    and created_by = auth.uid()
  );

create policy quotations_update
  on public.quotations for update
  to authenticated
  using (
    public.is_admin()
    or (
      created_by = auth.uid()
      and status in ('draft', 'pending_review')
    )
  )
  with check (
    public.is_admin()
    or (
      created_by = auth.uid()
      and status in ('draft', 'pending_review')
    )
  );

create policy quotations_delete_admin
  on public.quotations for delete
  to authenticated
  using (public.is_admin());

-- Lines: mismo alcance que la cotización padre
create policy quotation_lines_select
  on public.quotation_lines for select
  to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (public.is_admin() or q.created_by = auth.uid())
    )
  );

create policy quotation_lines_write
  on public.quotation_lines for all
  to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (
          public.is_admin()
          or (q.created_by = auth.uid() and q.status in ('draft', 'pending_review'))
        )
    )
  )
  with check (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (
          public.is_admin()
          or (q.created_by = auth.uid() and q.status in ('draft', 'pending_review'))
        )
    )
  );

-- Vista sin unit_price para empleados (costos/márgenes)
create or replace view public.quotation_lines_safe
with (security_invoker = true)
as
select
  id,
  quotation_id,
  catalog_item_id,
  quantity,
  case when public.is_admin() then unit_price else null end as unit_price,
  sort_order,
  created_at
from public.quotation_lines;

grant select on public.quotation_lines_safe to authenticated;

create policy quotation_public_items_select
  on public.quotation_public_items for select
  to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (public.is_admin() or q.created_by = auth.uid())
    )
  );

create policy quotation_public_items_write_admin
  on public.quotation_public_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy quotation_events_select
  on public.quotation_events for select
  to authenticated
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (public.is_admin() or q.created_by = auth.uid())
    )
  );

create policy quotation_events_insert_staff
  on public.quotation_events for insert
  to authenticated
  with check (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and (public.is_admin() or q.created_by = auth.uid())
    )
  );

-- ─── Projects ───────────────────────────────────────────────────

create policy projects_select
  on public.projects for select
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.quotations q
      where q.id = quotation_id and q.created_by = auth.uid()
    )
  );

create policy projects_write_admin
  on public.projects for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy project_departments_select
  on public.project_departments for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          public.is_admin()
          or p.created_by = auth.uid()
          or exists (
            select 1 from public.quotations q
            where q.id = p.quotation_id and q.created_by = auth.uid()
          )
        )
    )
  );

create policy project_departments_write_admin
  on public.project_departments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Empleado: solo lectura de installments (billing admin-only write)
create policy installments_select
  on public.project_installments for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.projects p
      left join public.quotations q on q.id = p.quotation_id
      where p.id = project_id
        and (p.created_by = auth.uid() or q.created_by = auth.uid())
    )
  );

create policy installments_write_admin
  on public.project_installments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy payment_events_select
  on public.payment_events for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.projects p
      join public.quotations q on q.id = p.quotation_id
      where p.id = project_id and q.created_by = auth.uid()
    )
  );

create policy payment_events_insert_admin
  on public.payment_events for insert
  to authenticated
  with check (public.is_admin());

create policy project_events_select
  on public.project_events for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.projects p
      join public.quotations q on q.id = p.quotation_id
      where p.id = project_id and q.created_by = auth.uid()
    )
  );

create policy project_events_insert_staff
  on public.project_events for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.projects p
      join public.quotations q on q.id = p.quotation_id
      where p.id = project_id and q.created_by = auth.uid()
    )
  );

-- Code counters: solo via next_code (security definer)
create policy code_counters_admin
  on public.code_counters for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
