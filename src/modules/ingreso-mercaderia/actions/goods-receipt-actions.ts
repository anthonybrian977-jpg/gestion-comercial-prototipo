"use server";

import { revalidatePath } from "next/cache";
import type {
  ConfirmReceiptPayload,
  GoodsReceiptActionResult,
} from "@/modules/ingreso-mercaderia/types";

// ─── Revalidar rutas afectadas ────────────────────────────────────────────────

function revalidateIM(purchaseOrderId?: string) {
  revalidatePath("/ingreso-mercaderia");
  if (purchaseOrderId) revalidatePath(`/ingreso-mercaderia/${purchaseOrderId}`);
  revalidatePath("/orden-compra");
  if (purchaseOrderId) revalidatePath(`/orden-compra/${purchaseOrderId}`);
  revalidatePath("/productos");
}

// ─── Helper: número de ingreso ────────────────────────────────────────────────

async function generateReceiptNumber(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
): Promise<string> {
  // Intentar función SQL (disponible después de la migración)
  const { data, error } = await supabase.rpc("generate_goods_receipt_number");
  if (!error && data) return data as string;

  // Fallback TypeScript
  const year = new Date().getFullYear().toString();
  const { count } = await supabase
    .from("goods_receipts")
    .select("id", { count: "exact", head: true })
    .ilike("receipt_number", `IM-${year}-%`);

  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `IM-${year}-${seq}`;
}

// ─── Server action: confirmar ingreso de mercadería ───────────────────────────
/**
 * Registra físicamente la llegada de mercadería y suma stock.
 *
 * ÚNICO LUGAR en el sistema donde se incrementa product_variants.stock.
 *
 * Orden de ejecución (todo validado ANTES de cualquier mutación):
 *   1. Fetch + validar OC (estado, ítems vinculados, cantidades)
 *   2. INSERT goods_receipts
 *   3. Por cada ítem:
 *      a. INSERT goods_receipt_items
 *      b. SELECT stock actual (stock_before)
 *      c. UPDATE product_variants.stock += quantity
 *      d. INSERT stock_movements (auditoría inmutable)
 *      e. UPDATE purchase_order_items.quantity_received
 *   4. Recalcular y UPDATE purchase_orders.status
 *
 * NOTA DE PRODUCCIÓN:
 *   Migrar al RPC confirm_goods_receipt() de 002_goods_receipts.sql
 *   para garantía transaccional completa (rollback automático en fallo).
 */
export async function confirmGoodsReceipt(
  payload: ConfirmReceiptPayload,
): Promise<GoodsReceiptActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // ── 1. Cargar y validar la OC ──────────────────────────────────────────────
  const { data: ocRaw, error: ocErr } = await supabase
    .from("purchase_orders")
    .select("id, order_number, status, supplier_id, purchase_order_items(*)")
    .eq("id", payload.purchaseOrderId)
    .single();

  if (ocErr || !ocRaw) {
    return { success: false, message: "No se encontró la Orden de Compra." };
  }

  type OcItem = {
    id: string;
    linked_product_id: string | null;
    linked_variant_id: string | null;
    quantity_ordered: number;
    quantity_received: number;
  };
  type OcRow = {
    id: string;
    order_number: string;
    status: string;
    supplier_id: string;
    purchase_order_items: OcItem[];
  };
  const oc = ocRaw as unknown as OcRow;

  if (oc.status === "draft") {
    return {
      success: false,
      message: `La OC "${oc.order_number}" está en borrador. Debe emitirse antes de recibir mercadería.`,
    };
  }
  if (oc.status === "cancelled") {
    return {
      success: false,
      message: `La OC "${oc.order_number}" está anulada. No se puede recibir mercadería.`,
    };
  }
  if (oc.status === "received") {
    return {
      success: false,
      message: `La OC "${oc.order_number}" ya fue recibida completamente.`,
    };
  }
  if (!["issued", "partial_received"].includes(oc.status)) {
    return {
      success: false,
      message: `Estado de OC no permitido para recepción: "${oc.status}".`,
    };
  }

  // ── 2. Filtrar ítems con cantidad > 0 ─────────────────────────────────────
  const itemsToReceive = payload.items.filter((i) => i.quantityReceived > 0);
  if (itemsToReceive.length === 0) {
    return {
      success: false,
      message: "Debes ingresar al menos una cantidad mayor a 0.",
    };
  }

  // ── 3. Validar todos los ítems ANTES de cualquier mutación ─────────────────
  const ocItemsMap = new Map(oc.purchase_order_items.map((i) => [i.id, i]));
  const validationErrors: string[] = [];

  for (const pi of itemsToReceive) {
    const ocItem = ocItemsMap.get(pi.purchaseOrderItemId);
    if (!ocItem) {
      validationErrors.push(
        `"${pi.productNameSnapshot}": ítem no encontrado en la OC.`,
      );
      continue;
    }
    if (!pi.linkedVariantId) {
      validationErrors.push(
        `"${pi.productNameSnapshot}": no está vinculado al Maestro. ` +
        `Revisa la Orden de Compra antes de recibir mercadería.`,
      );
      continue;
    }
    const pending = ocItem.quantity_ordered - ocItem.quantity_received;
    if (pi.quantityReceived <= 0) {
      validationErrors.push(
        `"${pi.productNameSnapshot}": la cantidad a recibir debe ser mayor a 0.`,
      );
    } else if (pi.quantityReceived > pending) {
      validationErrors.push(
        `"${pi.productNameSnapshot}": se intenta recibir ${pi.quantityReceived} ` +
        `pero solo quedan ${pending} pendiente${pending !== 1 ? "s" : ""}.`,
      );
    }
  }

  if (validationErrors.length > 0) {
    return {
      success: false,
      message: "Errores de validación. No se registró ningún ingreso.",
      errors: validationErrors,
    };
  }

  // ── 4. Generar número de ingreso ──────────────────────────────────────────
  const receiptNumber = await generateReceiptNumber(supabase);

  // ── 5. Crear cabecera del ingreso ─────────────────────────────────────────
  const { data: receiptData, error: receiptErr } = await supabase
    .from("goods_receipts")
    .insert({
      receipt_number: receiptNumber,
      purchase_order_id: payload.purchaseOrderId,
      supplier_id: oc.supplier_id,
      status: "confirmed",
      receipt_date: payload.receiptDate || new Date().toISOString().slice(0, 10),
      notes: payload.notes || null,
    })
    .select("id")
    .single();

  if (receiptErr || !receiptData) {
    return {
      success: false,
      message:
        "Error al crear el registro de ingreso: " +
        (receiptErr?.message ?? "sin ID"),
    };
  }

  const receiptId = (receiptData as { id: string }).id;
  const mutationErrors: string[] = [];

  // ── 6. Procesar cada ítem ─────────────────────────────────────────────────
  for (const pi of itemsToReceive) {
    const ocItem = ocItemsMap.get(pi.purchaseOrderItemId)!;

    // 6a. Guardar detalle del ingreso
    const { error: griErr } = await supabase
      .from("goods_receipt_items")
      .insert({
        goods_receipt_id: receiptId,
        purchase_order_item_id: pi.purchaseOrderItemId,
        linked_product_id: pi.linkedProductId,
        linked_variant_id: pi.linkedVariantId,
        product_name_snapshot: pi.productNameSnapshot,
        variant_snapshot: pi.variantSnapshot || null,
        supplier_sku_snapshot: pi.supplierSkuSnapshot || null,
        quantity_received: pi.quantityReceived,
        unit_cost: pi.unitCost,
        notes: pi.notes || null,
      });

    if (griErr) {
      mutationErrors.push(
        `"${pi.productNameSnapshot}": error al guardar detalle de ingreso — ${griErr.message}`,
      );
      continue;
    }

    // 6b. Leer stock actual (stock_before)
    const { data: variantData, error: variantReadErr } = await supabase
      .from("product_variants")
      .select("stock")
      .eq("id", pi.linkedVariantId)
      .single();

    if (variantReadErr || !variantData) {
      mutationErrors.push(
        `"${pi.productNameSnapshot}": error al leer stock actual — ` +
        `${variantReadErr?.message ?? "sin datos"}`,
      );
      continue;
    }

    const stockBefore = (variantData as { stock: number }).stock;
    const stockAfter = stockBefore + pi.quantityReceived;

    // 6c. Actualizar stock ← ÚNICO PUNTO donde se incrementa stock
    const { error: stockErr } = await supabase
      .from("product_variants")
      .update({ stock: stockAfter })
      .eq("id", pi.linkedVariantId);

    if (stockErr) {
      mutationErrors.push(
        `"${pi.productNameSnapshot}": error al actualizar stock — ${stockErr.message}`,
      );
      continue;
    }

    // 6d. Registrar movimiento de stock (auditoría inmutable)
    await supabase.from("stock_movements").insert({
      product_id: pi.linkedProductId,
      variant_id: pi.linkedVariantId,
      movement_type: "in",
      source_type: "goods_receipt",
      source_id: receiptId,
      quantity_delta: pi.quantityReceived,
      stock_before: stockBefore,
      stock_after: stockAfter,
      notes: `Ingreso de mercadería ${receiptNumber}`,
    });

    // 6e. Actualizar quantity_received acumulado en la OC
    const newQtyReceived = ocItem.quantity_received + pi.quantityReceived;
    const { error: poiErr } = await supabase
      .from("purchase_order_items")
      .update({ quantity_received: newQtyReceived })
      .eq("id", pi.purchaseOrderItemId);

    if (poiErr) {
      mutationErrors.push(
        `"${pi.productNameSnapshot}": error al actualizar cantidad recibida en OC — ${poiErr.message}`,
      );
    }
  }

  if (mutationErrors.length > 0) {
    // Ingreso creado pero con errores en algunos ítems
    return {
      success: false,
      message:
        `El ingreso ${receiptNumber} se registró parcialmente. ` +
        `Algunos ítems tuvieron errores. Revisa los datos.`,
      receiptId,
      receiptNumber,
      errors: mutationErrors,
    };
  }

  // ── 7. Recalcular y actualizar estado de la OC ────────────────────────────
  // Releer los ítems con los valores YA actualizados
  const { data: updatedItems, error: updItemsErr } = await supabase
    .from("purchase_order_items")
    .select("quantity_ordered, quantity_received")
    .eq("purchase_order_id", payload.purchaseOrderId);

  let newStatus = "partial_received";
  if (!updItemsErr && updatedItems) {
    const all = updatedItems as {
      quantity_ordered: number;
      quantity_received: number;
    }[];
    const allDone =
      all.length > 0 &&
      all.every((i) => i.quantity_received >= i.quantity_ordered);
    newStatus = allDone ? "received" : "partial_received";
  }

  const { error: statusErr } = await supabase
    .from("purchase_orders")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", payload.purchaseOrderId);

  if (statusErr) {
    // El ingreso se creó correctamente pero no se actualizó el estado de la OC
    revalidateIM(payload.purchaseOrderId);
    return {
      success: true,
      message:
        `Ingreso ${receiptNumber} confirmado. ` +
        `Advertencia: el estado de la OC no se pudo actualizar (${statusErr.message}).`,
      receiptId,
      receiptNumber,
    };
  }

  revalidateIM(payload.purchaseOrderId);

  const statusLabel =
    newStatus === "received"
      ? "completamente recibida ✓"
      : "marcada como recepción parcial";

  return {
    success: true,
    message: `Ingreso ${receiptNumber} confirmado. OC ${statusLabel}.`,
    receiptId,
    receiptNumber,
  };
}
