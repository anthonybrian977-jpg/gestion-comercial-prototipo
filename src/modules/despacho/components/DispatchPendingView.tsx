"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  IssuedInvoiceForDispatch,
  DispatchOrderSummary,
} from "@/modules/despacho/types";
import { DISPATCH_STATUS_COLORS, DISPATCH_STATUS_LABELS } from "@/modules/despacho/types";
import { formatCurrency } from "@/modules/productos/utils/format";
import { formatDateLima } from "@/lib/date-format";
import { createDispatchFromCustomerInvoice } from "@/modules/despacho/actions/dispatch-actions";

// ─── Sección A: facturas pendientes de despacho ───────────────────────────────

function PendingInvoicesSection({
  invoices,
  onCreated,
}: {
  invoices: IssuedInvoiceForDispatch[];
  onCreated: (dispatchId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCreate(invoiceId: string) {
    setError(null);
    setLoadingId(invoiceId);
    startTransition(async () => {
      const result = await createDispatchFromCustomerInvoice(invoiceId);
      if (result.dispatchId) {
        // Tanto nueva creación como duplicado detectado → ir al detalle
        onCreated(result.dispatchId);
        return;
      }
      setError(result.message);
      setLoadingId(null);
    });
  }

  if (invoices.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">
        Facturas emitidas — pendientes de crear pedido
      </h3>
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["N° Factura", "Cliente", "Documento", "Dirección", "Ítems", "Total", "Emitida el", "Acción"].map(
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
            {invoices.map((inv) => {
              const isLoading = isPending && loadingId === inv.id;
              return (
                <tr key={inv.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/facturacion/clientes/${inv.id}`}
                      className="font-mono text-xs font-bold text-cyan-700 hover:underline"
                    >
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-800">
                    {inv.customer_name_snapshot}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    {inv.customer_document_snapshot ?? <span className="not-mono text-slate-300">—</span>}
                  </td>
                  <td className="max-w-[200px] px-4 py-3 text-xs text-slate-500">
                    <p className="truncate">
                      {inv.customer_address_snapshot ?? <span className="text-slate-300">—</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-600">
                    {inv.item_count}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                    {formatCurrency(inv.total)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {inv.issue_date ? formatDateLima(inv.issue_date) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleCreate(inv.id)}
                      disabled={isPending}
                      className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                    >
                      {isLoading ? "Creando…" : "Crear pedido"}
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

// ─── Sección B: pedidos en proceso ────────────────────────────────────────────

function InProcessOrdersSection({ orders }: { orders: DispatchOrderSummary[] }) {
  if (orders.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">
        Pedidos en proceso
      </h3>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["N° Pedido", "N° Factura", "Cliente", "Dirección", "Estado", "Total", "Acción"].map(
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
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {o.dispatch_number}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/facturacion/clientes/${o.customer_invoice_id}`}
                    className="font-mono text-xs font-semibold text-cyan-700 hover:underline"
                  >
                    {o.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-slate-800">
                  {o.customer_name_snapshot}
                </td>
                <td className="max-w-[180px] px-4 py-3 text-xs text-slate-500">
                  <p className="truncate">
                    {o.shipping_address_snapshot ?? <span className="text-slate-300">—</span>}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${DISPATCH_STATUS_COLORS[o.status]}`}
                  >
                    {DISPATCH_STATUS_LABELS[o.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                  {formatCurrency(o.total)}
                </td>
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
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function DispatchPendingView({
  pendingInvoices,
  inProcessOrders,
}: {
  pendingInvoices: IssuedInvoiceForDispatch[];
  inProcessOrders: DispatchOrderSummary[];
}) {
  const router = useRouter();

  const isEmpty = pendingInvoices.length === 0 && inProcessOrders.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          No hay pedidos pendientes ni facturas por despachar.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Cuando emitas una factura a cliente, aparecerá aquí para crear el pedido de despacho.
        </p>
        <Link
          href="/facturacion/clientes"
          className="mt-4 inline-block text-xs text-cyan-600 hover:underline"
        >
          → Ver Facturas a Clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PendingInvoicesSection
        invoices={pendingInvoices}
        onCreated={(id) => router.push(`/despacho/${id}`)}
      />
      <InProcessOrdersSection orders={inProcessOrders} />
    </div>
  );
}
