"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseOrderListItem } from "@/modules/orden-compra/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/modules/orden-compra/types";
import { cancelPurchaseOrder } from "@/modules/orden-compra/actions/purchase-order-actions";
import { formatCurrency } from "@/modules/productos/utils/format";

export function PurchaseOrderTable({
  orders,
}: {
  orders: PurchaseOrderListItem[];
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function handleCancel(id: string, orderNumber: string) {
    if (!window.confirm(`¿Anular la orden "${orderNumber}"? Esta acción no se puede deshacer.`)) return;
    setCancelling(id);
    await cancelPurchaseOrder(id);
    setCancelling(null);
    router.refresh();
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
        <p className="text-3xl">📋</p>
        <p className="mt-3 text-sm font-medium text-slate-700">Sin órdenes de compra</p>
        <p className="mt-1 text-xs text-slate-400">
          Crea tu primera orden para empezar a comprar a proveedores.
        </p>
        <Link
          href="/orden-compra/nueva"
          className="mt-5 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
        >
          + Nueva Orden de Compra
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {["N° Orden", "Proveedor", "Estado", "Fecha", "F. Esperada", "Ítems", "Total", ""].map(
              (h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <tr
              key={order.id}
              className="group transition-colors hover:bg-slate-50/60"
            >
              {/* N° Orden */}
              <td className="whitespace-nowrap px-4 py-3">
                <Link
                  href={`/orden-compra/${order.id}`}
                  className="font-mono text-xs font-semibold text-cyan-700 hover:underline"
                >
                  {order.order_number}
                </Link>
              </td>

              {/* Proveedor */}
              <td className="px-4 py-3 text-xs font-medium text-slate-800">
                {order.supplier_name}
              </td>

              {/* Estado */}
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${STATUS_COLORS[order.status]}`}
                >
                  {STATUS_LABELS[order.status]}
                </span>
              </td>

              {/* Fecha */}
              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                {order.order_date}
              </td>

              {/* F. Esperada */}
              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                {order.expected_date ?? "—"}
              </td>

              {/* Ítems */}
              <td className="px-4 py-3 text-xs text-slate-500">
                {order.item_count} ítem{order.item_count !== 1 ? "s" : ""}
              </td>

              {/* Total */}
              <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-800">
                {formatCurrency(order.total)}
              </td>

              {/* Acciones */}
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    href={`/orden-compra/${order.id}`}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Ver
                  </Link>
                  {(order.status === "draft" || order.status === "issued") && (
                    <button
                      type="button"
                      onClick={() => handleCancel(order.id, order.order_number)}
                      disabled={cancelling === order.id}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                    >
                      {cancelling === order.id ? "Anulando…" : "Anular"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
