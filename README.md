# Gestión Comercial Prototipo

Prototipo de sistema ERP comercial orientado a una prueba técnica. Permite autenticación de usuarios, visualización de un dashboard gerencial con métricas de inventario y navegación hacia módulos comerciales en desarrollo.

## Stack tecnológico

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase PostgreSQL**
- **Vercel** como opción de despliegue

## Módulos implementados

- Login básico (RPC `login_app_user`)
- Dashboard Gerencial (métricas desde Supabase)
- Conexión Supabase (cliente público)

## Módulos en desarrollo

- Maestro de Productos
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

> Usa la **Publishable Key** (anon) de Supabase. No incluyas secret keys en el frontend.

## Ejecución local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000/login](http://localhost:3000/login).

## Base de datos (Supabase)

Scripts SQL incluidos en `database/`:

1. `database/schema.sql` — extensión, tablas (`app_users`, `products`, `product_variants`) y función `login_app_user`
2. `database/seed.sql` — usuario admin demo y catálogo inicial:

   **Productos**

   | Producto | main_sku |
   |----------|----------|
   | Alien Mugler | AUTO-ALIEN-MUGLER |
   | Teclado Redragon K552 | AUTO-REDRAGON-K552 |
   | Laptop Lenovo IdeaPad 3 | AUTO-LENOVO-IP3 |
   | Polo Naruto Asesino | AUTO-POLO-NARUTO |

   **Variantes:** AM-50ML-001, AM-100ML-002, TEC-K552-NEGRO, TEC-K552-ROJO, TEC-K552-BLANCO, LAP-LEN-IP3-R5, LAP-LEN-IP3-I5, POL-NARUTO-PRINCIPAL

Ejecuta primero `schema.sql` y luego `seed.sql` en el SQL Editor de Supabase.

## Arquitectura (resumen)

```
src/
├── app/
│   ├── (auth)/login/          # Pantalla de login
│   └── (dashboard)/           # Layout ERP + rutas protegidas
├── components/
│   ├── layout/                # Sidebar, Header, AuthGuard
│   ├── dashboard/             # KPIs y alertas
│   └── ui/                    # Placeholders de módulos
├── lib/
│   ├── auth/session.ts        # Sesión en localStorage (prototipo)
│   ├── navigation.ts          # Navegación del sidebar
│   └── supabase/client.ts     # Cliente Supabase
└── modules/
    ├── auth/services/         # loginAppUser → RPC
    └── dashboard/services/    # getDashboardMetrics
```

- **Frontend:** Next.js App Router con componentes de servidor para métricas y client components para login/sesión.
- **Backend de datos:** Supabase PostgreSQL expuesto vía `@supabase/supabase-js`.
- **Autenticación:** validación por función RPC; sesión persistida en `localStorage` solo para alcance del prototipo.

## Supuestos del prototipo

- El catálogo se modela con `products` (familia) y `product_variants` (SKU/stock).
- Las métricas del dashboard leen únicamente variantes con `status = 'active'`.
- Stock bajo se calcula cuando `stock <= min_stock`.
- Los módulos comerciales restantes están como placeholders visuales.
- No hay integraciones externas (facturación SUNAT, logística, etc.) en esta fase.

## Nota de seguridad

La sesión actual usa **localStorage** solo por alcance de prototipo. En producción se recomienda **Supabase Auth** con cookies seguras, políticas RLS estrictas y sin exponer lógica de contraseñas en el cliente.

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |

## Repositorio

https://github.com/anthonybrian977-jpg/gestion-comercial-prototipo
