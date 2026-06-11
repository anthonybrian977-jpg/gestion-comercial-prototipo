import type {
  SupplierCatalogItem,
  SupplierDetail,
  SupplierListItem,
  SupplierRecord,
} from "@/modules/proveedores/types";

type CatalogStatsRow = {
  supplier_id: string;
  linked_variant_id: string | null;
  id: string;
};

type ElectedRow = {
  preferred_catalog_item_id: string;
};

export async function getSuppliersList(): Promise<SupplierListItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const [suppliersResult, catalogResult, electedResult] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase
      .from("supplier_catalog_items")
      .select("id, supplier_id, linked_variant_id"),
    // Obtener todos los preferred_catalog_item_id que no sean null
    supabase
      .from("product_variants")
      .select("preferred_catalog_item_id")
      .not("preferred_catalog_item_id", "is", null),
  ]);

  if (suppliersResult.error) {
    console.error("[proveedores] error al leer suppliers:", suppliersResult.error.message);
    return [];
  }

  const suppliers = (suppliersResult.data ?? []) as SupplierRecord[];
  if (suppliers.length === 0) return [];

  // Construir set de IDs elegidos
  const electedRows = (electedResult.error ? [] : (electedResult.data ?? [])) as ElectedRow[];
  const electedSet = new Set(electedRows.map((r) => r.preferred_catalog_item_id));

  // Acumular estadísticas por proveedor
  const catalogRows = (catalogResult.error ? [] : (catalogResult.data ?? [])) as CatalogStatsRow[];

  const stats = new Map<
    string,
    { catalog_count: number; mapped_count: number; elected_count: number; solo_catalog_count: number }
  >();

  for (const row of catalogRows) {
    const s = stats.get(row.supplier_id) ?? {
      catalog_count: 0,
      mapped_count: 0,
      elected_count: 0,
      solo_catalog_count: 0,
    };
    s.catalog_count++;
    if (electedSet.has(row.id)) {
      s.elected_count++;
      s.mapped_count++; // elegido implica mapeado
    } else if (row.linked_variant_id !== null) {
      s.mapped_count++;
    } else {
      s.solo_catalog_count++;
    }
    stats.set(row.supplier_id, s);
  }

  return suppliers.map((s) => {
    const st = stats.get(s.id) ?? {
      catalog_count: 0,
      mapped_count: 0,
      elected_count: 0,
      solo_catalog_count: 0,
    };
    return { ...s, ...st };
  });
}

// ---------------------------------------------------------------------------
// Detalle de un proveedor con su catálogo (Server Component)
// ---------------------------------------------------------------------------

export async function getSupplierDetail(
  id: string,
): Promise<SupplierDetail | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const [supplierResult, catalogResult] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", id).single(),
    supabase
      .from("supplier_catalog_items")
      .select("*")
      .eq("supplier_id", id)
      .order("product_name"),
  ]);

  if (supplierResult.error || !supplierResult.data) return null;

  const supplier = supplierResult.data as SupplierRecord;

  if (catalogResult.error) {
    console.warn(
      "[proveedores] supplier_catalog_items no disponible:",
      catalogResult.error.message,
    );
  }

  const catalog = (catalogResult.error ? [] : (catalogResult.data ?? [])) as SupplierCatalogItem[];

  // Obtener los IDs de catalog items que son "elegidos" por alguna variante
  const catalogItemIds = catalog.map((c) => c.id);
  let electedIds: string[] = [];

  if (catalogItemIds.length > 0) {
    const { data: electedRows, error: electedErr } = await supabase
      .from("product_variants")
      .select("preferred_catalog_item_id")
      .in("preferred_catalog_item_id", catalogItemIds)
      .not("preferred_catalog_item_id", "is", null);

    if (!electedErr && electedRows) {
      electedIds = electedRows
        .map((r: { preferred_catalog_item_id: string | null }) => r.preferred_catalog_item_id)
        .filter((id): id is string => id !== null);
    }
  }

  return { ...supplier, catalog, elected_catalog_item_ids: electedIds };
}
