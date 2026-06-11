import Link from "next/link";
import type { CustomerInvoiceListItem } from "@/modules/facturacion/types";
import {
  CUSTOMER_INVOICE_STATUS_LABELS,
  CUSTOMER_INVOICE_STATUS_COLORS,
} from "@/modules/facturacion/types";
import { formatCurrency } from "@/modules/productos/utils/format";
import { formatDateLima } from "@/lib/date-format";

// ─── Componente principal ─────────────────────────────────────────────────────

export function CustomerInvoiceTable({
  invoices,
}: {
  invoices: CustomerInvoiceListItem[];
}) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          No hay facturas a clientes registradas.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Crea tu primera factura con el botón &ldquo;Nueva factura&rdquo;.
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
              "N° Factura",
              "Cliente",
              "Documento",
              "Ítems",
              "Total",
              "Estado",
              "Fecha emisión",
              "Creado",
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
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-slate-50/50">
              {/* N° Factura */}
              <td className="px-4 py-3">
                <span className="font-mono text-xs font-bold text-slate-800">
                  {inv.invoice_number}
                </span>
              </td>

              {/* Cliente */}
              <td className="px-4 py-3 text-xs font-medium text-slate-700">
                {inv.customer_name_snapshot}
              </td>

              {/* Documento */}
              <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                {inv.customer_document_snapshot ?? (
                  <span className="not-mono text-slate-300">—</span>
                )}
              </td>

              {/* Ítems */}
              <td className="px-4 py-3 text-center text-xs text-slate-600">
                {inv.item_count}
              </td>

              {/* Total */}
              <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                {formatCurrency(inv.total)}
              </td>

              {/* Estado */}
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${CUSTOMER_INVOICE_STATUS_COLORS[inv.status]}`}
                >
                  {CUSTOMER_INVOICE_STATUS_LABELS[inv.status]}
                </span>
              </td>

              {/* Fecha emisión */}
              <td className="px-4 py-3 text-xs text-slate-500">
                {inv.issue_date ? formatDateLima(inv.issue_date) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>

              {/* Creado */}
              <td className="px-4 py-3 text-xs text-slate-400">
                {formatDateLima(inv.created_at)}
              </td>

              {/* Acción */}
              <td className="px-4 py-3">
                <Link
                  href={`/facturacion/clientes/${inv.id}`}
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
