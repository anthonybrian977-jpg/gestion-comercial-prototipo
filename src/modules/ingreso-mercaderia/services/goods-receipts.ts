import type {
  ReceivableOrder,
  ReceivableOrderDetail,
  ReceivableItem,
  GoodsReceiptHistorySummary,
  GoodsReceiptDetailHeader,
  GoodsReceiptDetailItem,
} from "@/modules/ingreso-mercaderia/types";

// ─── Listado de OCs disponibles para recibir ─────────────────────────────────
/**
 * Retorna purchase_orders en estado "issued" o "partial_received",
 * con totales calculados desde sus ítems.
 * Si las tablas no existen (migración no aplicada) retorna [] con console.warn.
 */
export async function getReceivableOrders(): Promise<ReceivableOrder[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      `id, order_number, order_date, status, supplier_id,
       suppliers(name),
       purchase_order_items(quantity_ordered, quantity_received)`,
    )
    .in("status", ["issued", "partial_received"])
    .order("order_date", { ascending: false });

  if (error) {
    console.warn("[getReceivableOrders] error:", error.message);
    return [];
  }

  return (data ?? []).map((oc) => {
    const items = (
      oc.purchase_order_items as { quantity_ordered: number; quantity_received: number }[]
    ) ?? [];
    const supplierRaw = Array.isArray(oc.suppliers) ? oc.suppliers[0] : oc.suppliers;
    const supplier_name =
      (supplierRaw as { name: string } | null)?.name ?? "Desconocido";

    const total_ordered = items.reduce((s, i) => s + i.quantity_ordered, 0);
    const total_received = items.reduce((s, i) => s + i.quantity_received, 0);

    return {
      id: oc.id as string,
      order_number: oc.order_number as string,
      supplier_id: oc.supplier_id as string,
      supplier_name,
      order_date: oc.order_date as string,
      status: oc.status as "issued" | "partial_received",
      total_ordered,
      total_received,
      total_pending: total_ordered - total_received,
      items_count: items.length,
    };
  });
}

// ─── Detalle de una OC para el formulario de recepción ───────────────────────
/**
 * Carga una OC con todos sus ítems y calcula quantity_pending por ítem.
 * Retorna null si no existe.
 * No filtra por estado — la pantalla decide si bloquear la UI.
 */
export async function getOrderForReceipt(
  purchaseOrderId: string,
): Promise<ReceivableOrderDetail | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: ocRaw, error } = await supabase
    .from("purchase_orders")
    .select(
      `id, order_number, order_date, expected_date, status, notes, supplier_id,
       suppliers(name, ruc),
       purchase_order_items(
         id, purchase_order_id,
         product_name_snapshot, brand_snapshot,
         color_snapshot, size_snapshot, presentation_snapshot,
         supplier_sku_snapshot,
         linked_product_id, linked_variant_id,
         quantity_ordered, quantity_received, unit_cost
       )`,
    )
    .eq("id", purchaseOrderId)
    .single();

  if (error || !ocRaw) return null;

  const oc = ocRaw as Record<string, unknown>;
  const supplierRaw = Array.isArray(oc.suppliers) ? (oc.suppliers as unknown[])[0] : oc.suppliers;
  const supplier = supplierRaw as { name: string; ruc: string | null } | null;

  const rawItems = (oc.purchase_order_items as Record<string, unknown>[]) ?? [];

  const items: ReceivableItem[] = rawItems.map((item) => {
    const qty_ordered = (item.quantity_ordered as number) ?? 0;
    const qty_received = (item.quantity_received as number) ?? 0;
    return {
      id: item.id as string,
      purchase_order_id: item.purchase_order_id as string,
      product_name_snapshot: item.product_name_snapshot as string,
      brand_snapshot: (item.brand_snapshot as string | null) ?? null,
      color_snapshot: (item.color_snapshot as string | null) ?? null,
      size_snapshot: (item.size_snapshot as string | null) ?? null,
      presentation_snapshot: (item.presentation_snapshot as string | null) ?? null,
      supplier_sku_snapshot: (item.supplier_sku_snapshot as string | null) ?? null,
      linked_product_id: (item.linked_product_id as string | null) ?? null,
      linked_variant_id: (item.linked_variant_id as string | null) ?? null,
      quantity_ordered: qty_ordered,
      quantity_received: qty_received,
      quantity_pending: qty_ordered - qty_received,
      unit_cost: (item.unit_cost as number) ?? 0,
    };
  });

  return {
    id: oc.id as string,
    order_number: oc.order_number as string,
    supplier_id: oc.supplier_id as string,
    supplier_name: supplier?.name ?? "Desconocido",
    supplier_ruc: supplier?.ruc ?? null,
    order_date: oc.order_date as string,
    expected_date: (oc.expected_date as string | null) ?? null,
    status: oc.status as string,
    notes: (oc.notes as string | null) ?? null,
    items,
  };
}

// ─── Historial de todos los ingresos registrados ──────────────────────────────
/**
 * Retorna todos los goods_receipts con cálculo histórico del avance de cada OC.
 *
 * Para cada ingreso calcula:
 *   received_in_this_receipt         — unidades sumadas en ese ingreso puntual
 *   ordered_total                    — total pedido en la OC
 *   received_cumulative_after_receipt — acumulado de todos los ingresos de la
 *                                       misma OC con created_at ≤ este ingreso
 *   pending_after_receipt            — pendiente justo después de este ingreso
 *   status_after_receipt             — "complete" | "partial"
 *
 * Retorna [] (con console.warn) si las tablas aún no existen.
 */
export async function getGoodsReceiptHistory(): Promise<GoodsReceiptHistorySummary[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: raw, error } = await supabase
    .from("goods_receipts")
    .select(
      `id, receipt_number, purchase_order_id, receipt_date, created_at,
       suppliers(name),
       purchase_orders(order_number, purchase_order_items(quantity_ordered)),
       goods_receipt_items(quantity_received)`,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[getGoodsReceiptHistory] error:", error.message);
    return [];
  }

  type HistRow = {
    id: string;
    receipt_number: string;
    purchase_order_id: string;
    receipt_date: string;
    created_at: string;
    suppliers: { name: string } | { name: string }[] | null;
    purchase_orders:
      | { order_number: string; purchase_order_items: { quantity_ordered: number }[] }
      | { order_number: string; purchase_order_items: { quantity_ordered: number }[] }[]
      | null;
    goods_receipt_items: { quantity_received: number }[] | null;
  };

  const rows = (raw ?? []) as unknown as HistRow[];

  // ── Pre-calcular totales por ingreso ─────────────────────────────────────────
  const receiptTotals = new Map<string, number>();
  for (const r of rows) {
    const items = Array.isArray(r.goods_receipt_items) ? r.goods_receipt_items : [];
    receiptTotals.set(r.id, items.reduce((s, i) => s + i.quantity_received, 0));
  }

  // ── Agrupar ingresos por OC para el cálculo acumulado ────────────────────────
  const receiptsByOrder = new Map<string, { id: string; created_at: string; total: number }[]>();
  for (const r of rows) {
    const entry = { id: r.id, created_at: r.created_at, total: receiptTotals.get(r.id) ?? 0 };
    const arr = receiptsByOrder.get(r.purchase_order_id) ?? [];
    arr.push(entry);
    receiptsByOrder.set(r.purchase_order_id, arr);
  }

  return rows.map((r) => {
    // Resolver nombre de proveedor (Supabase puede devolver objeto o array)
    const suppRaw = r.suppliers;
    const supplierName = Array.isArray(suppRaw)
      ? (suppRaw[0]?.name ?? "—")
      : ((suppRaw as { name: string } | null)?.name ?? "—");

    // Resolver datos de la OC
    const poRaw = Array.isArray(r.purchase_orders) ? r.purchase_orders[0] : r.purchase_orders;
    const orderNumber = poRaw?.order_number ?? "—";
    const poItems = Array.isArray(poRaw?.purchase_order_items) ? poRaw!.purchase_order_items : [];
    const orderedTotal = poItems.reduce((s, i) => s + i.quantity_ordered, 0);

    const receivedInThisReceipt = receiptTotals.get(r.id) ?? 0;

    // Acumulado: suma de todos los ingresos de la misma OC con created_at ≤ este
    // Las timestamps ISO se comparan lexicográficamente (orden cronológico correcto)
    const sameOrderList = receiptsByOrder.get(r.purchase_order_id) ?? [];
    const receivedCumulative = sameOrderList
      .filter((x) => x.created_at <= r.created_at)
      .reduce((s, x) => s + x.total, 0);

    const pendingAfterReceipt = Math.max(0, orderedTotal - receivedCumulative);

    return {
      id: r.id,
      receipt_number: r.receipt_number,
      purchase_order_id: r.purchase_order_id,
      order_number: orderNumber,
      supplier_name: supplierName,
      receipt_date: r.receipt_date,
      created_at: r.created_at,
      received_in_this_receipt: receivedInThisReceipt,
      ordered_total: orderedTotal,
      received_cumulative_after_receipt: receivedCumulative,
      pending_after_receipt: pendingAfterReceipt,
      status_after_receipt: (pendingAfterReceipt <= 0 ? "complete" : "partial") as
        | "complete"
        | "partial",
    };
  });
}

// ─── Detalle de un ingreso específico ────────────────────────────────────────
/**
 * Retorna el detalle completo de un goods_receipt:
 * cabecera + ítems + cálculo histórico del avance de la OC.
 * Retorna null si no existe.
 */
export async function getGoodsReceiptDetail(
  receiptId: string,
): Promise<GoodsReceiptDetailHeader | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // ── 1. Cabecera + ítems del ingreso ──────────────────────────────────────────
  const { data: raw, error } = await supabase
    .from("goods_receipts")
    .select(
      `id, receipt_number, purchase_order_id, receipt_date, created_at, notes,
       suppliers(name),
       purchase_orders(order_number, purchase_order_items(quantity_ordered)),
       goods_receipt_items(
         id, purchase_order_item_id,
         product_name_snapshot, variant_snapshot, supplier_sku_snapshot,
         quantity_received, unit_cost, notes
       )`,
    )
    .eq("id", receiptId)
    .single();

  if (error || !raw) return null;

  type DetailRaw = {
    id: string;
    receipt_number: string;
    purchase_order_id: string;
    receipt_date: string;
    created_at: string;
    notes: string | null;
    suppliers: { name: string } | { name: string }[] | null;
    purchase_orders:
      | { order_number: string; purchase_order_items: { quantity_ordered: number }[] }
      | { order_number: string; purchase_order_items: { quantity_ordered: number }[] }[]
      | null;
    goods_receipt_items: {
      id: string;
      purchase_order_item_id: string | null;
      product_name_snapshot: string;
      variant_snapshot: string | null;
      supplier_sku_snapshot: string | null;
      quantity_received: number;
      unit_cost: number | null;
      notes: string | null;
    }[];
  };

  const r = raw as unknown as DetailRaw;

  // Resolver proveedor
  const suppRaw = r.suppliers;
  const supplierName = Array.isArray(suppRaw)
    ? (suppRaw[0]?.name ?? "—")
    : ((suppRaw as { name: string } | null)?.name ?? "—");

  // Resolver OC
  const poRaw = Array.isArray(r.purchase_orders) ? r.purchase_orders[0] : r.purchase_orders;
  const orderNumber = poRaw?.order_number ?? "—";
  const poItems = Array.isArray(poRaw?.purchase_order_items) ? poRaw!.purchase_order_items : [];
  const orderedTotal = poItems.reduce((s, i) => s + i.quantity_ordered, 0);

  const items: GoodsReceiptDetailItem[] = (Array.isArray(r.goods_receipt_items)
    ? r.goods_receipt_items
    : []
  ).map((i) => ({
    id: i.id,
    purchase_order_item_id: i.purchase_order_item_id,
    product_name_snapshot: i.product_name_snapshot,
    variant_snapshot: i.variant_snapshot,
    supplier_sku_snapshot: i.supplier_sku_snapshot,
    quantity_received: i.quantity_received,
    unit_cost: i.unit_cost,
    notes: i.notes,
  }));

  const receivedInThisReceipt = items.reduce((s, i) => s + i.quantity_received, 0);

  // ── 2. Acumulado: todos los ingresos de la misma OC con created_at ≤ este ────
  const { data: prevRaw } = await supabase
    .from("goods_receipts")
    .select("goods_receipt_items(quantity_received)")
    .eq("purchase_order_id", r.purchase_order_id)
    .lte("created_at", r.created_at);

  const receivedCumulative = prevRaw
    ? (prevRaw as unknown as { goods_receipt_items: { quantity_received: number }[] }[]).reduce(
        (sum, gr) => {
          const grItems = Array.isArray(gr.goods_receipt_items) ? gr.goods_receipt_items : [];
          return sum + grItems.reduce((s, i) => s + i.quantity_received, 0);
        },
        0,
      )
    : receivedInThisReceipt;

  const pendingAfterReceipt = Math.max(0, orderedTotal - receivedCumulative);

  return {
    id: r.id,
    receipt_number: r.receipt_number,
    purchase_order_id: r.purchase_order_id,
    order_number: orderNumber,
    supplier_name: supplierName,
    receipt_date: r.receipt_date,
    created_at: r.created_at,
    notes: r.notes,
    received_in_this_receipt: receivedInThisReceipt,
    ordered_total: orderedTotal,
    received_cumulative_after_receipt: receivedCumulative,
    pending_after_receipt: pendingAfterReceipt,
    status_after_receipt: pendingAfterReceipt <= 0 ? "complete" : "partial",
    items,
  };
}
