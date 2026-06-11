/**
 * Server-side data fetching para Facturas a Clientes.
 * Si las tablas no existen (migración pendiente) retorna [] con console.warn.
 */

import type {
  CustomerInvoiceListItem,
  CustomerInvoiceDetail,
  CustomerInvoiceItem,
  CustomerInvoiceStatus,
  ProductVariantForInvoice,
} from "@/modules/facturacion/types";

// ─── Helper ───────────────────────────────────────────────────────────────────

function isMissingTable(err: { message: string; code?: string }): boolean {
  return (
    err.message.includes("does not exist") ||
    err.message.includes("relation") ||
    err.code === "42P01"
  );
}

// ─── Listado de facturas a clientes ──────────────────────────────────────────

export async function getCustomerInvoices(): Promise<CustomerInvoiceListItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: invoices, error: invErr } = await supabase
    .from("customer_invoices")
    .select(
      `id, invoice_number, status, customer_name_snapshot, customer_document_snapshot,
       subtotal, total, issue_date, created_at`,
    )
    .order("created_at", { ascending: false });

  if (invErr) {
    if (isMissingTable(invErr)) {
      console.warn("[facturacion] customer_invoices no encontrado — aplica 003_billing.sql");
      return [];
    }
    console.error("[getCustomerInvoices]", invErr.message);
    return [];
  }

  if (!invoices || invoices.length === 0) return [];

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

  return invoices.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      invoice_number: r.invoice_number as string,
      status: r.status as CustomerInvoiceStatus,
      customer_name_snapshot: r.customer_name_snapshot as string,
      customer_document_snapshot: (r.customer_document_snapshot as string | null) ?? null,
      subtotal: Number(r.subtotal ?? 0),
      total: Number(r.total ?? 0),
      issue_date: (r.issue_date as string | null) ?? null,
      created_at: r.created_at as string,
      item_count: countMap.get(r.id as string) ?? 0,
    };
  });
}

// ─── Detalle de factura a cliente ─────────────────────────────────────────────

export async function getCustomerInvoiceDetail(
  invoiceId: string,
): Promise<CustomerInvoiceDetail | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const [headerResult, itemsResult] = await Promise.all([
    supabase
      .from("customer_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("customer_invoice_items")
      .select("*")
      .eq("customer_invoice_id", invoiceId)
      .order("created_at"),
  ]);

  if (headerResult.error || !headerResult.data) {
    if (
      headerResult.error &&
      (headerResult.error.message.includes("does not exist") ||
        headerResult.error.code === "42P01")
    ) {
      console.warn("[facturacion] customer_invoices no encontrado");
    }
    return null;
  }

  const r = headerResult.data as Record<string, unknown>;

  return {
    id: r.id as string,
    invoice_number: r.invoice_number as string,
    status: r.status as CustomerInvoiceStatus,
    customer_name_snapshot: r.customer_name_snapshot as string,
    customer_document_snapshot: (r.customer_document_snapshot as string | null) ?? null,
    customer_phone_snapshot: (r.customer_phone_snapshot as string | null) ?? null,
    customer_email_snapshot: (r.customer_email_snapshot as string | null) ?? null,
    customer_address_snapshot: (r.customer_address_snapshot as string | null) ?? null,
    subtotal: Number(r.subtotal ?? 0),
    total: Number(r.total ?? 0),
    notes: (r.notes as string | null) ?? null,
    issue_date: (r.issue_date as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    items: (itemsResult.data ?? []) as unknown as CustomerInvoiceItem[],
  };
}

// ─── Variantes activas disponibles para facturar ──────────────────────────────
/**
 * Retorna product_variants (status='active') con su producto padre.
 * Incluye variantes con stock 0 (la UI mostrará advertencia pero permite ver).
 * Excluye variantes de productos inactivos/archivados.
 */
export async function getProductVariantsForInvoice(): Promise<ProductVariantForInvoice[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_variants")
    .select(
      `id, sku, color, size, presentation, sale_price, stock, product_id,
       products(name, status)`,
    )
    .eq("status", "active")
    .order("product_id")
    .order("sku");

  if (error) {
    console.error("[getProductVariantsForInvoice]", error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => {
      // Excluir variantes cuyo producto padre esté inactivo/archivado
      const prodRaw = Array.isArray(row.products) ? row.products[0] : row.products;
      const prod = prodRaw as { name: string; status: string } | null;
      return prod?.status === "active";
    })
    .map((row) => {
      const r = row as Record<string, unknown>;
      const prodRaw = Array.isArray(r.products) ? r.products[0] : r.products;
      const prod = prodRaw as { name: string } | null;

      // Construir label de variante con los atributos que tenga
      const attrs = [r.color, r.size, r.presentation]
        .filter((v): v is string => Boolean(v))
        .join(" · ");

      return {
        variant_id: r.id as string,
        product_id: r.product_id as string,
        product_name: prod?.name ?? "Producto",
        variant_label: attrs || (prod?.name ?? "Variante"),
        sku: r.sku as string,
        sale_price: Number(r.sale_price ?? 0),
        stock: Number(r.stock ?? 0),
      };
    });
}
