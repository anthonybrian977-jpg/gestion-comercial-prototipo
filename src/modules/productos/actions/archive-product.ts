"use server";

import { revalidatePath } from "next/cache";

export type ArchiveProductResult = {
  success: boolean;
  message: string;
};

/**
 * Archiva un producto ("Eliminar de lista").
 * Establece status = 'archived' en products y product_variants.
 * Soft delete: no borra datos, aparece en la pestaña "Archivados".
 */
export async function archiveProduct(
  productId: string,
): Promise<ArchiveProductResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error: variantsError } = await supabase
    .from("product_variants")
    .update({ status: "archived" })
    .eq("product_id", productId);

  if (variantsError) {
    return {
      success: false,
      message: "Error al archivar variantes: " + variantsError.message,
    };
  }

  const { error: productError } = await supabase
    .from("products")
    .update({ status: "archived" })
    .eq("id", productId);

  if (productError) {
    return {
      success: false,
      message: "Error al archivar producto: " + productError.message,
    };
  }

  revalidatePath("/productos");

  return {
    success: true,
    message: "Producto eliminado de la lista activa.",
  };
}

/**
 * Restaura un producto archivado a estado activo.
 */
export async function restoreProduct(
  productId: string,
): Promise<ArchiveProductResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error: variantsError } = await supabase
    .from("product_variants")
    .update({ status: "active" })
    .eq("product_id", productId)
    .eq("status", "archived"); // solo restaura las que estaban archivadas

  if (variantsError) {
    return {
      success: false,
      message: "Error al restaurar variantes: " + variantsError.message,
    };
  }

  const { error: productError } = await supabase
    .from("products")
    .update({ status: "active" })
    .eq("id", productId);

  if (productError) {
    return {
      success: false,
      message: "Error al restaurar producto: " + productError.message,
    };
  }

  revalidatePath("/productos");

  return {
    success: true,
    message: "Producto restaurado a la lista activa.",
  };
}
