# Gestión Comercial Prototipo

Prototipo de sistema ERP comercial orientado a una prueba técnica. Cubre autenticación, dashboard gerencial con métricas de inventario y un Maestro de Productos con creación, edición, variantes e imágenes.

## Stack tecnológico

- **Next.js 15** (App Router, Server + Client Components)
- **TypeScript** estricto
- **Tailwind CSS v4**
- **Supabase** — PostgreSQL + Auth + Storage
- **Vercel** como opción de despliegue

## Módulos implementados

| Módulo | Estado | Funcionalidades |
|--------|--------|-----------------|
| Login | ✅ | Supabase Auth `signInWithPassword`, sesión por cookies |
| Dashboard Gerencial | ✅ | Métricas de inventario desde Supabase (Server Component) |
| Maestro de Productos | ✅ | Catálogo, creación, edición, variantes, imágenes, lightbox |

### Maestro de Productos — detalle

- **Tabla** con búsqueda por nombre, SKU, marca o categoría; alerta visual de stock bajo
- **Crear producto** — producto base + variantes con stock, precios e imagen inicial
- **Modal de detalle / edición compacto** — vista y edición en el mismo modal
- **Variantes** — productos simples y con variantes; conversión simple → multi-variante desde edición
- **Imágenes** — subida a Supabase Storage bucket `product-images`; se guarda `image_path` (path interno); URL pública solo se genera al renderizar
- **Lightbox** — clic en miniatura de producto o variante abre vista ampliada

## Módulos en desarrollo (placeholders)

- Orden de Compra
- Ingreso de Mercadería
- Facturación
- Despacho

## Credenciales demo

| Campo | Valor |
|-------|-------|
| Email | `admin@demo.com` |
| Contraseña | `123456` |

## Variables de entorno requeridas

Copia `.env.example` a `.env.local` y completa:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

> Usa la **Publishable Key** (anon key) de Supabase. No incluyas secret keys en el frontend.

## Ejecución local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000/login](http://localhost:3000/login).

## Base de datos (Supabase)

Scripts SQL en `database/`:

1. `schema.sql` — tablas, RLS y comentarios sobre Storage
2. `seed.sql` — usuario admin demo + catálogo inicial de 4 productos

Ejecutar en orden en el SQL Editor de Supabase:

```
1. schema.sql
2. seed.sql
```

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `app_users` | Usuarios de negocio vinculados a Supabase Auth via `auth_user_id` |
| `products` | Producto base (nombre, marca, SKU, `image_path`) |
| `product_variants` | Variantes vendibles (SKU, precio, stock, `image_path`) |

### Supabase Storage

- Bucket: `product-images` (público)
- Crear desde el panel: **Storage → New bucket → Public = true**
- Ejecutar las policies comentadas en `schema.sql`
- `image_path` almacena el path interno (ej. `products/uuid.webp`); la URL pública se construye en frontend con `getProductImagePublicUrl(path)`

### Catálogo seed

| Producto | main_sku | Tipo |
|----------|----------|------|
| Alien Mugler | AUTO-ALIEN-MUGLER | Con variantes (50ml, 100ml) |
| Teclado Redragon K552 | AUTO-REDRAGON-K552 | Con variantes (color/switch) |
| Laptop Lenovo IdeaPad 3 | AUTO-LENOVO-IP3 | Con variantes (CPU/RAM) |
| Polo Naruto Asesino | AUTO-POLO-NARUTO | Simple |

## Arquitectura (resumen)

```
src/
├── app/
│   ├── (auth)/login/           # Pantalla de login
│   └── (dashboard)/            # Layout ERP + rutas protegidas
├── components/
│   ├── layout/                 # Sidebar, Header, AuthGuard
│   ├── dashboard/              # KPIs y alertas de inventario
│   └── ui/
│       └── ImageLightbox.tsx   # Visor de imagen reutilizable
├── lib/
│   ├── auth/                   # Perfil desde app_users
│   ├── navigation.ts           # Navegación del sidebar
│   └── supabase/
│       ├── client.ts           # createBrowserClient (Client Components)
│       ├── server.ts           # createServerClient (Server Components)
│       └── upload-image.ts     # Subida a Storage + getProductImagePublicUrl
├── middleware.ts               # Refresco de sesión Supabase Auth
└── modules/
    ├── auth/services/          # loginAppUser (legado)
    ├── dashboard/services/     # getDashboardMetrics
    └── productos/
        ├── actions/
        │   ├── create-product.ts   # Server Action: crear producto + variantes
        │   └── update-product.ts   # Server Action: editar producto + variantes
        ├── components/
        │   ├── ProductTable.tsx        # Tabla con búsqueda y lightbox
        │   ├── ProductCreateModal.tsx  # Modal creación
        │   └── ProductDetailModal.tsx  # Modal detalle/edición compacto
        ├── services/products.ts    # getProductsCatalog (Server Component)
        ├── types.ts                # Tipos TypeScript del módulo
        └── utils/                  # format, sku
```

## Supuestos del prototipo

- `products` es el agrupador/ficha; `product_variants` son las unidades vendibles con SKU y stock.
- `has_variants` se recalcula automáticamente al guardar edición (> 1 variante activa = true).
- Las imágenes se suben al bucket antes de persistir el producto; si la inserción en BD falla posteriormente, puede quedar un archivo huérfano en Storage (limitación aceptable en prototipo).
- `updateProduct` aplica cambios en pasos secuenciales (producto → variantes → nuevas variantes). En un ERP real esto debería ejecutarse en una transacción PostgreSQL o RPC.
- Las métricas del dashboard leen únicamente variantes con `status = 'active'`.
- Stock bajo: `stock <= min_stock`.
- No hay integraciones externas (SUNAT, logística, etc.) en esta fase.

## Nota de seguridad

La sesión usa **Supabase Auth** con cookies gestionadas por `@supabase/ssr`. Las tablas de negocio están protegidas con **RLS**: solo usuarios `authenticated` con `role = 'admin'` en `app_users` pueden insertar/actualizar/eliminar. La función RPC `login_app_user` permanece en el esquema como legado pero no forma parte del flujo de login principal.

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |

## Repositorio

https://github.com/anthonybrian977-jpg/gestion-comercial-prototipo
