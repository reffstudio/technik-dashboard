-- IDs de la app (inst-…, pay-…, vp_…) son texto, no uuid.
-- Tesorería + bandeja: mismo destino que cotizaciones (Supabase, no RAM).

alter table public.payment_events drop constraint if exists payment_events_installment_id_fkey;

alter table public.project_installments alter column id drop default;
alter table public.project_installments alter column id type text using id::text;

alter table public.payment_events alter column installment_id type text using installment_id::text;
alter table public.payment_events
  add constraint payment_events_installment_id_fkey
  foreign key (installment_id) references public.project_installments (id) on delete cascade;

alter table public.payment_events alter column id drop default;
alter table public.payment_events alter column id type text using id::text;

alter table public.quotation_visit_photos alter column id drop default;
alter table public.quotation_visit_photos alter column id type text using id::text;

-- ─── Tesorería ──────────────────────────────────────────────────

create table if not exists public.expenses (
  id text primary key,
  amount numeric(14, 2) not null check (amount > 0),
  date date not null,
  description text not null default '',
  channel text not null check (channel in ('banco', 'efectivo')),
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null
);

create index if not exists expenses_date_idx on public.expenses (date desc);

create table if not exists public.treasury_months (
  year_month text primary key,
  opening_bank numeric(14, 2) not null default 0,
  opening_cash numeric(14, 2) not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.treasury_separados (
  id text primary key,
  name text not null,
  category text not null default 'custom',
  kind text not null check (kind in ('percent', 'amount')),
  value numeric(14, 4) not null default 0,
  suggested_amount numeric(14, 2),
  status text not null default 'open' check (status in ('open', 'paid')),
  paid_expense_id text,
  year_month text,
  amount_overridden boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.apartado_movements (
  id text primary key,
  apartado_id text not null references public.treasury_separados (id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),
  amount numeric(14, 2) not null check (amount > 0),
  date date not null,
  note text,
  expense_id text,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null
);

create index if not exists apartado_movements_apartado_idx on public.apartado_movements (apartado_id);

-- ─── Bandeja admin ──────────────────────────────────────────────

create table if not exists public.inbox_events (
  id text primary key,
  kind text not null,
  title text not null,
  body text not null default '',
  at timestamptz not null default timezone('utc', now()),
  href jsonb
);

create index if not exists inbox_events_at_idx on public.inbox_events (at desc);

alter table public.expenses enable row level security;
alter table public.treasury_months enable row level security;
alter table public.treasury_separados enable row level security;
alter table public.apartado_movements enable row level security;
alter table public.inbox_events enable row level security;

drop policy if exists expenses_admin on public.expenses;
create policy expenses_admin on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists treasury_months_admin on public.treasury_months;
create policy treasury_months_admin on public.treasury_months for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists treasury_separados_admin on public.treasury_separados;
create policy treasury_separados_admin on public.treasury_separados for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists apartado_movements_admin on public.apartado_movements;
create policy apartado_movements_admin on public.apartado_movements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists inbox_events_admin on public.inbox_events;
create policy inbox_events_select_admin on public.inbox_events for select to authenticated
  using (public.is_admin());
create policy inbox_events_insert_staff on public.inbox_events for insert to authenticated
  with check (public.is_staff());
create policy inbox_events_update_admin on public.inbox_events for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy inbox_events_delete_admin on public.inbox_events for delete to authenticated
  using (public.is_admin());
