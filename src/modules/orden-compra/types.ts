// ─── Estados posibles de una Orden de Compra ─────────────────────────────────

export type PurchaseOrderStatus =
  | "draft"           // Borrador — editable, no vincula al Maestro
  | "issued"          // Emitida — productos creados/vinculados en Maestro, stock=0
  | "partial_received" // Recepción parcial — futuro (Ingreso de Mercadería)
  | "received"        // Recibida completa — futuro
  | "cancelled";      // Anulada

export const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft:            "Borrador",
  issued:           "Emitida",
  partial_received: "Recep. parcial",
  received:         "Recibida",
  cancelled:        "Anulada",
};

export const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft:            "bg-slate-100 text-slate-600 ring-slate-200",
  issued:           "bg-sky-100 text-sky-700 ring-sky-200",
  partial_received: "bg-amber-100 text-amber-700 ring-amber-200",
  received:         "bg-emerald-100 text-emerald-700 ring-emerald-200",
  cancelled:        "bg-rose-100 text-rose-600 ring-rose-200",
};

// ─── Registro de Orden de Compra (tabla purchase_orders) ─────────────────────

export type PurchaseOrder = {
  id: string;
  order_number: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  order_date: string;          // "YYYY-MM-DD"
  expected_date: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Ítem de Orden de Compra (tabla purchase_order_items) ────────────────────

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  supplier_catalog_item_id: string | null;
  linked_product_id: string | null;
  linked_variant_id: string | null;
  // Snapshots (datos al momento de crear la OC, no cambian)
  supplier_sku_snapshot: string | null;
  product_name_snapshot: string;
  brand_snapshot: string | null;
  model_snapshot: string | null;
  category_snapshot: string | null;
  presentation_snapshot: string | null;
  color_snapshot: string | null;
  size_snapshot: string | null;
  // Cantidades y costos
  quantity_ordered: number;
  quantity_received: number;   // siempre 0 hasta Ingreso de Mercadería
  unit_cost: number;
  line_total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Vistas enriquecidas ──────────────────────────────────────────────────────

/** Para el listado de OCs (con datos del proveedor y conteo de ítems) */
export type PurchaseOrderListItem = PurchaseOrder & {
  supplier_name: string;
  item_count: number;
};

/** Para el detalle completo de una OC */
export type PurchaseOrderDetail = PurchaseOrder & {
  supplier_name: string;
  supplier_ruc: string | null;
  items: PurchaseOrderItem[];
};

// ─── Cart (estado client-side antes de guardar) ───────────────────────────────

/** Ítem en el carrito de la pantalla de creación de OC */
export type CartItem = {
  catalogItemId: string;
  supplierSku: string | null;
  productName: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  presentation: string | null;
  color: string | null;
  size: string | null;
  /** Precio sugerido del catálogo — puede ser editado por el usuario */
  unitCost: number;
  quantity: number;
  notes: string;
};

// ─── Payload para server actions ─────────────────────────────────────────────

export type SaveDraftPayload = {
  orderId?: string;  // undefined = nueva OC, string = actualizar borrador existente
  supplierId: string;
  orderDate: string;
  expectedDate: string;
  notes: string;
  items: CartItem[];
};

export type PurchaseOrderActionResult = {
  success: boolean;
  message: string;
  orderId?: string;
  errors?: string[];
};
