"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { DispatchOrderDetail } from "@/modules/despacho/types";
import { DISPATCH_STATUS_COLORS, DISPATCH_STATUS_LABELS } from "@/modules/despacho/types";
import { formatCurrency } from "@/modules/productos/utils/format";
import { formatDateLima, formatDateTimeLima } from "@/lib/date-format";
import {
  markDispatchDelivered,
  cancelDispatchOrder,
} from "@/modules/despacho/actions/dispatch-actions";

// ─── Componente principal ─────────────────────────────────────────────────────

export function DispatchOrderDetailView({
  dispatch,
}: {
  dispatch: DispatchOrderDetail;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    msg: string;
    errs?: string[];
  } | null>(null);

  function handleDeliver() {
    setFeedback(null);
    startTransition(async () => {
      const result = await markDispatchDelivered(dispatch.id);
      setFeedback({ ok: result.success, msg: result.message, errs: result.errors });
    });
  }

  function handleCancel() {
    if (!confirm(`¿Anular el pedido ${dispatch.dispatch_number}? Esta acción no se puede deshacer.`))
      return;
    setFeedback(null);
    startTransition(async () => {
      const result = await cancelDispatchOrder(dispatch.id);
      setFeedback({ ok: result.success, msg: result.message });
    });
  }

  // Validación inline: ¿hay algún ítem con stock < cantidad?
  const stockProblems = dispatch.items.filter((i) => i.current_stock < i.quantity);
  const canDeliver =
    dispatch.status === "in_process" &&
    stockProblems.length === 0 &&
    !isPending;

  const totalLine = dispatch.items.reduce((s, i) => s + i.line_total, 0);

  return (
    <div className="space-y-6">

      {/* ── Feedback ──────────────────────────────────────────────────────── */}
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <p className="font-medium">{feedback.msg}</p>
          {feedback.errs && feedback.errs.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs">
              {feedback.errs.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Advertencia de stock insuficiente ────────────────────────────── */}
      {dispatch.status === "in_process" && stockProblems.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p className="font-semibold">⚠ Stock insuficiente para entregar este pedido</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {stockProblems.map((i) => (
              <li key={i.id}>
                • {i.product_name_snapshot}: necesita {i.quantity}, hay {i.current_stock}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Registra un ingreso de mercadería para reponer el stock antes de despachar.
          </p>
        </div>
      )}

      {/* ── Cabecera ───────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-mono text-xl font-bold text-slate-900">
                {dispatch.dispatch_number}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${DISPATCH_STATUS_COLORS[dispatch.status]}`}
              >
                {DISPATCH_STATUS_LABELS[dispatch.status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Factura:{" "}
              <Link
                href={`/facturacion/clientes/${dispatch.customer_invoice_id}`}
                className="font-mono font-semibold text-cyan-700 hover:underline"
              >
                {dispatch.invoice_number}
              </Link>
            </p>
          </div>

          {/* Fechas */}
          <div className="flex flex-wrap gap-6 text-xs text-slate-500">
            <div>
              <p className="font-medium text-slate-600">Creado el</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {formatDateTimeLima(dispatch.created_at)}
              </p>
            </div>
            {dispatch.delivered_at && (
              <div>
                <p className="font-medium text-slate-600">Entregado el</p>
                <p className="mt-0.5 text-sm font-semibold text-emerald-700">
                  {formatDateTimeLima(dispatch.delivered_at)}
                </p>
              </div>
            )}
            {dispatch.cancelled_at && (
              <div>
                <p className="font-medium text-slate-600">Anulado el</p>
                <p className="mt-0.5 text-sm font-semibold text-rose-600">
                  {formatDateTimeLima(dispatch.cancelled_at)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Datos del destinatario */}
        <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Cliente
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {dispatch.customer_name_snapshot}
            </p>
            {dispatch.customer_document_snapshot && (
              <p className="font-mono text-xs text-slate-500">
                {dispatch.customer_document_snapshot}
              </p>
            )}
          </div>

          {dispatch.customer_phone_snapshot && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Teléfono
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                {dispatch.customer_phone_snapshot}
              </p>
            </div>
          )}

          {dispatch.customer_email_snapshot && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Correo
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                {dispatch.customer_email_snapshot}
              </p>
            </div>
          )}

          {dispatch.shipping_address_snapshot && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Dirección de envío
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                {dispatch.shipping_address_snapshot}
              </p>
            </div>
          )}
        </div>

        {dispatch.notes && (
          <p className="mt-4 rounded-lg bg-slate-50 px-4 py-2 text-xs italic text-slate-500 ring-1 ring-slate-100">
            {dispatch.notes}
          </p>
        )}
      </div>

      {/* ── Total ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total del pedido</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatCurrency(dispatch.total)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Productos distintos</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {dispatch.items.length}
            <span className="ml-1 text-sm font-normal text-slate-400">líneas</span>
          </p>
        </div>
      </div>

      {/* ── Tabla de ítems ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Productos a despachar</h3>
        </div>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Producto",
                "Variante",
                "SKU",
                "Cantidad",
                "Stock actual",
                "Precio unit.",
                "Total línea",
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
            {dispatch.items.map((item) => {
              const stockOk = item.current_stock >= item.quantity;
              return (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-xs font-medium text-slate-800">
                    {item.product_name_snapshot}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {item.variant_snapshot ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {item.sku_snapshot ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-semibold text-slate-800">
                    {item.quantity}
                  </td>
                  {/* Stock actual: rojo si insuficiente */}
                  <td className="px-4 py-3 text-center text-xs font-semibold">
                    <span className={stockOk ? "text-emerald-600" : "text-rose-600"}>
                      {item.current_stock}
                      {!stockOk && (
                        <span className="ml-1 text-[10px] font-normal">⚠</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                    {formatCurrency(item.line_total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-100 bg-slate-50">
            <tr>
              <td
                colSpan={3}
                className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500"
              >
                Total
              </td>
              <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-800">
                {dispatch.items.reduce((s, i) => s + i.quantity, 0)}
              </td>
              <td />
              <td />
              <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800">
                {formatCurrency(totalLine)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Acciones ─────────────────────────────────────────────────────── */}
      {dispatch.status === "in_process" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <button
            onClick={handleDeliver}
            disabled={!canDeliver}
            title={
              stockProblems.length > 0
                ? "Hay productos con stock insuficiente"
                : undefined
            }
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Procesando…" : "✓ Marcar como entregado"}
          </button>
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            Anular pedido
          </button>
        </div>
      )}

      {/* ── Navegación ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <Link
          href="/despacho"
          className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
        >
          ← Volver a Despacho
        </Link>
        <Link
          href={`/facturacion/clientes/${dispatch.customer_invoice_id}`}
          className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
        >
          Ver factura {dispatch.invoice_number} →
        </Link>
      </div>

    </div>
  );
}
