-- Ejecuta TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Crea una despensa privada, miembros y productos con permisos por pertenencia.

create extension if not exists pgcrypto;

create table if not exists public.pantries (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Despensa de casa',
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.pantry_members (
  pantry_id uuid not null references public.pantries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (pantry_id, user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  pantry_id uuid not null references public.pantries(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('Limpieza','Higiene personal','Alimentación')),
  name text not null check (length(trim(name)) between 1 and 100),
  quantity numeric not null check (quantity > 0),
  unit text not null check (unit in ('ud.','kg','g','l','ml')),
  expiry date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_pantry_id_idx on public.products(pantry_id);
create index if not exists pantry_members_user_id_idx on public.pantry_members(user_id);

create or replace function public.is_pantry_member(p_pantry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pantry_members pm
    where pm.pantry_id = p_pantry_id and pm.user_id = auth.uid()
  );
$$;

create or replace function public.create_pantry(p_name text default 'Despensa de casa')
returns table(pantry_id uuid, pantry_name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid; new_name text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if exists (select 1 from public.pantry_members where user_id = auth.uid()) then
    raise exception 'Esta cuenta ya pertenece a una despensa.';
  end if;
  new_name := coalesce(nullif(trim(p_name), ''), 'Despensa de casa');
  insert into public.pantries(name, created_by) values (new_name, auth.uid())
    returning id into new_id;
  insert into public.pantry_members(pantry_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return query select p.id, p.name, p.invite_code from public.pantries p where p.id = new_id;
end;
$$;

create or replace function public.join_pantry(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select p.id into target_id from public.pantries p
    where upper(p.invite_code) = upper(trim(p_code));
  if target_id is null then raise exception 'Código de invitación no válido.'; end if;
  if exists (select 1 from public.pantry_members where user_id = auth.uid() and pantry_id <> target_id) then
    raise exception 'Esta cuenta ya pertenece a otra despensa.';
  end if;
  insert into public.pantry_members(pantry_id, user_id, role)
    values (target_id, auth.uid(), 'member') on conflict (pantry_id, user_id) do nothing;
  return target_id;
end;
$$;

alter table public.pantries enable row level security;
alter table public.pantry_members enable row level security;
alter table public.products enable row level security;

drop policy if exists "members can view their pantry" on public.pantries;
create policy "members can view their pantry" on public.pantries
  for select to authenticated using (public.is_pantry_member(id));

drop policy if exists "users can view their own memberships" on public.pantry_members;
create policy "users can view their own memberships" on public.pantry_members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "members can view pantry products" on public.products;
create policy "members can view pantry products" on public.products
  for select to authenticated using (public.is_pantry_member(pantry_id));
drop policy if exists "members can add pantry products" on public.products;
create policy "members can add pantry products" on public.products
  for insert to authenticated with check (public.is_pantry_member(pantry_id) and created_by = auth.uid());
drop policy if exists "members can edit pantry products" on public.products;
create policy "members can edit pantry products" on public.products
  for update to authenticated using (public.is_pantry_member(pantry_id)) with check (public.is_pantry_member(pantry_id));
drop policy if exists "members can delete pantry products" on public.products;
create policy "members can delete pantry products" on public.products
  for delete to authenticated using (public.is_pantry_member(pantry_id));

grant usage on schema public to authenticated;
grant select on public.pantries, public.pantry_members to authenticated;
grant select, insert, update, delete on public.products to authenticated;
revoke all on function public.is_pantry_member(uuid) from public, anon;
revoke all on function public.create_pantry(text) from public, anon;
revoke all on function public.join_pantry(text) from public, anon;
grant execute on function public.is_pantry_member(uuid) to authenticated;
grant execute on function public.create_pantry(text) to authenticated;
grant execute on function public.join_pantry(text) to authenticated;

-- Para que los cambios se publiquen en tiempo real, activa Realtime para la tabla products
-- desde Database > Publications (o comprueba que products esté en supabase_realtime).
