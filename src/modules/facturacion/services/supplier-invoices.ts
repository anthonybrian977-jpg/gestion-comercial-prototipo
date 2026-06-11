/**
 * Server-side data fetching para Facturas de Proveedor.
 * Si las tablas no existen (migración pendiente) retorna [] con console.warn.
 */

import type {
  ReceiptForInvoicing,
  SupplierInvoiceListItem,
  SupplierInvoiceDetail,
  SupplierInvoiceItem,
  SupplierInvoiceStatus,
} from "@/modules/facturacion/types";

// ─── Helper ───────────────────────────────────────────────────────────────────

function isMissingTable(err: { message: string; code?: string }): boolean {
  return (
    err.message.includes("does not exist") ||
    err.message.includes("relation") ||
    err.code === "42P01"
  );
}

// ─── Recibos pendientes de facturar ──────────────────────────────────────────
/**
 * Retorna goods_receipts que no tienen un supplier_invoice asociado.
 * Si supplier_invoices no existe aún, retorna todos los recibos.
 */
export async function getReceiptsForInvoicing(): Promise<ReceiptForInvoicing[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Obtener todos los recibos con datos de OC y proveedor
  const { data: receipts, error: receiptErr } = await supabase
    .from("goods_receipts")
    .select(
      `id, receipt_number, receipt_date, created_at, notes,
       purchase_order_id,
       purchase_orders(order_number, supplier_id, suppliers(name)),
       goods_receipt_items(quantity_received, unit_cost)`,
    )
    .order("created_at", { ascending: false });

  if (receiptErr) {
    if (isMissingTable(receiptErr)) {
      console.warn(
        "[facturacion] goods_receipts no encontrado — aplica las migraciones 002 y 003",
      );
      return [];
    }
    console.error("[getReceiptsForInvoicing]", receiptErr.message);
    return [];
  }

  if (!receipts || receipts.length === 0) return [];

  // Obtener IDs de recibos ya facturados
  const { data: invoices, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("goods_receipt_id");

  if (invErr && !isMissingTable(invErr)) {
    console.error("[getReceiptsForInvoicing] error leyendo supplier_invoices:", invErr.message);
  }

  const invoicedIds = new Set<string>(
    (invoices ?? []).map((i) => (i as { goods_receipt_id: string }).goods_receipt_id),
  );

  return receipts
    .filter((r) => !invoicedIds.has(r.id as string))
    .map((r) => {
      const items =
        (r.goods_receipt_items as { quantity_received: number; unit_cost: number | null }[]) ?? [];
      const poRaw = Array.isArray(r.purchase_orders) ? r.purchase_orders[0] : r.purchase_orders;
      const po = poRaw as {
        order_number: string;
        supplier_id: string;
        suppliers: { name: string } | { name: string }[] | null;
      } | null;
      const supRaw = po?.suppliers;
      const sup = Array.isArray(supRaw) ? supRaw[0] : supRaw;

      return {
        id: r.id as string,
        receipt_number: r.receipt_number as string,
        receipt_date: r.receipt_date as string,
        created_at: r.created_at as string,
        purchase_order_id: r.purchase_order_id as string,
        order_number: po?.order_number ?? "—",
        supplier_id: po?.supplier_id ?? "",
        supplier_name: (sup as { name: string } | null)?.name ?? "Desconocido",
        item_count: items.length,
        total_units: items.reduce((s, i) => s + i.quantity_received, 0),
        estimated_cost: items.reduce((s, i) => s + i.quantity_received * (i.unit_cost ?? 0), 0),
        notes: (r.notes as string | null) ?? null,
      };
    });
}

// ─── Listado de facturas de proveedor ─────────────────────────────────────────

export async function getSupplierInvoices(): Promise<SupplierInvoiceListItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("supplier_invoices")
    .select(
      `id, invoice_number, status, invoice_date, due_date,
       subtotal, total, notes, paid_at, created_at,
       goods_receipt_id,
       goods_receipts(receipt_number),
       supplier_id,
       suppliers(name)`,
    )
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      console.warn("[facturacion] supplier_invoices no encontrado — aplica 003_billing.sql");
      return [];
    }
    console.error("[getSupplierInvoices]", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const grRaw = Array.isArray(r.goods_receipts) ? r.goods_receipts[0] : r.goods_receipts;
    const gr = grRaw as { receipt_number: string } | null;
    const supRaw = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers;
    const sup = supRaw as { name: string } | null;

    return {
      id: r.id as string,
      invoice_number: r.invoice_number as string,
      status: r.status as SupplierInvoiceStatus,
      invoice_date: r.invoice_date as string,
      due_date: (r.due_date as string | null) ?? null,
      subtotal: Number(r.subtotal ?? 0),
      total: Number(r.total ?? 0),
      notes: (r.notes as string | null) ?? null,
      paid_at: (r.paid_at as string | null) ?? null,
      created_at: r.created_at as string,
      goods_receipt_id: r.goods_receipt_id as string,
      receipt_number: gr?.receipt_number ?? "—",
      supplier_id: r.supplier_id as string,
      supplier_name: sup?.name ?? "Desconocido",
    };
  });
}

// ─── Detalle de factura de proveedor ──────────────────────────────────────────

export async function getSupplierInvoiceDetail(
  invoiceId: string,
): Promise<SupplierInvoiceDetail | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const [headerResult, itemsResult] = await Promise.all([
    supabase
      .from("supplier_invoices")
      .select(
        `id, invoice_number, status, invoice_date, due_date,
         subtotal, total, notes, paid_at, created_at,
         goods_receipt_id,
         goods_receipts(receipt_number),
         supplier_id,
         suppliers(name)`,
      )
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("supplier_invoice_items")
      .select("*")
      .eq("supplier_invoice_id", invoiceId)
      .order("created_at"),
  ]);

  if (headerResult.error || !headerResult.data) {
    if (
      headerResult.error &&
      (headerResult.error.message.includes("does not exist") ||
        headerResult.error.code === "42P01")
    ) {
      console.warn("[facturacion] supplier_invoices no encontrado");
    }
    return null;
  }

  const r = headerResult.data as Record<string, unknown>;
  const grRaw = Array.isArray(r.goods_receipts) ? r.goods_receipts[0] : r.goods_receipts;
  const gr = grRaw as { receipt_number: string } | null;
  const supRaw = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers;
  const sup = supRaw as { name: string } | null;

  return {
    id: r.id as string,
    invoice_number: r.invoice_number as string,
    status: r.status as SupplierInvoiceStatus,
    invoice_date: r.invoice_date as string,
    due_date: (r.due_date as string | null) ?? null,
    subtotal: Number(r.subtotal ?? 0),
    total: Number(r.total ?? 0),
    notes: (r.notes as string | null) ?? null,
    paid_at: (r.paid_at as string | null) ?? null,
    created_at: r.created_at as string,
    goods_receipt_id: r.goods_receipt_id as string,
    receipt_number: gr?.receipt_number ?? "—",
    supplier_id: r.supplier_id as string,
    supplier_name: sup?.name ?? "Desconocido",
    items: (itemsResult.data ?? []) as unknown as SupplierInvoiceItem[],
  };
}
