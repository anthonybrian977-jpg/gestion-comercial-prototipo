import { notFound } from "next/navigation";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { PurchaseOrderDetailView } from "@/modules/orden-compra/components/PurchaseOrderDetailView";
import { getPurchaseOrderDetail } from "@/modules/orden-compra/services/purchase-orders";

export default async function OrdenCompraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getPurchaseOrderDetail(id);

  if (!order) {
    notFound();
  }

  return (
    <DashboardPageShell
      title={`Orden ${order.order_number}`}
      subtitle={`${order.supplier_name} · ${order.order_date}`}
    >
      <PurchaseOrderDetailView order={order} />
    </DashboardPageShell>
  );
}
