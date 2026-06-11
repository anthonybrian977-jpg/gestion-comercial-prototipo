import Link from "next/link";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { PurchaseOrderTable } from "@/modules/orden-compra/components/PurchaseOrderTable";
import { getPurchaseOrdersList } from "@/modules/orden-compra/services/purchase-orders";

export default async function OrdenCompraPage() {
  const orders = await getPurchaseOrdersList();

  return (
    <DashboardPageShell
      title="Órdenes de Compra"
      subtitle="Gestión de compras a proveedores. Al emitir una OC los productos se crean en el Maestro con stock 0."
    >
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {orders.length} orden{orders.length !== 1 ? "es" : ""}
          </p>
          <Link
            href="/orden-compra/nueva"
            className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            + Nueva Orden de Compra
          </Link>
        </div>

        {/* Tabla */}
        <PurchaseOrderTable orders={orders} />
      </div>
    </DashboardPageShell>
  );
}
