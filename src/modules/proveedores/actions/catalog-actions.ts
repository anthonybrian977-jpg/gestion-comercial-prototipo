"use server";

import { revalidatePath } from "next/cache";

type ActionResult = { success: boolean; message: string };

// ─── Inline payload types ─────────────────────────────────────────────────────
// These mirror SmartProduct / SmartVariant from @/lib/excel/smart-product-import.
// Defined here inline to avoid importing the client-only engine into a server action.

type ImportVariantPayload = {
  supplierSku?: string;
  presentation?: string;
  color?: string;
  size?: string;
  purchasePrice?: number;
};

type ImportProductPayload = {
  productName: string;
  brand?: string;
  model?: string;
  category?: string;
  variants: ImportVariantPayload[];
};

// normKey — mirrors the one in smart-product-import (no xlsx dependency)
function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

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

  // 7. Vincular preferred_catalog_item_id en la variante recién creada
  //    (silencioso: la columna puede no existir si el SQL de migración aún no se ejecutó)
  await supabase
    .from("product_variants")
    .update({ preferred_catalog_item_id: itemId })
    .eq("id", newVariant.id)
    .then(({ error: prefErr }) => {
      if (prefErr) {
        console.warn("[importCatalogItemToMaster] preferred_catalog_item_id:", prefErr.message);
      }
    });

  revalidatePaths(supplierId);
  revalidatePath("/productos");

  return {
    success: true,
    message: `Producto "${item.product_name}" importado al Maestro correctamente.`,
    productId: newProduct.id,
    variantId: newVariant.id,
  };
}

// ---------------------------------------------------------------------------
// Eliminar ítems del catálogo (bulk hard delete)
// ---------------------------------------------------------------------------
export type DeleteCatalogItemsResult = {
  success: boolean;
  message: string;
  deleted: number;
};

export async function deleteCatalogItemsBulk(
  supplierId: string,
  itemIds: string[],
): Promise<DeleteCatalogItemsResult> {
  if (itemIds.length === 0) {
    return { success: false, message: "No hay ítems seleccionados.", deleted: 0 };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Limpiar preferred_catalog_item_id en variantes que apunten a estos items
  await supabase
    .from("product_variants")
    .update({ preferred_catalog_item_id: null })
    .in("preferred_catalog_item_id", itemIds);

  // Borrar los ítems del catálogo
  const { error, count } = await supabase
    .from("supplier_catalog_items")
    .delete({ count: "exact" })
    .in("id", itemIds)
    .eq("supplier_id", supplierId); // seguridad: solo del proveedor correcto

  if (error) {
    return {
      success: false,
      message: "Error al eliminar ítems: " + error.message,
      deleted: 0,
    };
  }

  revalidatePaths(supplierId);

  return {
    success: true,
    message: `${count ?? itemIds.length} ítem(s) eliminado(s) del catálogo.`,
    deleted: count ?? itemIds.length,
  };
}

// ---------------------------------------------------------------------------
// Smart import (upsert or replace)
// ---------------------------------------------------------------------------

export type SmartCatalogImportMode = "update" | "replace";

export type SmartCatalogImportResult = {
  success: boolean;
  message: string;
  inserted: number;
  updated: number;
  deactivated: number;
  errors: string[];
};

// ── Catalog row shape ────────────────────────────────────────────────────────

type CatalogRow = {
  supplier_id: string;
  supplier_sku: string | null;
  product_name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  presentation: string | null;
  color: string | null;
  size: string | null;
  purchase_price: number;
  is_active: boolean;
};

type ExistingCatalogItem = {
  id: string;
  supplier_sku: string | null;
  product_name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  presentation: string | null;
  color: string | null;
  size: string | null;
};

/**
 * Build a normalised signature string for a catalog item based on its full set
 * of identifying attributes (used when no supplier_sku is available).
 *
 * "Flora Gucci EDP", brand="Gucci", presentation="50ml"
 *   → "floragucci|gucci|||50ml||"
 *
 * This prevents items that share a product_name but differ in variant attributes
 * (size, color, presentation) from being merged.
 */
function buildSupplierCatalogSignature(item: {
  product_name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  presentation: string | null;
  color: string | null;
  size: string | null;
}): string {
  return [
    item.product_name,
    item.brand ?? "",
    item.model ?? "",
    item.category ?? "",
    item.presentation ?? "",
    item.color ?? "",
    item.size ?? "",
  ]
    .map((v) => normKey(v))
    .join("|");
}

/**
 * Import SmartProduct[] (already parsed client-side) into supplier_catalog_items.
 *
 * ── SAFETY RULES ────────────────────────────────────────────────────────────
 * ✓  Only touches supplier_catalog_items for this supplierId.
 * ✓  Never deletes catalog items (preserves IDs for trazabilidad).
 * ✓  Never touches product_variants, products, stock, or preferred_catalog_item_id.
 * ✓  Never clears linked_product_id / linked_variant_id.
 *
 * ── MODES ───────────────────────────────────────────────────────────────────
 * "update"  → upsert only the rows that appear in the Excel.
 *             Items NOT in the Excel are left untouched (no deactivation).
 *             Match: by supplier_sku first; if absent, by full-attribute signature.
 *
 * "replace" → upsert incoming rows + mark items NOT in the Excel as is_active=false.
 *             No deletion. IDs are preserved. preferred_catalog_item_id is NOT cleared.
 *             If is_active column does not exist, falls back to "update" mode silently.
 */
export async function importCatalogItemsSmart(
  supplierId: string,
  products: ImportProductPayload[],
  importMode: SmartCatalogImportMode,
): Promise<SmartCatalogImportResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const errors: string[] = [];

  // ── Flatten incoming products → catalog row objects ───────────────────────
  const rows: CatalogRow[] = products.flatMap((p) =>
    p.variants.map((v) => ({
      supplier_id: supplierId,
      supplier_sku: v.supplierSku?.trim() || null,
      product_name: p.productName.trim(),
      brand: p.brand?.trim() || null,
      model: p.model?.trim() || null,
      category: p.category?.trim() || null,
      presentation: v.presentation?.trim() || null,
      color: v.color?.trim() || null,
      size: v.size?.trim() || null,
      purchase_price: v.purchasePrice ?? 0,
      is_active: true,
    })),
  );

  if (rows.length === 0) {
    return {
      success: false,
      message: "No hay filas válidas para importar.",
      inserted: 0,
      updated: 0,
      deactivated: 0,
      errors,
    };
  }

  // ── REPLACE mode: verificar que is_active existe ANTES de mutar nada ─────
  // Si la columna no existe no podemos desactivar ítems obsoletos sin borrarlos,
  // por lo que se cancela la operación completamente.
  // "Actualizar catálogo" no requiere este chequeo y siempre puede continuar.
  if (importMode === "replace") {
    const { error: colCheckErr } = await supabase
      .from("supplier_catalog_items")
      .select("is_active")
      .limit(0);

    if (colCheckErr) {
      const isColMissing =
        colCheckErr.message.toLowerCase().includes("does not exist") ||
        colCheckErr.message.toLowerCase().includes("no existe") ||
        colCheckErr.code === "42703"; // PostgreSQL: undefined_column

      const msg = isColMissing
        ? "No se puede usar «Reemplazar catálogo»: la columna is_active no existe " +
          "en supplier_catalog_items. Sin esa columna no es posible desactivar ítems " +
          "obsoletos sin borrarlos, lo que rompería la trazabilidad. " +
          "Usa «Actualizar catálogo» en su lugar, o añade la columna is_active a la tabla."
        : "Error al verificar estructura de la tabla antes de reemplazar: " +
          colCheckErr.message;

      return {
        success: false,
        message: msg,
        inserted: 0,
        updated: 0,
        deactivated: 0,
        errors: [msg],
      };
    }
  }

  // ── Fetch existing catalog items for this supplier ────────────────────────
  const { data: existingItems } = await supabase
    .from("supplier_catalog_items")
    .select("id, supplier_sku, product_name, brand, model, category, presentation, color, size")
    .eq("supplier_id", supplierId);

  // Build lookup maps
  // 1) By supplier_sku: normKey(sku) → id  (highest precision)
  const bySkuMap = new Map<string, string>();
  // 2) By full attribute signature: signature → id  (for items without SKU)
  const bySignatureMap = new Map<string, string>();

  if (existingItems) {
    for (const item of existingItems as ExistingCatalogItem[]) {
      if (item.supplier_sku) {
        bySkuMap.set(normKey(item.supplier_sku), item.id);
      }
      bySignatureMap.set(buildSupplierCatalogSignature(item), item.id);
    }
  }

  // ── Classify incoming rows into UPDATE vs INSERT ──────────────────────────
  const toInsert: CatalogRow[] = [];
  const toUpdate: Array<{
    id: string;
    row: Omit<CatalogRow, "supplier_id"> & { updated_at: string };
  }> = [];
  const incomingIds = new Set<string>(); // IDs of existing items that will be touched

  for (const row of rows) {
    let existingId: string | undefined;

    // 1. Match by SKU (most precise — a supplier SKU uniquely identifies an item)
    if (row.supplier_sku) {
      existingId = bySkuMap.get(normKey(row.supplier_sku));
    }

    // 2. Fall back to full-attribute signature
    //    This correctly distinguishes "Flora Gucci 50ml" from "Flora Gucci 100ml"
    //    even though they share the same product_name base.
    if (!existingId) {
      existingId = bySignatureMap.get(buildSupplierCatalogSignature(row));
    }

    if (existingId) {
      incomingIds.add(existingId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { supplier_id: _sid, ...rest } = row;
      toUpdate.push({
        id: existingId,
        row: { ...rest, updated_at: new Date().toISOString() },
      });
    } else {
      toInsert.push(row);
    }
  }

  // ── Execute updates ───────────────────────────────────────────────────────
  let updateErrors = 0;
  for (const { id, row } of toUpdate) {
    const { error } = await supabase
      .from("supplier_catalog_items")
      .update(row)
      .eq("id", id);
    if (error) {
      updateErrors++;
      errors.push(`Error actualizando "${row.product_name}": ${error.message}`);
    }
  }

  // ── Execute inserts ───────────────────────────────────────────────────────
  let insertedCount = 0;
  if (toInsert.length > 0) {
    const { error, count } = await supabase
      .from("supplier_catalog_items")
      .insert(toInsert);
    if (error) {
      errors.push("Error al insertar nuevos ítems: " + error.message);
    } else {
      insertedCount = count ?? toInsert.length;
      // Add newly inserted items to incomingIds (they're already active)
    }
  }

  // ── REPLACE mode: mark NOT-incoming items as is_active = false ────────────
  // We only reach here if the is_active column check above passed.
  // NEVER deletes rows. NEVER touches product_variants, products, or stock.
  // NEVER clears preferred_catalog_item_id or linked_product_id/linked_variant_id.
  let deactivatedCount = 0;
  if (importMode === "replace" && existingItems) {
    const notIncomingIds = (existingItems as ExistingCatalogItem[])
      .map((i) => i.id)
      .filter((id) => !incomingIds.has(id));

    if (notIncomingIds.length > 0) {
      const { error: deactErr, count: deactCount } = await supabase
        .from("supplier_catalog_items")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", notIncomingIds);

      if (deactErr) {
        // Column check passed but update still failed — unexpected error, surface it
        errors.push(`Error al desactivar ítems obsoletos: ${deactErr.message}`);
      } else {
        deactivatedCount = deactCount ?? notIncomingIds.length;
      }
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  const updatedCount = toUpdate.length - updateErrors;
  const total = insertedCount + updatedCount;

  if (total === 0 && errors.length > 0) {
    return {
      success: false,
      message: "No se pudo importar ningún ítem.",
      inserted: 0,
      updated: 0,
      deactivated: 0,
      errors,
    };
  }

  revalidatePaths(supplierId);

  const deactMsg =
    importMode === "replace" && deactivatedCount > 0
      ? ` · ${deactivatedCount} desactivado(s) (no estaban en el Excel)`
      : "";

  return {
    success: true,
    message:
      `${total} producto(s) procesado(s) · ${updatedCount} actualizado(s), ${insertedCount} nuevo(s)${deactMsg}.` +
      (errors.length > 0 ? ` (${errors.length} advertencia(s))` : ""),
    inserted: insertedCount,
    updated: updatedCount,
    deactivated: deactivatedCount,
    errors,
  };
}
