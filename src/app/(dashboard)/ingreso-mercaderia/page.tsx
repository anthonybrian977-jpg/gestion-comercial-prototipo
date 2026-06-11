import Link from "next/link";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { GoodsReceiptList } from "@/modules/ingreso-mercaderia/components/GoodsReceiptList";
import { getReceivableOrders } from "@/modules/ingreso-mercaderia/services/goods-receipts";

export default async function IngresoMercaderiaPage() {
  const orders = await getReceivableOrders();

  return (
    <DashboardPageShell
      title="Ingreso de Mercadería"
      subtitle="Registra la llegada de productos. Aquí se suma el stock real al Maestro."
    >
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {orders.length} orden{orders.length !== 1 ? "es" : ""} pendiente
            {orders.length !== 1 ? "s" : ""}
          </p>
          <Link
            href="/orden-compra"
            className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
          >
            Ver todas las Órdenes de Compra →
          </Link>
        </div>

        <GoodsReceiptList orders={orders} />
      </div>
    </DashboardPageShell>
  );
}
