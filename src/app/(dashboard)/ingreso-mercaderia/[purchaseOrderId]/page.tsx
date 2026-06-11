import { notFound } from "next/navigation";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { GoodsReceiptDetailView } from "@/modules/ingreso-mercaderia/components/GoodsReceiptDetailView";
import { getOrderForReceipt } from "@/modules/ingreso-mercaderia/services/goods-receipts";

export default async function IngresoMercaderiaDetailPage({
  params,
}: {
  params: Promise<{ purchaseOrderId: string }>;
}) {
  const { purchaseOrderId } = await params;
  const order = await getOrderForReceipt(purchaseOrderId);

  if (!order) {
    notFound();
  }

  return (
    <DashboardPageShell
      title={`Ingreso de Mercadería — ${order.order_number}`}
      subtitle={`${order.supplier_name} · ${order.order_date}`}
    >
      <GoodsReceiptDetailView order={order} />
    </DashboardPageShell>
  );
}
