-- Bootstrap mínimo (correr en SQL Editor DESPUÉS de las 4 migraciones).
-- 1) Departamentos
-- 2) Perfil admin: crea antes el usuario en Authentication → Users,
--    copia su UUID y reemplaza el bloque de abajo.

insert into public.departments (id, label, short, color_id)
values
  ('maquinados', 'Maquinados', 'Maquinados', 'indigo'),
  ('soldadura', 'Soldadura', 'Soldadura', 'fucsia')
on conflict (id) do nothing;

-- Descomenta y completa cuando tengas el UUID de Auth:
-- insert into public.profiles (
--   id, username, name, email, role, department_id, location, since, active
-- ) values (
--   'PEGA-AQUI-EL-UUID-DE-AUTH',
--   'iochoa',
--   'Isaac Ochoa',
--   'tu-email@technik.solutions',
--   'admin',
--   'maquinados',
--   'Oficina central',
--   '2024',
--   true
-- );

-- Prueba de folios (debe devolver TKS-Q-2026-2001 la primera vez):
-- select public.next_code('quotation');
