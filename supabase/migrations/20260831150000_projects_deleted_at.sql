-- Papelera de proyectos (15 días). Pareja de quotations.deleted_at.
-- Sin esta columna, Eliminar proyecto no persiste: el upsert reintenta sin ella.

alter table public.projects
  add column if not exists deleted_at timestamptz;

create index if not exists projects_deleted_at_idx
  on public.projects (deleted_at)
  where deleted_at is not null;
