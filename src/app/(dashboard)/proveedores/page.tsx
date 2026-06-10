import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { SupplierTable } from "@/modules/proveedores/components/SupplierTable";
import { getSuppliersList } from "@/modules/proveedores/services/suppliers";

export default async function ProveedoresPage() {
  const suppliers = await getSuppliersList();

  return (
    <DashboardPageShell
      title="Proveedores"
      subtitle="Listado de proveedores activos con sus precios de compra por variante."
    >
      <SupplierTable suppliers={suppliers} />
    </DashboardPageShell>
  );
}
