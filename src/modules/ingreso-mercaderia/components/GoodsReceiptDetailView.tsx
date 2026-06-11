"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReceivableOrderDetail, ReceivableItem } from "@/modules/ingreso-mercaderia/types";
import { confirmGoodsReceipt } from "@/modules/ingreso-mercaderia/actions/goods-receipt-actions";
import { STATUS_LABELS, STATUS_COLORS } from "@/modules/orden-compra/types";
import type { PurchaseOrderStatus } from "@/modules/orden-compra/types";
import { formatCurrency } from "@/modules/productos/utils/format";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function buildVariantSnapshot(item: ReceivableItem): string {
  return [item.color_snapshot, item.size_snapshot, item.presentation_snapshot]
    .filter(Boolean)
    .join(" · ");
}

// ─── Fila de ítem ─────────────────────────────────────────────────────────────

function ItemRow({
  item,
  inputValue: rawValue,
  onChange,
  disabled,
}: {
  item: ReceivableItem;
  inputValue: string;
  onChange: (val: string) => void;
  disabled: boolean;
}) {
  const attrs = buildVariantSnapshot(item);
  const isNotLinked = !item.linked_variant_id;
  const isComplete = item.quantity_pending <= 0;

  return (
    <tr className={`${isComplete ? "opacity-50" : ""} hover:bg-slate-50/50`}>
      {/* Producto */}
      <td className="px-4 py-3">
        <p className="text-xs font-medium text-slate-800">
          {item.product_name_snapshot}
        </p>
        {attrs && (
          <p className="mt-0.5 text-[11px] text-slate-400">{attrs}</p>
        )}
        {item.brand_snapshot && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            {item.brand_snapshot}
          </p>
        )}
      </td>

      {/* SKU proveedor */}
      <td className="px-4 py-3 text-[11px] font-mono text-slate-400">
        {item.supplier_sku_snapshot ?? "—"}
      </td>

      {/* Pedido */}
      <td className="px-4 py-3 text-center text-xs text-slate-600">
        {item.quantity_ordered}
      </td>

      {/* Recibido acumulado */}
      <td className="px-4 py-3 text-center text-xs text-slate-500">
        {item.quantity_received}
      </td>

      {/* Pendiente */}
      <td className="px-4 py-3 text-center text-xs font-semibold">
        {isComplete ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 ring-1 ring-emerald-100">
            Completo
          </span>
        ) : (
          <span className="text-amber-700">{item.quantity_pending}</span>
        )}
      </td>

      {/* Precio unit. */}
      <td className="px-4 py-3 text-right text-xs text-slate-500">
        {formatCurrency(item.unit_cost)}
      </td>

      {/* Recibir ahora */}
      <td className="px-4 py-3 text-center">
        {isNotLinked ? (
          <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] text-rose-600 ring-1 ring-rose-100">
            Sin vínculo al Maestro
          </span>
        ) : isComplete ? (
          <span className="text-[11px] text-slate-300">—</span>
        ) : (
          <input
            type="number"
            min={0}
            max={item.quantity_pending}
            value={rawValue}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="0"
            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100 disabled:opacity-50"
          />
        )}
      </td>

      {/* Maestro */}
      <td className="px-4 py-3 text-center">
        {item.linked_variant_id ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            ✓
          </span>
        ) : (
          <span className="text-[11px] text-rose-400">✗</span>
        )}
      </td>
    </tr>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GoodsReceiptDetailView({
  order,
}: {
  order: ReceivableOrderDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Formulario ───────────────────────────────────────────────────────────
  const [receiptDate, setReceiptDate] = useState(today());
  const [receiptNotes, setReceiptNotes] = useState("");

  // Cantidades a recibir AHORA por ítem (keyed by purchase_order_item id)
  // String para manejar el input vacío sin forzar 0
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  // ── Feedback ─────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "error";
    message: string;
    details?: string[];
  } | null>(null);

  // ── Estado de la OC ──────────────────────────────────────────────────────
  const status = order.status as PurchaseOrderStatus;
  const isReceivable =
    order.status === "issued" || order.status === "partial_received";

  // Totales
  const totalOrdered = order.items.reduce((s, i) => s + i.quantity_ordered, 0);
  const totalReceived = order.items.reduce((s, i) => s + i.quantity_received, 0);
  const totalPending = totalOrdered - totalReceived;

  // Ítems sin vínculo al Maestro
  const unlinkedItems = order.items.filter((i) => !i.linked_variant_id);

  // ── Confirmar ingreso ────────────────────────────────────────────────────
  async function handleConfirm() {
    // El RPC lee todos los datos del ítem desde purchase_order_items.
    // El cliente solo envía qué ítem, cuánto llegó y una nota opcional.
    const itemsToSend = order.items
      .filter((item) => {
        const q = parseInt(quantities[item.id] ?? "0", 10);
        return !isNaN(q) && q > 0;
      })
      .map((item) => ({
        purchaseOrderItemId: item.id,
        quantityReceived: parseInt(quantities[item.id] ?? "0", 10),
        notes: itemNotes[item.id] ?? "",
      }));

    if (itemsToSend.length === 0) {
      setFeedback({
        type: "error",
        message: "Ingresa al menos una cantidad mayor a 0 en algún ítem.",
      });
      return;
    }

    if (
      !window.confirm(
        `¿Confirmar el ingreso de mercadería? Se sumará stock a ${itemsToSend.length} ` +
          `ítem${itemsToSend.length !== 1 ? "s" : ""} en el Maestro.`,
      )
    )
      return;

    setSaving(true);
    setFeedback(null);

    const result = await confirmGoodsReceipt({
      purchaseOrderId: order.id,
      receiptDate,
      notes: receiptNotes,
      items: itemsToSend,
    });

    setSaving(false);

    if (result.success) {
      setFeedback({ type: "ok", message: result.message });
      // Reiniciar cantidades y redirigir al listado tras breve pausa
      setQuantities({});
      startTransition(() => {
        router.refresh();
        router.push("/ingreso-mercaderia");
      });
    } else {
      setFeedback({
        type: "error",
        message: result.message,
        details: result.errors,
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Feedback ──────────────────────────────────────────────────────── */}
      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ring-1 ${
            feedback.type === "ok"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : "bg-rose-50 text-rose-700 ring-rose-100"
          }`}
        >
          <p className="font-medium">{feedback.message}</p>
          {feedback.details && feedback.details.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {feedback.details.map((d, i) => (
                <li key={i}>· {d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Bloqueo si OC no es recibible ─────────────────────────────────── */}
      {!isReceivable && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-100">
          <p className="font-medium">
            Esta OC está en estado &ldquo;{STATUS_LABELS[status]}&rdquo; y no puede recibirse.
          </p>
          <p className="mt-1 text-xs">
            Solo se puede registrar ingreso para órdenes <strong>Emitidas</strong> o
            en <strong>Recepción parcial</strong>.
          </p>
        </div>
      )}

      {/* ── Advertencia ítems sin vínculo ─────────────────────────────────── */}
      {isReceivable && unlinkedItems.length > 0 && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
          <p className="font-medium">
            {unlinkedItems.length} ítem{unlinkedItems.length !== 1 ? "s" : ""} sin
            vínculo al Maestro
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {unlinkedItems.map((i) => (
              <li key={i.id}>· {i.product_name_snapshot}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">
            Emite la Orden de Compra primero para vincular estos ítems al Maestro.
          </p>
        </div>
      )}

      {/* ── Cabecera de la OC ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-mono text-lg font-bold text-slate-900">
                {order.order_number}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_COLORS[status]}`}
              >
                {STATUS_LABELS[status]}
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

          {/* Resumen de progreso */}
          <div className="flex gap-6 text-center text-xs">
            <div>
              <p className="text-slate-400">Pedido</p>
              <p className="text-base font-bold text-slate-800">{totalOrdered}</p>
            </div>
            <div>
              <p className="text-slate-400">Recibido</p>
              <p className="text-base font-bold text-emerald-600">{totalReceived}</p>
            </div>
            <div>
              <p className="text-slate-400">Pendiente</p>
              <p className={`text-base font-bold ${totalPending > 0 ? "text-amber-600" : "text-slate-300"}`}>
                {totalPending}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 text-xs text-slate-500">
          <span>
            <span className="font-medium text-slate-600">Fecha OC:</span>{" "}
            {order.order_date}
          </span>
          {order.expected_date && (
            <span>
              <span className="font-medium text-slate-600">Entrega esperada:</span>{" "}
              {order.expected_date}
            </span>
          )}
          {order.notes && (
            <span className="italic">{order.notes}</span>
          )}
        </div>
      </div>

      {/* ── Tabla de ítems ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Ítems de la orden
          </h3>
        </div>

        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Producto",
                "SKU prov.",
                "Pedido",
                "Recibido",
                "Pendiente",
                "P. unit.",
                "Recibir ahora",
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
              <ItemRow
                key={item.id}
                item={item}
                inputValue={quantities[item.id] ?? ""}
                onChange={(val) =>
                  setQuantities((prev) => ({ ...prev, [item.id]: val }))
                }
                disabled={!isReceivable || saving || isPending}
              />
            ))}
          </tbody>
        </table>

        {/* Notas por ítem (expandible) — debajo de la tabla */}
        {isReceivable && (
          <div className="border-t border-slate-100 px-5 py-4 space-y-2">
            <p className="text-xs font-medium text-slate-500">
              Notas por ítem (opcional)
            </p>
            {order.items
              .filter((i) => i.linked_variant_id && i.quantity_pending > 0)
              .map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="w-48 truncate text-xs text-slate-600">
                    {item.product_name_snapshot}
                  </span>
                  <input
                    type="text"
                    value={itemNotes[item.id] ?? ""}
                    onChange={(e) =>
                      setItemNotes((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    disabled={saving || isPending}
                    placeholder="Nota del ítem (opcional)"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100 disabled:opacity-50"
                  />
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Cabecera del ingreso + footer ─────────────────────────────────── */}
      {isReceivable && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Datos del ingreso
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Fecha de recepción
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                disabled={saving || isPending}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Observaciones del ingreso
              </label>
              <input
                type="text"
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                disabled={saving || isPending}
                placeholder="Remito, guía de remisión, etc."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Acciones ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <Link
          href="/ingreso-mercaderia"
          className="text-xs text-slate-500 hover:text-cyan-700 hover:underline"
        >
          ← Volver al listado
        </Link>

        {isReceivable && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || isPending}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving || isPending ? "Confirmando…" : "✓ Confirmar ingreso"}
          </button>
        )}
      </div>
    </div>
  );
}
