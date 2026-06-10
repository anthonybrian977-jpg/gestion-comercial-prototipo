"use client";

import { useMemo, useState } from "react";
import type { ProductListItem } from "@/modules/productos/types";
import {
  formatCurrency,
  formatNumber,
} from "@/modules/productos/utils/format";
import { ProductVariantsModal } from "@/modules/productos/components/ProductVariantsModal";

type ProductTableProps = {
  products: ProductListItem[];
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

function matchesSearch(product: ProductListItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const fields = [
    product.name,
    product.main_sku,
    product.brand,
    product.category,
    ...product.variants.map((variant) => variant.sku),
  ];

  return fields.some((field) => field?.toLowerCase().includes(normalized));
}

export function ProductTable({ products }: ProductTableProps) {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductListItem | null>(
    null,
  );

  const filteredProducts = useMemo(
    () => products.filter((product) => matchesSearch(product, search)),
    [products, search],
  );

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-400"
          >
            Nuevo producto · Próximamente
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-400"
          >
            Importar Excel · Próximamente
          </button>
        </div>

        <div className="w-full lg:max-w-md">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por producto, SKU, marca o categoría..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
        </div>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-base font-medium text-slate-900">
            No hay productos registrados
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Cuando existan registros en Supabase, aparecerán aquí automáticamente.
          </p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-base font-medium text-slate-900">
            Sin resultados para la búsqueda
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Prueba con otro nombre, SKU, marca o categoría.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Producto",
                    "SKU principal",
                    "Categoría",
                    "Marca",
                    "Precio desde",
                    "Stock total",
                    "Variantes",
                    "Estado",
                    "Acciones",
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
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className={product.hasLowStock ? "bg-rose-50/40" : undefined}
                  >
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-slate-900">
                        {product.name}
                      </p>
                      {product.model ? (
                        <p className="mt-0.5 text-xs text-slate-500">{product.model}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {product.main_sku ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {product.category ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {product.brand ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-900">
                      {formatCurrency(product.priceFrom)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-900">
                      <span
                        className={
                          product.hasLowStock ? "font-semibold text-rose-700" : undefined
                        }
                      >
                        {formatNumber(product.totalStock)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {product.has_variants
                        ? formatNumber(product.activeVariantCount)
                        : "Simple"}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-4 py-4">
                      {product.has_variants ? (
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(product)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
                        >
                          Ver variantes
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductVariantsModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </>
  );
}
