import Link from "next/link";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { DispatchPendingView } from "@/modules/despacho/components/DispatchPendingView";
import { DispatchHistoryTable } from "@/modules/despacho/components/DispatchHistoryTable";
import {
  getIssuedInvoicesWithoutDispatch,
  getInProcessDispatchOrders,
  getDeliveredDispatchOrders,
} from "@/modules/despacho/services/dispatch-orders";

// ─── Barra de pestañas ────────────────────────────────────────────────────────

function TabBar({ activeTab }: { activeTab: string }) {
  const tabs = [
    { key: "pendientes", label: "Pendientes / En proceso" },
    { key: "historial",  label: "Historial" },
  ];

  return (
    <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={
            t.key === "pendientes"
              ? "/despacho"
              : `/despacho?tab=${t.key}`
          }
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

export default async function DespachoPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "historial" ? "historial" : "pendientes";

  const [pendingInvoices, inProcessOrders, historialOrders] = await Promise.all([
    activeTab === "pendientes" ? getIssuedInvoicesWithoutDispatch() : Promise.resolve([]),
    activeTab === "pendientes" ? getInProcessDispatchOrders()       : Promise.resolve([]),
    activeTab === "historial"  ? getDeliveredDispatchOrders()       : Promise.resolve([]),
  ]);

  return (
    <DashboardPageShell
      title="Despacho"
      subtitle="Salida y entrega de pedidos a clientes"
    >
      <div className="space-y-6">
        <TabBar activeTab={activeTab} />

        {activeTab === "pendientes" && (
          <DispatchPendingView
            pendingInvoices={pendingInvoices}
            inProcessOrders={inProcessOrders}
          />
        )}

        {activeTab === "historial" && (
          <DispatchHistoryTable orders={historialOrders} />
        )}
      </div>
    </DashboardPageShell>
  );
}
