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

-- ─── RPC transaccional: confirm_goods_receipt ─────────────────────────────────
-- Para producción: usar esta función en lugar del server action de TypeScript.
-- Garantiza atomicidad: si cualquier paso falla, hace ROLLBACK completo.
--
-- Parámetro p_items es un array JSONB con objetos:
-- {
--   purchase_order_item_id: uuid,
--   linked_product_id: uuid,
--   linked_variant_id: uuid,
--   product_name_snapshot: text,
--   variant_snapshot: text,       (nullable)
--   supplier_sku_snapshot: text,  (nullable)
--   quantity_received: integer,
--   unit_cost: numeric,
--   notes: text                   (nullable)
-- }
CREATE OR REPLACE FUNCTION confirm_goods_receipt(
  p_purchase_order_id   uuid,
  p_supplier_id         uuid,
  p_receipt_date        date,
  p_notes               text,
  p_created_by          uuid,
  p_items               jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_receipt_id      uuid;
  v_receipt_number  text;
  v_item            jsonb;
  v_stock_before    integer;
  v_stock_after     integer;
  v_total_ordered   integer;
  v_total_received  integer;
  v_new_status      text;
BEGIN
  -- 1. Número de ingreso
  v_receipt_number := generate_goods_receipt_number();

  -- 2. Crear cabecera
  INSERT INTO goods_receipts (
    receipt_number, purchase_order_id, supplier_id,
    receipt_date, notes, created_by
  ) VALUES (
    v_receipt_number, p_purchase_order_id, p_supplier_id,
    p_receipt_date, p_notes, p_created_by
  )
  RETURNING id INTO v_receipt_id;

  -- 3. Procesar ítems
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Detalle
    INSERT INTO goods_receipt_items (
      goods_receipt_id, purchase_order_item_id,
      linked_product_id, linked_variant_id,
      product_name_snapshot, variant_snapshot, supplier_sku_snapshot,
      quantity_received, unit_cost, notes
    ) VALUES (
      v_receipt_id,
      (v_item->>'purchase_order_item_id')::uuid,
      (v_item->>'linked_product_id')::uuid,
      (v_item->>'linked_variant_id')::uuid,
      v_item->>'product_name_snapshot',
      v_item->>'variant_snapshot',
      v_item->>'supplier_sku_snapshot',
      (v_item->>'quantity_received')::integer,
      (v_item->>'unit_cost')::numeric,
      v_item->>'notes'
    );

    -- Leer stock con bloqueo (evita race conditions)
    SELECT stock INTO v_stock_before
    FROM product_variants
    WHERE id = (v_item->>'linked_variant_id')::uuid
    FOR UPDATE;

    v_stock_after := v_stock_before + (v_item->>'quantity_received')::integer;

    -- Actualizar stock
    UPDATE product_variants
    SET stock = v_stock_after
    WHERE id = (v_item->>'linked_variant_id')::uuid;

    -- Auditoría
    INSERT INTO stock_movements (
      product_id, variant_id,
      movement_type, source_type, source_id,
      quantity_delta, stock_before, stock_after, notes
    ) VALUES (
      (v_item->>'linked_product_id')::uuid,
      (v_item->>'linked_variant_id')::uuid,
      'in', 'goods_receipt', v_receipt_id,
      (v_item->>'quantity_received')::integer,
      v_stock_before, v_stock_after,
      'Ingreso de mercadería ' || v_receipt_number
    );

    -- Actualizar acumulado en OC
    UPDATE purchase_order_items
    SET quantity_received = quantity_received + (v_item->>'quantity_received')::integer
    WHERE id = (v_item->>'purchase_order_item_id')::uuid;
  END LOOP;

  -- 4. Calcular nuevo estado de la OC
  SELECT SUM(quantity_ordered), SUM(quantity_received)
  INTO v_total_ordered, v_total_received
  FROM purchase_order_items
  WHERE purchase_order_id = p_purchase_order_id;

  v_new_status := CASE
    WHEN v_total_received >= v_total_ordered THEN 'received'
    ELSE 'partial_received'
  END;

  UPDATE purchase_orders
  SET status = v_new_status, updated_at = now()
  WHERE id = p_purchase_order_id;

  RETURN jsonb_build_object(
    'receipt_id',     v_receipt_id,
    'receipt_number', v_receipt_number,
    'new_status',     v_new_status
  );
END;
$$;
