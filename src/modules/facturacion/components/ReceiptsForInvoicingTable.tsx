"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReceiptForInvoicing } from "@/modules/facturacion/types";
import { formatCurrency } from "@/modules/productos/utils/format";
import { formatDateLima, formatDateTimeLima } from "@/lib/date-format";
import { createSupplierInvoice } from "@/modules/facturacion/actions/supplier-invoice-actions";

// ─── Componente principal ─────────────────────────────────────────────────────

export function ReceiptsForInvoicingTable({
  receipts,
}: {
  receipts: ReceiptForInvoicing[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(receiptId: string) {
    setError(null);
    setLoadingId(receiptId);
    startTransition(async () => {
      const result = await createSupplierInvoice(receiptId);
      if (result.success && result.invoiceId) {
        router.push(`/facturacion/proveedores/${result.invoiceId}`);
      } else {
        setError(result.message);
        setLoadingId(null);
      }
    });
  }

  if (receipts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          No hay recibos pendientes de facturar.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Cuando se registre un ingreso de mercadería, aparecerá aquí para crear la factura de proveedor.
        </p>
        <Link
          href="/ingreso-mercaderia?tab=historial"
          className="mt-4 inline-block text-xs text-cyan-600 hover:underline"
        >
          → Ver historial de ingresos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "N° Recibo",
                "OC relacionada",
                "Proveedor",
                "Fecha recepción",
                "Registrado",
                "Ítems",
                "Costo estimado",
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
            {receipts.map((r) => {
              const isLoading = isPending && loadingId === r.id;
              return (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  {/* N° Recibo */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/ingreso-mercaderia/historial/${r.id}`}
                      className="font-mono text-xs font-bold text-cyan-700 hover:underline"
                    >
                      {r.receipt_number}
                    </Link>
                  </td>

                  {/* OC */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/orden-compra/${r.purchase_order_id}`}
                      className="font-mono text-xs font-semibold text-slate-700 hover:text-cyan-700 hover:underline"
                    >
                      {r.order_number}
                    </Link>
                  </td>

                  {/* Proveedor */}
                  <td className="px-4 py-3 text-xs text-slate-700">{r.supplier_name}</td>

                  {/* Fecha recepción */}
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDateLima(r.receipt_date)}
                  </td>

                  {/* Registrado */}
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {formatDateTimeLima(r.created_at)}
                  </td>

                  {/* Ítems */}
                  <td className="px-4 py-3 text-center text-xs text-slate-600">
                    {r.item_count} ({r.total_units} uds.)
                  </td>

                  {/* Costo estimado */}
                  <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                    {r.estimated_cost > 0 ? formatCurrency(r.estimated_cost) : "—"}
                  </td>

                  {/* Acción */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleCreate(r.id)}
                      disabled={isPending}
                      className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                    >
                      {isLoading ? "Creando…" : "Crear factura"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
