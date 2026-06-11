// ─────────────────────────────────────────────────────────────
// FACTURAS DE PROVEEDOR
// ─────────────────────────────────────────────────────────────

export type SupplierInvoiceStatus = "pending" | "paid" | "cancelled";

export const SUPPLIER_INVOICE_STATUS_LABELS: Record<SupplierInvoiceStatus, string> = {
  pending:   "Pendiente",
  paid:      "Pagado",
  cancelled: "Anulado",
};

export const SUPPLIER_INVOICE_STATUS_COLORS: Record<SupplierInvoiceStatus, string> = {
  pending:   "bg-amber-100 text-amber-700 ring-amber-200",
  paid:      "bg-emerald-100 text-emerald-700 ring-emerald-200",
  cancelled: "bg-rose-100 text-rose-600 ring-rose-200",
};

// ─── Recibos pendientes de facturar ──────────────────────────────────────────

export type ReceiptForInvoicing = {
  id: string;
  receipt_number: string;
  receipt_date: string;        // "YYYY-MM-DD"
  created_at: string;
  purchase_order_id: string;
  order_number: string;
  supplier_id: string;
  supplier_name: string;
  item_count: number;
  total_units: number;
  estimated_cost: number;      // suma de quantity_received × unit_cost
  notes: string | null;
};

// ─── Ítem de factura de proveedor ─────────────────────────────────────────────

export type SupplierInvoiceItem = {
  id: string;
  supplier_invoice_id: string;
  goods_receipt_item_id: string;
  product_name_snapshot: string;
  variant_snapshot: string | null;
  supplier_sku_snapshot: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
};

// ─── Factura de proveedor (listado) ──────────────────────────────────────────

export type SupplierInvoiceListItem = {
  id: string;
  invoice_number: string;
  status: SupplierInvoiceStatus;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  total: number;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  goods_receipt_id: string;
  receipt_number: string;
  supplier_id: string;
  supplier_name: string;
};

// ─── Factura de proveedor (detalle) ──────────────────────────────────────────

export type SupplierInvoiceDetail = SupplierInvoiceListItem & {
  items: SupplierInvoiceItem[];
};

// ─────────────────────────────────────────────────────────────
// FACTURAS A CLIENTES
// ─────────────────────────────────────────────────────────────

export type CustomerInvoiceStatus =
  | "draft"
  | "issued"
  | "cancelled"
  | "partial_dispatched"
  | "dispatched";

export const CUSTOMER_INVOICE_STATUS_LABELS: Record<CustomerInvoiceStatus, string> = {
  draft:              "Borrador",
  issued:             "Emitida",
  cancelled:          "Anulada",
  partial_dispatched: "Desp. parcial",
  dispatched:         "Despachada",
};

export const CUSTOMER_INVOICE_STATUS_COLORS: Record<CustomerInvoiceStatus, string> = {
  draft:              "bg-slate-100 text-slate-600 ring-slate-200",
  issued:             "bg-sky-100 text-sky-700 ring-sky-200",
  cancelled:          "bg-rose-100 text-rose-600 ring-rose-200",
  partial_dispatched: "bg-amber-100 text-amber-700 ring-amber-200",
  dispatched:         "bg-emerald-100 text-emerald-700 ring-emerald-200",
};

// ─── Ítem de factura a cliente ────────────────────────────────────────────────

export type CustomerInvoiceItem = {
  id: string;
  customer_invoice_id: string;
  product_variant_id: string | null;
  product_name_snapshot: string;
  variant_snapshot: string | null;
  sku_snapshot: string | null;
  quantity: number;
  unit_price_snapshot: number;
  line_total: number;
};

// ─── Factura a cliente (listado) ──────────────────────────────────────────────

export type CustomerInvoiceListItem = {
  id: string;
  invoice_number: string;
  status: CustomerInvoiceStatus;
  customer_name_snapshot: string;
  customer_document_snapshot: string | null;
  subtotal: number;
  total: number;
  issue_date: string | null;
  created_at: string;
  item_count: number;
};

// ─── Factura a cliente (detalle) ──────────────────────────────────────────────

export type CustomerInvoiceDetail = {
  id: string;
  invoice_number: string;
  status: CustomerInvoiceStatus;
  customer_name_snapshot: string;
  customer_document_snapshot: string | null;
  customer_phone_snapshot: string | null;
  customer_email_snapshot: string | null;
  customer_address_snapshot: string | null;
  subtotal: number;
  total: number;
  notes: string | null;
  issue_date: string | null;
  created_at: string;
  updated_at: string;
  items: CustomerInvoiceItem[];
};

// ─── Variante disponible para facturar ────────────────────────────────────────

export type ProductVariantForInvoice = {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_label: string;    // "Rojo · M" o nombre del producto si sin atributos
  sku: string;
  sale_price: number;
  stock: number;
};

// ─────────────────────────────────────────────────────────────
// PAYLOADS PARA ACTIONS
// ─────────────────────────────────────────────────────────────

export type CustomerInvoiceItemInput = {
  variantId: string;
  quantity: number;
};

export type SaveCustomerInvoicePayload = {
  customerName: string;
  customerDocument: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  notes: string;
  items: CustomerInvoiceItemInput[];
};

export type InvoiceActionResult = {
  success: boolean;
  message: string;
  invoiceId?: string;
  invoiceNumber?: string;
  errors?: string[];
};
