"use server";

import { slugifyForSku } from "@/modules/productos/utils/sku";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(value: number | string | undefined, fallback = 0): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

function isNumericField(value: number | string | undefined): boolean {
  if (value === undefined || value === "") return true; // opcional → OK
  return !isNaN(Number(value));
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function importProducts(
  rawRows: ProductImportRow[],
): Promise<ProductImportResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // ── 1. Validación ────────────────────────────────────────────────────────
  const errors: string[] = [];
  const seenSkus = new Set<string>();

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const label = `Fila ${i + 2}`;

    if (!String(row.product_name ?? "").trim()) {
      errors.push(`${label}: product_name es obligatorio.`);
    }
    if (!String(row.variant_sku ?? "").trim()) {
      errors.push(`${label}: variant_sku es obligatorio.`);
    } else {
      const sku = String(row.variant_sku).trim();
      if (seenSkus.has(sku)) {
        errors.push(`${label}: variant_sku "${sku}" está duplicado en el archivo.`);
      }
      seenSkus.add(sku);
    }
    if (!isNumericField(row.sale_price)) {
      errors.push(`${label}: sale_price debe ser numérico (valor: "${row.sale_price}").`);
    }
    if (!isNumericField(row.purchase_price)) {
      errors.push(`${label}: purchase_price debe ser numérico (valor: "${row.purchase_price}").`);
    }
    if (!isNumericField(row.stock)) {
      errors.push(`${label}: stock debe ser numérico (valor: "${row.stock}").`);
    }
    if (!isNumericField(row.min_stock)) {
      errors.push(`${label}: min_stock debe ser numérico (valor: "${row.min_stock}").`);
    }
  }

  if (errors.length > 0) {
    return { success: false, message: "Errores de validación.", errors };
  }

  // ── 2. Agrupar por product_name ──────────────────────────────────────────
  const groupMap = new Map<string, ProductImportRow[]>();

  for (const row of rawRows) {
    const name = String(row.product_name).trim();
    const group = groupMap.get(name) ?? [];
    group.push(row);
    groupMap.set(name, group);
  }

  // ── 3. Upsert productos y variantes ─────────────────────────────────────
  let productsProcessed = 0;
  let variantsProcessed = 0;

  for (const [productName, rows] of groupMap) {
    const firstRow = rows[0];
    // main_sku determinista para importaciones (permite reimportar sin duplicar)
    const mainSku = `IMPORT-${slugifyForSku(productName)}`;
    const hasVariants = rows.length > 1;

    // Upsert producto
    const { data: productData, error: productError } = await supabase
      .from("products")
      .upsert(
        {
          name: productName,
          brand: String(firstRow.brand ?? "").trim() || null,
          model: String(firstRow.model ?? "").trim() || null,
          category: String(firstRow.category ?? "").trim() || null,
          description: String(firstRow.description ?? "").trim() || null,
          main_sku: mainSku,
          has_variants: hasVariants,
          status: "active",
        },
        { onConflict: "main_sku" },
      )
      .select("id")
      .single();

    if (productError || !productData) {
      return {
        success: false,
        message: `Error al guardar producto "${productName}": ${productError?.message ?? "sin ID"}`,
      };
    }

    productsProcessed++;

    // Upsert variantes
    for (const row of rows) {
      const variantSku = String(row.variant_sku).trim();

      const { error: variantError } = await supabase
        .from("product_variants")
        .upsert(
          {
            product_id: productData.id,
            sku: variantSku,
            presentation: String(row.presentation ?? "").trim() || null,
            color: String(row.color ?? "").trim() || null,
            size: String(row.size ?? "").trim() || null,
            purchase_price: row.purchase_price !== undefined && row.purchase_price !== ""
              ? toNum(row.purchase_price)
              : null,
            sale_price: row.sale_price !== undefined && row.sale_price !== ""
              ? toNum(row.sale_price)
              : null,
            stock: toNum(row.stock, 0),
            min_stock: toNum(row.min_stock, 0),
            status: "active",
          },
          { onConflict: "sku" },
        );

      if (variantError) {
        return {
          success: false,
          message: `Error al guardar variante "${variantSku}": ${variantError.message}`,
        };
      }

      variantsProcessed++;
    }
  }

  return {
    success: true,
    message: `Importación exitosa. ${productsProcessed} producto(s) y ${variantsProcessed} variante(s) procesado(s).`,
    products_processed: productsProcessed,
    variants_processed: variantsProcessed,
  };
}
