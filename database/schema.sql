-- Gestión Comercial Prototipo
-- Esquema alineado con Supabase (RLS para usuarios autenticados)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabla: app_users
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null default 'admin',
  is_active boolean not null default true,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Tabla: products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  model text,
  category text,
  description text,
  main_sku text unique,
  image_path text,
  has_variants boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabla: product_variants
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  size text,
  color text,
  presentation text,
  purchase_price numeric(12, 2),
  sale_price numeric(12, 2),
  stock integer not null default 0,
  min_stock integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Función: login_app_user (legado; el login actual usa Supabase Auth)
-- ---------------------------------------------------------------------------
create or replace function public.login_app_user(
  input_email text,
  input_password text
)
returns table (
  id uuid,
  name text,
  email text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    u.id,
    u.name,
    u.email,
    u.role
  from public.app_users u
  where u.email = input_email
    and u.is_active = true
    and u.password_hash = crypt(input_password, u.password_hash);
end;
$$;

grant execute on function public.login_app_user(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Columnas de imagen (agregar si no existen en BD existente)
-- Nota: image_path guarda el PATH INTERNO del bucket product-images.
-- Ej: "products/uuid.webp" o "variants/uuid.webp"
-- La URL pública se genera solo al renderizar con getProductImagePublicUrl().
-- NO se guarda la URL completa de Supabase en la BD.
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists image_path text;

alter table public.product_variants
  add column if not exists image_path text;

-- ---------------------------------------------------------------------------
-- Bucket de imágenes: product-images
-- Crear el bucket desde el panel de Supabase (Storage > New bucket)
-- con Public = true, luego ejecutar las siguientes políticas:
-- ---------------------------------------------------------------------------

-- Lectura pública (anon puede leer las imágenes)
-- create policy "public read product images"
--   on storage.objects for select
--   to public
--   using (bucket_id = 'product-images');

-- Escritura solo para usuarios autenticados con rol admin
-- create policy "admin upload product images"
--   on storage.objects for insert
--   to authenticated
--   with check (
--     bucket_id = 'product-images'
--     and exists (
--       select 1 from public.app_users
--       where auth_user_id = auth.uid()
--         and role = 'admin'
--         and is_active = true
--     )
--   );

-- ---------------------------------------------------------------------------
-- RLS: app_users
-- ---------------------------------------------------------------------------
alter table public.app_users enable row level security;

drop policy if exists users_read_own_profile on public.app_users;

create policy users_read_own_profile
  on public.app_users
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

-- ---------------------------------------------------------------------------
-- RLS: products
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists authenticated_read_products on public.products;

create policy authenticated_read_products
  on public.products
  for select
  to authenticated
  using (true);

drop policy if exists authenticated_insert_products on public.products;

create policy authenticated_insert_products
  on public.products
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.app_users
      where auth_user_id = auth.uid()
        and role = 'admin'
        and is_active = true
    )
  );

drop policy if exists authenticated_update_products on public.products;

create policy authenticated_update_products
  on public.products
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.app_users
      where auth_user_id = auth.uid()
        and role = 'admin'
        and is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.app_users
      where auth_user_id = auth.uid()
        and role = 'admin'
        and is_active = true
    )
  );

drop policy if exists authenticated_delete_products on public.products;

create policy authenticated_delete_products
  on public.products
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.app_users
      where auth_user_id = auth.uid()
        and role = 'admin'
        and is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: product_variants
-- ---------------------------------------------------------------------------
alter table public.product_variants enable row level security;

drop policy if exists authenticated_read_product_variants on public.product_variants;

create policy authenticated_read_product_variants
  on public.product_variants
  for select
  to authenticated
  using (true);

drop policy if exists authenticated_insert_product_variants on public.product_variants;

create policy authenticated_insert_product_variants
  on public.product_variants
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.app_users
      where auth_user_id = auth.uid()
        and role = 'admin'
        and is_active = true
    )
  );

drop policy if exists authenticated_update_product_variants on public.product_variants;

create policy authenticated_update_product_variants
  on public.product_variants
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.app_users
      where auth_user_id = auth.uid()
        and role = 'admin'
        and is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.app_users
      where auth_user_id = auth.uid()
        and role = 'admin'
        and is_active = true
    )
  );
