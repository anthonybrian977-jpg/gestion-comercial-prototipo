"use server";

import { createClient } from "@/lib/supabase/server";
import type { CreateProductInput } from "@/modules/productos/types";
import {
  resolveUniqueMainSku,
  resolveUniqueVariantSku,
} from "@/modules/productos/utils/sku";

export type CreateProductResult =
  | { success: true }
  | { success: false; message: string };

function normalizeOptional(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validateInput(input: CreateProductInput): string | null {
  if (!input.name.trim()) {
    return "El nombre del producto es obligatorio.";
  }

  if (input.hasVariants && input.variants.length === 0) {
    return "Debes agregar al menos una variante para productos con variantes.";
  }

  if (!input.hasVariants && input.variants.length !== 1) {
    return "El producto simple debe tener una variante principal.";
  }

  for (const variant of input.variants) {
    if (variant.purchasePrice < 0) {
      return "El precio de compra debe ser mayor o igual a 0.";
    }
    if (variant.salePrice < 0) {
      return "El precio de venta debe ser mayor o igual a 0.";
    }
    if (variant.stock < 0) {
      return "El stock inicial debe ser mayor o igual a 0.";
    }
    if (variant.minStock < 0) {
      return "El stock mínimo debe ser mayor o igual a 0.";
    }
  }

  return null;
}

async function isSkuTaken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sku: string,
): Promise<boolean> {
  const [productResult, variantResult] = await Promise.all([
    supabase.from("products").select("id").eq("main_sku", sku).maybeSingle(),
    supabase.from("product_variants").select("id").eq("sku", sku).maybeSingle(),
  ]);

  if (productResult.error || variantResult.error) {
    throw new Error("No se pudo validar la unicidad del SKU.");
  }

  return Boolean(productResult.data || variantResult.data);
}

export async function createProduct(
  input: CreateProductInput,
): Promise<CreateProductResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { success: false, message: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Debes iniciar sesión para crear productos." };
  }

  try {
    const mainSku = await resolveUniqueMainSku(
      [input.name, input.brand, input.model],
      (sku) => isSkuTaken(supabase, sku),
      input.mainSku,
    );

    const variantSkus: string[] = [];

    for (const variant of input.variants) {
      const sku = await resolveUniqueVariantSku(
        mainSku,
        input.hasVariants
          ? [variant.presentation, variant.color, variant.size]
          : ["PRINCIPAL"],
        (candidate) =>
          isSkuTaken(supabase, candidate) || variantSkus.includes(candidate),
        variant.sku,
      );
      variantSkus.push(sku);
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        name: input.name.trim(),
        brand: normalizeOptional(input.brand),
        model: normalizeOptional(input.model),
        category: normalizeOptional(input.category),
        description: normalizeOptional(input.description),
        main_sku: mainSku,
        image_path: normalizeOptional(input.imagePath),
        has_variants: input.hasVariants,
        status: input.status || "active",
      })
      .select("id")
      .single();

    if (productError || !product) {
      if (productError?.code === "23505") {
        return {
          success: false,
          message: "El SKU principal ya existe. Usa otro código.",
        };
      }

      return {
        success: false,
        message:
          productError?.message ??
          "No se pudo crear el producto. Verifica permisos de escritura en Supabase.",
      };
    }

    const variantRows = input.variants.map((variant, index) => ({
      product_id: product.id,
      sku: variantSkus[index],
      size: normalizeOptional(variant.size),
      color: normalizeOptional(variant.color),
      presentation: input.hasVariants
        ? normalizeOptional(variant.presentation)
        : "Principal",
      purchase_price: variant.purchasePrice,
      sale_price: variant.salePrice,
      stock: variant.stock,
      min_stock: variant.minStock,
      status: variant.status || "active",
      image_path: normalizeOptional(variant.imagePath),
    }));

    const { error: variantsError } = await supabase
      .from("product_variants")
      .insert(variantRows);

    if (variantsError) {
      const { error: rollbackError } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (rollbackError) {
        const variantDetail =
          variantsError.code === "23505"
            ? "Uno de los SKU de variantes ya existe."
            : variantsError.message ??
              "No se pudieron crear las variantes del producto.";

        return {
          success: false,
          message: `${variantDetail} El producto fue creado pero no se pudieron crear las variantes, y el rollback falló: ${rollbackError.message}`,
        };
      }

      if (variantsError.code === "23505") {
        return {
          success: false,
          message: "Uno de los SKU de variantes ya existe. Usa otros códigos.",
        };
      }

      return {
        success: false,
        message:
          variantsError.message ??
          "No se pudieron crear las variantes del producto.",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado al crear el producto.",
    };
  }
}
