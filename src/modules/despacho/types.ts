// ─────────────────────────────────────────────────────────────
// ESTADOS
// ─────────────────────────────────────────────────────────────

export type DispatchStatus = "in_process" | "delivered" | "cancelled";

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  in_process: "En proceso",
  delivered:  "Entregado",
  cancelled:  "Anulado",
};

export const DISPATCH_STATUS_COLORS: Record<DispatchStatus, string> = {
  in_process: "bg-amber-100 text-amber-700 ring-amber-200",
  delivered:  "bg-emerald-100 text-emerald-700 ring-emerald-200",
  cancelled:  "bg-rose-100 text-rose-600 ring-rose-200",
};

// ─────────────────────────────────────────────────────────────
// FACTURAS EMITIDAS PENDIENTES DE DESPACHO
// (status = 'issued', sin pedido de despacho activo)
// ─────────────────────────────────────────────────────────────

export type IssuedInvoiceForDispatch = {
  id: string;
  invoice_number: string;
  customer_name_snapshot: string;
  customer_document_snapshot: string | null;
  customer_phone_snapshot: string | null;
  customer_address_snapshot: string | null;
  subtotal: number;
  total: number;
  issue_date: string | null;
  created_at: string;
  item_count: number;
};

// ─────────────────────────────────────────────────────────────
// PEDIDO DE DESPACHO — LISTADO
// ─────────────────────────────────────────────────────────────

export type DispatchOrderSummary = {
  id: string;
  dispatch_number: string;
  status: DispatchStatus;
  customer_invoice_id: string;
  invoice_number: string;
  customer_name_snapshot: string;
  customer_document_snapshot: string | null;
  shipping_address_snapshot: string | null;
  total: number;
  delivered_at: string | null;
  created_at: string;
};

// ─────────────────────────────────────────────────────────────
// PEDIDO DE DESPACHO — ÍTEM DE DETALLE
// ─────────────────────────────────────────────────────────────

export type DispatchOrderItem = {
  id: string;
  dispatch_order_id: string;
  customer_invoice_item_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  product_name_snapshot: string;
  variant_snapshot: string | null;
  sku_snapshot: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  current_stock: number;   // leído de product_variants en tiempo real
};

// ─────────────────────────────────────────────────────────────
// PEDIDO DE DESPACHO — DETALLE COMPLETO
// ─────────────────────────────────────────────────────────────

export type DispatchOrderDetail = {
  id: string;
  dispatch_number: string;
  status: DispatchStatus;
  customer_invoice_id: string;
  invoice_number: string;
  customer_name_snapshot: string;
  customer_document_snapshot: string | null;
  customer_phone_snapshot: string | null;
  customer_email_snapshot: string | null;
  shipping_address_snapshot: string | null;
  total: number;
  notes: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  items: DispatchOrderItem[];
};

// ─────────────────────────────────────────────────────────────
// RESULTADO DE ACTIONS
// ─────────────────────────────────────────────────────────────

export type DispatchActionResult = {
  success: boolean;
  message: string;
  dispatchId?: string;
  dispatchNumber?: string;
  errors?: string[];
};
