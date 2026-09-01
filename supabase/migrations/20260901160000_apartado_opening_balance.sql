-- Saldo inicial de apartados (stock de arranque, no un movimiento del mes).

alter table public.treasury_separados
  add column if not exists opening_balance numeric(14, 2) not null default 0;
