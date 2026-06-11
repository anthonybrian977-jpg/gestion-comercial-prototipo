import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { SupplierTable } from "@/modules/proveedores/components/SupplierTable";
import { NewSupplierButton } from "@/modules/proveedores/components/NewSupplierButton";
import { getSuppliersList } from "@/modules/proveedores/services/suppliers";

export default async function ProveedoresPage() {
  const suppliers = await getSuppliersList();

  return (
    <DashboardPageShell
      title="Proveedores"
      subtitle="Listado de proveedores con sus precios de compra por variante."
    >
      <div className="mb-5 flex justify-end">
        <NewSupplierButton />
      </div>
      <SupplierTable suppliers={suppliers} />
    </DashboardPageShell>
  );
}
