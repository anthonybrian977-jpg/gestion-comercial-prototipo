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

-- ---------------------------------------------------------------------------
-- Tabla: suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ruc text unique,
  contact_name text,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabla: supplier_products
-- Relaciona un proveedor con una variante de producto y su precio de compra.
-- variant_id → product_variants.id (la unidad vendible real con SKU y stock).
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  purchase_price numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, variant_id)
);

-- ---------------------------------------------------------------------------
-- RLS: suppliers
-- ---------------------------------------------------------------------------
alter table public.suppliers enable row level security;

drop policy if exists authenticated_read_suppliers on public.suppliers;

create policy authenticated_read_suppliers
  on public.suppliers
  for select
  to authenticated
  using (true);

drop policy if exists authenticated_insert_suppliers on public.suppliers;

create policy authenticated_insert_suppliers
  on public.suppliers
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

drop policy if exists authenticated_update_suppliers on public.suppliers;

create policy authenticated_update_suppliers
  on public.suppliers
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

drop policy if exists authenticated_delete_suppliers on public.suppliers;

create policy authenticated_delete_suppliers
  on public.suppliers
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
-- RLS: supplier_products
-- ---------------------------------------------------------------------------
alter table public.supplier_products enable row level security;

drop policy if exists authenticated_read_supplier_products on public.supplier_products;

create policy authenticated_read_supplier_products
  on public.supplier_products
  for select
  to authenticated
  using (true);

drop policy if exists authenticated_insert_supplier_products on public.supplier_products;

create policy authenticated_insert_supplier_products
  on public.supplier_products
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

drop policy if exists authenticated_update_supplier_products on public.supplier_products;

create policy authenticated_update_supplier_products
  on public.supplier_products
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

-- Columna de SKU del proveedor (código interno del proveedor para la variante)
alter table public.supplier_products
  add column if not exists supplier_sku text;

drop policy if exists authenticated_delete_supplier_products on public.supplier_products;

create policy authenticated_delete_supplier_products
  on public.supplier_products
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

-- is_active en supplier_products (precio vigente o no para ese proveedor)
alter table public.supplier_products
  add column if not exists is_active boolean not null default true;

-- Proveedor preferido por variante (determina el precio de compra en el maestro)
alter table public.product_variants
  add column if not exists preferred_supplier_product_id uuid
    references public.supplier_products(id)
    on delete set null;

-- ---------------------------------------------------------------------------
-- Tabla: supplier_catalog_items
-- Catálogo de productos ofrecidos por cada proveedor (independiente del Maestro)
-- Un item puede existir sin estar vinculado a products/product_variants.
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_catalog_items (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid not null references public.suppliers(id) on delete cascade,
  supplier_sku        text,
  product_name        text not null,
  brand               text,
  model               text,
  category            text,
  presentation        text,
  color               text,
  size                text,
  purchase_price      numeric(12,2) not null,
  is_active           boolean not null default true,
  linked_product_id   uuid references public.products(id) on delete set null,
  linked_variant_id   uuid references public.product_variants(id) on delete set null,
  imported_to_master  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.supplier_catalog_items enable row level security;

drop policy if exists catalog_select on public.supplier_catalog_items;
create policy catalog_select on public.supplier_catalog_items
  for select to authenticated using (true);

drop policy if exists catalog_insert on public.supplier_catalog_items;
create policy catalog_insert on public.supplier_catalog_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.app_users
      where auth_user_id = auth.uid() and role = 'admin' and is_active = true
    )
  );

drop policy if exists catalog_update on public.supplier_catalog_items;
create policy catalog_update on public.supplier_catalog_items
  for update to authenticated
  using (
    exists (
      select 1 from public.app_users
      where auth_user_id = auth.uid() and role = 'admin' and is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.app_users
      where auth_user_id = auth.uid() and role = 'admin' and is_active = true
    )
  );

drop policy if exists catalog_delete on public.supplier_catalog_items;
create policy catalog_delete on public.supplier_catalog_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.app_users
      where auth_user_id = auth.uid() and role = 'admin' and is_active = true
    )
  );

-- ===========================================================================
-- MIGRACIÓN: supplier_products → supplier_catalog_items
-- Seguro de ejecutar varias veces (idempotente).
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de crear supplier_catalog_items.
-- ===========================================================================

-- 1. Columna preferred_catalog_item_id en product_variants
alter table public.product_variants
  add column if not exists preferred_catalog_item_id uuid
    references public.supplier_catalog_items(id) on delete set null;

-- 2. Migrar filas de supplier_products → supplier_catalog_items
--    Solo inserta las que aún no tienen un catalog_item con el mismo supplier+variant
insert into public.supplier_catalog_items (
  supplier_id,
  supplier_sku,
  product_name,
  brand,
  model,
  category,
  presentation,
  color,
  size,
  purchase_price,
  is_active,
  linked_variant_id,
  linked_product_id,
  imported_to_master
)
select
  sp.supplier_id,
  sp.supplier_sku,
  p.name                        as product_name,
  p.brand,
  p.model,
  p.category,
  pv.presentation,
  pv.color,
  pv.size,
  sp.purchase_price,
  coalesce(sp.is_active, true)  as is_active,
  pv.id                         as linked_variant_id,
  pv.product_id                 as linked_product_id,
  true                          as imported_to_master
from  public.supplier_products sp
join  public.product_variants pv on pv.id = sp.variant_id
join  public.products p          on p.id  = pv.product_id
where not exists (
  select 1
  from   public.supplier_catalog_items sci
  where  sci.supplier_id       = sp.supplier_id
    and  sci.linked_variant_id = sp.variant_id
);

-- 3. Trasladar proveedor preferido: preferred_supplier_product_id → preferred_catalog_item_id
update public.product_variants pv
set    preferred_catalog_item_id = sci.id
from   public.supplier_products sp
join   public.supplier_catalog_items sci
         on  sci.supplier_id       = sp.supplier_id
         and sci.linked_variant_id = sp.variant_id
where  pv.preferred_supplier_product_id = sp.id
  and  pv.preferred_catalog_item_id is null;
