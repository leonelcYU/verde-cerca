-- Ejecuta este archivo completo en Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  ingredients text[] not null check (cardinality(ingredients) between 1 and 3),
  unit_price integer not null default 1000 check (unit_price = 1000),
  quantity integer not null check (quantity between 1 and 10),
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  phone text not null check (char_length(phone) between 6 and 30),
  pickup_date date not null,
  pickup_label text not null,
  notes text check (notes is null or char_length(notes) <= 300),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
revoke all on table public.orders from anon, authenticated;
grant insert on table public.orders to anon, authenticated;
grant select, update, delete on table public.orders to authenticated;

drop policy if exists "Clientes pueden crear pedidos" on public.orders;
create policy "Clientes pueden crear pedidos" on public.orders for insert to anon, authenticated
with check (done = false and unit_price = 1000);

drop policy if exists "Carmen puede leer pedidos" on public.orders;
create policy "Carmen puede leer pedidos" on public.orders for select to authenticated
using ((select auth.jwt() ->> 'email') = 'carmenrosarivascanupan@gmail.com');

drop policy if exists "Carmen puede actualizar pedidos" on public.orders;
create policy "Carmen puede actualizar pedidos" on public.orders for update to authenticated
using ((select auth.jwt() ->> 'email') = 'carmenrosarivascanupan@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'carmenrosarivascanupan@gmail.com');

drop policy if exists "Carmen puede borrar pedidos" on public.orders;
create policy "Carmen puede borrar pedidos" on public.orders for delete to authenticated
using ((select auth.jwt() ->> 'email') = 'carmenrosarivascanupan@gmail.com');

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
