-- ============================================================
-- Migración 002: Ingreso de Mercadería
-- PROPUESTA — NO aplicar hasta aprobación de Brian
-- ============================================================
-- Crea 3 tablas nuevas + función de numeración + RPC transaccional.
-- Zero cambios en tablas existentes (purchase_orders, products, etc.).
-- ============================================================

-- ─── Tabla: goods_receipts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goods_receipts (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number      text          UNIQUE NOT NULL,
  purchase_order_id   uuid          NOT NULL REFERENCES purchase_orders(id)  ON DELETE RESTRICT,
  supplier_id         uuid          NOT NULL REFERENCES suppliers(id)         ON DELETE RESTRICT,
  status              text          NOT NULL DEFAULT 'confirmed'
                                    CHECK (status IN ('confirmed', 'cancelled')),
  receipt_date        date          NOT NULL DEFAULT current_date,
  notes               text,
  created_by          uuid          REFERENCES app_users(id) ON DELETE SET NULL,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

-- ─── Tabla: goods_receipt_items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id        uuid          NOT NULL REFERENCES goods_receipts(id)       ON DELETE CASCADE,
  purchase_order_item_id  uuid                   REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  linked_product_id       uuid                   REFERENCES products(id)             ON DELETE SET NULL,
  linked_variant_id       uuid                   REFERENCES product_variants(id)     ON DELETE SET NULL,
  product_name_snapshot   text          NOT NULL,
  variant_snapshot        text,
  supplier_sku_snapshot   text,
  quantity_received       integer       NOT NULL CHECK (quantity_received > 0),
  unit_cost               numeric(12,2),
  notes                   text,
  created_at              timestamptz   NOT NULL DEFAULT now()
);

-- ─── Tabla: stock_movements ───────────────────────────────────────────────────
-- Auditoría inmutable de todos los cambios de stock.
CREATE TABLE IF NOT EXISTS stock_movements (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid          NOT NULL REFERENCES products(id)         ON DELETE RESTRICT,
  variant_id      uuid          NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  movement_type   text          NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  source_type     text          NOT NULL CHECK (source_type IN ('goods_receipt', 'dispatch', 'manual_adjustment')),
  source_id       uuid          NOT NULL,
  quantity_delta  integer       NOT NULL,       -- positivo = entrada, negativo = salida
  stock_before    integer       NOT NULL,
  stock_after     integer       NOT NULL,
  notes           text,
  created_by      uuid          REFERENCES app_users(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gr_purchase_order  ON goods_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_gr_supplier        ON goods_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_gr_receipt_date    ON goods_receipts(receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_gri_receipt        ON goods_receipt_items(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_gri_poi            ON goods_receipt_items(purchase_order_item_id);
CREATE INDEX IF NOT EXISTS idx_gri_variant        ON goods_receipt_items(linked_variant_id);
CREATE INDEX IF NOT EXISTS idx_sm_variant         ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_sm_source          ON stock_movements(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_sm_created_at      ON stock_movements(created_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE goods_receipts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements     ENABLE ROW LEVEL SECURITY;

-- Lectura: usuarios autenticados
CREATE POLICY "gr_select"  ON goods_receipts
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "gri_select" ON goods_receipt_items
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sm_select"  ON stock_movements
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escritura: solo admin activo (coincide con el patrón del resto del proyecto)
CREATE POLICY "gr_admin"  ON goods_receipts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM app_users
    WHERE auth_user_id = auth.uid() AND role = 'admin' AND is_active = true
  ));
CREATE POLICY "gri_admin" ON goods_receipt_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM app_users
    WHERE auth_user_id = auth.uid() AND role = 'admin' AND is_active = true
  ));
CREATE POLICY "sm_admin"  ON stock_movements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM app_users
    WHERE auth_user_id = auth.uid() AND role = 'admin' AND is_active = true
  ));

-- ─── Función: generate_goods_receipt_number() ────────────────────────────────
-- Formato: IM-2026-001 (año dinámico con to_char, nunca hardcodeado)
CREATE OR REPLACE FUNCTION generate_goods_receipt_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year  text;
  v_max   integer;
  v_seq   text;
BEGIN
  v_year := to_char(current_date, 'YYYY');

  SELECT COALESCE(
    MAX(CAST(SPLIT_PART(receipt_number, '-', 3) AS integer)), 0
  )
  INTO v_max
  FROM goods_receipts
  WHERE receipt_number LIKE 'IM-' || v_year || '-%';

  v_seq := LPAD((v_max + 1)::text, 3, '0');
  RETURN 'IM-' || v_year || '-' || v_seq;
END;
$$;

-- ─── RPC transaccional: confirm_goods_receipt() ───────────────────────────────
--
-- ÚNICO punto del sistema donde se incrementa product_variants.stock.
-- Garantía absoluta: todo o nada. Si cualquier validación o mutación falla,
-- PostgreSQL hace ROLLBACK completo — no quedan registros parciales.
--
-- Estrategia en dos pasadas:
--   PASADA 1 (validación):  valida TODOS los ítems y bloquea las filas con
--                           FOR UPDATE antes de tocar nada.
--   PASADA 2 (mutación):    ejecuta todos los INSERTs/UPDATEs; las filas ya
--                           están bloqueadas, cualquier error dispara ROLLBACK.
--
-- Firma (sin p_supplier_id ni p_created_by — se resuelven internamente):
--   p_purchase_order_id  uuid   — OC a recibir
--   p_receipt_date       date   — fecha del ingreso (null = hoy)
--   p_notes              text   — notas del ingreso (nullable)
--   p_items              jsonb  — array de ítems a recibir (ver esquema abajo)
--
-- Esquema de cada objeto en p_items:
--   {
--     "purchase_order_item_id": "<uuid>",
--     "linked_product_id":      "<uuid>",
--     "linked_variant_id":      "<uuid>",
--     "product_name_snapshot":  "<text>",
--     "variant_snapshot":       "<text|null>",
--     "supplier_sku_snapshot":  "<text|null>",
--     "quantity_received":      <integer>,
--     "unit_cost":              <numeric|null>,
--     "notes":                  "<text|null>"
--   }
--
-- Retorna:
--   { "receipt_id": "<uuid>", "receipt_number": "<text>", "new_status": "<text>" }
--
-- Errores (RAISE EXCEPTION con prefijo de código legible):
--   UNAUTHORIZED      — usuario no es admin activo
--   NOT_FOUND         — OC no existe
--   INVALID_STATUS    — OC no está en issued / partial_received
--   NO_ITEMS          — array de ítems vacío
--   ITEM_NOT_FOUND    — ítem no pertenece a la OC
--   ITEM_NOT_LINKED   — ítem sin linked_product_id / linked_variant_id
--   INVALID_QTY       — quantity_received <= 0
--   EXCEEDS_PENDING   — quantity_received > cantidad pendiente
--   VARIANT_NOT_FOUND — variante no existe en product_variants
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_goods_receipt(
  p_purchase_order_id   uuid,
  p_receipt_date        date,
  p_notes               text,
  p_items               jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id        uuid;
  v_oc_status       text;
  v_oc_supplier_id  uuid;
  v_receipt_id      uuid;
  v_receipt_number  text;
  v_item            jsonb;
  v_poi_id          uuid;
  v_poi_ordered     integer;
  v_poi_received    integer;
  v_poi_product_id  uuid;
  v_poi_variant_id  uuid;
  v_qty_in          integer;
  v_pending         integer;
  v_stock_before    integer;
  v_stock_after     integer;
  v_total_ordered   integer;
  v_total_received  integer;
  v_new_status      text;
BEGIN

  -- ══════════════════════════════════════════════════════════════════
  -- PASADA 1: VALIDACIONES (todo antes de cualquier mutación)
  -- ══════════════════════════════════════════════════════════════════

  -- ── 0. Validar usuario admin activo ────────────────────────────────────────
  SELECT id INTO v_admin_id
  FROM app_users
  WHERE auth_user_id = auth.uid()
    AND role        = 'admin'
    AND is_active   = true
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuario no autorizado o inactivo.';
  END IF;

  -- ── 1. Bloquear y validar OC ────────────────────────────────────────────────
  --      FOR UPDATE: evita que otra transacción modifique la OC mientras
  --      procesamos el ingreso.
  SELECT status, supplier_id
  INTO   v_oc_status, v_oc_supplier_id
  FROM   purchase_orders
  WHERE  id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Orden de Compra no encontrada.';
  END IF;

  IF v_oc_status NOT IN ('issued', 'partial_received') THEN
    RAISE EXCEPTION
      'INVALID_STATUS: La OC tiene estado "%" y no puede recibir mercadería. '
      'Solo se permite estado "Emitida" o "Recepción parcial".',
      v_oc_status;
  END IF;

  -- ── 2. Validar que llegan ítems ─────────────────────────────────────────────
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS: El ingreso debe contener al menos un ítem con cantidad mayor a 0.';
  END IF;

  -- ── 3. Validar cada ítem y bloquear sus filas ───────────────────────────────
  --      Todos los FOR UPDATE aquí garantizan que las filas no cambien durante
  --      la pasada de mutaciones que sigue.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_poi_id := (v_item->>'purchase_order_item_id')::uuid;
    v_qty_in := (v_item->>'quantity_received')::integer;

    -- 3a. Ítem existe y pertenece a esta OC
    SELECT quantity_ordered,
           quantity_received,
           linked_product_id,
           linked_variant_id
    INTO   v_poi_ordered,
           v_poi_received,
           v_poi_product_id,
           v_poi_variant_id
    FROM   purchase_order_items
    WHERE  id                = v_poi_id
      AND  purchase_order_id = p_purchase_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'ITEM_NOT_FOUND: El ítem % no pertenece a esta Orden de Compra.',
        v_poi_id;
    END IF;

    -- 3b. Ítem vinculado al Maestro de productos
    IF v_poi_product_id IS NULL OR v_poi_variant_id IS NULL THEN
      RAISE EXCEPTION
        'ITEM_NOT_LINKED: El producto "%" no está vinculado al Maestro. '
        'Vincúlalo desde la Orden de Compra antes de registrar el ingreso.',
        COALESCE(v_item->>'product_name_snapshot', v_poi_id::text);
    END IF;

    -- 3c. Cantidad a recibir > 0
    IF v_qty_in <= 0 THEN
      RAISE EXCEPTION
        'INVALID_QTY: La cantidad a recibir debe ser mayor a 0 (producto: %).',
        COALESCE(v_item->>'product_name_snapshot', v_poi_id::text);
    END IF;

    -- 3d. Cantidad no excede el pendiente
    v_pending := v_poi_ordered - v_poi_received;
    IF v_qty_in > v_pending THEN
      RAISE EXCEPTION
        'EXCEEDS_PENDING: Se intenta recibir % unidades de "%" pero solo quedan % pendientes.',
        v_qty_in,
        COALESCE(v_item->>'product_name_snapshot', '?'),
        v_pending;
    END IF;

    -- 3e. Variante existe en el Maestro (bloquear fila para el UPDATE de stock)
    SELECT stock INTO v_stock_before
    FROM   product_variants
    WHERE  id = v_poi_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'VARIANT_NOT_FOUND: La variante % no existe en el Maestro de productos.',
        v_poi_variant_id;
    END IF;

  END LOOP;
  -- ── Fin pasada 1: todas las validaciones pasaron, todas las filas bloqueadas ─

  -- ══════════════════════════════════════════════════════════════════
  -- PASADA 2: MUTACIONES (solo se llega aquí si todo es válido)
  -- ══════════════════════════════════════════════════════════════════

  -- ── 4. Generar número único de ingreso ──────────────────────────────────────
  v_receipt_number := generate_goods_receipt_number();

  -- ── 5. Crear cabecera del ingreso ───────────────────────────────────────────
  INSERT INTO goods_receipts (
    receipt_number,
    purchase_order_id,
    supplier_id,
    receipt_date,
    notes,
    created_by
  ) VALUES (
    v_receipt_number,
    p_purchase_order_id,
    v_oc_supplier_id,
    COALESCE(p_receipt_date, current_date),
    NULLIF(TRIM(COALESCE(p_notes, '')), ''),
    v_admin_id
  )
  RETURNING id INTO v_receipt_id;

  -- ── 6. Procesar cada ítem: detalle → stock → auditoría → OC ────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_poi_id := (v_item->>'purchase_order_item_id')::uuid;
    v_qty_in := (v_item->>'quantity_received')::integer;

    -- 6a. Insertar detalle del ingreso
    INSERT INTO goods_receipt_items (
      goods_receipt_id,
      purchase_order_item_id,
      linked_product_id,
      linked_variant_id,
      product_name_snapshot,
      variant_snapshot,
      supplier_sku_snapshot,
      quantity_received,
      unit_cost,
      notes
    ) VALUES (
      v_receipt_id,
      v_poi_id,
      (v_item->>'linked_product_id')::uuid,
      (v_item->>'linked_variant_id')::uuid,
      v_item->>'product_name_snapshot',
      NULLIF(TRIM(COALESCE(v_item->>'variant_snapshot',      '')), ''),
      NULLIF(TRIM(COALESCE(v_item->>'supplier_sku_snapshot', '')), ''),
      v_qty_in,
      CASE WHEN (v_item->>'unit_cost') IS NOT NULL
           THEN (v_item->>'unit_cost')::numeric END,
      NULLIF(TRIM(COALESCE(v_item->>'notes', '')), '')
    );

    -- 6b. Leer stock actual
    --     La fila ya está bloqueada desde la pasada de validación;
    --     este SELECT lee el valor vigente dentro de la transacción.
    SELECT stock INTO v_stock_before
    FROM   product_variants
    WHERE  id = (v_item->>'linked_variant_id')::uuid;

    v_stock_after := v_stock_before + v_qty_in;

    -- 6c. Sumar stock ← ÚNICO PUNTO del sistema donde stock sube
    UPDATE product_variants
    SET    stock = v_stock_after
    WHERE  id    = (v_item->>'linked_variant_id')::uuid;

    -- 6d. Registrar movimiento de auditoría (obligatorio)
    --     Si este INSERT falla por cualquier razón, la excepción propaga
    --     y PostgreSQL hace ROLLBACK de toda la transacción.
    INSERT INTO stock_movements (
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
      (v_item->>'linked_product_id')::uuid,
      (v_item->>'linked_variant_id')::uuid,
      'in',
      'goods_receipt',
      v_receipt_id,
      v_qty_in,
      v_stock_before,
      v_stock_after,
      'Ingreso de mercadería ' || v_receipt_number,
      v_admin_id
    );

    -- 6e. Actualizar quantity_received acumulado en el ítem de OC
    UPDATE purchase_order_items
    SET    quantity_received = quantity_received + v_qty_in
    WHERE  id = v_poi_id;

  END LOOP;

  -- ── 7. Recalcular estado de la OC ───────────────────────────────────────────
  --      Releer los ítems con los quantity_received ya actualizados.
  SELECT SUM(quantity_ordered), SUM(quantity_received)
  INTO   v_total_ordered, v_total_received
  FROM   purchase_order_items
  WHERE  purchase_order_id = p_purchase_order_id;

  v_new_status := CASE
    WHEN v_total_received >= v_total_ordered THEN 'received'
    ELSE 'partial_received'
  END;

  UPDATE purchase_orders
  SET    status     = v_new_status,
         updated_at = now()
  WHERE  id = p_purchase_order_id;

  -- ── 8. Retornar resultado ───────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'receipt_id',     v_receipt_id,
    'receipt_number', v_receipt_number,
    'new_status',     v_new_status
  );

END;
$$;
