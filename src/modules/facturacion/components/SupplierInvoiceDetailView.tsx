"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { SupplierInvoiceDetail } from "@/modules/facturacion/types";
import {
  SUPPLIER_INVOICE_STATUS_LABELS,
  SUPPLIER_INVOICE_STATUS_COLORS,
} from "@/modules/facturacion/types";
import { formatCurrency } from "@/modules/productos/utils/format";
import { formatDateLima, formatDateTimeLima } from "@/lib/date-format";
import { updateSupplierInvoiceStatus } from "@/modules/facturacion/actions/supplier-invoice-actions";

// ─── Componente principal ─────────────────────────────────────────────────────

export function SupplierInvoiceDetailView({
  invoice,
}: {
  invoice: SupplierInvoiceDetail;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleStatusChange(newStatus: "paid" | "cancelled") {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateSupplierInvoiceStatus(invoice.id, newStatus);
      setFeedback({ ok: result.success, msg: result.message });
    });
  }

  const totalLineCost = invoice.items.reduce(
    (s, i) => s + i.quantity * i.unit_cost,
    0,
  );

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
          {feedback.msg}
        </div>
      )}

      {/* ── Cabecera ───────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-mono text-xl font-bold text-slate-900">
                {invoice.invoice_number}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${SUPPLIER_INVOICE_STATUS_COLORS[invoice.status]}`}
              >
                {SUPPLIER_INVOICE_STATUS_LABELS[invoice.status]}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-700">{invoice.supplier_name}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Recibo:{" "}
              <Link
                href={`/ingreso-mercaderia/historial/${invoice.goods_receipt_id}`}
                className="font-mono font-semibold text-cyan-700 hover:underline"
              >
                {invoice.receipt_number}
              </Link>
            </p>
          </div>

          {/* Fechas */}
          <div className="flex flex-wrap gap-6 text-xs text-slate-500">
            <div>
              <p className="font-medium text-slate-600">Fecha factura</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {formatDateLima(invoice.invoice_date)}
              </p>
            </div>
            {invoice.due_date && (
              <div>
                <p className="font-medium text-slate-600">Vencimiento</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">
                  {formatDateLima(invoice.due_date)}
                </p>
              </div>
            )}
            {invoice.paid_at && (
              <div>
                <p className="font-medium text-slate-600">Pagado el</p>
                <p className="mt-0.5 text-sm font-semibold text-emerald-700">
                  {formatDateTimeLima(invoice.paid_at)}
                </p>
              </div>
            )}
            <div>
              <p className="font-medium text-slate-600">Registrado el</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {formatDateTimeLima(invoice.created_at)}
              </p>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <p className="mt-4 rounded-lg bg-slate-50 px-4 py-2 text-xs italic text-slate-500 ring-1 ring-slate-100">
            {invoice.notes}
          </p>
        )}
      </div>

      {/* ── Resumen financiero ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Subtotal</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatCurrency(invoice.subtotal)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {/* TODO: mostrar IGV cuando se implemente */}
            Sin IGV aplicado
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total a pagar</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatCurrency(invoice.total)}
          </p>
        </div>
      </div>

      {/* ── Tabla de ítems ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Ítems de la factura</h3>
        </div>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Producto", "Variante", "SKU prov.", "Cantidad", "Costo unit.", "Total línea"].map(
                (h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-xs font-medium text-slate-800">
                  {item.product_name_snapshot}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {item.variant_snapshot ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                  {item.supplier_sku_snapshot ?? "—"}
                </td>
                <td className="px-4 py-3 text-center text-xs font-semibold text-slate-800">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-500">
                  {formatCurrency(item.unit_cost)}
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                  {formatCurrency(item.line_total)}
                </td>
              </tr>
            ))}
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
                {invoice.items.reduce((s, i) => s + i.quantity, 0)}
              </td>
              <td />
              <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800">
                {formatCurrency(totalLineCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Acciones ─────────────────────────────────────────────────────── */}
      {invoice.status === "pending" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-600">Cambiar estado:</p>
          <button
            onClick={() => handleStatusChange("paid")}
            disabled={isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending ? "Procesando…" : "✓ Marcar como pagado"}
          </button>
          <button
            onClick={() => handleStatusChange("cancelled")}
            disabled={isPending}
            className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            Anular factura
          </button>
        </div>
      )}

      {invoice.status === "paid" && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-600">Opciones:</p>
          <button
            onClick={() => handleStatusChange("cancelled")}
            disabled={isPending}
            className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            Anular factura
          </button>
        </div>
      )}

      {/* ── Navegación ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <Link
          href="/facturacion/proveedores?tab=historial"
          className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
        >
          ← Volver al historial
        </Link>
        <Link
          href={`/ingreso-mercaderia/historial/${invoice.goods_receipt_id}`}
          className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
        >
          Ver ingreso {invoice.receipt_number} →
        </Link>
      </div>

    </div>
  );
}
