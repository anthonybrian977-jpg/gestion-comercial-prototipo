"use server";

import { revalidatePath } from "next/cache";

export type DeleteProductsResult = {
  success: boolean;
  message: string;
  deleted: number;
  archived: number;
};

/**
 * Intenta eliminar definitivamente una lista de productos.
 *
 * Si un producto tiene historial operativo (movimientos de stock, órdenes de
 * compra, ingresos de mercadería, facturas de cliente o pedidos de despacho)
 * lo ARCHIVA en lugar de borrarlo para preservar la integridad de los registros.
 *
 * Productos sin historial → hard delete (cascadea a product_variants).
 * Productos con historial → status = 'archived' en product + variants.
 */
export async function deleteProductsBulk(
  productIds: string[],
): Promise<DeleteProductsResult> {
  if (productIds.length === 0) {
    return {
      success: false,
      message: "No hay productos seleccionados.",
      deleted: 0,
      archived: 0,
    };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // ── 1. Obtener variantes de los productos seleccionados ───────────────────
  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, product_id")
    .in("product_id", productIds);

  const variantRows = variants ?? [];
  const variantIds = variantRows.map((v) => v.id as string);

  // Map: variant_id → product_id (para retrotraer pertenencia)
  const variantToProduct: Record<string, string> = {};
  for (const v of variantRows) {
    variantToProduct[v.id as string] = v.product_id as string;
  }

  // ── 2. Detectar qué productos tienen historial operativo ──────────────────
  const productsWithHistory = new Set<string>();

  function markFromVariants(vids: (string | null | undefined)[]) {
    for (const vid of vids) {
      if (!vid) continue;
      const pid = variantToProduct[vid];
      if (pid) productsWithHistory.add(pid);
    }
  }

  // a) stock_movements.product_id → products.id (referencia directa)
  {
    const { data } = await supabase
      .from("stock_movements")
      .select("product_id")
      .in("product_id", productIds)
      .limit(500);
    for (const row of data ?? []) {
      if (row.product_id) productsWithHistory.add(row.product_id as string);
    }
  }

  if (variantIds.length > 0) {
    // b) purchase_order_items.linked_variant_id → product_variants.id
    {
      const { data } = await supabase
        .from("purchase_order_items")
        .select("linked_variant_id")
        .in("linked_variant_id", variantIds)
        .not("linked_variant_id", "is", null)
        .limit(500);
      markFromVariants((data ?? []).map((r) => r.linked_variant_id as string | null));
    }

    // c) goods_receipt_items.linked_variant_id → product_variants.id
    {
      const { data } = await supabase
        .from("goods_receipt_items")
        .select("linked_variant_id")
        .in("linked_variant_id", variantIds)
        .not("linked_variant_id", "is", null)
        .limit(500);
      markFromVariants((data ?? []).map((r) => r.linked_variant_id as string | null));
    }

    // d) customer_invoice_items.product_variant_id → product_variants.id
    {
      const { data } = await supabase
        .from("customer_invoice_items")
        .select("product_variant_id")
        .in("product_variant_id", variantIds)
        .not("product_variant_id", "is", null)
        .limit(500);
      markFromVariants((data ?? []).map((r) => r.product_variant_id as string | null));
    }

    // e) dispatch_order_items.variant_id → product_variants.id
    {
      const { data } = await supabase
        .from("dispatch_order_items")
        .select("variant_id")
        .in("variant_id", variantIds)
        .not("variant_id", "is", null)
        .limit(500);
      markFromVariants((data ?? []).map((r) => r.variant_id as string | null));
    }
  }

  // f) dispatch_order_items.product_id → products.id (referencia directa)
  {
    const { data } = await supabase
      .from("dispatch_order_items")
      .select("product_id")
      .in("product_id", productIds)
      .not("product_id", "is", null)
      .limit(500);
    for (const row of data ?? []) {
      if (row.product_id) productsWithHistory.add(row.product_id as string);
    }
  }

  // ── 3. Clasificar: archivar vs. eliminar ──────────────────────────────────
  const toArchive = productIds.filter((id) => productsWithHistory.has(id));
  const toDelete  = productIds.filter((id) => !productsWithHistory.has(id));

  // ── 4. Archivar los que tienen historial ──────────────────────────────────
  let archivedCount = 0;
  if (toArchive.length > 0) {
    await supabase
      .from("product_variants")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .in("product_id", toArchive);

    const { error: archErr } = await supabase
      .from("products")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .in("id", toArchive);

    if (!archErr) archivedCount = toArchive.length;
  }

  // ── 5. Eliminar definitivamente los que no tienen historial ───────────────
  let deletedCount = 0;
  if (toDelete.length > 0) {
    // Limpiar vínculos en supplier_catalog_items para que queden como "Solo catálogo"
    await supabase
      .from("supplier_catalog_items")
      .update({
        linked_product_id: null,
        linked_variant_id: null,
        imported_to_master: false,
        updated_at: new Date().toISOString(),
      })
      .in("linked_product_id", toDelete);

    // Limpiar preferred_catalog_item_id en variantes que serán borradas
    await supabase
      .from("product_variants")
      .update({ preferred_catalog_item_id: null })
      .in("product_id", toDelete);

    // Hard delete (cascadea a product_variants)
    const { error, count } = await supabase
      .from("products")
      .delete({ count: "exact" })
      .in("id", toDelete);

    if (error) {
      return {
        success: false,
        message: "Error al eliminar productos: " + error.message,
        deleted: 0,
        archived: archivedCount,
      };
    }
    deletedCount = count ?? toDelete.length;
  }

  revalidatePath("/productos");
  revalidatePath("/proveedores");

  // ── 6. Mensaje de resultado ───────────────────────────────────────────────
  const parts: string[] = [];
  if (deletedCount > 0)
    parts.push(
      `${deletedCount} producto${deletedCount !== 1 ? "s" : ""} eliminado${deletedCount !== 1 ? "s" : ""}`,
    );
  if (archivedCount > 0)
    parts.push(
      `${archivedCount} archivado${archivedCount !== 1 ? "s" : ""} (tenían historial operativo)`,
    );

  return {
    success: true,
    message: parts.join(" · "),
    deleted: deletedCount,
    archived: archivedCount,
  };
}
