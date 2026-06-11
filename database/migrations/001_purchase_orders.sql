-- =============================================================================
-- Migración: 001_purchase_orders
-- Tablas: purchase_orders, purchase_order_items
--
-- ⚠️  INSTRUCCIONES:
--   1. Revisar y aprobar con Brian antes de aplicar.
--   2. Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase.
--   3. Idempotente: usa IF NOT EXISTS / DROP POLICY IF EXISTS.
--   4. NO modifica tablas existentes (products, product_variants,
--      supplier_catalog_items, suppliers).
-- =============================================================================

-- ─── 1. purchase_orders ───────────────────────────────────────────────────────
create table if not exists public.purchase_orders (
  id             uuid          primary key default gen_random_uuid(),
  order_number   text          not null unique,
  supplier_id    uuid          not null references public.suppliers(id) on delete restrict,
  status         text          not null default 'draft'
                               check (status in ('draft','issued','partial_received','received','cancelled')),
  order_date     date          not null default current_date,
  expected_date  date,
  notes          text,
  subtotal       numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  created_by     uuid          references public.app_users(id) on delete set null,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now()
);

-- ─── 2. purchase_order_items ─────────────────────────────────────────────────
create table if not exists public.purchase_order_items (
  id                        uuid          primary key default gen_random_uuid(),
  purchase_order_id         uuid          not null references public.purchase_orders(id) on delete cascade,
  -- Referencia al catálogo del proveedor (puede quedar null si el ítem se borró del catálogo)
  supplier_catalog_item_id  uuid          references public.supplier_catalog_items(id) on delete set null,
  -- Vínculos al Maestro (se rellenan al emitir la OC)
  linked_product_id         uuid          references public.products(id) on delete set null,
  linked_variant_id         uuid          references public.product_variants(id) on delete set null,
  -- Snapshots: conservan los datos al momento de crear la OC
  -- El catálogo del proveedor puede cambiar después; estos campos no.
  supplier_sku_snapshot     text,
  product_name_snapshot     text          not null,
  brand_snapshot            text,
  model_snapshot            text,
  category_snapshot         text,
  presentation_snapshot     text,
  color_snapshot            text,
  size_snapshot             text,
  -- Cantidades y costos
  quantity_ordered          integer       not null default 1 check (quantity_ordered > 0),
  quantity_received         integer       not null default 0,  -- siempre 0 hasta Ingreso de Mercadería
  unit_cost                 numeric(12,2) not null default 0,
  line_total                numeric(12,2) not null default 0,  -- quantity_ordered * unit_cost
  notes                     text,
  created_at                timestamptz   not null default now(),
  updated_at                timestamptz   not null default now()
);

-- ─── 3. Índices ───────────────────────────────────────────────────────────────
create index if not exists idx_po_supplier_id   on public.purchase_orders(supplier_id);
create index if not exists idx_po_status        on public.purchase_orders(status);
create index if not exists idx_po_order_date    on public.purchase_orders(order_date desc);
create index if not exists idx_poi_order_id     on public.purchase_order_items(purchase_order_id);
create index if not exists idx_poi_catalog_item on public.purchase_order_items(supplier_catalog_item_id);
create index if not exists idx_poi_variant_id   on public.purchase_order_items(linked_variant_id);

-- ─── 4. RLS: purchase_orders ─────────────────────────────────────────────────
alter table public.purchase_orders enable row level security;

drop policy if exists po_select on public.purchase_orders;
drop policy if exists po_insert on public.purchase_orders;
drop policy if exists po_update on public.purchase_orders;
drop policy if exists po_delete on public.purchase_orders;

create policy po_select on public.purchase_orders
  for select to authenticated using (true);

create policy po_insert on public.purchase_orders
  for insert to authenticated
  with check (exists (
    select 1 from public.app_users
    where auth_user_id = auth.uid() and role = 'admin' and is_active = true
  ));

create policy po_update on public.purchase_orders
  for update to authenticated
  using (exists (
    select 1 from public.app_users
    where auth_user_id = auth.uid() and role = 'admin' and is_active = true
  ))
  with check (exists (
    select 1 from public.app_users
    where auth_user_id = auth.uid() and role = 'admin' and is_active = true
  ));

create policy po_delete on public.purchase_orders
  for delete to authenticated
  using (exists (
    select 1 from public.app_users
    where auth_user_id = auth.uid() and role = 'admin' and is_active = true
  ));

-- ─── 5. RLS: purchase_order_items ────────────────────────────────────────────
alter table public.purchase_order_items enable row level security;

drop policy if exists poi_select on public.purchase_order_items;
drop policy if exists poi_insert on public.purchase_order_items;
drop policy if exists poi_update on public.purchase_order_items;
drop policy if exists poi_delete on public.purchase_order_items;

create policy poi_select on public.purchase_order_items
  for select to authenticated using (true);

create policy poi_insert on public.purchase_order_items
  for insert to authenticated
  with check (exists (
    select 1 from public.app_users
    where auth_user_id = auth.uid() and role = 'admin' and is_active = true
  ));

create policy poi_update on public.purchase_order_items
  for update to authenticated
  using (exists (
    select 1 from public.app_users
    where auth_user_id = auth.uid() and role = 'admin' and is_active = true
  ))
  with check (exists (
    select 1 from public.app_users
    where auth_user_id = auth.uid() and role = 'admin' and is_active = true
  ));

create policy poi_delete on public.purchase_order_items
  for delete to authenticated
  using (exists (
    select 1 from public.app_users
    where auth_user_id = auth.uid() and role = 'admin' and is_active = true
  ));

-- ─── 6. Función: generate_order_number() ─────────────────────────────────────
-- Genera números secuenciales por año: OC-2025-001, OC-2025-002 ...
-- Usa el MAX del correlativo del año para evitar huecos por filas borradas.
create or replace function public.generate_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text    := to_char(current_date, 'YYYY');
  v_seq  integer;
begin
  select coalesce(
    max(
      cast(split_part(order_number, '-', 3) as integer)
    ), 0
  ) + 1
  into v_seq
  from public.purchase_orders
  where order_number like 'OC-' || v_year || '-%'
    and order_number ~ '^OC-[0-9]{4}-[0-9]+$';

  return 'OC-' || v_year || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

grant execute on function public.generate_order_number() to authenticated;

-- =============================================================================
-- Impacto esperado al aplicar esta migración:
--   + Tabla purchase_orders       (nueva)
--   + Tabla purchase_order_items  (nueva)
--   + Función generate_order_number() (nueva)
--   Cero cambios en tablas existentes.
-- =============================================================================
