/**
 * Server-side data fetching for the Orden de Compra module.
 * All functions use the Supabase server client and run in Server Components.
 */

import type {
  PurchaseOrderDetail,
  PurchaseOrderListItem,
  PurchaseOrderStatus,
} from "@/modules/orden-compra/types";
import type { SupplierCatalogItem } from "@/modules/proveedores/types";
import type { SupplierRecord } from "@/modules/proveedores/types";

// ─── Listado de OCs ────────────────────────────────────────────────────────────

export async function getPurchaseOrdersList(): Promise<PurchaseOrderListItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(name)")
    .order("created_at", { ascending: false });

  if (error) {
    // Tabla aún no existe en Supabase → devolver vacío en lugar de crash
    if (
      error.message.includes("does not exist") ||
      error.message.includes("relation") ||
      error.code === "42P01"
    ) {
      console.warn("[orden-compra] tablas no encontradas — aplica la migración 001_purchase_orders.sql");
      return [];
    }
    console.error("[orden-compra] error al leer purchase_orders:", error.message);
    return [];
  }

  const rows = (orders ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  // Conteo de ítems por OC
  const orderIds = rows.map((o) => o.id as string);
  const { data: itemRows } = await supabase
    .from("purchase_order_items")
    .select("purchase_order_id")
    .in("purchase_order_id", orderIds);

  const countMap = new Map<string, number>();
  for (const row of itemRows ?? []) {
    const r = row as { purchase_order_id: string };
    countMap.set(r.purchase_order_id, (countMap.get(r.purchase_order_id) ?? 0) + 1);
  }

  return rows.map((o) => {
    const sup = o.suppliers as { name?: string } | null;
    return {
      id: o.id as string,
      order_number: o.order_number as string,
      supplier_id: o.supplier_id as string,
      status: o.status as PurchaseOrderStatus,
      order_date: o.order_date as string,
      expected_date: (o.expected_date as string | null) ?? null,
      notes: (o.notes as string | null) ?? null,
      subtotal: Number(o.subtotal ?? 0),
      total: Number(o.total ?? 0),
      created_by: (o.created_by as string | null) ?? null,
      created_at: o.created_at as string,
      updated_at: o.updated_at as string,
      supplier_name: sup?.name ?? "—",
      item_count: countMap.get(o.id as string) ?? 0,
    };
  });
}

// ─── Detalle de una OC ────────────────────────────────────────────────────────

export async function getPurchaseOrderDetail(
  id: string,
): Promise<PurchaseOrderDetail | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const [orderResult, itemsResult] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("*, suppliers(name, ruc)")
      .eq("id", id)
      .single(),
    supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", id)
      .order("created_at"),
  ]);

  if (orderResult.error || !orderResult.data) {
    if (
      orderResult.error?.message.includes("does not exist") ||
      orderResult.error?.code === "42P01"
    ) {
      console.warn("[orden-compra] tablas no encontradas — aplica la migración");
    }
    return null;
  }

  const o = orderResult.data as Record<string, unknown>;
  const sup = o.suppliers as { name?: string; ruc?: string | null } | null;

  return {
    id: o.id as string,
    order_number: o.order_number as string,
    supplier_id: o.supplier_id as string,
    status: o.status as PurchaseOrderStatus,
    order_date: o.order_date as string,
    expected_date: (o.expected_date as string | null) ?? null,
    notes: (o.notes as string | null) ?? null,
    subtotal: Number(o.subtotal ?? 0),
    total: Number(o.total ?? 0),
    created_by: (o.created_by as string | null) ?? null,
    created_at: o.created_at as string,
    updated_at: o.updated_at as string,
    supplier_name: sup?.name ?? "—",
    supplier_ruc: sup?.ruc ?? null,
    items: (itemsResult.data ?? []) as unknown as import("@/modules/orden-compra/types").PurchaseOrderItem[],
  };
}

// ─── Proveedores activos (para el formulario de nueva OC) ─────────────────────

export async function getActiveSuppliersForOC(): Promise<SupplierRecord[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, ruc, contact_name, phone, email, address, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("[orden-compra] error al leer suppliers:", error.message);
    return [];
  }
  return (data ?? []) as SupplierRecord[];
}

// ─── Catálogo de un proveedor (para el formulario de nueva OC) ────────────────

export async function getCatalogItemsForOC(
  supplierId: string,
): Promise<SupplierCatalogItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("supplier_catalog_items")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("is_active", true)
    .order("product_name");

  if (error) {
    console.error("[orden-compra] error al leer catálogo:", error.message);
    return [];
  }
  return (data ?? []) as SupplierCatalogItem[];
}
