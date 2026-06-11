"use server";

import { revalidatePath } from "next/cache";
import type { InvoiceActionResult } from "@/modules/facturacion/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateProveedoresPaths(invoiceId?: string) {
  revalidatePath("/facturacion");
  revalidatePath("/facturacion/proveedores");
  if (invoiceId) revalidatePath(`/facturacion/proveedores/${invoiceId}`);
}

/**
 * Genera número de factura de proveedor: FP-YYYY-NNN.
 * Intenta la función SQL; si no existe usa fallback TypeScript.
 */
async function generateSupplierInvoiceNumber(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
): Promise<string> {
  const { data, error } = await supabase.rpc("generate_supplier_invoice_number");
  if (!error && data) return data as string;

  // Fallback TypeScript
  const year = new Date().getFullYear().toString();
  const { count } = await supabase
    .from("supplier_invoices")
    .select("id", { count: "exact", head: true })
    .ilike("invoice_number", `FP-${year}-%`);
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `FP-${year}-${seq}`;
}

// ─── Action: crear factura de proveedor desde un recibo ───────────────────────
/**
 * Crea supplier_invoice + supplier_invoice_items a partir de un goods_receipt.
 *
 * Reglas:
 *  - Un recibo solo puede tener UNA factura (UNIQUE constraint en goods_receipt_id).
 *  - Los ítems de la factura son los mismos ítems del recibo (snapshots copiados).
 *  - NO modifica stock.
 *  - NO toca Ingreso de Mercadería, OC, ni Despacho.
 */
export async function createSupplierInvoice(
  receiptId: string,
): Promise<InvoiceActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // ── 1. Verificar que el recibo existe ────────────────────────────────────
  const { data: receipt, error: receiptErr } = await supabase
    .from("goods_receipts")
    .select("id, receipt_number, supplier_id, purchase_order_id")
    .eq("id", receiptId)
    .single();

  if (receiptErr || !receipt) {
    return { success: false, message: "No se encontró el recibo de mercadería." };
  }

  const r = receipt as {
    id: string;
    receipt_number: string;
    supplier_id: string;
    purchase_order_id: string;
  };

  // ── 2. Verificar que no existe ya una factura para este recibo ───────────
  const { data: existing } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_number")
    .eq("goods_receipt_id", receiptId)
    .maybeSingle();

  if (existing) {
    const e = existing as { invoice_number: string };
    return {
      success: false,
      message: `Este recibo ya tiene la factura ${e.invoice_number} asociada.`,
    };
  }

  // ── 3. Leer ítems del recibo ─────────────────────────────────────────────
  const { data: receiptItems, error: itemsErr } = await supabase
    .from("goods_receipt_items")
    .select(
      "id, product_name_snapshot, variant_snapshot, supplier_sku_snapshot, quantity_received, unit_cost",
    )
    .eq("goods_receipt_id", receiptId);

  if (itemsErr || !receiptItems || receiptItems.length === 0) {
    return { success: false, message: "El recibo no tiene ítems registrados." };
  }

  type ReceiptItem = {
    id: string;
    product_name_snapshot: string;
    variant_snapshot: string | null;
    supplier_sku_snapshot: string | null;
    quantity_received: number;
    unit_cost: number | null;
  };

  const items = receiptItems as ReceiptItem[];

  // ── 4. Calcular totales ──────────────────────────────────────────────────
  const subtotal = items.reduce(
    (s, i) => s + i.quantity_received * (i.unit_cost ?? 0),
    0,
  );
  const total = subtotal; // sin IGV por ahora

  // ── 5. Generar número de factura ─────────────────────────────────────────
  const invoiceNumber = await generateSupplierInvoiceNumber(supabase);

  // ── 6. Insertar factura ──────────────────────────────────────────────────
  const { data: newInvoice, error: insertErr } = await supabase
    .from("supplier_invoices")
    .insert({
      invoice_number: invoiceNumber,
      goods_receipt_id: receiptId,
      supplier_id: r.supplier_id,
      status: "pending",
      invoice_date: new Date().toISOString().slice(0, 10),
      subtotal,
      total,
    })
    .select("id")
    .single();

  if (insertErr || !newInvoice) {
    // Colisión de número (race condition) → informar al usuario
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

  // ── 7. Insertar ítems de la factura ──────────────────────────────────────
  const invoiceItems = items.map((i) => ({
    supplier_invoice_id: invoiceId,
    goods_receipt_item_id: i.id,
    product_name_snapshot: i.product_name_snapshot,
    variant_snapshot: i.variant_snapshot ?? null,
    supplier_sku_snapshot: i.supplier_sku_snapshot ?? null,
    quantity: i.quantity_received,
    unit_cost: i.unit_cost ?? 0,
    line_total: i.quantity_received * (i.unit_cost ?? 0),
  }));

  const { error: itemsInsertErr } = await supabase
    .from("supplier_invoice_items")
    .insert(invoiceItems);

  if (itemsInsertErr) {
    // Rollback manual: eliminar la cabecera si los ítems fallaron
    await supabase.from("supplier_invoices").delete().eq("id", invoiceId);
    return {
      success: false,
      message: "Error al guardar los ítems de la factura: " + itemsInsertErr.message,
    };
  }

  revalidateProveedoresPaths(invoiceId);

  return {
    success: true,
    message: `Factura ${invoiceNumber} creada correctamente.`,
    invoiceId,
    invoiceNumber,
  };
}

// ─── Action: actualizar estado de factura de proveedor ───────────────────────
/**
 * Transiciones permitidas:
 *   pending  → paid       (marca como pagado)
 *   pending  → cancelled  (anula)
 *   paid     → cancelled  (excepcionalmente se puede anular un pago)
 */
export async function updateSupplierInvoiceStatus(
  invoiceId: string,
  newStatus: "paid" | "cancelled",
): Promise<InvoiceActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: invoice, error: fetchErr } = await supabase
    .from("supplier_invoices")
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
  if (inv.status === newStatus) {
    return {
      success: false,
      message: `La factura ya está en estado "${newStatus}".`,
    };
  }

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === "paid") {
    updatePayload.paid_at = new Date().toISOString();
  }

  const { error: updateErr } = await supabase
    .from("supplier_invoices")
    .update(updatePayload)
    .eq("id", invoiceId);

  if (updateErr) {
    return { success: false, message: "Error al actualizar la factura: " + updateErr.message };
  }

  revalidateProveedoresPaths(invoiceId);

  const label = newStatus === "paid" ? "marcada como pagada" : "anulada";
  return {
    success: true,
    message: `Factura ${inv.invoice_number} ${label}.`,
    invoiceId,
    invoiceNumber: inv.invoice_number,
  };
}
