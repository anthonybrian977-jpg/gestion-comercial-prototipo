"use client";

import type { ProductListItem, ProductVariant } from "@/modules/productos/types";
import {
  formatCurrency,
  formatNumber,
} from "@/modules/productos/utils/format";

type ProductVariantsModalProps = {
  product: ProductListItem | null;
  onClose: () => void;
};

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        isActive
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      {isActive ? "Activo" : "Inactivo"}
    </span>
  );
}

function VariantRow({ variant }: { variant: ProductVariant }) {
  const isLowStock = (variant.stock ?? 0) <= (variant.min_stock ?? 0);

  return (
    <tr className={isLowStock ? "bg-rose-50/60" : undefined}>
      <td className="px-4 py-3 text-sm font-medium text-slate-900">{variant.sku}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{variant.presentation ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{variant.color ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{variant.size ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {formatCurrency(variant.purchase_price)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {formatCurrency(variant.sale_price)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-900">
        <span className={isLowStock ? "font-semibold text-rose-700" : undefined}>
          {formatNumber(variant.stock ?? 0)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {formatNumber(variant.min_stock ?? 0)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={variant.status} />
      </td>
    </tr>
  );
}

export function ProductVariantsModal({
  product,
  onClose,
}: ProductVariantsModalProps) {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
              Variantes del producto
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              {product.name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              SKU principal: {product.main_sku ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        {product.variants.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            Este producto no tiene variantes registradas.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "SKU",
                    "Presentación",
                    "Color",
                    "Talla",
                    "Precio compra",
                    "Precio venta",
                    "Stock",
                    "Stock mínimo",
                    "Estado",
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {product.variants.map((variant) => (
                  <VariantRow key={variant.id} variant={variant} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
