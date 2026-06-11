// ─── OC disponible para recibir (listado) ────────────────────────────────────

export type ReceivableOrder = {
  id: string;
  order_number: string;
  supplier_id: string;
  supplier_name: string;
  order_date: string;
  status: "issued" | "partial_received";
  total_ordered: number;
  total_received: number;
  total_pending: number;
  items_count: number;
};

// ─── Ítem de OC para el formulario de recepción ───────────────────────────────

export type ReceivableItem = {
  id: string;                          // purchase_order_item.id
  purchase_order_id: string;
  product_name_snapshot: string;
  brand_snapshot: string | null;
  color_snapshot: string | null;
  size_snapshot: string | null;
  presentation_snapshot: string | null;
  supplier_sku_snapshot: string | null;
  linked_product_id: string | null;
  linked_variant_id: string | null;
  quantity_ordered: number;
  quantity_received: number;           // acumulado hasta ahora
  quantity_pending: number;            // calculado: ordered − received
  unit_cost: number;
};

// ─── Detalle de OC para la pantalla de recepción ─────────────────────────────

export type ReceivableOrderDetail = {
  id: string;
  order_number: string;
  supplier_id: string;
  supplier_name: string;
  supplier_ruc: string | null;
  order_date: string;
  expected_date: string | null;
  status: string;
  notes: string | null;
  items: ReceivableItem[];
};

// ─── Payload para confirmar ingreso ──────────────────────────────────────────

export type ConfirmReceiptPayload = {
  purchaseOrderId: string;
  receiptDate: string;
  notes: string;
  items: ConfirmReceiptItemPayload[];
};

export type ConfirmReceiptItemPayload = {
  purchaseOrderItemId: string;
  linkedProductId: string;
  linkedVariantId: string;
  productNameSnapshot: string;
  /** "color · talla · presentación" combinado (puede ser vacío) */
  variantSnapshot: string;
  supplierSkuSnapshot: string | null;
  /** Cantidad que se recibe EN ESTE INGRESO (no el acumulado) */
  quantityReceived: number;
  unitCost: number;
  notes: string;
};

// ─── Resultado de server action ───────────────────────────────────────────────

export type GoodsReceiptActionResult = {
  success: boolean;
  message: string;
  receiptId?: string;
  receiptNumber?: string;
  errors?: string[];
};
