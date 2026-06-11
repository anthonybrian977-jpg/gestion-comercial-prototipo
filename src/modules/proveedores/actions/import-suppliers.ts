"use server";

import { revalidatePath } from "next/cache";

export type SupplierImportRow = {
  variant_sku: string;
  purchase_price: number | string;
  supplier_sku?: string;
};

export type SupplierImportResult = {
  success: boolean;
  message: string;
  errors?: string[];
  processed?: number;
};

export async function importSupplierPrices(
  supplierId: string,
  rawRows: SupplierImportRow[],
): Promise<SupplierImportResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // ── 1. Validación campo por campo ────────────────────────────────────────
  const errors: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const label = `Fila ${i + 2}`;

    if (!String(row.variant_sku ?? "").trim()) {
      errors.push(`${label}: variant_sku es obligatorio.`);
    }
    const price = Number(row.purchase_price);
    if (isNaN(price) || price < 0) {
      errors.push(
        `${label}: purchase_price debe ser un número ≥ 0 (valor: "${row.purchase_price}").`,
      );
    }
  }

  if (errors.length > 0) {
    return { success: false, message: "Errores de validación.", errors };
  }

  // ── 2. Verificar que todos los SKUs internos existen ─────────────────────
  const skus = [...new Set(rawRows.map((r) => String(r.variant_sku).trim()))];

  const { data: variantData, error: variantError } = await supabase
    .from("product_variants")
    .select("id, sku")
    .in("sku", skus);

  if (variantError) {
    return {
      success: false,
      message: "Error al verificar SKUs: " + variantError.message,
    };
  }

  const variantMap = new Map<string, string>(); // sku → id
  for (const v of variantData ?? []) {
    variantMap.set(v.sku, v.id);
  }

  const missingSkus = skus.filter((sku) => !variantMap.has(sku));
  if (missingSkus.length > 0) {
    return {
      success: false,
      message: "Hay SKUs que no existen en el sistema.",
      errors: missingSkus.map((sku) => `SKU "${sku}" no encontrado en product_variants.`),
    };
  }

  // ── 3. Upsert supplier_products en bloque ────────────────────────────────
  const spRows = rawRows.map((row) => ({
    supplier_id: supplierId,
    variant_id: variantMap.get(String(row.variant_sku).trim())!,
    purchase_price: Number(row.purchase_price),
    supplier_sku: String(row.supplier_sku ?? "").trim() || null,
  }));

  const { error: spError } = await supabase
    .from("supplier_products")
    .upsert(spRows, { onConflict: "supplier_id,variant_id" });

  if (spError) {
    return {
      success: false,
      message: "Error al guardar precios: " + spError.message,
    };
  }

  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${supplierId}`);
  revalidatePath("/productos");

  return {
    success: true,
    message: `Importación exitosa. ${spRows.length} precio(s) procesado(s).`,
    processed: spRows.length,
  };
}
