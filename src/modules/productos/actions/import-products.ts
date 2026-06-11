"use server";

import { revalidatePath } from "next/cache";
import { slugifyForSku } from "@/modules/productos/utils/sku";

// ─── Inline payload types ─────────────────────────────────────────────────────
// These mirror SmartProduct / SmartVariant from @/lib/excel/smart-product-import.
// Defined here to avoid importing the client-only engine into a server action.

export type ImportVariantPayload = {
  rowNum: number;
  variantSku?: string;
  presentation?: string;
  color?: string;
  size?: string;
  purchasePrice?: number;
  salePrice?: number;
  stock?: number;
  minStock?: number;
};

export type ImportProductPayload = {
  productName: string;
  brand?: string;
  model?: string;
  category?: string;
  description?: string;
  variants: ImportVariantPayload[];
};

// ─── Legacy types (kept for reference / backward compat) ─────────────────────
export type ProductImportRow = {
  product_name: string;
  brand?: string;
  model?: string;
  category?: string;
  description?: string;
  variant_sku: string;
  presentation?: string;
  color?: string;
  size?: string;
  purchase_price?: number | string;
  sale_price?: number | string;
  stock?: number | string;
  min_stock?: number | string;
};

export type ProductImportResult = {
  success: boolean;
  message: string;
  errors?: string[];
  products_processed?: number;
  variants_processed?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(value: number | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  return isNaN(value) ? fallback : value;
}

/**
 * Build a deterministic variant SKU from product base slug + attributes.
 * Used when the Excel row doesn't provide an explicit SKU.
 */
function buildVariantSku(
  baseSlug: string,
  variant: ImportVariantPayload,
  index: number,
  totalVariants: number,
): string {
  const parts: string[] = [];

  if (variant.color) parts.push(slugifyForSku(variant.color));
  if (variant.size) parts.push(slugifyForSku(variant.size));
  if (variant.presentation) parts.push(slugifyForSku(variant.presentation));

  if (parts.length > 0) {
    return `${baseSlug}-${parts.join("-")}`;
  }

  // No attributes — use index only when there are multiple variants
  return totalVariants > 1 ? `${baseSlug}-V${index + 1}` : baseSlug;
}

// ─── Server Action ────────────────────────────────────────────────────────────

/**
 * Upsert SmartProduct[] into the products + product_variants tables.
 *
 * - Products are matched (and upserted) by `main_sku = IMPORT-{slugify(name)}`.
 * - Variants are matched (and upserted) by `sku`.
 * - No preferred_catalog_item_id is set — these are own-inventory products.
 */
export async function importProducts(
  products: ImportProductPayload[],
): Promise<ProductImportResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  if (products.length === 0) {
    return { success: false, message: "No hay productos para importar." };
  }

  const errors: string[] = [];
  let productsProcessed = 0;
  let variantsProcessed = 0;

  for (const product of products) {
    const productName = product.productName.trim();
    if (!productName) {
      errors.push("Producto sin nombre — omitido.");
      continue;
    }

    const mainSku = `IMPORT-${slugifyForSku(productName)}`;
    const hasVariants = product.variants.length > 1;

    // ── Upsert product ───────────────────────────────────────────────────────
    const { data: productData, error: productError } = await supabase
      .from("products")
      .upsert(
        {
          name: productName,
          brand: product.brand?.trim() || null,
          model: product.model?.trim() || null,
          category: product.category?.trim() || null,
          description: product.description?.trim() || null,
          main_sku: mainSku,
          has_variants: hasVariants,
          status: "active",
        },
        { onConflict: "main_sku" },
      )
      .select("id")
      .single();

    if (productError || !productData) {
      errors.push(
        `Error al guardar "${productName}": ${productError?.message ?? "sin ID"}`,
      );
      continue;
    }

    productsProcessed++;

    // ── Upsert variants ──────────────────────────────────────────────────────
    for (let idx = 0; idx < product.variants.length; idx++) {
      const v = product.variants[idx];

      // Determine SKU: explicit > auto-generated
      const variantSku =
        v.variantSku?.trim() ||
        buildVariantSku(mainSku, v, idx, product.variants.length);

      const { error: variantError } = await supabase
        .from("product_variants")
        .upsert(
          {
            product_id: productData.id,
            sku: variantSku,
            presentation: v.presentation?.trim() || null,
            color: v.color?.trim() || null,
            size: v.size?.trim() || null,
            purchase_price:
              v.purchasePrice !== undefined ? toNum(v.purchasePrice) : null,
            sale_price:
              v.salePrice !== undefined ? toNum(v.salePrice) : null,
            stock: toNum(v.stock, 0),
            min_stock: toNum(v.minStock, 0),
            status: "active",
          },
          { onConflict: "sku" },
        );

      if (variantError) {
        errors.push(
          `Error al guardar variante "${variantSku}": ${variantError.message}`,
        );
        continue;
      }

      variantsProcessed++;
    }
  }

  if (productsProcessed === 0) {
    return {
      success: false,
      message: "No se procesó ningún producto.",
      errors,
    };
  }

  revalidatePath("/productos");
  revalidatePath("/proveedores");

  return {
    success: true,
    message: `Importación exitosa — ${productsProcessed} producto(s), ${variantsProcessed} variante(s) procesado(s).`,
    products_processed: productsProcessed,
    variants_processed: variantsProcessed,
    errors: errors.length > 0 ? errors : undefined,
  };
}
