import { notFound } from "next/navigation";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { getSupplierDetail } from "@/modules/proveedores/services/suppliers";
import { SupplierDetailView } from "@/modules/proveedores/components/SupplierDetailView";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplierDetail(id);

  if (!supplier) notFound();

  return (
    <DashboardPageShell title={supplier.name} subtitle="Productos y precios asociados">
      <SupplierDetailView supplier={supplier} />
    </DashboardPageShell>
  );
}
