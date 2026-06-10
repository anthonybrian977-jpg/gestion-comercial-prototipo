-- Gestión Comercial Prototipo
-- Datos demo definidos (reproducible, sin UUIDs fijos)

-- ---------------------------------------------------------------------------
-- Usuario administrador demo
-- ---------------------------------------------------------------------------
insert into public.app_users (
  email,
  password_hash,
  name,
  role,
  is_active
)
values (
  'admin@demo.com',
  crypt('123456', gen_salt('bf')),
  'Admin Demo',
  'admin',
  true
)
on conflict (email) do update
set
  password_hash = excluded.password_hash,
  name = excluded.name,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------------
insert into public.products (
  name,
  brand,
  model,
  category,
  description,
  main_sku,
  image_path,
  has_variants,
  status
)
values
  (
    'Alien Mugler',
    'Mugler',
    'Alien',
    'Perfumes',
    'Perfume importado con presentaciones por mililitros.',
    'AUTO-ALIEN-MUGLER',
    null,
    true,
    'active'
  ),
  (
    'Teclado Redragon K552',
    'Redragon',
    'K552',
    'Teclados',
    'Teclado mecánico compacto con variantes por color.',
    'AUTO-REDRAGON-K552',
    null,
    true,
    'active'
  ),
  (
    'Laptop Lenovo IdeaPad 3',
    'Lenovo',
    'IdeaPad 3',
    'Laptops',
    'Laptop de uso diario con diferentes configuraciones.',
    'AUTO-LENOVO-IP3',
    null,
    true,
    'active'
  ),
  (
    'Polo Naruto Asesino',
    'Anime Store',
    'Naruto Asesino',
    'Ropa',
    'Polo estampado sin variantes visibles para el prototipo.',
    'AUTO-POLO-NARUTO',
    null,
    false,
    'active'
  )
on conflict (main_sku) do update
set
  name = excluded.name,
  brand = excluded.brand,
  model = excluded.model,
  category = excluded.category,
  description = excluded.description,
  image_path = excluded.image_path,
  has_variants = excluded.has_variants,
  status = excluded.status,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Variantes
-- ---------------------------------------------------------------------------
insert into public.product_variants (
  product_id,
  sku,
  size,
  color,
  presentation,
  purchase_price,
  sale_price,
  stock,
  min_stock,
  status
)
select
  p.id,
  v.sku,
  v.size,
  v.color,
  v.presentation,
  v.purchase_price,
  v.sale_price,
  v.stock,
  v.min_stock,
  'active'
from (
  values
    (
      'AUTO-ALIEN-MUGLER',
      'AM-50ML-001',
      null,
      null,
      '50ml',
      280.00,
      390.00,
      15,
      3
    ),
    (
      'AUTO-ALIEN-MUGLER',
      'AM-100ML-002',
      null,
      null,
      '100ml',
      460.00,
      625.00,
      7,
      2
    ),
    (
      'AUTO-REDRAGON-K552',
      'TEC-K552-NEGRO',
      null,
      'Negro',
      'Switch azul',
      90.00,
      140.00,
      10,
      3
    ),
    (
      'AUTO-REDRAGON-K552',
      'TEC-K552-ROJO',
      null,
      'Rojo',
      'Switch rojo',
      95.00,
      150.00,
      5,
      2
    ),
    (
      'AUTO-REDRAGON-K552',
      'TEC-K552-BLANCO',
      null,
      'Blanco',
      'Switch azul',
      98.00,
      155.00,
      8,
      2
    ),
    (
      'AUTO-LENOVO-IP3',
      'LAP-LEN-IP3-R5',
      null,
      'Gris',
      'Ryzen 5 / 8GB / 512GB',
      1800.00,
      2300.00,
      4,
      1
    ),
    (
      'AUTO-LENOVO-IP3',
      'LAP-LEN-IP3-I5',
      null,
      'Azul',
      'Intel i5 / 8GB / 512GB',
      1900.00,
      2450.00,
      3,
      1
    ),
    (
      'AUTO-POLO-NARUTO',
      'POL-NARUTO-PRINCIPAL',
      'M',
      'Negro',
      'Principal',
      35.00,
      68.00,
      12,
      3
    )
) as v (
  main_sku,
  sku,
  size,
  color,
  presentation,
  purchase_price,
  sale_price,
  stock,
  min_stock
)
join public.products p on p.main_sku = v.main_sku
on conflict (sku) do update
set
  product_id = excluded.product_id,
  size = excluded.size,
  color = excluded.color,
  presentation = excluded.presentation,
  purchase_price = excluded.purchase_price,
  sale_price = excluded.sale_price,
  stock = excluded.stock,
  min_stock = excluded.min_stock,
  status = excluded.status,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Vincular app_users con Supabase Auth
-- Ejecutar después de crear el usuario admin@demo.com en Supabase Auth.
-- ---------------------------------------------------------------------------
update public.app_users au
set auth_user_id = u.id
from auth.users u
where au.email = u.email
  and au.email = 'admin@demo.com';

-- ---------------------------------------------------------------------------
-- Nuevos productos: Botella Térmica 1L + Zapatilla Urbana Test
-- ---------------------------------------------------------------------------
insert into public.products (
  name, brand, model, category, description, main_sku, image_path, has_variants, status
)
values
  (
    'Botella Térmica 1L',
    'ThermoMax',
    'Térmica Pro',
    'Hogar',
    'Botella de acero inoxidable con aislamiento térmico de doble pared.',
    'AUTO-BOT-THERM-1L',
    null,
    false,
    'active'
  ),
  (
    'Zapatilla Urbana Test',
    'UrbanStep',
    'Urbana X',
    'Calzado',
    'Zapatilla casual para uso diario, diseño moderno y cómodo.',
    'AUTO-ZAP-URB-TEST',
    null,
    false,
    'active'
  )
on conflict (main_sku) do update
set
  name = excluded.name,
  brand = excluded.brand,
  model = excluded.model,
  category = excluded.category,
  description = excluded.description,
  image_path = excluded.image_path,
  has_variants = excluded.has_variants,
  status = excluded.status,
  updated_at = now();

-- Variantes de los nuevos productos
insert into public.product_variants (
  product_id, sku, size, color, presentation,
  purchase_price, sale_price, stock, min_stock, status
)
select
  p.id,
  v.sku, v.size, v.color, v.presentation,
  v.purchase_price, v.sale_price, v.stock, v.min_stock,
  'active'
from (
  values
    ('AUTO-BOT-THERM-1L',  'BOT-THERM-1L',      null, 'Plateado', '1 Litro',    55.00,  89.00, 20, 4),
    ('AUTO-ZAP-URB-TEST',  'ZAP-URB-TEST-40',    '40', 'Blanco',  'Principal',  75.00, 129.00, 10, 3)
) as v (main_sku, sku, size, color, presentation, purchase_price, sale_price, stock, min_stock)
join public.products p on p.main_sku = v.main_sku
on conflict (sku) do update
set
  product_id    = excluded.product_id,
  size          = excluded.size,
  color         = excluded.color,
  presentation  = excluded.presentation,
  purchase_price = excluded.purchase_price,
  sale_price    = excluded.sale_price,
  stock         = excluded.stock,
  min_stock     = excluded.min_stock,
  status        = excluded.status,
  updated_at    = now();

-- ---------------------------------------------------------------------------
-- Proveedores + precios por variante
-- Proveedor A: más barato para Alien Mugler, Botella Térmica, Laptop, Polo
-- Proveedor B: más barato para Teclado Redragon, Zapatilla Urbana
-- ---------------------------------------------------------------------------
do $$
declare
  supplier_a_id uuid;
  supplier_b_id uuid;
  v_am_50ml     uuid;
  v_am_100ml    uuid;
  v_tec_negro   uuid;
  v_tec_rojo    uuid;
  v_tec_blanco  uuid;
  v_lap_r5      uuid;
  v_lap_i5      uuid;
  v_polo_naruto uuid;
  v_botella     uuid;
  v_zapatilla   uuid;
begin
  -- Insertar o recuperar Proveedor A (identificado por RUC único)
  insert into public.suppliers (name, ruc, contact_name, phone, email, address, is_active)
  values ('Proveedor A', '20100000001', 'Carlos Quispe', '987654321', 'proveedora@demo.com', 'Av. Lima 123, Lima', true)
  on conflict (ruc) do update
    set name = excluded.name, contact_name = excluded.contact_name,
        phone = excluded.phone, email = excluded.email,
        address = excluded.address, updated_at = now()
  returning id into supplier_a_id;

  if supplier_a_id is null then
    select id into supplier_a_id from public.suppliers where ruc = '20100000001';
  end if;

  -- Insertar o recuperar Proveedor B
  insert into public.suppliers (name, ruc, contact_name, phone, email, address, is_active)
  values ('Proveedor B', '20100000002', 'María Torres', '987654322', 'proveedorb@demo.com', 'Jr. Arequipa 456, Lima', true)
  on conflict (ruc) do update
    set name = excluded.name, contact_name = excluded.contact_name,
        phone = excluded.phone, email = excluded.email,
        address = excluded.address, updated_at = now()
  returning id into supplier_b_id;

  if supplier_b_id is null then
    select id into supplier_b_id from public.suppliers where ruc = '20100000002';
  end if;

  -- Recuperar IDs de variantes por SKU
  select id into v_am_50ml     from public.product_variants where sku = 'AM-50ML-001';
  select id into v_am_100ml    from public.product_variants where sku = 'AM-100ML-002';
  select id into v_tec_negro   from public.product_variants where sku = 'TEC-K552-NEGRO';
  select id into v_tec_rojo    from public.product_variants where sku = 'TEC-K552-ROJO';
  select id into v_tec_blanco  from public.product_variants where sku = 'TEC-K552-BLANCO';
  select id into v_lap_r5      from public.product_variants where sku = 'LAP-LEN-IP3-R5';
  select id into v_lap_i5      from public.product_variants where sku = 'LAP-LEN-IP3-I5';
  select id into v_polo_naruto from public.product_variants where sku = 'POL-NARUTO-PRINCIPAL';
  select id into v_botella     from public.product_variants where sku = 'BOT-THERM-1L';
  select id into v_zapatilla   from public.product_variants where sku = 'ZAP-URB-TEST-40';

  -- Precios Proveedor A (más barato en: Alien Mugler, Botella, Laptop, Polo)
  insert into public.supplier_products (supplier_id, variant_id, purchase_price)
  values
    (supplier_a_id, v_am_50ml,      260.00),
    (supplier_a_id, v_am_100ml,     440.00),
    (supplier_a_id, v_tec_negro,     95.00),
    (supplier_a_id, v_tec_rojo,     100.00),
    (supplier_a_id, v_tec_blanco,   103.00),
    (supplier_a_id, v_lap_r5,      1750.00),
    (supplier_a_id, v_lap_i5,      1850.00),
    (supplier_a_id, v_polo_naruto,   30.00),
    (supplier_a_id, v_botella,       45.00),
    (supplier_a_id, v_zapatilla,     68.00)
  on conflict (supplier_id, variant_id) do update
    set purchase_price = excluded.purchase_price, updated_at = now();

  -- Precios Proveedor B (más barato en: Teclado Redragon, Zapatilla Urbana)
  insert into public.supplier_products (supplier_id, variant_id, purchase_price)
  values
    (supplier_b_id, v_am_50ml,      275.00),
    (supplier_b_id, v_am_100ml,     455.00),
    (supplier_b_id, v_tec_negro,     85.00),
    (supplier_b_id, v_tec_rojo,      90.00),
    (supplier_b_id, v_tec_blanco,    93.00),
    (supplier_b_id, v_lap_r5,      1820.00),
    (supplier_b_id, v_lap_i5,      1920.00),
    (supplier_b_id, v_polo_naruto,   38.00),
    (supplier_b_id, v_botella,       52.00),
    (supplier_b_id, v_zapatilla,     60.00)
  on conflict (supplier_id, variant_id) do update
    set purchase_price = excluded.purchase_price, updated_at = now();

end;
$$;
