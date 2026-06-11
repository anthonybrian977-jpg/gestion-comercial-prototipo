import Link from "next/link";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { CustomerInvoiceTable } from "@/modules/facturacion/components/CustomerInvoiceTable";
import { getCustomerInvoices } from "@/modules/facturacion/services/customer-invoices";

export default async function ClientesFacturacionPage() {
  const invoices = await getCustomerInvoices();

  return (
    <DashboardPageShell
      title="Facturas a Clientes"
      subtitle="Emisión y control de facturas de venta"
    >
      <div className="space-y-6">
        {/* Barra superior */}
        <div className="flex items-center justify-between">
          <Link
            href="/facturacion"
            className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
          >
            ← Volver a Facturación
          </Link>
          <Link
            href="/facturacion/clientes/nueva"
            className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            + Nueva factura
          </Link>
        </div>

        <CustomerInvoiceTable invoices={invoices} />
      </div>
    </DashboardPageShell>
  );
}
