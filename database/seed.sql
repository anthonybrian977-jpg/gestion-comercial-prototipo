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
  image_url,
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
  image_url = excluded.image_url,
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
