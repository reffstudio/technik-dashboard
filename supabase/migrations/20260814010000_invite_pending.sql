-- Invitados pendientes de crear contraseña
alter table public.profiles
  add column if not exists invite_pending boolean not null default false;

update public.profiles p
set invite_pending = true
from auth.users u
where u.id = p.id
  and coalesce((u.raw_user_meta_data->>'must_set_password')::boolean, false) = true;
