"use server";

import { createClient } from "@/lib/supabase/server";
import type { UpdateProductInput } from "@/modules/productos/types";
import { resolveUniqueVariantSku } from "@/modules/productos/utils/sku";

export type UpdateProductResult =
  | { success: true }
  | { success: false; message: string };

function normalizeOptional(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validateInput(input: UpdateProductInput): string | null {
  if (!input.name.trim()) {
    return "El nombre del producto es obligatorio.";
  }
  if (!input.mainSku.trim()) {
    return "El SKU principal es obligatorio.";
  }
  for (const variant of input.variants) {
    if (!variant.sku.trim()) {
      return "Todas las variantes deben tener un SKU.";
    }
    if (variant.purchasePrice < 0) return "El precio de compra debe ser mayor o igual a 0.";
    if (variant.salePrice < 0) return "El precio de venta debe ser mayor o igual a 0.";
    if (variant.stock < 0) return "El stock debe ser mayor o igual a 0.";
    if (variant.minStock < 0) return "El stock mínimo debe ser mayor o igual a 0.";
  }
  for (const nv of input.newVariants ?? []) {
    if (nv.purchasePrice < 0) return "El precio de compra de la nueva variante debe ser >= 0.";
    if (nv.salePrice < 0) return "El precio de venta de la nueva variante debe ser >= 0.";
    if (nv.stock < 0) return "El stock de la nueva variante debe ser >= 0.";
    if (nv.minStock < 0) return "El stock mínimo de la nueva variante debe ser >= 0.";
  }
  return null;
}

export async function updateProduct(
  input: UpdateProductInput,
): Promise<UpdateProductResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { success: false, message: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: "Debes iniciar sesión para editar productos.",
    };
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("role", "admin")
    .eq("is_active", true)
    .maybeSingle();

  if (!appUser) {
    return {
      success: false,
      message: "No tienes permisos para editar productos.",
    };
  }

  try {
    const mainSkuTrimmed = input.mainSku.trim();

    // Verifica unicidad del SKU principal (excluyendo el producto actual)
    const { data: skuConflict } = await supabase
      .from("products")
      .select("id")
      .eq("main_sku", mainSkuTrimmed)
      .neq("id", input.id)
      .maybeSingle();

    if (skuConflict) {
      return {
        success: false,
        message: "El SKU principal ya está en uso por otro producto.",
      };
    }

    // Verifica unicidad de SKUs de variantes (excluyendo la variante actual)
    for (const variant of input.variants) {
      const skuTrimmed = variant.sku.trim();
      const { data: variantSkuConflict } = await supabase
        .from("product_variants")
        .select("id")
        .eq("sku", skuTrimmed)
        .neq("id", variant.id)
        .maybeSingle();

      if (variantSkuConflict) {
        return {
          success: false,
          message: `El SKU "${skuTrimmed}" ya está en uso por otra variante.`,
        };
      }
    }

    // Actualiza el producto base
    const { error: productError } = await supabase
      .from("products")
      .update({
        name: input.name.trim(),
        brand: normalizeOptional(input.brand),
        model: normalizeOptional(input.model),
        category: normalizeOptional(input.category),
        description: normalizeOptional(input.description),
        main_sku: mainSkuTrimmed,
        image_path: normalizeOptional(input.imagePath),
        status: input.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);

    if (productError) {
      if (productError.code === "23505") {
        return {
          success: false,
          message: "El SKU principal ya existe. Usa otro código.",
        };
      }
      return {
        success: false,
        message:
          productError.message ?? "No se pudo actualizar el producto.",
      };
    }

    // Actualiza cada variante
    for (const variant of input.variants) {
      const { error: variantError } = await supabase
        .from("product_variants")
        .update({
          sku: variant.sku.trim(),
          presentation: normalizeOptional(variant.presentation),
          color: normalizeOptional(variant.color),
          size: normalizeOptional(variant.size),
          purchase_price: variant.purchasePrice,
          sale_price: variant.salePrice,
          stock: variant.stock,
          min_stock: variant.minStock,
          status: variant.status,
          image_path: normalizeOptional(variant.imagePath),
          updated_at: new Date().toISOString(),
        })
        .eq("id", variant.id);

      if (variantError) {
        if (variantError.code === "23505") {
          return {
            success: false,
            message: `El SKU "${variant.sku}" ya existe. Usa otro código.`,
          };
        }
        return {
          success: false,
          message:
            variantError.message ?? "No se pudo actualizar una variante.",
        };
      }

      // Actualizar catálogo item preferido (columna puede no existir aún — fallo silencioso)
      if (variant.preferredCatalogItemId !== undefined) {
        await supabase
          .from("product_variants")
          .update({
            preferred_catalog_item_id:
              variant.preferredCatalogItemId ?? null,
          })
          .eq("id", variant.id)
          .then(({ error: prefErr }) => {
            if (prefErr) {
              console.warn(
                "[update-product] preferred_catalog_item_id:",
                prefErr.message,
              );
            }
          });
      }
    }

    // Insertar nuevas variantes
    const newVariantsList = input.newVariants ?? [];
    if (newVariantsList.length > 0) {
      const newVariantSkus: string[] = [];

      for (const nv of newVariantsList) {
        const sku = await resolveUniqueVariantSku(
          mainSkuTrimmed,
          [nv.presentation, nv.color, nv.size],
          async (candidate) => {
            const [productResult, variantResult] = await Promise.all([
              supabase.from("products").select("id").eq("main_sku", candidate).maybeSingle(),
              supabase.from("product_variants").select("id").eq("sku", candidate).maybeSingle(),
            ]);
            return (
              Boolean(productResult.data || variantResult.data) ||
              newVariantSkus.includes(candidate)
            );
          },
          nv.sku,
        );
        newVariantSkus.push(sku);
      }

      const newRows = newVariantsList.map((nv, i) => ({
        product_id: input.id,
        sku: newVariantSkus[i],
        presentation: normalizeOptional(nv.presentation),
        color: normalizeOptional(nv.color),
        size: normalizeOptional(nv.size),
        purchase_price: nv.purchasePrice,
        sale_price: nv.salePrice,
        stock: nv.stock,
        min_stock: nv.minStock,
        status: nv.status,
        image_path: normalizeOptional(nv.imagePath),
      }));

      const { error: insertError } = await supabase
        .from("product_variants")
        .insert(newRows);

      if (insertError) {
        if (insertError.code === "23505") {
          return { success: false, message: "Uno de los SKU de las nuevas variantes ya existe." };
        }
        return {
          success: false,
          message: insertError.message ?? "No se pudieron insertar las nuevas variantes.",
        };
      }
    }

    // Recalcula has_variants según variantes activas
    const { count: activeCount } = await supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", input.id)
      .eq("status", "active");

    const { error: flagError } = await supabase
      .from("products")
      .update({ has_variants: (activeCount ?? 0) > 1 })
      .eq("id", input.id);

    if (flagError) {
      return {
        success: false,
        message: "Variantes guardadas pero no se pudo actualizar el flag has_variants.",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado al actualizar el producto.",
    };
  }
}
