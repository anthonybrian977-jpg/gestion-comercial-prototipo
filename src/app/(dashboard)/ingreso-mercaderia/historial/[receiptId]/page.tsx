import { notFound } from "next/navigation";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { GoodsReceiptHistoryDetailView } from "@/modules/ingreso-mercaderia/components/GoodsReceiptHistoryDetailView";
import { getGoodsReceiptDetail } from "@/modules/ingreso-mercaderia/services/goods-receipts";

export default async function GoodsReceiptDetailPage({
  params,
}: {
  params: Promise<{ receiptId: string }>;
}) {
  const { receiptId } = await params;
  const receipt = await getGoodsReceiptDetail(receiptId);

  if (!receipt) {
    notFound();
  }

  return (
    <DashboardPageShell
      title={`Ingreso ${receipt.receipt_number}`}
      subtitle={`${receipt.supplier_name} · OC ${receipt.order_number}`}
    >
      <GoodsReceiptHistoryDetailView receipt={receipt} />
    </DashboardPageShell>
  );
}
