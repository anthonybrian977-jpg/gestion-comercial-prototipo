"use server";

import { revalidatePath } from "next/cache";
import type {
  SaveCustomerInvoicePayload,
  InvoiceActionResult,
  CustomerInvoiceStatus,
} from "@/modules/facturacion/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateClientesPaths(invoiceId?: string) {
  revalidatePath("/facturacion");
  revalidatePath("/facturacion/clientes");
  if (invoiceId) revalidatePath(`/facturacion/clientes/${invoiceId}`);
  // No tocamos /productos ni /despacho aquí
}

/**
 * Genera número de factura a cliente: FC-YYYY-NNN.
 * Intenta la función SQL; si no existe usa fallback TypeScript.
 */
async function generateCustomerInvoiceNumber(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
): Promise<string> {
  const { data, error } = await supabase.rpc("generate_customer_invoice_number");
  if (!error && data) return data as string;

  // Fallback TypeScript
  const year = new Date().getFullYear().toString();
  const { count } = await supabase
    .from("customer_invoices")
    .select("id", { count: "exact", head: true })
    .ilike("invoice_number", `FC-${year}-%`);
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `FC-${year}-${seq}`;
}

// ─── Action: guardar factura a cliente (borrador o emitida) ───────────────────
/**
 * Crea una factura a cliente en estado "draft" o "issued".
 *
 * Reglas:
 *  - Precio bloqueado al sale_price actual de la variante (snapshot).
 *  - No puede facturar más unidades de las que hay en stock.
 *  - Para emitir: sale_price debe ser > 0 en todos los ítems.
 *  - NO modifica stock (eso lo hace Despacho).
 */
export async function saveCustomerInvoice(
  payload: SaveCustomerInvoicePayload,
  action: "draft" | "issue",
): Promise<InvoiceActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // ── 1. Validaciones básicas ───────────────────────────────────────────────
  if (!payload.customerName.trim()) {
    return { success: false, message: "El nombre del cliente es obligatorio." };
  }
  if (payload.items.length === 0) {
    return { success: false, message: "Debes agregar al menos un producto." };
  }
  for (const item of payload.items) {
    if (item.quantity <= 0) {
      return { success: false, message: "Todas las cantidades deben ser mayores a 0." };
    }
  }

  // ── 2. Leer variantes y validar stock + precio ───────────────────────────
  const variantIds = payload.items.map((i) => i.variantId);

  const { data: variants, error: variantErr } = await supabase
    .from("product_variants")
    .select("id, sku, sale_price, stock, color, size, presentation, product_id, products(name)")
    .in("id", variantIds)
    .eq("status", "active");

  if (variantErr || !variants) {
    return { success: false, message: "Error al leer los productos seleccionados." };
  }

  type VariantRow = {
    id: string;
    sku: string;
    sale_price: number | null;
    stock: number;
    color: string | null;
    size: string | null;
    presentation: string | null;
    product_id: string;
    products: { name: string } | { name: string }[] | null;
  };

  const variantMap = new Map<string, VariantRow>(
    (variants as VariantRow[]).map((v) => [v.id, v]),
  );

  const errors: string[] = [];

  for (const item of payload.items) {
    const v = variantMap.get(item.variantId);
    if (!v) {
      errors.push(`Variante ${item.variantId} no encontrada o inactiva.`);
      continue;
    }

    const prodRaw = Array.isArray(v.products) ? v.products[0] : v.products;
    const productName = (prodRaw as { name: string } | null)?.name ?? v.sku;

    if (item.quantity > v.stock) {
      errors.push(
        `"${productName}" — solo hay ${v.stock} en stock, solicitaste ${item.quantity}.`,
      );
    }

    if (action === "issue" && (v.sale_price === null || v.sale_price <= 0)) {
      errors.push(
        `"${productName}" no tiene precio de venta definido. No se puede emitir.`,
      );
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: "No se puede guardar la factura por los siguientes problemas:",
      errors,
    };
  }

  // ── 3. Construir ítems con snapshots ─────────────────────────────────────
  const invoiceItems = payload.items.map((item) => {
    const v = variantMap.get(item.variantId)!;
    const prodRaw = Array.isArray(v.products) ? v.products[0] : v.products;
    const productName = (prodRaw as { name: string } | null)?.name ?? v.sku;

    const attrs = [v.color, v.size, v.presentation]
      .filter((x): x is string => Boolean(x))
      .join(" · ");

    const unitPrice = v.sale_price ?? 0;
    return {
      product_variant_id: v.id,
      product_name_snapshot: productName,
      variant_snapshot: attrs || null,
      sku_snapshot: v.sku,
      quantity: item.quantity,
      unit_price_snapshot: unitPrice,
      line_total: item.quantity * unitPrice,
    };
  });

  const subtotal = invoiceItems.reduce((s, i) => s + i.line_total, 0);
  const total = subtotal; // sin IGV por ahora

  // ── 4. Generar número (solo si se emite; borrador lo obtiene al emitirse) ─
  //       Para simplificar, siempre generamos número (incluso borradores).
  //       Esto permite visualizar el número antes de emitir.
  const invoiceNumber = await generateCustomerInvoiceNumber(supabase);

  const invoiceDate = action === "issue"
    ? new Date().toISOString().slice(0, 10)
    : null;

  // ── 5. Insertar cabecera ──────────────────────────────────────────────────
  const { data: newInvoice, error: insertErr } = await supabase
    .from("customer_invoices")
    .insert({
      invoice_number: invoiceNumber,
      status: action === "issue" ? "issued" : "draft",
      customer_name_snapshot: payload.customerName.trim(),
      customer_document_snapshot: payload.customerDocument.trim() || null,
      customer_phone_snapshot: payload.customerPhone.trim() || null,
      customer_email_snapshot: payload.customerEmail.trim() || null,
      customer_address_snapshot: payload.customerAddress.trim() || null,
      subtotal,
      total,
      notes: payload.notes.trim() || null,
      issue_date: invoiceDate,
    })
    .select("id")
    .single();

  if (insertErr || !newInvoice) {
    if (insertErr?.code === "23505") {
      return {
        success: false,
        message: "Conflicto al generar el número de factura. Intenta nuevamente.",
      };
    }
    return {
      success: false,
      message: "Error al crear la factura: " + (insertErr?.message ?? "sin ID"),
    };
  }

  const invoiceId = (newInvoice as { id: string }).id;

  // ── 6. Insertar ítems ─────────────────────────────────────────────────────
  const itemRows = invoiceItems.map((i) => ({
    customer_invoice_id: invoiceId,
    ...i,
  }));

  const { error: itemsErr } = await supabase.from("customer_invoice_items").insert(itemRows);

  if (itemsErr) {
    // Rollback manual
    await supabase.from("customer_invoices").delete().eq("id", invoiceId);
    return {
      success: false,
      message: "Error al guardar los ítems: " + itemsErr.message,
    };
  }

  revalidateClientesPaths(invoiceId);

  const label = action === "issue" ? "emitida" : "guardada como borrador";
  return {
    success: true,
    message: `Factura ${invoiceNumber} ${label} correctamente.`,
    invoiceId,
    invoiceNumber,
  };
}

// ─── Action: actualizar estado de factura a cliente ───────────────────────────
/**
 * Transiciones permitidas desde la pantalla de detalle:
 *   draft  → issued    (emitir)
 *   issued → cancelled (anular)
 *   draft  → cancelled (descartar borrador)
 */
export async function updateCustomerInvoiceStatus(
  invoiceId: string,
  newStatus: CustomerInvoiceStatus,
): Promise<InvoiceActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: invoice, error: fetchErr } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, status")
    .eq("id", invoiceId)
    .single();

  if (fetchErr || !invoice) {
    return { success: false, message: "No se encontró la factura." };
  }

  const inv = invoice as { id: string; invoice_number: string; status: string };

  if (inv.status === "cancelled") {
    return { success: false, message: "La factura ya está anulada." };
  }
  if (inv.status === "dispatched" && newStatus !== "cancelled") {
    return {
      success: false,
      message: "Una factura completamente despachada solo puede anularse.",
    };
  }
  if (inv.status === newStatus) {
    return { success: false, message: `La factura ya está en estado "${newStatus}".` };
  }

  // Si se emite desde draft: verificar que los precios no sean 0
  if (newStatus === "issued") {
    const { data: items } = await supabase
      .from("customer_invoice_items")
      .select("product_name_snapshot, unit_price_snapshot")
      .eq("customer_invoice_id", invoiceId);

    const zeroPriceItems = (
      (items ?? []) as { product_name_snapshot: string; unit_price_snapshot: number }[]
    ).filter((i) => i.unit_price_snapshot <= 0);

    if (zeroPriceItems.length > 0) {
      return {
        success: false,
        message: "No se puede emitir: hay ítems sin precio de venta.",
        errors: zeroPriceItems.map((i) => `"${i.product_name_snapshot}" tiene precio S/ 0.`),
      };
    }
  }

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === "issued") {
    updatePayload.issue_date = new Date().toISOString().slice(0, 10);
  }

  const { error: updateErr } = await supabase
    .from("customer_invoices")
    .update(updatePayload)
    .eq("id", invoiceId);

  if (updateErr) {
    return { success: false, message: "Error al actualizar la factura: " + updateErr.message };
  }

  revalidateClientesPaths(invoiceId);

  const labels: Record<string, string> = {
    issued:    "emitida",
    cancelled: "anulada",
  };

  return {
    success: true,
    message: `Factura ${inv.invoice_number} ${labels[newStatus] ?? newStatus}.`,
    invoiceId,
    invoiceNumber: inv.invoice_number,
  };
}
