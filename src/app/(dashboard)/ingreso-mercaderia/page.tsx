import Link from "next/link";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { GoodsReceiptList } from "@/modules/ingreso-mercaderia/components/GoodsReceiptList";
import { GoodsReceiptHistoryTable } from "@/modules/ingreso-mercaderia/components/GoodsReceiptHistoryTable";
import {
  getReceivableOrders,
  getGoodsReceiptHistory,
} from "@/modules/ingreso-mercaderia/services/goods-receipts";

// ─── Tab bar (solo Links — no necesita "use client") ─────────────────────────

function TabBar({ active }: { active: "pendientes" | "historial" }) {
  const base =
    "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors";
  const activeClass = "border-cyan-600 text-cyan-700";
  const inactiveClass =
    "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300";

  return (
    <div className="flex border-b border-slate-200">
      <Link
        href="/ingreso-mercaderia"
        className={`${base} ${active === "pendientes" ? activeClass : inactiveClass}`}
      >
        Pendientes de recibir
      </Link>
      <Link
        href="/ingreso-mercaderia?tab=historial"
        className={`${base} ${active === "historial" ? activeClass : inactiveClass}`}
      >
        Historial de ingresos
      </Link>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function IngresoMercaderiaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const isHistory = tab === "historial";

  // Fetch solo lo que corresponde a la pestaña activa
  const [orders, history] = await Promise.all([
    isHistory ? Promise.resolve([]) : getReceivableOrders(),
    isHistory ? getGoodsReceiptHistory() : Promise.resolve([]),
  ]);

  return (
    <DashboardPageShell
      title="Ingreso de Mercadería"
      subtitle="Registra la llegada de productos. Aquí se suma el stock real al Maestro."
    >
      <div className="space-y-4">
        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <TabBar active={isHistory ? "historial" : "pendientes"} />

        {/* ── Contenido de la pestaña activa ────────────────────────────────── */}
        {isHistory ? (
          /* ── Historial ────────────────────────────────────────────────────── */
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {history.length} ingreso{history.length !== 1 ? "s" : ""} registrado
              {history.length !== 1 ? "s" : ""}
            </p>
            <GoodsReceiptHistoryTable receipts={history} />
          </div>
        ) : (
          /* ── Pendientes ──────────────────────────────────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {orders.length} orden{orders.length !== 1 ? "es" : ""} pendiente
                {orders.length !== 1 ? "s" : ""}
              </p>
              <Link
                href="/orden-compra"
                className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
              >
                Ver todas las Órdenes de Compra →
              </Link>
            </div>
            <GoodsReceiptList orders={orders} />
          </div>
        )}
      </div>
    </DashboardPageShell>
  );
}
