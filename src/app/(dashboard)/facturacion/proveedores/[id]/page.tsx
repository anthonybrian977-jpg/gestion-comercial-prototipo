import { notFound } from "next/navigation";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { SupplierInvoiceDetailView } from "@/modules/facturacion/components/SupplierInvoiceDetailView";
import { getSupplierInvoiceDetail } from "@/modules/facturacion/services/supplier-invoices";

export default async function SupplierInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getSupplierInvoiceDetail(id);

  if (!invoice) notFound();

  return (
    <DashboardPageShell
      title={invoice.invoice_number}
      subtitle={`Factura de proveedor — ${invoice.supplier_name}`}
    >
      <SupplierInvoiceDetailView invoice={invoice} />
    </DashboardPageShell>
  );
}
