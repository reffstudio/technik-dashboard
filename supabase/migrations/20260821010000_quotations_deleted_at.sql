-- Papelera de borradores (7 días). Sin esta columna, un deploy no debe
-- borrar cotizaciones: viven en `quotations`, no en memoria del server.

alter table public.quotations
  add column if not exists deleted_at timestamptz;

create index if not exists quotations_deleted_at_idx
  on public.quotations (deleted_at)
  where deleted_at is not null;
