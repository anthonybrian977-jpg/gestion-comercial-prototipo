-- ============================================================
-- Migración 004: Despacho Fase 1
-- PROPUESTA — NO aplicar hasta aprobación del equipo.
-- ============================================================
-- Requiere que 001, 002 y 003 ya estén aplicadas.
-- Crea 2 tablas + función de numeración + RPC transaccional + RLS.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLA: dispatch_orders
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dispatch_orders (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number             text          NOT NULL UNIQUE,                -- OD-2026-001
  customer_invoice_id         uuid          NOT NULL UNIQUE                 -- 1 pedido por factura
                                              REFERENCES public.customer_invoices(id) ON DELETE RESTRICT,
  status                      text          NOT NULL DEFAULT 'in_process'
                                              CHECK (status IN ('in_process', 'delivered', 'cancelled')),
  -- Snapshots del cliente copiados desde la factura al crear el pedido
  customer_name_snapshot      text          NOT NULL,
  customer_document_snapshot  text,
  customer_phone_snapshot     text,
  customer_email_snapshot     text,
  shipping_address_snapshot   text,
  total                       numeric(12,2) NOT NULL DEFAULT 0,
  notes                       text,
  delivered_at                timestamptz,                                  -- set cuando → delivered
  cancelled_at                timestamptz,                                  -- set cuando → cancelled
  created_by                  uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: dispatch_order_items
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dispatch_order_items (
  id                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id         uuid          NOT NULL
                                            REFERENCES public.dispatch_orders(id) ON DELETE CASCADE,
  customer_invoice_item_id  uuid
                                            REFERENCES public.customer_invoice_items(id) ON DELETE SET NULL,
  product_id                uuid          REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id                uuid          REFERENCES public.product_variants(id) ON DELETE SET NULL,
  -- Snapshots (igual que en la factura — precios y nombres al momento de facturar)
  product_name_snapshot     text          NOT NULL,
  variant_snapshot          text,
  sku_snapshot              text,
  quantity                  integer       NOT NULL CHECK (quantity > 0),
  unit_price                numeric(12,2) NOT NULL,
  line_total                numeric(12,2) NOT NULL,
  created_at                timestamptz   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN: generate_dispatch_number()
-- Formato: OD-YYYY-NNN (año en hora Lima)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_dispatch_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year  text;
  v_max   integer;
BEGIN
  v_year := to_char(now() AT TIME ZONE 'America/Lima', 'YYYY');
  SELECT COALESCE(
    MAX(CAST(SPLIT_PART(dispatch_number, '-', 3) AS integer)), 0
  ) INTO v_max
  FROM public.dispatch_orders
  WHERE dispatch_number LIKE 'OD-' || v_year || '-%';
  RETURN 'OD-' || v_year || '-' || LPAD((v_max + 1)::text, 3, '0');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC TRANSACCIONAL: mark_dispatch_delivered(dispatch_order_id)
-- ─────────────────────────────────────────────────────────────
--
-- ÚNICO punto del sistema donde product_variants.stock baja por venta.
-- Garantía: todo o nada. Si falla cualquier validación o mutación,
-- PostgreSQL hace ROLLBACK completo.
--
-- PASADA 1 (validación):
--   - Valida usuario admin activo
--   - Bloquea dispatch_order (FOR UPDATE)
--   - Valida status = 'in_process'
--   - Para cada ítem: bloquea la fila de product_variants y verifica
--     que stock >= quantity pedida
--
-- PASADA 2 (mutación):
--   - Resta stock en product_variants
--   - Inserta stock_movements (movement_type = 'out', source_type = 'dispatch')
--   - Actualiza dispatch_orders.status → 'delivered', delivered_at = now()
--   - Actualiza customer_invoices.status → 'dispatched'
--
-- Errores con código legible:
--   UNAUTHORIZED      — no admin activo
--   NOT_FOUND         — pedido no existe
--   INVALID_STATUS    — pedido no está in_process
--   STOCK_INSUFICIENTE — stock insuficiente para algún ítem
--   VARIANT_NOT_FOUND — variante eliminada del maestro
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_dispatch_delivered(
  p_dispatch_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id       uuid;
  v_dispatch_num   text;
  v_invoice_id     uuid;
  v_invoice_num    text;
  v_dispatch_status text;
  v_item           RECORD;
  v_stock_before   integer;
  v_stock_after    integer;
BEGIN

  -- ══════════════════════════════════════════════════════════════════
  -- PASADA 1: VALIDACIONES
  -- ══════════════════════════════════════════════════════════════════

  -- 0. Usuario admin activo
  SELECT id INTO v_admin_id
  FROM public.app_users
  WHERE auth_user_id = auth.uid()
    AND role        = 'admin'
    AND is_active   = true
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuario no autorizado.';
  END IF;

  -- 1. Bloquear y validar pedido de despacho
  SELECT dispatch_number, customer_invoice_id, status
  INTO   v_dispatch_num, v_invoice_id, v_dispatch_status
  FROM   public.dispatch_orders
  WHERE  id = p_dispatch_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Pedido de despacho no encontrado.';
  END IF;

  IF v_dispatch_status != 'in_process' THEN
    RAISE EXCEPTION
      'INVALID_STATUS: El pedido tiene estado "%" y no puede marcarse como entregado.',
      v_dispatch_status;
  END IF;

  -- 2. Leer número de factura (para las notas del movimiento)
  SELECT invoice_number INTO v_invoice_num
  FROM   public.customer_invoices
  WHERE  id = v_invoice_id;

  -- 3. Validar stock disponible por cada ítem + bloquear filas de variante
  FOR v_item IN
    SELECT doi.variant_id,
           doi.product_name_snapshot,
           doi.quantity
    FROM   public.dispatch_order_items doi
    WHERE  doi.dispatch_order_id = p_dispatch_order_id
  LOOP
    IF v_item.variant_id IS NULL THEN
      RAISE EXCEPTION
        'VARIANT_NOT_FOUND: El producto "%" ya no tiene variante vinculada.',
        v_item.product_name_snapshot;
    END IF;

    SELECT stock INTO v_stock_before
    FROM   public.product_variants
    WHERE  id = v_item.variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'VARIANT_NOT_FOUND: La variante de "%" no existe en el Maestro.',
        v_item.product_name_snapshot;
    END IF;

    IF v_stock_before < v_item.quantity THEN
      RAISE EXCEPTION
        'STOCK_INSUFICIENTE: Stock insuficiente para "%" (disponible: %, solicitado: %).',
        v_item.product_name_snapshot,
        v_stock_before,
        v_item.quantity;
    END IF;
  END LOOP;

  -- ══════════════════════════════════════════════════════════════════
  -- PASADA 2: MUTACIONES
  -- ══════════════════════════════════════════════════════════════════

  FOR v_item IN
    SELECT doi.variant_id,
           doi.product_id,
           doi.product_name_snapshot,
           doi.quantity
    FROM   public.dispatch_order_items doi
    WHERE  doi.dispatch_order_id = p_dispatch_order_id
  LOOP
    -- Releer stock (filas ya bloqueadas por la pasada 1)
    SELECT stock INTO v_stock_before
    FROM   public.product_variants
    WHERE  id = v_item.variant_id;

    v_stock_after := v_stock_before - v_item.quantity;

    -- Restar stock ← ÚNICO PUNTO donde stock baja por despacho
    UPDATE public.product_variants
    SET    stock      = v_stock_after,
           updated_at = now()
    WHERE  id = v_item.variant_id;

    -- Registrar movimiento de salida (quantity_delta negativo = salida)
    INSERT INTO public.stock_movements (
      product_id,
      variant_id,
      movement_type,
      source_type,
      source_id,
      quantity_delta,
      stock_before,
      stock_after,
      notes,
      created_by
    ) VALUES (
      v_item.product_id,
      v_item.variant_id,
      'out',
      'dispatch',
      p_dispatch_order_id,
      -v_item.quantity,
      v_stock_before,
      v_stock_after,
      'Entrega ' || v_dispatch_num || ' vinculada a factura ' || COALESCE(v_invoice_num, '?'),
      v_admin_id
    );
  END LOOP;

  -- Actualizar pedido → delivered
  UPDATE public.dispatch_orders
  SET    status       = 'delivered',
         delivered_at = now(),
         updated_at   = now()
  WHERE  id = p_dispatch_order_id;

  -- Actualizar factura cliente → dispatched
  UPDATE public.customer_invoices
  SET    status     = 'dispatched',
         updated_at = now()
  WHERE  id = v_invoice_id;

  RETURN jsonb_build_object(
    'dispatch_number', v_dispatch_num,
    'status',          'delivered'
  );

END;
$$;

-- ─────────────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_do_invoice_id
  ON public.dispatch_orders(customer_invoice_id);
CREATE INDEX IF NOT EXISTS idx_do_status
  ON public.dispatch_orders(status);
CREATE INDEX IF NOT EXISTS idx_do_created_at
  ON public.dispatch_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doi_dispatch_id
  ON public.dispatch_order_items(dispatch_order_id);
CREATE INDEX IF NOT EXISTS idx_doi_variant_id
  ON public.dispatch_order_items(variant_id);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.dispatch_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "do_select" ON public.dispatch_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );
CREATE POLICY "do_insert" ON public.dispatch_orders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE auth_user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );
CREATE POLICY "do_update" ON public.dispatch_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE auth_user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

CREATE POLICY "doi_select" ON public.dispatch_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );
CREATE POLICY "doi_insert" ON public.dispatch_order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE auth_user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Permite eliminar la cabecera del pedido si el insert de ítems falla
-- (rollback manual desde TypeScript). Solo admins activos.
-- Sin esta política, RLS bloquea DELETE en silencio y el rollback es no-op.
CREATE POLICY "do_delete" ON public.dispatch_orders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE auth_user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );
