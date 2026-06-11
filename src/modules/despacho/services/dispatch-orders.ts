/**
 * Server-side data fetching para Despacho.
 * Si las tablas no existen (migración pendiente) retorna [] con console.warn.
 */

import type {
  IssuedInvoiceForDispatch,
  DispatchOrderSummary,
  DispatchOrderDetail,
  DispatchOrderItem,
  DispatchStatus,
} from "@/modules/despacho/types";

// ─── Helper ───────────────────────────────────────────────────────────────────

function isMissingTable(err: { message: string; code?: string }): boolean {
  return (
    err.message.includes("does not exist") ||
    err.message.includes("relation") ||
    err.code === "42P01"
  );
}

// ─── Facturas emitidas sin pedido de despacho ─────────────────────────────────
/**
 * Retorna customer_invoices con status = 'issued' que no tienen todavía
 * ningún dispatch_order asociado.
 */
export async function getIssuedInvoicesWithoutDispatch(): Promise<IssuedInvoiceForDispatch[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Facturas emitidas
  const { data: invoices, error: invErr } = await supabase
    .from("customer_invoices")
    .select(
      `id, invoice_number, customer_name_snapshot, customer_document_snapshot,
       customer_phone_snapshot, customer_address_snapshot,
       subtotal, total, issue_date, created_at`,
    )
    .eq("status", "issued")
    .order("created_at", { ascending: false });

  if (invErr) {
    if (isMissingTable(invErr)) {
      console.warn("[despacho] customer_invoices no encontrado — aplica las migraciones");
      return [];
    }
    console.error("[getIssuedInvoicesWithoutDispatch]", invErr.message);
    return [];
  }

  if (!invoices || invoices.length === 0) return [];

  // IDs de facturas que ya tienen pedido de despacho (cualquier estado)
  const { data: dispatches, error: dispErr } = await supabase
    .from("dispatch_orders")
    .select("customer_invoice_id");

  if (dispErr && !isMissingTable(dispErr)) {
    console.error("[getIssuedInvoicesWithoutDispatch] dispatch_orders:", dispErr.message);
  }

  const dispatchedIds = new Set<string>(
    (dispatches ?? []).map((d) => (d as { customer_invoice_id: string }).customer_invoice_id),
  );

  // Conteo de ítems por factura
  const ids = invoices.map((i) => (i as { id: string }).id);
  const { data: itemRows } = await supabase
    .from("customer_invoice_items")
    .select("customer_invoice_id")
    .in("customer_invoice_id", ids);

  const countMap = new Map<string, number>();
  for (const row of itemRows ?? []) {
    const r = row as { customer_invoice_id: string };
    countMap.set(r.customer_invoice_id, (countMap.get(r.customer_invoice_id) ?? 0) + 1);
  }

  return invoices
    .filter((inv) => !dispatchedIds.has((inv as { id: string }).id))
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        invoice_number: r.invoice_number as string,
        customer_name_snapshot: r.customer_name_snapshot as string,
        customer_document_snapshot: (r.customer_document_snapshot as string | null) ?? null,
        customer_phone_snapshot: (r.customer_phone_snapshot as string | null) ?? null,
        customer_address_snapshot: (r.customer_address_snapshot as string | null) ?? null,
        subtotal: Number(r.subtotal ?? 0),
        total: Number(r.total ?? 0),
        issue_date: (r.issue_date as string | null) ?? null,
        created_at: r.created_at as string,
        item_count: countMap.get(r.id as string) ?? 0,
      };
    });
}

// ─── Pedidos en proceso ───────────────────────────────────────────────────────

export async function getInProcessDispatchOrders(): Promise<DispatchOrderSummary[]> {
  return _getDispatchOrders(["in_process"]);
}

// ─── Historial de entregados (y anulados) ─────────────────────────────────────

export async function getDeliveredDispatchOrders(): Promise<DispatchOrderSummary[]> {
  return _getDispatchOrders(["delivered", "cancelled"]);
}

// ─── Interno: lista de pedidos por status ────────────────────────────────────

async function _getDispatchOrders(
  statuses: DispatchStatus[],
): Promise<DispatchOrderSummary[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("dispatch_orders")
    .select(
      `id, dispatch_number, status, customer_invoice_id,
       customer_name_snapshot, customer_document_snapshot,
       shipping_address_snapshot, total, delivered_at, created_at,
       customer_invoices(invoice_number)`,
    )
    .in("status", statuses)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      console.warn("[despacho] dispatch_orders no encontrado — aplica 004_dispatch.sql");
      return [];
    }
    console.error("[_getDispatchOrders]", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const invRaw = Array.isArray(r.customer_invoices)
      ? r.customer_invoices[0]
      : r.customer_invoices;
    const inv = invRaw as { invoice_number: string } | null;

    return {
      id: r.id as string,
      dispatch_number: r.dispatch_number as string,
      status: r.status as DispatchStatus,
      customer_invoice_id: r.customer_invoice_id as string,
      invoice_number: inv?.invoice_number ?? "—",
      customer_name_snapshot: r.customer_name_snapshot as string,
      customer_document_snapshot: (r.customer_document_snapshot as string | null) ?? null,
      shipping_address_snapshot: (r.shipping_address_snapshot as string | null) ?? null,
      total: Number(r.total ?? 0),
      delivered_at: (r.delivered_at as string | null) ?? null,
      created_at: r.created_at as string,
    };
  });
}

// ─── Detalle de pedido de despacho ────────────────────────────────────────────

export async function getDispatchOrderDetail(
  dispatchId: string,
): Promise<DispatchOrderDetail | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Cabecera
  const { data: header, error: headerErr } = await supabase
    .from("dispatch_orders")
    .select(
      `id, dispatch_number, status, customer_invoice_id,
       customer_name_snapshot, customer_document_snapshot,
       customer_phone_snapshot, customer_email_snapshot,
       shipping_address_snapshot, total, notes,
       delivered_at, cancelled_at, created_at, updated_at,
       customer_invoices(invoice_number)`,
    )
    .eq("id", dispatchId)
    .single();

  if (headerErr || !header) {
    if (headerErr && isMissingTable(headerErr)) {
      console.warn("[despacho] dispatch_orders no encontrado");
    }
    return null;
  }

  // Ítems
  const { data: rawItems, error: itemsErr } = await supabase
    .from("dispatch_order_items")
    .select("*")
    .eq("dispatch_order_id", dispatchId)
    .order("created_at");

  if (itemsErr) {
    console.error("[getDispatchOrderDetail] items:", itemsErr.message);
  }

  const items = (rawItems ?? []) as Record<string, unknown>[];

  // Stock actual por variante (consulta separada para seguridad)
  const variantIds = items
    .map((i) => i.variant_id as string | null)
    .filter((id): id is string => Boolean(id));

  const stockMap = new Map<string, number>();
  if (variantIds.length > 0) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id, stock")
      .in("id", variantIds);

    for (const v of variants ?? []) {
      const vr = v as { id: string; stock: number };
      stockMap.set(vr.id, vr.stock);
    }
  }

  const h = header as Record<string, unknown>;
  const invRaw = Array.isArray(h.customer_invoices)
    ? h.customer_invoices[0]
    : h.customer_invoices;
  const inv = invRaw as { invoice_number: string } | null;

  return {
    id: h.id as string,
    dispatch_number: h.dispatch_number as string,
    status: h.status as DispatchStatus,
    customer_invoice_id: h.customer_invoice_id as string,
    invoice_number: inv?.invoice_number ?? "—",
    customer_name_snapshot: h.customer_name_snapshot as string,
    customer_document_snapshot: (h.customer_document_snapshot as string | null) ?? null,
    customer_phone_snapshot: (h.customer_phone_snapshot as string | null) ?? null,
    customer_email_snapshot: (h.customer_email_snapshot as string | null) ?? null,
    shipping_address_snapshot: (h.shipping_address_snapshot as string | null) ?? null,
    total: Number(h.total ?? 0),
    notes: (h.notes as string | null) ?? null,
    delivered_at: (h.delivered_at as string | null) ?? null,
    cancelled_at: (h.cancelled_at as string | null) ?? null,
    created_at: h.created_at as string,
    updated_at: h.updated_at as string,
    items: items.map((i) => ({
      id: i.id as string,
      dispatch_order_id: i.dispatch_order_id as string,
      customer_invoice_item_id: (i.customer_invoice_item_id as string | null) ?? null,
      product_id: (i.product_id as string | null) ?? null,
      variant_id: (i.variant_id as string | null) ?? null,
      product_name_snapshot: i.product_name_snapshot as string,
      variant_snapshot: (i.variant_snapshot as string | null) ?? null,
      sku_snapshot: (i.sku_snapshot as string | null) ?? null,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
      current_stock: stockMap.get(i.variant_id as string) ?? 0,
    })),
  };
}
