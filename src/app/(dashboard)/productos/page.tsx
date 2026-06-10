import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { ProductTable } from "@/modules/productos/components/ProductTable";
import { getProductsCatalog } from "@/modules/productos/services/products";

export default async function ProductosPage() {
  const products = await getProductsCatalog();

  return (
    <DashboardPageShell
      title="Maestro de Productos"
      subtitle="Catálogo base de productos, variantes, precios y stock disponible."
    >
      <ProductTable products={products} />
    </DashboardPageShell>
  );
}
