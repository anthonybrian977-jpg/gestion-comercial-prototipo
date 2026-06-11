import Link from "next/link";
import type { GoodsReceiptDetailHeader } from "@/modules/ingreso-mercaderia/types";
import { formatCurrency } from "@/modules/productos/utils/format";
import { formatDateLima, formatDateTimeLima } from "@/lib/date-format";

// ─── Badge de estado ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "complete" | "partial" }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
        ✓ Completo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
      Parcial
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GoodsReceiptHistoryDetailView({
  receipt,
}: {
  receipt: GoodsReceiptDetailHeader;
}) {
  const pct =
    receipt.ordered_total > 0
      ? Math.min(100, (receipt.received_cumulative_after_receipt / receipt.ordered_total) * 100)
      : 0;

  const totalLineCost = receipt.items.reduce(
    (s, i) => s + i.quantity_received * (i.unit_cost ?? 0),
    0,
  );

  return (
    <div className="space-y-6">

      {/* ── Cabecera del ingreso ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-mono text-xl font-bold text-slate-900">
                {receipt.receipt_number}
              </h2>
              <StatusBadge status={receipt.status_after_receipt} />
            </div>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {receipt.supplier_name}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              OC relacionada:{" "}
              <Link
                href={`/orden-compra/${receipt.purchase_order_id}`}
                className="font-mono font-semibold text-cyan-700 hover:underline"
              >
                {receipt.order_number}
              </Link>
            </p>
          </div>

          {/* Fechas */}
          <div className="flex gap-6 text-xs text-slate-500">
            <div>
              <p className="font-medium text-slate-600">Fecha de recepción</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {formatDateLima(receipt.receipt_date)}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-600">Registrado el</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {formatDateTimeLima(receipt.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Notas generales del ingreso */}
        {receipt.notes && (
          <p className="mt-4 rounded-lg bg-slate-50 px-4 py-2 text-xs italic text-slate-500 ring-1 ring-slate-100">
            {receipt.notes}
          </p>
        )}
      </div>

      {/* ── Resumen de avance ────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Recibido en este ingreso */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Recibido en este ingreso</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {receipt.received_in_this_receipt}
            <span className="ml-1 text-sm font-normal text-slate-400">uds.</span>
          </p>
        </div>

        {/* Avance acumulado */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Avance acumulado de la OC</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {receipt.received_cumulative_after_receipt}
            <span className="ml-1 text-sm font-normal text-slate-400">
              / {receipt.ordered_total} uds.
            </span>
          </p>
          {/* Mini barra de progreso */}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 100 ? "bg-emerald-500" : "bg-amber-400"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Pendiente */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">
            Pendiente después de este ingreso
          </p>
          {receipt.pending_after_receipt > 0 ? (
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {receipt.pending_after_receipt}
              <span className="ml-1 text-sm font-normal text-slate-400">uds.</span>
            </p>
          ) : (
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              0
              <span className="ml-1 text-sm font-normal text-emerald-500">
                — OC completa ✓
              </span>
            </p>
          )}
        </div>
      </div>

      {/* ── Tabla de ítems recibidos ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Ítems recibidos en este ingreso
          </h3>
        </div>

        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Producto",
                "Variante",
                "SKU prov.",
                "Cantidad",
                "Costo unit.",
                "Total línea",
                "Nota",
              ].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {receipt.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50">
                {/* Producto */}
                <td className="px-4 py-3">
                  <p className="text-xs font-medium text-slate-800">
                    {item.product_name_snapshot}
                  </p>
                </td>

                {/* Variante */}
                <td className="px-4 py-3 text-xs text-slate-500">
                  {item.variant_snapshot ?? (
                    <span className="text-slate-300">—</span>
                  )}
                </td>

                {/* SKU proveedor */}
                <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                  {item.supplier_sku_snapshot ?? "—"}
                </td>

                {/* Cantidad */}
                <td className="px-4 py-3 text-center text-xs font-semibold text-slate-800">
                  {item.quantity_received}
                </td>

                {/* Costo unitario */}
                <td className="px-4 py-3 text-right text-xs text-slate-500">
                  {item.unit_cost !== null ? formatCurrency(item.unit_cost) : "—"}
                </td>

                {/* Total línea */}
                <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                  {item.unit_cost !== null
                    ? formatCurrency(item.quantity_received * item.unit_cost)
                    : "—"}
                </td>

                {/* Nota */}
                <td className="px-4 py-3 text-xs italic text-slate-400">
                  {item.notes ?? <span className="not-italic text-slate-200">—</span>}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Footer con totales */}
          <tfoot className="border-t border-slate-100 bg-slate-50">
            <tr>
              <td
                colSpan={3}
                className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500"
              >
                Total
              </td>
              <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-800">
                {receipt.received_in_this_receipt}
              </td>
              <td />
              <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800">
                {totalLineCost > 0 ? formatCurrency(totalLineCost) : "—"}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Navegación ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <Link
          href="/ingreso-mercaderia?tab=historial"
          className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
        >
          ← Volver al historial
        </Link>
        <Link
          href={`/orden-compra/${receipt.purchase_order_id}`}
          className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
        >
          Ver Orden de Compra {receipt.order_number} →
        </Link>
      </div>

    </div>
  );
}
