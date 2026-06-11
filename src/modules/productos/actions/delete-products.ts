"use server";

import { revalidatePath } from "next/cache";

export type DeleteProductsResult = {
  success: boolean;
  message: string;
  deleted: number;
};

/**
 * Elimina definitivamente una lista de productos (hard delete).
 * Cascadea a product_variants automáticamente.
 * También limpia los vínculos en supplier_catalog_items para los items afectados.
 */
export async function deleteProductsBulk(
  productIds: string[],
): Promise<DeleteProductsResult> {
  if (productIds.length === 0) {
    return { success: false, message: "No hay productos seleccionados.", deleted: 0 };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // 1. Limpiar vínculos en supplier_catalog_items para que queden como "Solo catálogo"
  await supabase
    .from("supplier_catalog_items")
    .update({
      linked_product_id: null,
      linked_variant_id: null,
      imported_to_master: false,
      updated_at: new Date().toISOString(),
    })
    .in("linked_product_id", productIds);

  // 2. Limpiar preferred_catalog_item_id en variantes que serán borradas
  await supabase
    .from("product_variants")
    .update({ preferred_catalog_item_id: null })
    .in("product_id", productIds);

  // 3. Borrar productos (cascadea a product_variants)
  const { error, count } = await supabase
    .from("products")
    .delete({ count: "exact" })
    .in("id", productIds);

  if (error) {
    return {
      success: false,
      message: "Error al eliminar productos: " + error.message,
      deleted: 0,
    };
  }

  revalidatePath("/productos");
  revalidatePath("/proveedores");

  return {
    success: true,
    message: `${count ?? productIds.length} producto(s) eliminado(s).`,
    deleted: count ?? productIds.length,
  };
}
