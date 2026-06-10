import type { ProductListItem, ProductRecord, ProductVariant } from "@/modules/productos/types";

function groupVariantsByProduct(
  variants: ProductVariant[],
): Map<string, ProductVariant[]> {
  const map = new Map<string, ProductVariant[]>();

  for (const variant of variants) {
    const current = map.get(variant.product_id) ?? [];
    current.push(variant);
    map.set(variant.product_id, current);
  }

  return map;
}

function buildProductListItem(
  product: ProductRecord,
  variants: ProductVariant[],
): ProductListItem {
  const activeVariants = variants.filter((variant) => variant.status === "active");
  const salePrices = activeVariants
    .map((variant) => variant.sale_price)
    .filter((price): price is number => price !== null);

  const priceFrom =
    salePrices.length > 0 ? Math.min(...salePrices) : null;

  const totalStock = activeVariants.reduce(
    (sum, variant) => sum + (variant.stock ?? 0),
    0,
  );

  const hasLowStock = activeVariants.some(
    (variant) => (variant.stock ?? 0) <= (variant.min_stock ?? 0),
  );

  return {
    ...product,
    priceFrom,
    totalStock,
    activeVariantCount: activeVariants.length,
    variants,
    hasLowStock,
  };
}

export async function getProductsCatalog(): Promise<ProductListItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const [productsResult, variantsResult] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("product_variants").select("*").order("sku"),
  ]);

  if (productsResult.error || variantsResult.error) {
    throw new Error("No se pudo cargar el catálogo de productos.");
  }

  const variantsByProduct = groupVariantsByProduct(
    (variantsResult.data ?? []) as ProductVariant[],
  );

  return ((productsResult.data ?? []) as ProductRecord[]).map((product) =>
    buildProductListItem(product, variantsByProduct.get(product.id) ?? []),
  );
}
