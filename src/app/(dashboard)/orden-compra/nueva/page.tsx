import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { NewPurchaseOrderView } from "@/modules/orden-compra/components/NewPurchaseOrderView";
import {
  getActiveSuppliersForOC,
  getCatalogItemsForOC,
} from "@/modules/orden-compra/services/purchase-orders";

// En Next.js 15 App Router, searchParams es una Promise que debe awaitearse.
export default async function NuevaOrdenCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string }>;
}) {
  const params = await searchParams;
  const supplierId = params.supplierId ?? "";

  // Cargar proveedores activos y, si viene supplierId desde la URL, su catálogo
  const [suppliers, initialCatalog] = await Promise.all([
    getActiveSuppliersForOC(),
    supplierId ? getCatalogItemsForOC(supplierId) : Promise.resolve([]),
  ]);

  return (
    <DashboardPageShell
      title="Nueva Orden de Compra"
      subtitle="Selecciona un proveedor, agrega productos de su catálogo y emite la orden."
    >
      <NewPurchaseOrderView
        suppliers={suppliers}
        initialSupplierId={supplierId}
        initialCatalog={initialCatalog}
      />
    </DashboardPageShell>
  );
}
