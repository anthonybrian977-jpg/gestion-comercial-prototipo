export type InventoryAlert = {
  id: string;
  product: string;
  detail: string;
  level: "critical" | "warning";
};

export type DashboardMetric = {
  label: string;
  value: string;
  tone: "primary" | "neutral" | "success" | "danger";
};

export type DashboardMetricsResult = {
  metrics: DashboardMetric[];
  alerts: InventoryAlert[];
};

type ProductVariantRow = {
  id: string;
  stock: number | null;
  min_stock: number | null;
  sku?: string | null;
  products?: { name: string | null } | { name: string | null }[] | null;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-PE").format(value);
}

function getVariantLabel(variant: ProductVariantRow): string {
  const productName = Array.isArray(variant.products)
    ? variant.products[0]?.name
    : variant.products?.name;

  if (productName && variant.sku) {
    return `${productName} (${variant.sku})`;
  }

  if (productName) return productName;
  if (variant.sku) return variant.sku;

  return `Variante ${variant.id}`;
}

function mapLowStockAlerts(variants: ProductVariantRow[]): InventoryAlert[] {
  return variants
    .filter((variant) => {
      const stock = variant.stock ?? 0;
      const minStock = variant.min_stock ?? 0;
      return stock <= minStock;
    })
    .map((variant) => {
      const stock = variant.stock ?? 0;
      const minStock = variant.min_stock ?? 0;

      return {
        id: variant.id,
        product: getVariantLabel(variant),
        detail: `Stock: ${formatNumber(stock)} · Mínimo: ${formatNumber(minStock)}`,
        level: (stock === 0 ? "critical" : "warning") as "critical" | "warning",
      };
    })
    .sort((a, b) => {
      const order = { critical: 0, warning: 1 };
      return order[a.level] - order[b.level];
    });
}

export async function getDashboardMetrics(): Promise<DashboardMetricsResult> {
  const { createSupabaseClient } = await import("@/lib/supabase/client");
  const supabase = createSupabaseClient();

  const [
    activeProductsResult,
    activeVariantsResult,
    stockVariantsResult,
    alertVariantsResult,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("product_variants")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("product_variants")
      .select("stock")
      .eq("status", "active"),
    supabase
      .from("product_variants")
      .select("id, stock, min_stock, sku, products(name)")
      .eq("status", "active"),
  ]);

  if (
    activeProductsResult.error ||
    activeVariantsResult.error ||
    stockVariantsResult.error ||
    alertVariantsResult.error
  ) {
    throw new Error("No se pudieron cargar las métricas del dashboard.");
  }

  const activeProducts = activeProductsResult.count ?? 0;
  const activeVariants = activeVariantsResult.count ?? 0;
  const totalStock = (stockVariantsResult.data ?? []).reduce(
    (sum, row) => sum + (row.stock ?? 0),
    0,
  );

  const lowStockVariants = mapLowStockAlerts(
    (alertVariantsResult.data ?? []) as ProductVariantRow[],
  );

  return {
    metrics: [
      {
        label: "Productos activos",
        value: formatNumber(activeProducts),
        tone: "primary",
      },
      {
        label: "SKUs / variantes activos",
        value: formatNumber(activeVariants),
        tone: "neutral",
      },
      {
        label: "Stock total",
        value: formatNumber(totalStock),
        tone: "success",
      },
      {
        label: "Stock bajo",
        value: formatNumber(lowStockVariants.length),
        tone: lowStockVariants.length > 0 ? "danger" : "neutral",
      },
    ],
    alerts: lowStockVariants,
  };
}
