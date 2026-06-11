import { notFound } from "next/navigation";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { DispatchOrderDetailView } from "@/modules/despacho/components/DispatchOrderDetailView";
import { getDispatchOrderDetail } from "@/modules/despacho/services/dispatch-orders";

export default async function DispatchOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dispatch = await getDispatchOrderDetail(id);

  if (!dispatch) notFound();

  return (
    <DashboardPageShell
      title={dispatch.dispatch_number}
      subtitle={`Pedido de despacho — ${dispatch.customer_name_snapshot}`}
    >
      <DispatchOrderDetailView dispatch={dispatch} />
    </DashboardPageShell>
  );
}
