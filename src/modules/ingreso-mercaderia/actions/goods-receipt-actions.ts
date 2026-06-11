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

// ─── Server action: confirmar ingreso de mercadería ───────────────────────────
/**
 * Delega toda la lógica al RPC confirm_goods_receipt() de PostgreSQL.
 *
 * El RPC garantiza:
 *   - Validaciones completas ANTES de cualquier mutación.
 *   - Todo o nada: si falla cualquier paso (incluyendo stock_movements),
 *     PostgreSQL hace ROLLBACK automático — no quedan registros parciales.
 *   - Es el ÚNICO punto del sistema donde product_variants.stock sube.
 *
 * Este action solo:
 *   1. Filtra los ítems con quantity > 0 (mínima validación en cliente).
 *   2. Llama al RPC.
 *   3. Traduce el resultado en GoodsReceiptActionResult.
 */
export async function confirmGoodsReceipt(
  payload: ConfirmReceiptPayload,
): Promise<GoodsReceiptActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // ── 1. Filtrar ítems con cantidad > 0 ────────────────────────────────────────
  const itemsToReceive = payload.items.filter((i) => i.quantityReceived > 0);
  if (itemsToReceive.length === 0) {
    return {
      success: false,
      message: "Debes ingresar al menos una cantidad mayor a 0.",
    };
  }

  // ── 2. Llamar al RPC transaccional ──────────────────────────────────────────
  //      confirm_goods_receipt() valida todo antes de mutar y hace rollback
  //      automático si cualquier paso falla.
  //      No se pasan supplier_id ni created_by: el RPC los resuelve
  //      internamente desde la OC y desde auth.uid().
  const { data, error } = await supabase.rpc("confirm_goods_receipt", {
    p_purchase_order_id: payload.purchaseOrderId,
    p_receipt_date: payload.receiptDate || null,
    p_notes: payload.notes || null,
    // El RPC lee desde purchase_order_items todos los datos del ítem
    // (IDs de Maestro, snapshots, unit_cost). El cliente envía solo
    // qué ítem se recibe, cuánto llegó y una nota opcional.
    p_items: itemsToReceive.map((i) => ({
      purchase_order_item_id: i.purchaseOrderItemId,
      quantity_received:      i.quantityReceived,
      notes:                  i.notes || null,
    })),
  });

  // ── 3. Manejar error del RPC ─────────────────────────────────────────────────
  //      El RPC lanza RAISE EXCEPTION con formato "CODIGO: mensaje legible".
  //      Extraemos solo la parte legible para mostrársela al usuario.
  if (error) {
    const raw = error.message ?? "";
    const humanMessage = raw.includes(": ")
      ? raw.substring(raw.indexOf(": ") + 2)
      : raw;
    return {
      success: false,
      message: humanMessage || "Error al confirmar el ingreso. Intenta nuevamente.",
    };
  }

  // ── 4. Revalidar rutas y retornar resultado exitoso ─────────────────────────
  const result = data as {
    receipt_id:     string;
    receipt_number: string;
    new_status:     string;
  };

  revalidateIM(payload.purchaseOrderId);

  const statusLabel =
    result.new_status === "received"
      ? "completamente recibida ✓"
      : "marcada como recepción parcial";

  return {
    success:       true,
    message:       `Ingreso ${result.receipt_number} confirmado. OC ${statusLabel}.`,
    receiptId:     result.receipt_id,
    receiptNumber: result.receipt_number,
  };
}
