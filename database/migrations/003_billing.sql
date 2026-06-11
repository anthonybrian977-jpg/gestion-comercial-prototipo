-- ============================================================
-- Migración 003: Facturación Fase 1
-- PROPUESTA — NO aplicar hasta aprobación del equipo.
-- ============================================================
-- Crea 4 tablas nuevas + 2 funciones de numeración + RLS.
-- Requiere que 001 y 002 ya estén aplicadas.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FACTURAS DE PROVEEDOR (Cuentas por pagar)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number      text          NOT NULL UNIQUE,              -- FP-2026-001
  goods_receipt_id    uuid          NOT NULL UNIQUE               -- 1 factura por recibo
                                      REFERENCES public.goods_receipts(id) ON DELETE RESTRICT,
  supplier_id         uuid          NOT NULL
                                      REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status              text          NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'paid', 'cancelled')),
  invoice_date        date          NOT NULL DEFAULT current_date,
  due_date            date,                                       -- vencimiento opcional
  subtotal            numeric(12,2) NOT NULL DEFAULT 0,
  -- igv              numeric(12,2) NOT NULL DEFAULT 0,           -- TODO: agregar IGV cuando se requiera
  total               numeric(12,2) NOT NULL DEFAULT 0,
  notes               text,
  paid_at             timestamptz,                                -- se llena cuando status → paid
  created_by          uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_invoice_items (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id     uuid          NOT NULL
                                          REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  goods_receipt_item_id   uuid          NOT NULL
                                          REFERENCES public.goods_receipt_items(id) ON DELETE RESTRICT,
  -- Snapshots capturados desde goods_receipt_items al crear la factura
  product_name_snapshot   text          NOT NULL,
  variant_snapshot        text,
  supplier_sku_snapshot   text,
  quantity                integer       NOT NULL CHECK (quantity > 0),
  unit_cost               numeric(12,2) NOT NULL DEFAULT 0,
  line_total              numeric(12,2) NOT NULL DEFAULT 0,
  created_at              timestamptz   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- FACTURAS A CLIENTES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_invoices (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number              text          NOT NULL UNIQUE,       -- FC-2026-001
  status                      text          NOT NULL DEFAULT 'draft'
                                              CHECK (status IN (
                                                'draft', 'issued', 'cancelled',
                                                'partial_dispatched', 'dispatched'
                                              )),
  -- Snapshot del cliente (los datos del cliente al momento de facturar no cambian)
  customer_name_snapshot      text          NOT NULL,
  customer_document_snapshot  text,                               -- DNI / RUC
  customer_phone_snapshot     text,
  customer_email_snapshot     text,
  customer_address_snapshot   text,
  -- Financiero
  subtotal                    numeric(12,2) NOT NULL DEFAULT 0,
  -- igv                      numeric(12,2) NOT NULL DEFAULT 0,   -- TODO: agregar IGV cuando se requiera
  total                       numeric(12,2) NOT NULL DEFAULT 0,
  notes                       text,
  issue_date                  date,                               -- se llena cuando status → issued
  created_by                  uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_invoice_items (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_invoice_id     uuid          NOT NULL
                                          REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  product_variant_id      uuid                                    -- nullable: la variante podría eliminarse luego
                                          REFERENCES public.product_variants(id) ON DELETE SET NULL,
  -- Snapshots (precio y nombre capturados al facturar — cambios futuros no afectan esta factura)
  product_name_snapshot   text          NOT NULL,
  variant_snapshot        text,
  sku_snapshot            text,
  quantity                integer       NOT NULL CHECK (quantity > 0),
  unit_price_snapshot     numeric(12,2) NOT NULL,                 -- sale_price en el momento de facturar
  line_total              numeric(12,2) NOT NULL,
  created_at              timestamptz   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- FUNCIONES DE NUMERACIÓN
-- ─────────────────────────────────────────────────────────────

-- Genera el siguiente número de factura de proveedor: FP-YYYY-NNN
CREATE OR REPLACE FUNCTION public.generate_supplier_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year  text;
  v_count integer;
BEGIN
  v_year := to_char(now() AT TIME ZONE 'America/Lima', 'YYYY');
  SELECT COUNT(*) INTO v_count
    FROM public.supplier_invoices
   WHERE invoice_number LIKE 'FP-' || v_year || '-%';
  RETURN 'FP-' || v_year || '-' || lpad((v_count + 1)::text, 3, '0');
END;
$$;

-- Genera el siguiente número de factura a cliente: FC-YYYY-NNN
CREATE OR REPLACE FUNCTION public.generate_customer_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year  text;
  v_count integer;
BEGIN
  v_year := to_char(now() AT TIME ZONE 'America/Lima', 'YYYY');
  SELECT COUNT(*) INTO v_count
    FROM public.customer_invoices
   WHERE invoice_number LIKE 'FC-' || v_year || '-%';
  RETURN 'FC-' || v_year || '-' || lpad((v_count + 1)::text, 3, '0');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_si_goods_receipt_id
  ON public.supplier_invoices(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_si_supplier_id
  ON public.supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_si_status
  ON public.supplier_invoices(status);
CREATE INDEX IF NOT EXISTS idx_si_created_at
  ON public.supplier_invoices(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sii_invoice_id
  ON public.supplier_invoice_items(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_sii_receipt_item_id
  ON public.supplier_invoice_items(goods_receipt_item_id);

CREATE INDEX IF NOT EXISTS idx_ci_status
  ON public.customer_invoices(status);
CREATE INDEX IF NOT EXISTS idx_ci_created_at
  ON public.customer_invoices(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cii_invoice_id
  ON public.customer_invoice_items(customer_invoice_id);
CREATE INDEX IF NOT EXISTS idx_cii_variant_id
  ON public.customer_invoice_items(product_variant_id);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.supplier_invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_invoice_items  ENABLE ROW LEVEL SECURITY;

-- Solo usuarios registrados en app_users pueden operar
-- (mismo patrón que las migraciones 001 y 002)

CREATE POLICY "si_select" ON public.supplier_invoices
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.app_users));
CREATE POLICY "si_insert" ON public.supplier_invoices
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.app_users));
CREATE POLICY "si_update" ON public.supplier_invoices
  FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM public.app_users));

CREATE POLICY "sii_select" ON public.supplier_invoice_items
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.app_users));
CREATE POLICY "sii_insert" ON public.supplier_invoice_items
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.app_users));

CREATE POLICY "ci_select" ON public.customer_invoices
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.app_users));
CREATE POLICY "ci_insert" ON public.customer_invoices
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.app_users));
CREATE POLICY "ci_update" ON public.customer_invoices
  FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM public.app_users));

CREATE POLICY "cii_select" ON public.customer_invoice_items
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.app_users));
CREATE POLICY "cii_insert" ON public.customer_invoice_items
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.app_users));
CREATE POLICY "cii_update" ON public.customer_invoice_items
  FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM public.app_users));
