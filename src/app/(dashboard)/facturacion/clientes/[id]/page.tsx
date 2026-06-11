import { notFound } from "next/navigation";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { CustomerInvoiceDetailView } from "@/modules/facturacion/components/CustomerInvoiceDetailView";
import { getCustomerInvoiceDetail } from "@/modules/facturacion/services/customer-invoices";

export default async function CustomerInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getCustomerInvoiceDetail(id);

  if (!invoice) notFound();

  return (
    <DashboardPageShell
      title={invoice.invoice_number}
      subtitle={`Factura a cliente — ${invoice.customer_name_snapshot}`}
    >
      <CustomerInvoiceDetailView invoice={invoice} />
    </DashboardPageShell>
  );
}
