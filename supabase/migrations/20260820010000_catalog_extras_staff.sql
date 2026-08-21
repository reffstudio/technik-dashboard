-- Colaboradores pueden dar de alta extras de campo (flete, viático, grúa…).
-- No pueden crear ni editar materiales / mano de obra.

create policy catalog_insert_extras_staff
  on public.catalog_items for insert
  to authenticated
  with check (
    public.is_staff()
    and kind = 'extra'
  );
