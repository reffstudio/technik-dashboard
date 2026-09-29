-- Finanzas en vivo: cuotas, cobros, egresos y apartados.
-- Pegar en el SQL editor de Supabase.

do $$
begin
  begin
    alter publication supabase_realtime add table public.project_installments;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.payment_events;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.expenses;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.treasury_months;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.treasury_separados;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.apartado_movements;
  exception
    when duplicate_object then null;
  end;
end $$;
