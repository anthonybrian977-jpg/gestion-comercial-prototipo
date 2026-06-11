import Link from "next/link";
import type { SupplierInvoiceListItem } from "@/modules/facturacion/types";
import {
  SUPPLIER_INVOICE_STATUS_LABELS,
  SUPPLIER_INVOICE_STATUS_COLORS,
} from "@/modules/facturacion/types";
import { formatCurrency } from "@/modules/productos/utils/format";
import { formatDateLima } from "@/lib/date-format";

// ─── Componente principal ─────────────────────────────────────────────────────

export function SupplierInvoiceTable({
  invoices,
}: {
  invoices: SupplierInvoiceListItem[];
}) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          No hay facturas de proveedor registradas.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Crea una factura desde la pestaña &ldquo;Por facturar&rdquo; seleccionando un recibo de mercadería.
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
              "N° Recibo",
              "Proveedor",
              "Fecha factura",
              "Vencimiento",
              "Total",
              "Estado",
              "Pagado el",
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

              {/* N° Recibo */}
              <td className="px-4 py-3">
                <Link
                  href={`/ingreso-mercaderia/historial/${inv.goods_receipt_id}`}
                  className="font-mono text-xs font-semibold text-cyan-700 hover:underline"
                >
                  {inv.receipt_number}
                </Link>
              </td>

              {/* Proveedor */}
              <td className="px-4 py-3 text-xs text-slate-700">{inv.supplier_name}</td>

              {/* Fecha factura */}
              <td className="px-4 py-3 text-xs text-slate-500">
                {formatDateLima(inv.invoice_date)}
              </td>

              {/* Vencimiento */}
              <td className="px-4 py-3 text-xs text-slate-500">
                {inv.due_date ? formatDateLima(inv.due_date) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>

              {/* Total */}
              <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                {formatCurrency(inv.total)}
              </td>

              {/* Estado */}
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${SUPPLIER_INVOICE_STATUS_COLORS[inv.status]}`}
                >
                  {SUPPLIER_INVOICE_STATUS_LABELS[inv.status]}
                </span>
              </td>

              {/* Pagado el */}
              <td className="px-4 py-3 text-xs text-slate-500">
                {inv.paid_at ? formatDateLima(inv.paid_at) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>

              {/* Acción */}
              <td className="px-4 py-3">
                <Link
                  href={`/facturacion/proveedores/${inv.id}`}
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
