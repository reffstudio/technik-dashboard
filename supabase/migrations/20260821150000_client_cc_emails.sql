-- Copias fijas por cliente (supervisores, socio, etc.) al enviar cotizaciones.
alter table public.clients
  add column if not exists cc_emails text[] not null default '{}';
