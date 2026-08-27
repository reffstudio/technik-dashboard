-- Folio de cotización atómico: el contador no puede quedar detrás de los TKS-Q- ya existentes.

insert into public.code_counters (kind, year, last_value)
select
  'quotation',
  substring(id from 'TKS-Q-(\d{4})-')::int,
  max(substring(id from '\d+$')::int)
from public.quotations
where id ~ '^TKS-Q-\d{4}-\d+$'
group by 2
on conflict (kind, year) do update
set last_value = greatest(public.code_counters.last_value, excluded.last_value);

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
  max_existing int;
begin
  if p_kind not in ('quotation', 'project', 'client', 'supplier', 'catalog_m', 'catalog_k', 'catalog_n', 'catalog_l', 'catalog_e') then
    raise exception 'kind inválido: %', p_kind;
  end if;

  if p_kind in ('quotation', 'project') then
    insert into public.code_counters (kind, year, last_value)
    values (p_kind, y, 0)
    on conflict (kind, year) do nothing;

    if p_kind = 'quotation' then
      select coalesce(max(substring(q.id from '\d+$')::int), 0)
        into max_existing
      from public.quotations q
      where q.id ~ ('^TKS-Q-' || y::text || '-[0-9]+$');

      update public.code_counters
      set last_value = greatest(last_value, max_existing, 2000) + 1
      where kind = p_kind and year = y
      returning last_value into n;

      prefix := 'TKS-Q-' || y::text || '-';
    else
      select coalesce(max(substring(p.id from '\d+$')::int), 0)
        into max_existing
      from public.projects p
      where p.id ~ ('^TKS-P-' || y::text || '-[0-9]+$');

      update public.code_counters
      set last_value = greatest(last_value, max_existing, 0) + 1
      where kind = p_kind and year = y
      returning last_value into n;

      prefix := 'TKS-P-' || y::text || '-';
    end if;

    return prefix || lpad(n::text, p_width, '0');
  end if;

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

grant execute on function public.next_code(text, int) to authenticated;
