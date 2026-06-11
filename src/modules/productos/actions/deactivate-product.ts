"use server";

import { revalidatePath } from "next/cache";

export type DeactivateProductResult = {
  success: boolean;
  message: string;
};

/**
 * Inactiva un producto y todas sus variantes (soft delete).
 * Establece status = 'inactive' en la tabla products y product_variants.
 * No elimina ningún registro.
 */
export async function deactivateProduct(
  productId: string,
): Promise<DeactivateProductResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Inactivar variantes
  const { error: variantsError } = await supabase
    .from("product_variants")
    .update({ status: "inactive" })
    .eq("product_id", productId);

  if (variantsError) {
    return {
      success: false,
      message: "Error al inactivar variantes: " + variantsError.message,
    };
  }

  // Inactivar producto
  const { error: productError } = await supabase
    .from("products")
    .update({ status: "inactive" })
    .eq("id", productId);

  if (productError) {
    return {
      success: false,
      message: "Error al inactivar producto: " + productError.message,
    };
  }

  revalidatePath("/productos");

  return {
    success: true,
    message: "Producto inactivado correctamente.",
  };
}

/**
 * Reactiva un producto inactivo.
 * Establece status = 'active' en products y product_variants.
 */
export async function reactivateProduct(
  productId: string,
): Promise<DeactivateProductResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error: variantsError } = await supabase
    .from("product_variants")
    .update({ status: "active" })
    .eq("product_id", productId)
    .eq("status", "inactive"); // solo reactiva las que estaban inactivas

  if (variantsError) {
    return {
      success: false,
      message: "Error al reactivar variantes: " + variantsError.message,
    };
  }

  const { error: productError } = await supabase
    .from("products")
    .update({ status: "active" })
    .eq("id", productId);

  if (productError) {
    return {
      success: false,
      message: "Error al reactivar producto: " + productError.message,
    };
  }

  revalidatePath("/productos");

  return {
    success: true,
    message: "Producto reactivado correctamente.",
  };
}
