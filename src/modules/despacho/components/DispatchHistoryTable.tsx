import Link from "next/link";
import type { DispatchOrderSummary } from "@/modules/despacho/types";
import { DISPATCH_STATUS_COLORS, DISPATCH_STATUS_LABELS } from "@/modules/despacho/types";
import { formatCurrency } from "@/modules/productos/utils/format";
import { formatDateLima, formatDateTimeLima } from "@/lib/date-format";

// ─── Componente principal ─────────────────────────────────────────────────────

export function DispatchHistoryTable({
  orders,
}: {
  orders: DispatchOrderSummary[];
}) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          No hay pedidos entregados ni anulados aún.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Los pedidos marcados como entregados o anulados aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {[
              "N° Pedido",
              "N° Factura",
              "Cliente",
              "Estado",
              "Total",
              "Creado",
              "Entregado",
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
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-slate-50/50">
              {/* N° Pedido */}
              <td className="px-4 py-3">
                <span className="font-mono text-xs font-bold text-slate-800">
                  {o.dispatch_number}
                </span>
              </td>

              {/* N° Factura */}
              <td className="px-4 py-3">
                <Link
                  href={`/facturacion/clientes/${o.customer_invoice_id}`}
                  className="font-mono text-xs font-semibold text-cyan-700 hover:underline"
                >
                  {o.invoice_number}
                </Link>
              </td>

              {/* Cliente */}
              <td className="px-4 py-3 text-xs font-medium text-slate-800">
                {o.customer_name_snapshot}
              </td>

              {/* Estado */}
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${DISPATCH_STATUS_COLORS[o.status]}`}
                >
                  {DISPATCH_STATUS_LABELS[o.status]}
                </span>
              </td>

              {/* Total */}
              <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                {formatCurrency(o.total)}
              </td>

              {/* Creado */}
              <td className="px-4 py-3 text-xs text-slate-400">
                {formatDateLima(o.created_at)}
              </td>

              {/* Entregado */}
              <td className="px-4 py-3 text-xs text-slate-500">
                {o.delivered_at ? (
                  formatDateTimeLima(o.delivered_at)
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>

              {/* Acción */}
              <td className="px-4 py-3">
                <Link
                  href={`/despacho/${o.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
                >
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
