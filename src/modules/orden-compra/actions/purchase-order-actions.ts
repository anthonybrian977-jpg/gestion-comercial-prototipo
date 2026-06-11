"use server";

import { revalidatePath } from "next/cache";
import { slugifyForSku } from "@/modules/productos/utils/sku";
import type {
  CartItem,
  PurchaseOrderActionResult,
  PurchaseOrderItem,
  SaveDraftPayload,
  SupplierAlternative,
} from "@/modules/orden-compra/types";
import type { SupplierCatalogItem } from "@/modules/proveedores/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateOCPaths(orderId?: string) {
  revalidatePath("/orden-compra");
  if (orderId) revalidatePath(`/orden-compra/${orderId}`);
  revalidatePath("/productos");
  revalidatePath("/proveedores");
}

/**
 * Genera el número de OC.
 * Primero intenta la función SQL (disponible tras la migración).
 * Si no existe, calcula el correlativo desde TypeScript.
 */
async function generateOrderNumber(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>): Promise<string> {
  // Intentar función SQL
  const { data: rpcData, error: rpcErr } = await supabase.rpc("generate_order_number");
  if (!rpcErr && rpcData) return rpcData as string;

  // Fallback TypeScript
  const year = new Date().getFullYear().toString();
  const { count } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .ilike("order_number", `OC-${year}-%`);

  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `OC-${year}-${seq}`;
}

// ─── Server action: cargar catálogo de un proveedor (lectura) ─────────────────
// Usado por NewPurchaseOrderView cuando el usuario cambia el proveedor seleccionado.

export async function getCatalogForSupplier(
  supplierId: string,
): Promise<SupplierCatalogItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("supplier_catalog_items")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("is_active", true)
    .order("product_name");

  if (error) return [];
  return (data ?? []) as SupplierCatalogItem[];
}

// ─── Helper: normalización para matching entre catálogos ─────────────────────

/** Minúsculas + trim + espacios colapsados. No slugifica para no perder info. */
function normalizeForMatch(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

// ─── Server action: comparativa de proveedores ────────────────────────────────
/**
 * Para cada ítem del catálogo actual busca el mismo producto en catálogos de
 * otros proveedores. Matching primario por linked_variant_id (exacto); si no,
 * por nombre + marca + modelo + categoría + atributos normalizados.
 *
 * Retorna mapa catalogItemId → alternativas ordenadas de más barata a más cara.
 * No modifica nada — solo lectura.
 */
export async function getAlternativesForCatalog(
  currentSupplierId: string,
  catalogItemIds: string[],
): Promise<Record<string, SupplierAlternative[]>> {
  if (catalogItemIds.length === 0) return {};

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Nuestros ítems con todos los campos de matching
  const { data: ourItems, error: ourErr } = await supabase
    .from("supplier_catalog_items")
    .select(
      "id, product_name, brand, model, category, presentation, color, size, linked_variant_id, purchase_price",
    )
    .in("id", catalogItemIds);

  if (ourErr || !ourItems || ourItems.length === 0) return {};

  // Ítems activos de OTROS proveedores (join con suppliers para nombre)
  const { data: othersRaw, error: othersErr } = await supabase
    .from("supplier_catalog_items")
    .select(
      "id, supplier_id, product_name, brand, model, category, presentation, color, size, linked_variant_id, purchase_price, suppliers(name)",
    )
    .eq("is_active", true)
    .neq("supplier_id", currentSupplierId);

  if (othersErr || !othersRaw || othersRaw.length === 0) return {};

  type OurItem = {
    id: string;
    product_name: string;
    brand: string | null;
    model: string | null;
    category: string | null;
    presentation: string | null;
    color: string | null;
    size: string | null;
    linked_variant_id: string | null;
    purchase_price: number;
  };
  type OtherItem = OurItem & {
    supplier_id: string;
    // Supabase puede devolver la relación como objeto o array según el driver
    suppliers: { name: string } | { name: string }[] | null;
  };

  // Doble cast necesario porque el tipo inferido de Supabase difiere del runtime
  const others = othersRaw as unknown as OtherItem[];
  const result: Record<string, SupplierAlternative[]> = {};

  for (const our of ourItems as OurItem[]) {
    const found: SupplierAlternative[] = [];

    for (const other of others) {
      let isMatch = false;

      // Matching primario: mismo linked_variant_id (misma variante en Maestro)
      if (
        our.linked_variant_id &&
        other.linked_variant_id &&
        our.linked_variant_id === other.linked_variant_id
      ) {
        isMatch = true;
      } else if (
        normalizeForMatch(our.product_name) === normalizeForMatch(other.product_name)
      ) {
        // Matching secundario: nombre idéntico + atributos compatibles
        const ok =
          (!our.brand || !other.brand ||
            normalizeForMatch(our.brand) === normalizeForMatch(other.brand)) &&
          (!our.model || !other.model ||
            normalizeForMatch(our.model) === normalizeForMatch(other.model)) &&
          (!our.category || !other.category ||
            normalizeForMatch(our.category) === normalizeForMatch(other.category)) &&
          (!our.presentation || !other.presentation ||
            normalizeForMatch(our.presentation) === normalizeForMatch(other.presentation)) &&
          (!our.color || !other.color ||
            normalizeForMatch(our.color) === normalizeForMatch(other.color)) &&
          (!our.size || !other.size ||
            normalizeForMatch(our.size) === normalizeForMatch(other.size));
        if (ok) isMatch = true;
      }

      if (isMatch) {
        const priceDiff = our.purchase_price - other.purchase_price;
        // suppliers puede ser objeto o array según la versión del driver
        const suppliersRaw = other.suppliers;
        const supplierName = Array.isArray(suppliersRaw)
          ? (suppliersRaw[0]?.name ?? "Proveedor desconocido")
          : (suppliersRaw?.name ?? "Proveedor desconocido");
        found.push({
          supplierId: other.supplier_id,
          supplierName,
          catalogItemId: other.id,
          price: other.purchase_price,
          priceDiff,
          priceDiffPct:
            our.purchase_price > 0
              ? (priceDiff / our.purchase_price) * 100
              : 0,
        });
      }
    }

    if (found.length > 0) {
      // Ordenar: alternativa más barata primero (mayor priceDiff al frente)
      result[our.id] = found.sort((a, b) => b.priceDiff - a.priceDiff);
    }
  }

  return result;
}

// ─── Server action: guardar borrador ─────────────────────────────────────────
/**
 * Crea o actualiza una Orden de Compra en estado "draft".
 * - Si payload.orderId existe → actualiza esa OC (solo si está en draft).
 * - Si no → crea una nueva OC con order_number generado.
 *
 * Reglas:
 * - NO modifica stock.
 * - NO crea productos en el Maestro (eso ocurre al emitir).
 * - Solo inserta/reemplaza los ítems de la OC.
 */
export async function saveDraftPurchaseOrder(
  payload: SaveDraftPayload,
): Promise<PurchaseOrderActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // ── Validaciones básicas ───────────────────────────────────────────────────
  if (!payload.supplierId) {
    return { success: false, message: "Debes seleccionar un proveedor." };
  }
  if (payload.items.length === 0) {
    return { success: false, message: "Debes agregar al menos un producto." };
  }
  for (const item of payload.items) {
    if (item.quantity <= 0) {
      return { success: false, message: `La cantidad de "${item.productName}" debe ser mayor a 0.` };
    }
    if (item.unitCost < 0) {
      return { success: false, message: `El precio de "${item.productName}" no puede ser negativo.` };
    }
  }

  // ── Calcular totales ───────────────────────────────────────────────────────
  const subtotal = payload.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  );
  const total = subtotal; // sin impuestos por ahora

  // ── Upsert purchase_orders ────────────────────────────────────────────────
  let orderId: string;

  if (payload.orderId) {
    // Actualizar borrador existente
    const { data: existing, error: fetchErr } = await supabase
      .from("purchase_orders")
      .select("id, status")
      .eq("id", payload.orderId)
      .single();

    if (fetchErr || !existing) {
      return { success: false, message: "No se encontró la orden de compra." };
    }
    if ((existing as { status: string }).status !== "draft") {
      return { success: false, message: "Solo se pueden editar órdenes en estado borrador." };
    }

    const { error: updateErr } = await supabase
      .from("purchase_orders")
      .update({
        supplier_id: payload.supplierId,
        order_date: payload.orderDate || new Date().toISOString().slice(0, 10),
        expected_date: payload.expectedDate || null,
        notes: payload.notes || null,
        subtotal,
        total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.orderId);

    if (updateErr) {
      return { success: false, message: "Error al actualizar la orden: " + updateErr.message };
    }
    orderId = payload.orderId;

    // Eliminar ítems anteriores y reemplazar — abortar si falla
    const { error: deleteErr } = await supabase
      .from("purchase_order_items")
      .delete()
      .eq("purchase_order_id", orderId);

    if (deleteErr) {
      return {
        success: false,
        message: "Error al limpiar los ítems anteriores: " + deleteErr.message,
      };
    }

  } else {
    // Crear nueva OC
    const orderNumber = await generateOrderNumber(supabase);

    const { data: newOrder, error: insertErr } = await supabase
      .from("purchase_orders")
      .insert({
        order_number: orderNumber,
        supplier_id: payload.supplierId,
        status: "draft",
        order_date: payload.orderDate || new Date().toISOString().slice(0, 10),
        expected_date: payload.expectedDate || null,
        notes: payload.notes || null,
        subtotal,
        total,
      })
      .select("id")
      .single();

    if (insertErr || !newOrder) {
      return {
        success: false,
        message: "Error al crear la orden: " + (insertErr?.message ?? "sin ID"),
      };
    }
    orderId = (newOrder as { id: string }).id;
  }

  // ── Insertar ítems ────────────────────────────────────────────────────────
  const itemRows = payload.items.map((item) => ({
    purchase_order_id: orderId,
    supplier_catalog_item_id: item.catalogItemId || null,
    supplier_sku_snapshot: item.supplierSku ?? null,
    product_name_snapshot: item.productName,
    brand_snapshot: item.brand ?? null,
    model_snapshot: item.model ?? null,
    category_snapshot: item.category ?? null,
    presentation_snapshot: item.presentation ?? null,
    color_snapshot: item.color ?? null,
    size_snapshot: item.size ?? null,
    quantity_ordered: item.quantity,
    quantity_received: 0,
    unit_cost: item.unitCost,
    line_total: item.quantity * item.unitCost,
    notes: item.notes || null,
  }));

  const { error: itemsErr } = await supabase
    .from("purchase_order_items")
    .insert(itemRows);

  if (itemsErr) {
    // Rollback: eliminar la orden recién creada si falló el insert de ítems
    if (!payload.orderId) {
      await supabase.from("purchase_orders").delete().eq("id", orderId);
    }
    return { success: false, message: "Error al guardar los ítems: " + itemsErr.message };
  }

  revalidateOCPaths(orderId);

  return {
    success: true,
    message: "Borrador guardado.",
    orderId,
  };
}

// ─── Server action: emitir OC ─────────────────────────────────────────────────
/**
 * Transiciona la OC de "draft" a "issued".
 *
 * Para cada ítem de la OC:
 *  1. Si supplier_catalog_items ya tiene linked_product_id + linked_variant_id → reutilizar.
 *  2. Si no → crear product + product_variant con stock = 0 (NUNCA modificar stock).
 *  3. Actualizar supplier_catalog_items con los IDs del Maestro.
 *  4. Actualizar product_variants.preferred_catalog_item_id SOLO si está null.
 *  5. Actualizar purchase_order_items.linked_product_id / linked_variant_id.
 *
 * NUNCA:
 * - Suma stock.
 * - Borra productos existentes.
 * - Cambia preferred_catalog_item_id si ya tiene valor.
 * - Toca Facturación, Despacho, supplier_products.
 */
export async function issuePurchaseOrder(
  orderId: string,
): Promise<PurchaseOrderActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const errors: string[] = [];

  // ── Cargar orden ──────────────────────────────────────────────────────────
  const { data: orderData, error: orderErr } = await supabase
    .from("purchase_orders")
    .select("id, status, order_number")
    .eq("id", orderId)
    .single();

  if (orderErr || !orderData) {
    return { success: false, message: "No se encontró la orden de compra." };
  }

  const order = orderData as { id: string; status: string; order_number: string };

  if (order.status !== "draft") {
    return {
      success: false,
      message: `La orden "${order.order_number}" ya está en estado "${order.status}". Solo se pueden emitir borradores.`,
    };
  }

  // ── Cargar ítems de la OC ─────────────────────────────────────────────────
  const { data: itemsData, error: itemsErr } = await supabase
    .from("purchase_order_items")
    .select("*")
    .eq("purchase_order_id", orderId);

  if (itemsErr) {
    return { success: false, message: "Error al leer los ítems: " + itemsErr.message };
  }

  const items = (itemsData ?? []) as PurchaseOrderItem[];

  if (items.length === 0) {
    return { success: false, message: "La orden no tiene ítems. Agrega productos antes de emitir." };
  }

  // ── Procesar cada ítem → crear/vincular en Maestro ────────────────────────
  for (const item of items) {
    let productId: string | null = null;
    let variantId: string | null = null;

    // 1. Leer el catalog item (si existe)
    let catalogItem: SupplierCatalogItem | null = null;
    if (item.supplier_catalog_item_id) {
      const { data: ci } = await supabase
        .from("supplier_catalog_items")
        .select("id, linked_product_id, linked_variant_id, imported_to_master")
        .eq("id", item.supplier_catalog_item_id)
        .single();
      catalogItem = ci as SupplierCatalogItem | null;
    }

    // 2. Reutilizar vínculos existentes si ya están creados
    if (catalogItem?.linked_product_id && catalogItem?.linked_variant_id) {
      productId = catalogItem.linked_product_id;
      variantId = catalogItem.linked_variant_id;
    } else {
      // 3. Crear o encontrar producto/variante en Maestro
      try {
        const result = await createOrFindProductVariant(supabase, item);
        productId = result.productId;
        variantId = result.variantId;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`"${item.product_name_snapshot}": ${msg}`);
        continue; // No bloquear los demás ítems
      }
    }

    if (!productId || !variantId) continue;

    // 4. Actualizar supplier_catalog_items con vínculos al Maestro
    if (item.supplier_catalog_item_id) {
      const { error: catalogUpdateErr } = await supabase
        .from("supplier_catalog_items")
        .update({
          linked_product_id: productId,
          linked_variant_id: variantId,
          imported_to_master: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.supplier_catalog_item_id);

      if (catalogUpdateErr) {
        errors.push(
          `"${item.product_name_snapshot}": error al actualizar catálogo del proveedor — ${catalogUpdateErr.message}`,
        );
        continue; // No continuar con este ítem si el catálogo no se actualizó
      }

      // 5. preferred_catalog_item_id: SOLO si está null (no reemplazar proveedor elegido)
      const { error: preferredErr } = await supabase
        .from("product_variants")
        .update({ preferred_catalog_item_id: item.supplier_catalog_item_id })
        .eq("id", variantId)
        .is("preferred_catalog_item_id", null);

      if (preferredErr) {
        errors.push(
          `"${item.product_name_snapshot}": error al asignar catálogo preferido — ${preferredErr.message}`,
        );
        continue;
      }
    }

    // 6. Actualizar purchase_order_items con los IDs del Maestro
    const { error: itemLinkErr } = await supabase
      .from("purchase_order_items")
      .update({
        linked_product_id: productId,
        linked_variant_id: variantId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (itemLinkErr) {
      errors.push(
        `"${item.product_name_snapshot}": error al vincular el ítem con el Maestro — ${itemLinkErr.message}`,
      );
    }
  }

  // ── Si hubo errores en ítems, NO emitir — dejar en draft ─────────────────
  if (errors.length > 0) {
    return {
      success: false,
      message:
        "No se pudo emitir la orden porque algunos ítems no pudieron vincularse al Maestro. La orden sigue como borrador.",
      errors,
    };
  }

  // ── Actualizar estado de la OC ────────────────────────────────────────────
  const { error: statusErr } = await supabase
    .from("purchase_orders")
    .update({
      status: "issued",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (statusErr) {
    return {
      success: false,
      message: "Error al cambiar el estado de la orden: " + statusErr.message,
    };
  }

  revalidateOCPaths(orderId);

  return {
    success: true,
    message: `Orden "${order.order_number}" emitida. Productos creados/vinculados en Maestro con stock 0.`,
    orderId,
  };
}

// ─── Server action: cancelar OC ──────────────────────────────────────────────
export async function cancelPurchaseOrder(
  orderId: string,
): Promise<PurchaseOrderActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: order, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("id, status, order_number")
    .eq("id", orderId)
    .single();

  if (fetchErr || !order) {
    return { success: false, message: "No se encontró la orden." };
  }

  const o = order as { id: string; status: string; order_number: string };

  if (o.status === "cancelled") {
    return { success: false, message: "La orden ya está anulada." };
  }
  if (o.status === "received") {
    return { success: false, message: "No se puede anular una orden que ya fue recibida." };
  }

  const { error: updateErr } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (updateErr) {
    return { success: false, message: "Error al anular la orden: " + updateErr.message };
  }

  revalidateOCPaths(orderId);

  return {
    success: true,
    message: `Orden "${o.order_number}" anulada.`,
    orderId,
  };
}

// ─── Helper: crear o encontrar product + product_variant ─────────────────────
/**
 * Busca un producto y variante existentes en el Maestro, o los crea si no existen.
 *
 * Lógica de búsqueda:
 *   Producto:  por main_sku = "OC-{slugify(nombre)}"
 *   Variante:  por sku = "{mainSku}[-{color}-{size}-{presentation}]"
 *
 * Regla obligatoria: stock = 0 siempre. NUNCA se modifica stock aquí.
 */
async function createOrFindProductVariant(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  item: Pick<
    PurchaseOrderItem,
    | "product_name_snapshot"
    | "brand_snapshot"
    | "model_snapshot"
    | "category_snapshot"
    | "color_snapshot"
    | "size_snapshot"
    | "presentation_snapshot"
    | "unit_cost"
  >,
): Promise<{ productId: string; variantId: string }> {
  const productName = item.product_name_snapshot.trim();
  const mainSku = `OC-${slugifyForSku(productName).slice(0, 40)}`;

  // ── Buscar o crear producto padre ──────────────────────────────────────────
  let productId: string;

  const { data: existingProduct } = await supabase
    .from("products")
    .select("id")
    .eq("main_sku", mainSku)
    .maybeSingle();

  if (existingProduct && (existingProduct as { id: string }).id) {
    productId = (existingProduct as { id: string }).id;
  } else {
    const { data: newProduct, error: productErr } = await supabase
      .from("products")
      .insert({
        name: productName,
        brand: item.brand_snapshot?.trim() || null,
        model: item.model_snapshot?.trim() || null,
        category: item.category_snapshot?.trim() || null,
        main_sku: mainSku,
        has_variants: false,
        status: "active",
      })
      .select("id")
      .single();

    if (productErr || !newProduct) {
      throw new Error(`No se pudo crear el producto: ${productErr?.message ?? "sin ID"}`);
    }
    productId = (newProduct as { id: string }).id;
  }

  // ── Construir SKU de variante ──────────────────────────────────────────────
  const variantParts = [
    item.color_snapshot,
    item.size_snapshot,
    item.presentation_snapshot,
  ]
    .filter((v): v is string => Boolean(v?.trim()))
    .map((v) => slugifyForSku(v).slice(0, 15));

  const baseVariantSku =
    variantParts.length > 0
      ? `${mainSku}-${variantParts.join("-")}`.slice(0, 60)
      : mainSku;

  // ── Buscar o crear variante ────────────────────────────────────────────────
  let variantId: string;

  const { data: existingVariant } = await supabase
    .from("product_variants")
    .select("id")
    .eq("sku", baseVariantSku)
    .maybeSingle();

  if (existingVariant && (existingVariant as { id: string }).id) {
    variantId = (existingVariant as { id: string }).id;
  } else {
    const variantPayload = {
      product_id: productId,
      sku: baseVariantSku,
      color: item.color_snapshot?.trim() || null,
      size: item.size_snapshot?.trim() || null,
      presentation: item.presentation_snapshot?.trim() || null,
      purchase_price: item.unit_cost,
      sale_price: 0,   // ← 0 = "pendiente de definir" — la OC no conoce el precio de venta
      stock: 0,        // ← SIEMPRE 0 — el stock lo suma Ingreso de Mercadería
      min_stock: 0,
      status: "active",
    };

    const { data: newVariant, error: variantErr } = await supabase
      .from("product_variants")
      .insert(variantPayload)
      .select("id")
      .single();

    if (variantErr) {
      // Colisión de SKU (23505) → agregar sufijo único y reintentar
      if (variantErr.code === "23505") {
        const suffix = Date.now().toString(36).slice(-4).toUpperCase();
        const fallbackSku = `${baseVariantSku.slice(0, 55)}-${suffix}`;

        const { data: retryVariant, error: retryErr } = await supabase
          .from("product_variants")
          .insert({ ...variantPayload, sku: fallbackSku })
          .select("id")
          .single();

        if (retryErr || !retryVariant) {
          throw new Error(`No se pudo crear la variante (SKU conflicto): ${retryErr?.message}`);
        }
        variantId = (retryVariant as { id: string }).id;
      } else {
        throw new Error(`No se pudo crear la variante: ${variantErr.message}`);
      }
    } else if (!newVariant) {
      throw new Error("No se pudo crear la variante: sin ID de respuesta.");
    } else {
      variantId = (newVariant as { id: string }).id;
    }
  }

  return { productId, variantId };
}
