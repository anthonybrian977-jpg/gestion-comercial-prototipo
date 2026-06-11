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
  /** ID del ítem de OC que se está recibiendo */
  purchaseOrderItemId: string;
  /** Cantidad que se recibe EN ESTE INGRESO (no el acumulado) */
  quantityReceived: number;
  /** Nota opcional del receptor para este ítem */
  notes: string;
  // El RPC lee desde purchase_order_items todos los demás datos
  // (linked_*_id, snapshots, unit_cost). El cliente no los envía.
};

// ─── Historial de ingresos — resumen por fila ────────────────────────────────

export type GoodsReceiptHistorySummary = {
  id: string;
  receipt_number: string;
  purchase_order_id: string;
  order_number: string;
  supplier_name: string;
  receipt_date: string;
  created_at: string;
  /** Unidades sumadas en este ingreso puntual */
  received_in_this_receipt: number;
  /** Total ordenado en la OC */
  ordered_total: number;
  /** Acumulado recibido de la OC hasta e incluyendo este ingreso */
  received_cumulative_after_receipt: number;
  /** Pendiente de la OC justo después de este ingreso */
  pending_after_receipt: number;
  /** Estado de la OC justo después de este ingreso */
  status_after_receipt: "complete" | "partial";
};

// ─── Historial de ingresos — detalle ─────────────────────────────────────────

export type GoodsReceiptDetailItem = {
  id: string;
  purchase_order_item_id: string | null;
  product_name_snapshot: string;
  variant_snapshot: string | null;
  supplier_sku_snapshot: string | null;
  quantity_received: number;
  unit_cost: number | null;
  notes: string | null;
};

export type GoodsReceiptDetailHeader = {
  id: string;
  receipt_number: string;
  purchase_order_id: string;
  order_number: string;
  supplier_name: string;
  receipt_date: string;
  created_at: string;
  notes: string | null;
  received_in_this_receipt: number;
  ordered_total: number;
  received_cumulative_after_receipt: number;
  pending_after_receipt: number;
  status_after_receipt: "complete" | "partial";
  items: GoodsReceiptDetailItem[];
};

// ─── Resultado de server action ───────────────────────────────────────────────

export type GoodsReceiptActionResult = {
  success: boolean;
  message: string;
  receiptId?: string;
  receiptNumber?: string;
  errors?: string[];
};
