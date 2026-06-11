"use server";

import { revalidatePath } from "next/cache";

type ActionResult = { success: boolean; message: string };

function revalidatePaths(supplierId: string) {
  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${supplierId}`);
  revalidatePath("/productos");
}

function norm(v?: string | null): string | null {
  const t = v?.trim();
  return t || null;
}

function slugify(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

// ---------------------------------------------------------------------------
// Agregar un item al catálogo del proveedor
// ---------------------------------------------------------------------------
export async function addCatalogItem(
  supplierId: string,
  data: {
    supplier_sku?: string | null;
    product_name: string;
    brand?: string | null;
    model?: string | null;
    category?: string | null;
    presentation?: string | null;
    color?: string | null;
    size?: string | null;
    purchase_price: number;
    is_active?: boolean;
  },
): Promise<ActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.from("supplier_catalog_items").insert({
    supplier_id: supplierId,
    supplier_sku: norm(data.supplier_sku),
    product_name: data.product_name.trim(),
    brand: norm(data.brand),
    model: norm(data.model),
    category: norm(data.category),
    presentation: norm(data.presentation),
    color: norm(data.color),
    size: norm(data.size),
    purchase_price: data.purchase_price,
    is_active: data.is_active ?? true,
  });

  if (error) {
    const msg = error.message.includes("does not exist")
      ? "La tabla del catálogo no existe aún. Ejecuta el SQL de migración primero."
      : "Error al agregar producto: " + error.message;
    return { success: false, message: msg };
  }

  revalidatePaths(supplierId);
  return { success: true, message: "Producto agregado al catálogo." };
}

// ---------------------------------------------------------------------------
// Editar item existente
// ---------------------------------------------------------------------------
export async function updateCatalogItem(
  itemId: string,
  supplierId: string,
  data: {
    supplier_sku?: string | null;
    product_name: string;
    brand?: string | null;
    model?: string | null;
    category?: string | null;
    presentation?: string | null;
    color?: string | null;
    size?: string | null;
    purchase_price: number;
    is_active: boolean;
  },
): Promise<ActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase
    .from("supplier_catalog_items")
    .update({
      supplier_sku: norm(data.supplier_sku),
      product_name: data.product_name.trim(),
      brand: norm(data.brand),
      model: norm(data.model),
      category: norm(data.category),
      presentation: norm(data.presentation),
      color: norm(data.color),
      size: norm(data.size),
      purchase_price: data.purchase_price,
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) return { success: false, message: "Error al actualizar: " + error.message };

  revalidatePaths(supplierId);
  return { success: true, message: "Producto actualizado." };
}

// ---------------------------------------------------------------------------
// Importar desde Excel (bulk)
// ---------------------------------------------------------------------------
export type CatalogImportRow = {
  supplier_sku?: string;
  product_name: string;
  brand?: string;
  model?: string;
  category?: string;
  presentation?: string;
  color?: string;
  size?: string;
  purchase_price: number | string;
};

export type CatalogImportResult = {
  success: boolean;
  message: string;
  imported: number;
  errors: string[];
};

export async function importCatalogItems(
  supplierId: string,
  rawRows: CatalogImportRow[],
): Promise<CatalogImportResult> {
  const errors: string[] = [];
  const validRows: object[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2;

    if (!row.product_name?.trim()) {
      errors.push(`Fila ${rowNum}: product_name es obligatorio.`);
      continue;
    }

    const price = Number(row.purchase_price);
    if (isNaN(price) || price < 0) {
      errors.push(`Fila ${rowNum}: purchase_price inválido ("${row.purchase_price}").`);
      continue;
    }

    validRows.push({
      supplier_id: supplierId,
      supplier_sku: norm(row.supplier_sku),
      product_name: row.product_name.trim(),
      brand: norm(row.brand),
      model: norm(row.model),
      category: norm(row.category),
      presentation: norm(row.presentation),
      color: norm(row.color),
      size: norm(row.size),
      purchase_price: price,
      is_active: true,
    });
  }

  if (validRows.length === 0) {
    return {
      success: false,
      message: "No hay filas válidas para importar.",
      imported: 0,
      errors,
    };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.from("supplier_catalog_items").insert(validRows);

  if (error) {
    const msg = error.message.includes("does not exist")
      ? "La tabla del catálogo no existe aún. Ejecuta el SQL de migración primero."
      : "Error al importar: " + error.message;
    return { success: false, message: msg, imported: 0, errors };
  }

  revalidatePaths(supplierId);
  return {
    success: true,
    message: `${validRows.length} producto(s) importados al catálogo.`,
    imported: validRows.length,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Importar un item del catálogo al Maestro de Productos
// ---------------------------------------------------------------------------
export type ImportToMasterResult = {
  success: boolean;
  message: string;
  productId?: string;
  variantId?: string;
};

export async function importCatalogItemToMaster(
  itemId: string,
  supplierId: string,
  data: {
    mainSku?: string;
    variantSku?: string;
    salePrice: number;
    stock: number;
    minStock: number;
    status?: string;
  },
): Promise<ImportToMasterResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // 1. Leer el item del catálogo
  const { data: item, error: itemErr } = await supabase
    .from("supplier_catalog_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (itemErr || !item) {
    return { success: false, message: "No se encontró el item del catálogo." };
  }
  if (item.imported_to_master) {
    return { success: false, message: "Este producto ya fue importado al Maestro." };
  }

  // 2. Determinar main_sku
  const mainSkuBase = data.mainSku?.trim() || `IMP-${slugify(item.product_name)}`;
  let mainSku = mainSkuBase;

  // Verificar unicidad de main_sku
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("main_sku", mainSku)
    .maybeSingle();

  if (existing) {
    // Agregar sufijo
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .ilike("main_sku", `${mainSkuBase}%`);
    mainSku = `${mainSkuBase}-${(count ?? 0) + 1}`;
  }

  // 3. Crear producto
  const { data: newProduct, error: productErr } = await supabase
    .from("products")
    .insert({
      name: item.product_name,
      brand: item.brand,
      model: item.model,
      category: item.category,
      main_sku: mainSku,
      status: data.status ?? "active",
      has_variants: false,
    })
    .select("id")
    .single();

  if (productErr || !newProduct) {
    return { success: false, message: "Error al crear producto: " + (productErr?.message ?? "") };
  }

  // 4. Determinar variant_sku
  let variantSku = data.variantSku?.trim() || mainSku;

  const { data: existingVariant } = await supabase
    .from("product_variants")
    .select("id")
    .eq("sku", variantSku)
    .maybeSingle();

  if (existingVariant) {
    variantSku = `${variantSku}-V1`;
  }

  // 5. Crear variante
  const { data: newVariant, error: variantErr } = await supabase
    .from("product_variants")
    .insert({
      product_id: newProduct.id,
      sku: variantSku,
      presentation: item.presentation,
      color: item.color,
      size: item.size,
      purchase_price: item.purchase_price,
      sale_price: data.salePrice,
      stock: data.stock,
      min_stock: data.minStock,
      status: data.status ?? "active",
    })
    .select("id")
    .single();

  if (variantErr || !newVariant) {
    // Rollback producto
    await supabase.from("products").delete().eq("id", newProduct.id);
    return { success: false, message: "Error al crear variante: " + (variantErr?.message ?? "") };
  }

  // 6. Marcar item como importado
  await supabase
    .from("supplier_catalog_items")
    .update({
      imported_to_master: true,
      linked_product_id: newProduct.id,
      linked_variant_id: newVariant.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  revalidatePaths(supplierId);
  revalidatePath("/productos");

  return {
    success: true,
    message: `Producto "${item.product_name}" importado al Maestro correctamente.`,
    productId: newProduct.id,
    variantId: newVariant.id,
  };
}
