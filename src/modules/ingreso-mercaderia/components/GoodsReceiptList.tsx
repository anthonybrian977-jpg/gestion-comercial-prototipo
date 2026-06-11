import Link from "next/link";
import type { ReceivableOrder } from "@/modules/ingreso-mercaderia/types";
import { formatDateLima } from "@/lib/date-format";
import { STATUS_LABELS, STATUS_COLORS } from "@/modules/orden-compra/types";
import type { PurchaseOrderStatus } from "@/modules/orden-compra/types";

// ─── Barra de progreso ────────────────────────────────────────────────────────

function ProgressBar({ received, total }: { received: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (received / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-400" : "bg-slate-200"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-slate-500">
        {received}/{total}
      </span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GoodsReceiptList({ orders }: { orders: ReceivableOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          No hay órdenes pendientes de recibir.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Solo aparecen órdenes en estado <strong>Emitida</strong> o{" "}
          <strong>Recep. parcial</strong>.
        </p>
        <Link
          href="/orden-compra"
          className="mt-4 inline-block text-xs text-cyan-600 hover:underline"
        >
          → Ver todas las Órdenes de Compra
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {[
              "N° Orden",
              "Proveedor",
              "Fecha OC",
              "Estado",
              "Progreso",
              "Pendiente",
              "Acción",
            ].map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => {
            const status = order.status as PurchaseOrderStatus;
            return (
              <tr key={order.id} className="hover:bg-slate-50/50">
                {/* N° Orden */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {order.order_number}
                  </span>
                </td>

                {/* Proveedor */}
                <td className="px-4 py-3 text-xs text-slate-700">
                  {order.supplier_name}
                </td>

                {/* Fecha */}
                <td className="px-4 py-3 text-xs text-slate-500">
                  {formatDateLima(order.order_date)}
                </td>

                {/* Estado */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_COLORS[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                </td>

                {/* Progreso */}
                <td className="px-4 py-3">
                  <ProgressBar
                    received={order.total_received}
                    total={order.total_ordered}
                  />
                </td>

                {/* Pendiente */}
                <td className="px-4 py-3 text-xs font-semibold text-amber-700">
                  {order.total_pending > 0 ? (
                    <span>{order.total_pending} uds.</span>
                  ) : (
                    <span className="text-emerald-600">Completo</span>
                  )}
                </td>

                {/* Acción */}
                <td className="px-4 py-3">
                  <Link
                    href={`/ingreso-mercaderia/${order.id}`}
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
                  >
                    Registrar ingreso
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
