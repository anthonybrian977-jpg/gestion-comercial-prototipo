import type { ReceivableOrder, ReceivableOrderDetail, ReceivableItem } from "@/modules/ingreso-mercaderia/types";

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
