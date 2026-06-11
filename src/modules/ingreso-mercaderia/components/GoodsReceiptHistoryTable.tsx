import Link from "next/link";
import type { GoodsReceiptHistorySummary } from "@/modules/ingreso-mercaderia/types";

// ─── Helpers de formato ───────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtDateTime(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const time = iso.slice(11, 16);
  return `${d}/${m}/${y} ${time}`;
}

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

// ─── Badge de estado ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "complete" | "partial" }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
        Completo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
      Parcial
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GoodsReceiptHistoryTable({
  receipts,
}: {
  receipts: GoodsReceiptHistorySummary[];
}) {
  if (receipts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          No hay ingresos registrados aún.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Los ingresos confirmados aparecerán aquí con su avance histórico.
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
              "N° Ingreso",
              "N° OC",
              "Proveedor",
              "Registrado",
              "Este ingreso",
              "Avance OC",
              "Estado",
              "Faltantes",
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
          {receipts.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/50">
              {/* N° Ingreso */}
              <td className="px-4 py-3">
                <span className="font-mono text-xs font-bold text-slate-800">
                  {r.receipt_number}
                </span>
              </td>

              {/* N° OC */}
              <td className="px-4 py-3">
                <Link
                  href={`/orden-compra/${r.purchase_order_id}`}
                  className="font-mono text-xs font-semibold text-cyan-700 hover:underline"
                >
                  {r.order_number}
                </Link>
              </td>

              {/* Proveedor */}
              <td className="px-4 py-3 text-xs text-slate-700">
                {r.supplier_name}
              </td>

              {/* Fecha/hora de registro */}
              <td className="px-4 py-3 text-xs text-slate-500">
                <p>{fmtDate(r.receipt_date)}</p>
                <p className="text-[11px] text-slate-400">{fmtDateTime(r.created_at)}</p>
              </td>

              {/* Unidades recibidas en este ingreso */}
              <td className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                {r.received_in_this_receipt} uds.
              </td>

              {/* Avance acumulado de la OC */}
              <td className="px-4 py-3">
                <ProgressBar
                  received={r.received_cumulative_after_receipt}
                  total={r.ordered_total}
                />
              </td>

              {/* Estado */}
              <td className="px-4 py-3">
                <StatusBadge status={r.status_after_receipt} />
              </td>

              {/* Faltantes */}
              <td className="px-4 py-3 text-xs">
                {r.pending_after_receipt > 0 ? (
                  <span className="font-semibold text-amber-700">
                    Faltan {r.pending_after_receipt} uds.
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>

              {/* Acción */}
              <td className="px-4 py-3">
                <Link
                  href={`/ingreso-mercaderia/historial/${r.id}`}
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
