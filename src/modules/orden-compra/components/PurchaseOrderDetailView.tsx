"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseOrderDetail, PurchaseOrderItem } from "@/modules/orden-compra/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/modules/orden-compra/types";
import {
  issuePurchaseOrder,
  cancelPurchaseOrder,
} from "@/modules/orden-compra/actions/purchase-order-actions";
import { formatCurrency } from "@/modules/productos/utils/format";

// ─── Fila de ítem ─────────────────────────────────────────────────────────────

function ItemRow({ item }: { item: PurchaseOrderItem }) {
  const attrs = [item.color_snapshot, item.size_snapshot, item.presentation_snapshot]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr className="hover:bg-slate-50/50">
      {/* Producto */}
      <td className="px-4 py-3">
        <p className="text-xs font-medium text-slate-800">{item.product_name_snapshot}</p>
        {attrs && <p className="mt-0.5 text-[11px] text-slate-400">{attrs}</p>}
        {item.supplier_sku_snapshot && (
          <p className="mt-0.5 font-mono text-[11px] text-slate-400">
            SKU: {item.supplier_sku_snapshot}
          </p>
        )}
        {item.notes && (
          <p className="mt-0.5 text-[11px] italic text-slate-400">{item.notes}</p>
        )}
      </td>

      {/* Marca / Cat. */}
      <td className="px-4 py-3 text-xs text-slate-500">
        {item.brand_snapshot && <span className="block">{item.brand_snapshot}</span>}
        {item.category_snapshot && (
          <span className="mt-0.5 block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 w-fit">
            {item.category_snapshot}
          </span>
        )}
      </td>

      {/* Cant. pedida */}
      <td className="px-4 py-3 text-center text-xs text-slate-700">
        {item.quantity_ordered}
      </td>

      {/* Cant. recibida */}
      <td className="px-4 py-3 text-center text-xs text-slate-400">
        {item.quantity_received}
      </td>

      {/* P. unitario */}
      <td className="px-4 py-3 text-right text-xs text-slate-700">
        {formatCurrency(item.unit_cost)}
      </td>

      {/* Total línea */}
      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800">
        {formatCurrency(item.line_total)}
      </td>

      {/* Vinculado a Maestro */}
      <td className="px-4 py-3 text-center">
        {item.linked_variant_id ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            ✓ Maestro
          </span>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PurchaseOrderDetailView({ order }: { order: PurchaseOrderDetail }) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; msg: string; details?: string[] } | null>(null);

  const isDraft = order.status === "draft";
  const canCancel = order.status === "draft" || order.status === "issued";

  async function handleIssue() {
    if (!window.confirm("¿Emitir la Orden de Compra? Los productos seleccionados serán creados o vinculados en el Maestro con stock 0.")) return;
    setActing(true);
    setFeedback(null);
    const result = await issuePurchaseOrder(order.id);
    setActing(false);
    if (result.success) {
      setFeedback({ type: "ok", msg: result.message, details: result.errors });
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message, details: result.errors });
    }
  }

  async function handleCancel() {
    if (!window.confirm(`¿Anular la orden "${order.order_number}"? Esta acción no se puede deshacer.`)) return;
    setActing(true);
    setFeedback(null);
    const result = await cancelPurchaseOrder(order.id);
    setActing(false);
    if (result.success) {
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message });
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Feedback ────────────────────────────────────────────────────── */}
      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ring-1 ${
            feedback.type === "ok"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : "bg-rose-50 text-rose-700 ring-rose-100"
          }`}
        >
          <p className="font-medium">{feedback.msg}</p>
          {feedback.details && feedback.details.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {feedback.details.map((d, i) => (
                <li key={i}>· {d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Header de la OC ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Info principal */}
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-mono text-lg font-bold text-slate-900">
                {order.order_number}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_COLORS[order.status]}`}
              >
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {order.supplier_name}
              {order.supplier_ruc && (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  RUC: {order.supplier_ruc}
                </span>
              )}
            </p>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            {isDraft && (
              <button
                type="button"
                onClick={handleIssue}
                disabled={acting}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {acting ? "Procesando…" : "Emitir OC"}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={acting}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:opacity-60"
              >
                Anular
              </button>
            )}
          </div>
        </div>

        {/* Datos secundarios */}
        <div className="mt-4 flex flex-wrap gap-6 text-xs text-slate-500">
          <span>
            <span className="font-medium text-slate-600">Fecha:</span>{" "}
            {order.order_date}
          </span>
          {order.expected_date && (
            <span>
              <span className="font-medium text-slate-600">Entrega esperada:</span>{" "}
              {order.expected_date}
            </span>
          )}
          <span>
            <span className="font-medium text-slate-600">Ítems:</span>{" "}
            {order.items.length}
          </span>
          <span>
            <span className="font-medium text-slate-600">Total:</span>{" "}
            <span className="font-semibold text-slate-800">
              {formatCurrency(order.total)}
            </span>
          </span>
        </div>

        {order.notes && (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs italic text-slate-500">
            {order.notes}
          </p>
        )}

        {/* Banner informativo para borradores */}
        {isDraft && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-xs text-sky-700 ring-1 ring-sky-100">
            <span className="mt-px shrink-0">ℹ</span>
            <span>
              Este borrador aún no está emitido. Al emitir, los productos de la OC serán creados o
              vinculados en el Maestro con <strong>stock 0</strong>. El stock se sumará
              más adelante en <strong>Ingreso de Mercadería</strong>.
            </span>
          </div>
        )}
      </div>

      {/* ── Tabla de ítems ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Ítems de la orden</h3>
        </div>

        {order.items.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">
            Esta orden no tiene ítems.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Producto",
                  "Marca / Cat.",
                  "Cant. pedida",
                  "Cant. recibida",
                  "Precio unit.",
                  "Total línea",
                  "Maestro",
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
              {order.items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td
                  colSpan={5}
                  className="px-4 py-3 text-right text-xs font-semibold text-slate-600"
                >
                  Total
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                  {formatCurrency(order.total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── Pie: volver ─────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/orden-compra"
          className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
        >
          ← Volver al listado de Órdenes de Compra
        </Link>
      </div>
    </div>
  );
}
