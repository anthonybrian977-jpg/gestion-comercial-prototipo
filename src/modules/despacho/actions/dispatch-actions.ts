"use server";

import { revalidatePath } from "next/cache";
import type { DispatchActionResult } from "@/modules/despacho/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateDespacho(dispatchId?: string) {
  revalidatePath("/despacho");
  if (dispatchId) revalidatePath(`/despacho/${dispatchId}`);
  revalidatePath("/facturacion/clientes");
  revalidatePath("/productos");
}

/**
 * Genera número de pedido de despacho: OD-YYYY-NNN.
 * Intenta la función SQL; si no existe usa fallback TypeScript.
 */
async function generateDispatchNumber(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
): Promise<string> {
  const { data, error } = await supabase.rpc("generate_dispatch_number");
  if (!error && data) return data as string;

  // Fallback TypeScript
  const year = new Date().getFullYear().toString();
  const { count } = await supabase
    .from("dispatch_orders")
    .select("id", { count: "exact", head: true })
    .ilike("dispatch_number", `OD-${year}-%`);
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `OD-${year}-${seq}`;
}

// ─── Action: crear pedido de despacho desde factura cliente ──────────────────
/**
 * Crea dispatch_order + dispatch_order_items a partir de una customer_invoice.
 *
 * Reglas:
 *  - Solo desde facturas con status = 'issued'.
 *  - Una factura puede tener máximo un pedido de despacho.
 *  - NO modifica stock (eso lo hace mark_dispatch_delivered).
 *  - Los ítems se copian desde customer_invoice_items con snapshots intactos.
 */
export async function createDispatchFromCustomerInvoice(
  invoiceId: string,
): Promise<DispatchActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // ── 1. Verificar que la factura existe y está emitida ─────────────────────
  const { data: invoice, error: invErr } = await supabase
    .from("customer_invoices")
    .select(
      `id, invoice_number, status,
       customer_name_snapshot, customer_document_snapshot,
       customer_phone_snapshot, customer_email_snapshot,
       customer_address_snapshot, total`,
    )
    .eq("id", invoiceId)
    .single();

  if (invErr || !invoice) {
    return { success: false, message: "No se encontró la factura." };
  }

  const inv = invoice as {
    id: string;
    invoice_number: string;
    status: string;
    customer_name_snapshot: string;
    customer_document_snapshot: string | null;
    customer_phone_snapshot: string | null;
    customer_email_snapshot: string | null;
    customer_address_snapshot: string | null;
    total: number;
  };

  if (inv.status !== "issued") {
    return {
      success: false,
      message: `La factura ${inv.invoice_number} tiene estado "${inv.status}". Solo se pueden despachar facturas emitidas.`,
    };
  }

  // ── 2. Verificar que no existe ya un pedido para esta factura ─────────────
  const { data: existing } = await supabase
    .from("dispatch_orders")
    .select("id, dispatch_number, status")
    .eq("customer_invoice_id", invoiceId)
    .maybeSingle();

  if (existing) {
    const ex = existing as { id: string; dispatch_number: string; status: string };
    return {
      success: false,
      message: `La factura ${inv.invoice_number} ya tiene el pedido ${ex.dispatch_number} (${ex.status}).`,
      dispatchId: ex.id,
      dispatchNumber: ex.dispatch_number,
    };
  }

  // ── 3. Leer ítems de la factura ───────────────────────────────────────────
  const { data: invoiceItems, error: itemsErr } = await supabase
    .from("customer_invoice_items")
    .select(
      "id, product_variant_id, product_name_snapshot, variant_snapshot, sku_snapshot, quantity, unit_price_snapshot, line_total",
    )
    .eq("customer_invoice_id", invoiceId);

  if (itemsErr || !invoiceItems || invoiceItems.length === 0) {
    return { success: false, message: "La factura no tiene ítems registrados." };
  }

  type InvoiceItem = {
    id: string;
    product_variant_id: string | null;
    product_name_snapshot: string;
    variant_snapshot: string | null;
    sku_snapshot: string | null;
    quantity: number;
    unit_price_snapshot: number;
    line_total: number;
  };

  const items = invoiceItems as InvoiceItem[];

  // ── 4. Leer product_id para cada variante (necesario para dispatch_order_items) ─
  const variantIds = items
    .map((i) => i.product_variant_id)
    .filter((id): id is string => Boolean(id));

  const variantMap = new Map<string, string>(); // variant_id → product_id
  if (variantIds.length > 0) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id, product_id")
      .in("id", variantIds);

    for (const v of variants ?? []) {
      const vr = v as { id: string; product_id: string };
      variantMap.set(vr.id, vr.product_id);
    }
  }

  // ── 5. Generar número de pedido ───────────────────────────────────────────
  const dispatchNumber = await generateDispatchNumber(supabase);

  // ── 6. Crear cabecera del pedido ──────────────────────────────────────────
  const { data: newDispatch, error: insertErr } = await supabase
    .from("dispatch_orders")
    .insert({
      dispatch_number: dispatchNumber,
      customer_invoice_id: invoiceId,
      status: "in_process",
      customer_name_snapshot: inv.customer_name_snapshot,
      customer_document_snapshot: inv.customer_document_snapshot ?? null,
      customer_phone_snapshot: inv.customer_phone_snapshot ?? null,
      customer_email_snapshot: inv.customer_email_snapshot ?? null,
      shipping_address_snapshot: inv.customer_address_snapshot ?? null,
      total: inv.total,
    })
    .select("id")
    .single();

  if (insertErr || !newDispatch) {
    if (insertErr?.code === "23505") {
      return {
        success: false,
        message: "Conflicto al generar el número de pedido. Intenta nuevamente.",
      };
    }
    return {
      success: false,
      message: "Error al crear el pedido: " + (insertErr?.message ?? "sin ID"),
    };
  }

  const dispatchId = (newDispatch as { id: string }).id;

  // ── 7. Crear ítems del pedido ─────────────────────────────────────────────
  const dispatchItems = items.map((i) => ({
    dispatch_order_id: dispatchId,
    customer_invoice_item_id: i.id,
    product_id: i.product_variant_id ? (variantMap.get(i.product_variant_id) ?? null) : null,
    variant_id: i.product_variant_id ?? null,
    product_name_snapshot: i.product_name_snapshot,
    variant_snapshot: i.variant_snapshot ?? null,
    sku_snapshot: i.sku_snapshot ?? null,
    quantity: i.quantity,
    unit_price: i.unit_price_snapshot,
    line_total: i.line_total,
  }));

  const { error: dispItemsErr } = await supabase
    .from("dispatch_order_items")
    .insert(dispatchItems);

  if (dispItemsErr) {
    // Rollback manual: eliminar cabecera para no dejar un pedido huérfano.
    // Requiere la política RLS "do_delete" en dispatch_orders — sin ella
    // Postgres devuelve 0 filas en silencio y el rollback es no-op.
    const { count: rolledBack } = await supabase
      .from("dispatch_orders")
      .delete({ count: "exact" })
      .eq("id", dispatchId);

    if ((rolledBack ?? 0) === 0) {
      // El DELETE no eliminó la fila (política ausente o error interno).
      // Loguear para monitoreo; el usuario recibirá el mensaje correcto.
      console.error(
        `[createDispatch] Rollback fallido: dispatch_orders ${dispatchId} puede haber quedado huérfano.`,
      );
    }

    return {
      success: false,
      message: "Error al guardar los ítems del pedido. El pedido no fue creado — intenta nuevamente.",
    };
  }

  revalidateDespacho(dispatchId);

  return {
    success: true,
    message: `Pedido ${dispatchNumber} creado. Estado: En proceso.`,
    dispatchId,
    dispatchNumber,
  };
}

// ─── Action: marcar pedido como entregado (vía RPC) ──────────────────────────
/**
 * Llama al RPC mark_dispatch_delivered que:
 *  1. Valida stock suficiente para todos los ítems.
 *  2. Descuenta stock de product_variants.
 *  3. Crea stock_movements de salida.
 *  4. Cambia dispatch_orders.status → 'delivered'.
 *  5. Cambia customer_invoices.status → 'dispatched'.
 *
 *  Si falla cualquier paso, PostgreSQL hace ROLLBACK completo.
 *  NO hay baja de stock desde TypeScript.
 */
export async function markDispatchDelivered(
  dispatchId: string,
): Promise<DispatchActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("mark_dispatch_delivered", {
    p_dispatch_order_id: dispatchId,
  });

  if (error) {
    const raw = error.message ?? "";
    // El RPC lanza "CODIGO: mensaje legible" — extraemos solo el mensaje
    const humanMessage = raw.includes(": ")
      ? raw.substring(raw.indexOf(": ") + 2)
      : raw;
    return {
      success: false,
      message: humanMessage || "Error al marcar como entregado. Intenta nuevamente.",
    };
  }

  const result = data as { dispatch_number: string; status: string };
  revalidateDespacho(dispatchId);

  return {
    success: true,
    message: `Pedido ${result.dispatch_number} marcado como entregado. Stock actualizado.`,
    dispatchId,
    dispatchNumber: result.dispatch_number,
  };
}

// ─── Action: anular pedido de despacho ────────────────────────────────────────
/**
 * Solo permite anular si status = 'in_process'.
 * No revierte stock (nunca se bajó).
 */
export async function cancelDispatchOrder(
  dispatchId: string,
): Promise<DispatchActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: dispatch, error: fetchErr } = await supabase
    .from("dispatch_orders")
    .select("id, dispatch_number, status")
    .eq("id", dispatchId)
    .single();

  if (fetchErr || !dispatch) {
    return { success: false, message: "No se encontró el pedido." };
  }

  const d = dispatch as { id: string; dispatch_number: string; status: string };

  if (d.status === "delivered") {
    return {
      success: false,
      message: "No se puede anular un pedido ya entregado.",
    };
  }
  if (d.status === "cancelled") {
    return { success: false, message: "El pedido ya está anulado." };
  }

  const { error: updateErr } = await supabase
    .from("dispatch_orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", dispatchId);

  if (updateErr) {
    return {
      success: false,
      message: "Error al anular el pedido: " + updateErr.message,
    };
  }

  revalidateDespacho(dispatchId);

  return {
    success: true,
    message: `Pedido ${d.dispatch_number} anulado.`,
    dispatchId,
    dispatchNumber: d.dispatch_number,
  };
}
