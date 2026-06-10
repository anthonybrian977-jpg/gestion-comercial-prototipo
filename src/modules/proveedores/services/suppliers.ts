import type { SupplierListItem, SupplierRecord } from "@/modules/proveedores/types";

type SpRow = {
  supplier_id: string;
  variant_id: string;
  purchase_price: number;
};

export async function getSuppliersList(): Promise<SupplierListItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const [suppliersResult, spResult] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase
      .from("supplier_products")
      .select("supplier_id, variant_id, purchase_price"),
  ]);

  if (suppliersResult.error) {
    // La tabla puede no existir todavía (schema.sql pendiente de ejecutar).
    console.error("[proveedores] error al leer suppliers:", suppliersResult.error.message);
    return [];
  }

  const suppliers = (suppliersResult.data ?? []) as SupplierRecord[];
  const spRows = (spResult.data ?? []) as SpRow[];

  if (suppliers.length === 0) return [];

  // Calcular precio mínimo por variante (para determinar "más barato")
  const variantMinPrice = new Map<string, number>();
  for (const row of spRows) {
    const current = variantMinPrice.get(row.variant_id);
    if (current === undefined || row.purchase_price < current) {
      variantMinPrice.set(row.variant_id, row.purchase_price);
    }
  }

  // Acumular estadísticas por proveedor
  const stats = new Map<string, { variant_count: number; cheapest_count: number }>();
  for (const row of spRows) {
    const s = stats.get(row.supplier_id) ?? { variant_count: 0, cheapest_count: 0 };
    s.variant_count++;
    const minPrice = variantMinPrice.get(row.variant_id) ?? Infinity;
    if (row.purchase_price <= minPrice) {
      s.cheapest_count++;
    }
    stats.set(row.supplier_id, s);
  }

  return suppliers.map((s) => {
    const st = stats.get(s.id) ?? { variant_count: 0, cheapest_count: 0 };
    return { ...s, ...st };
  });
}
