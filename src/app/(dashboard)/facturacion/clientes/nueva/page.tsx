import Link from "next/link";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { NewCustomerInvoiceView } from "@/modules/facturacion/components/NewCustomerInvoiceView";
import { getProductVariantsForInvoice } from "@/modules/facturacion/services/customer-invoices";

export default async function NuevaFacturaClientePage() {
  const variants = await getProductVariantsForInvoice();

  return (
    <DashboardPageShell
      title="Nueva Factura a Cliente"
      subtitle="Completa los datos del cliente y selecciona los productos"
    >
      <div className="space-y-4">
        <Link
          href="/facturacion/clientes"
          className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
        >
          ← Volver a Facturas a Clientes
        </Link>

        <NewCustomerInvoiceView variants={variants} />
      </div>
    </DashboardPageShell>
  );
}
