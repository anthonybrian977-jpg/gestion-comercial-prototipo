import Link from "next/link";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { ReceiptsForInvoicingTable } from "@/modules/facturacion/components/ReceiptsForInvoicingTable";
import { SupplierInvoiceTable } from "@/modules/facturacion/components/SupplierInvoiceTable";
import { getReceiptsForInvoicing } from "@/modules/facturacion/services/supplier-invoices";
import { getSupplierInvoices } from "@/modules/facturacion/services/supplier-invoices";

// ─── Barra de pestañas ────────────────────────────────────────────────────────

function TabBar({ activeTab }: { activeTab: string }) {
  const tabs = [
    { key: "pendientes", label: "Por facturar" },
    { key: "historial",  label: "Historial" },
  ];

  return (
    <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.key === "pendientes" ? "/facturacion/proveedores" : `?tab=${t.key}`}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === t.key
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function ProveedoresFacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "historial" ? "historial" : "pendientes";

  const [receipts, invoices] = await Promise.all([
    activeTab === "pendientes" ? getReceiptsForInvoicing() : Promise.resolve([]),
    activeTab === "historial"  ? getSupplierInvoices()     : Promise.resolve([]),
  ]);

  return (
    <DashboardPageShell
      title="Facturas de Proveedor"
      subtitle="Cuentas por pagar generadas desde ingresos de mercadería"
    >
      <div className="space-y-6">
        {/* Navegación de regreso */}
        <Link
          href="/facturacion"
          className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
        >
          ← Volver a Facturación
        </Link>

        <TabBar activeTab={activeTab} />

        {activeTab === "pendientes" && (
          <ReceiptsForInvoicingTable receipts={receipts} />
        )}

        {activeTab === "historial" && (
          <SupplierInvoiceTable invoices={invoices} />
        )}
      </div>
    </DashboardPageShell>
  );
}
