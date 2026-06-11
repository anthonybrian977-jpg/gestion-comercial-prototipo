import type {
  SupplierCatalogItem,
  SupplierDetail,
  SupplierListItem,
  SupplierRecord,
} from "@/modules/proveedores/types";

type CatalogStatsRow = {
  supplier_id: string;
  imported_to_master: boolean;
};

export async function getSuppliersList(): Promise<SupplierListItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const [suppliersResult, catalogResult] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase
      .from("supplier_catalog_items")
      .select("supplier_id, imported_to_master"),
  ]);

  if (suppliersResult.error) {
    console.error("[proveedores] error al leer suppliers:", suppliersResult.error.message);
    return [];
  }

  const suppliers = (suppliersResult.data ?? []) as SupplierRecord[];
  if (suppliers.length === 0) return [];

  // Acumular estadísticas por proveedor desde el catálogo
  // (si la tabla aún no existe, catalogResult.data será null — stats en 0)
  const catalogRows = (catalogResult.data ?? []) as CatalogStatsRow[];

  const stats = new Map<string, { catalog_count: number; imported_count: number; pending_count: number }>();
  for (const row of catalogRows) {
    const s = stats.get(row.supplier_id) ?? { catalog_count: 0, imported_count: 0, pending_count: 0 };
    s.catalog_count++;
    if (row.imported_to_master) {
      s.imported_count++;
    } else {
      s.pending_count++;
    }
    stats.set(row.supplier_id, s);
  }

  return suppliers.map((s) => {
    const st = stats.get(s.id) ?? { catalog_count: 0, imported_count: 0, pending_count: 0 };
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

  return { ...supplier, catalog };
}
