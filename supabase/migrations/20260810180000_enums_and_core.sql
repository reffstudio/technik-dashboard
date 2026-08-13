-- Technik Dashboard — schema inicial (enums + tablas + folios)
-- Alineado a lib/technik/data.ts. No incluye passwords (Auth de Supabase).

-- ─── Enums ───────────────────────────────────────────────────────

create type public.user_role as enum ('admin', 'empleado');

create type public.quote_status as enum (
  'draft',
  'pending_review',
  'approved',
  'closed'
);

create type public.client_response as enum (
  'en_espera',
  'aprobada',
  'rechazada'
);

create type public.catalog_kind as enum ('material', 'labor', 'extra');

create type public.supplier_channel as enum ('email', 'whatsapp', 'both');

-- Paleta dept: sin amarillo/naranja/verde/rojo (status) ni grises (poco visibles).
create type public.department_color as enum (
  'azul',
  'indigo',
  'violeta',
  'fucsia',
  'cian'
);

create type public.project_stage as enum (
  'procesando_solicitud',
  'listo_para_iniciar',
  'en_proceso',
  'atrasado',
  'completado'
);

create type public.payment_mode as enum ('unico', 'abonos');
-- Complemento de pago CFDI (parcialidades): N/A · pendiente · hecho y enviado
create type public.payment_complement_status as enum ('na', 'pending', 'sent');

create type public.payment_method as enum (
  'transferencia',
  'efectivo',
  'cheque',
  'tarjeta',
  'otro'
);

create type public.payment_event_kind as enum (
  'marked_paid',
  'correction_note'
);

-- ─── Utilidad updated_at ────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ─── Departments ────────────────────────────────────────────────

create table public.departments (
  id text primary key,
  label text not null,
  short text not null,
  color_id public.department_color not null default 'azul',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

-- ─── Profiles (1:1 con auth.users) ──────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'empleado',
  department_id text not null references public.departments (id),
  location text not null default '',
  since text not null default '',
  active boolean not null default true,
  avatar_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{2,32}$')
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Al crear usuario en Auth, opcionalmente crear profile vía trigger
-- (el invite/admin UI debe insertar el profile con role/department).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Profile lo crea el admin (invite flow). No auto-insert ciego.
  return new;
end;
$$;

-- ─── Clients ────────────────────────────────────────────────────

create table public.clients (
  id text primary key,
  company text not null,
  rfc text not null default '',
  contact text not null default '',
  email text not null default '',
  phone text not null default '',
  industry text not null default '',
  location text not null default '',
  since text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clients_rfc_format check (
    rfc = '' or rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
  )
);

create index clients_rfc_idx on public.clients (rfc) where rfc <> '';

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ─── Suppliers ──────────────────────────────────────────────────

create table public.suppliers (
  id text primary key,
  name text not null,
  contact text not null default '',
  email text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  preferred_channel public.supplier_channel not null default 'email',
  specialty text not null default '',
  location text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ─── Catalog ────────────────────────────────────────────────────

create table public.catalog_items (
  id text primary key,
  kind public.catalog_kind not null,
  name text not null,
  sku text not null default '',
  category text not null,
  unit text not null default 'pza',
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  supplier_id text references public.suppliers (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index catalog_items_kind_idx on public.catalog_items (kind);
create index catalog_items_supplier_idx on public.catalog_items (supplier_id);

create trigger catalog_items_set_updated_at
  before update on public.catalog_items
  for each row execute function public.set_updated_at();

-- ─── Quotations ─────────────────────────────────────────────────

create table public.quotations (
  id text primary key,
  reference text not null unique,
  client_id text not null references public.clients (id),
  title text not null,
  status public.quote_status not null default 'draft',
  /** Uno o más departamentos (reemplaza el dept compuesto “Soldadura y maquinados”). */
  department_ids text[] not null default '{}',
  created_by uuid not null references public.profiles (id),
  notes text,
  comments text,
  terms text,
  tax_rate numeric(8, 6) not null default 0.16 check (tax_rate >= 0 and tax_rate <= 1),
  isr_retention_rate numeric(8, 6) not null default 0 check (isr_retention_rate >= 0 and isr_retention_rate <= 1),
  client_response public.client_response,
  client_sent_at date,
  supplier_sent_at date,
  supplier_id text references public.suppliers (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quotations_id_matches_reference check (id = reference)
);

create index quotations_status_idx on public.quotations (status);
create index quotations_client_idx on public.quotations (client_id);
create index quotations_created_by_idx on public.quotations (created_by);
create index quotations_department_ids_idx on public.quotations using gin (department_ids);

create trigger quotations_set_updated_at
  before update on public.quotations
  for each row execute function public.set_updated_at();

-- Líneas internas (material / mano de obra / extras)
create table public.quotation_lines (
  id uuid primary key default gen_random_uuid(),
  quotation_id text not null references public.quotations (id) on delete cascade,
  catalog_item_id text not null references public.catalog_items (id),
  quantity numeric(14, 4) not null check (quantity > 0),
  unit_price numeric(14, 2),
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index quotation_lines_quote_idx on public.quotation_lines (quotation_id);

-- Ítems públicos del PDF al cliente
create table public.quotation_public_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id text not null references public.quotations (id) on delete cascade,
  quantity numeric(14, 4) not null check (quantity > 0),
  title text not null,
  description text not null default '',
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  image_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index quotation_public_items_quote_idx on public.quotation_public_items (quotation_id);

-- Historial append-only
create table public.quotation_events (
  id uuid primary key default gen_random_uuid(),
  quotation_id text not null references public.quotations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index quotation_events_quote_idx on public.quotation_events (quotation_id, created_at);

-- ─── Projects ───────────────────────────────────────────────────

create table public.projects (
  id text primary key,
  -- Cotización origen (opcional: cobros N/A del Excel sin cotización)
  quotation_id text unique references public.quotations (id),
  title text,
  client_id text references public.clients (id),
  total_due numeric(14, 2) check (total_due is null or total_due >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  stage public.project_stage not null default 'procesando_solicitud',
  due_date date,
  delivered_at date,
  notes text,
  -- Método de pago CFDI (exhibición única vs parcialidades)
  payment_mode public.payment_mode,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_has_source check (
    quotation_id is not null
    or (title is not null and client_id is not null and total_due is not null)
  )
);

-- Departamentos de proyectos sin cotización
create table public.project_departments (
  project_id text not null references public.projects (id) on delete cascade,
  department_id text not null references public.departments (id),
  primary key (project_id, department_id)
);

create index projects_stage_idx on public.projects (stage);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_installments (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  due_date date not null,
  note text,
  -- UUID CFDI (ID factura SAT) — una cuota ≈ una fila del Excel de pagos
  invoice_uuid text,
  invoice_date date,
  payment_complement public.payment_complement_status not null default 'na',
  paid_at date,
  -- Medio de cobro (transferencia, efectivo…) — distinto del método CFDI
  method public.payment_method,
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint installment_paid_needs_method check (
    (paid_at is null and method is null)
    or (paid_at is not null and method is not null)
  )
);

create index project_installments_project_idx on public.project_installments (project_id);
create index project_installments_due_idx on public.project_installments (due_date)
  where paid_at is null;

create trigger project_installments_set_updated_at
  before update on public.project_installments
  for each row execute function public.set_updated_at();

-- Inmutabilidad: no borrar ni “desmarcar” un abono ya cobrado
create or replace function public.guard_paid_installment()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.paid_at is not null then
      raise exception 'No se puede eliminar un abono ya cobrado (%)', old.id;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.paid_at is not null then
      if new.paid_at is distinct from old.paid_at
         or new.amount is distinct from old.amount
         or new.method is distinct from old.method then
        raise exception 'Abono cobrado es inmutable (%). Use payment_events para correcciones.', old.id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger project_installments_guard_paid
  before update or delete on public.project_installments
  for each row execute function public.guard_paid_installment();

-- Eventos de pago (auditoría / correcciones)
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.project_installments (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  kind public.payment_event_kind not null,
  actor_id uuid references public.profiles (id) on delete set null,
  amount numeric(14, 2),
  method public.payment_method,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index payment_events_project_idx on public.payment_events (project_id, created_at);

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index project_events_project_idx on public.project_events (project_id, created_at);

-- ─── Secuencias / folios server-side ────────────────────────────

create table public.code_counters (
  kind text not null,
  year int not null default 0,
  last_value int not null default 0,
  primary key (kind, year)
);

create or replace function public.next_code(p_kind text, p_width int default 4)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from timezone('utc', now()))::int;
  n int;
  prefix text;
begin
  if p_kind not in ('quotation', 'project', 'client', 'supplier', 'catalog_m', 'catalog_k', 'catalog_n', 'catalog_l', 'catalog_e') then
    raise exception 'kind inválido: %', p_kind;
  end if;

  if p_kind in ('quotation', 'project') then
    insert into public.code_counters (kind, year, last_value)
    values (p_kind, y, 0)
    on conflict (kind, year) do nothing;

    update public.code_counters
    set last_value = last_value + 1
    where kind = p_kind and year = y
    returning last_value into n;

    if p_kind = 'quotation' then
      if n < 2001 then
        n := 2001;
        update public.code_counters set last_value = n where kind = p_kind and year = y;
      end if;
      prefix := 'TKS-Q-' || y::text || '-';
    else
      -- Solo proyectos sin cotización (N/A). Con cotización: projects.id = quotation.id
      prefix := 'TKS-P-' || y::text || '-';
    end if;

    return prefix || lpad(n::text, p_width, '0');
  end if;

  -- client / supplier / catalog: year = 0
  insert into public.code_counters (kind, year, last_value)
  values (p_kind, 0, case when p_kind = 'client' then 1000 when p_kind = 'supplier' then 0 else 0 end)
  on conflict (kind, year) do nothing;

  update public.code_counters
  set last_value = last_value + 1
  where kind = p_kind and year = 0
  returning last_value into n;

  if p_kind = 'client' then
    return 'TKS-C-' || lpad(n::text, 4, '0');
  elsif p_kind = 'supplier' then
    return 'TKS-V-' || lpad(n::text, 3, '0');
  elsif p_kind = 'catalog_m' then
    return 'TKS-M-' || lpad(n::text, 3, '0');
  elsif p_kind = 'catalog_k' then
    return 'TKS-K-' || lpad(n::text, 3, '0');
  elsif p_kind = 'catalog_n' then
    return 'TKS-N-' || lpad(n::text, 3, '0');
  elsif p_kind = 'catalog_e' then
    return 'TKS-E-' || lpad(n::text, 3, '0');
  else
    return 'TKS-L-' || lpad(n::text, 3, '0');
  end if;
end;
$$;

revoke all on function public.next_code(text, int) from public;
grant execute on function public.next_code(text, int) to authenticated;

-- ─── Realtime (tablas operativas) ───────────────────────────────
-- Habilitar en el dashboard o:
-- alter publication supabase_realtime add table public.quotations;
-- alter publication supabase_realtime add table public.projects;
-- alter publication supabase_realtime add table public.project_installments;
