"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductListItem } from "@/modules/productos/types";
import {
  formatCurrency,
  formatNumber,
} from "@/modules/productos/utils/format";
import { ProductDetailModal } from "@/modules/productos/components/ProductDetailModal";
import { ProductCreateModal } from "@/modules/productos/components/ProductCreateModal";
import { ProductImportModal } from "@/modules/productos/components/ProductImportModal";
import { ImportFromSupplierModal } from "@/modules/productos/components/ImportFromSupplierModal";
import { getProductImagePublicUrl } from "@/lib/supabase/upload-image";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { deleteProductsBulk } from "@/modules/productos/actions/delete-products";

type ProductTableProps = {
  products: ProductListItem[];
};

type TabStatus = "active" | "inactive" | "archived";

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
        Activo
      </span>
    );
  }
  if (status === "inactive") {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
        Inactivo
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
      Archivado
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
    ...product.variants.map((v) => v.sku),
  ];
  return fields.some((f) => f?.toLowerCase().includes(normalized));
}

const TAB_LABELS: Record<TabStatus, string> = {
  active: "Activos",
  inactive: "Inactivos",
  archived: "Archivados",
};

export function ProductTable({ products }: ProductTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabStatus>("active");
  const [detailProduct, setDetailProduct] = useState<ProductListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFromSupplierOpen, setImportFromSupplierOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // ── Selección para limpieza ────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cleaning, setCleaning] = useState(false);

  // Contadores por pestaña
  const counts = useMemo(
    () => ({
      active: products.filter((p) => p.status === "active").length,
      inactive: products.filter((p) => p.status === "inactive").length,
      archived: products.filter((p) => p.status === "archived").length,
    }),
    [products],
  );

  const tabProducts = useMemo(
    () => products.filter((p) => p.status === activeTab),
    [products, activeTab],
  );

  const filteredProducts = useMemo(
    () => tabProducts.filter((p) => matchesSearch(p, search)),
    [tabProducts, search],
  );

  // ── Helpers de selección ──────────────────────────────────────────────────
  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedIds.has(p.id));

  const someSelected = selectedIds.size > 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      // Deseleccionar todos los visibles
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      // Seleccionar todos los visibles
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleCleanup() {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    const confirmed = window.confirm(
      `¿Eliminar definitivamente ${n} producto${n !== 1 ? "s" : ""}?\n\nEsta acción no se puede deshacer. Los vínculos con catálogos de proveedores también se limpiarán.`,
    );
    if (!confirmed) return;

    setCleaning(true);
    const result = await deleteProductsBulk([...selectedIds]);
    setCleaning(false);

    if (!result.success) {
      alert("Error: " + result.message);
      return;
    }

    clearSelection();
    router.refresh();
  }

  // Limpiar selección al cambiar de pestaña
  function switchTab(tab: TabStatus) {
    setActiveTab(tab);
    setSearch("");
    clearSelection();
  }

  const emptyMessages: Record<TabStatus, { title: string; subtitle: string }> = {
    active: {
      title: "No hay productos activos",
      subtitle: 'Agrega uno nuevo o importa desde un proveedor.',
    },
    inactive: {
      title: "No hay productos inactivos",
      subtitle: "Los productos inactivados aparecerán aquí.",
    },
    archived: {
      title: "No hay productos archivados",
      subtitle: '"Eliminar de lista" mueve productos aquí.',
    },
  };

  return (
    <>
      {/* ── Pestañas ────────────────────────────────────────────────────── */}
      <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        {(["active", "inactive", "archived"] as TabStatus[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => switchTab(tab)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {TAB_LABELS[tab]}
            {counts[tab] > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                  activeTab === tab
                    ? "bg-slate-100 text-slate-600"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Barra de acciones de selección (aparece cuando hay selección) ── */}
      {someSelected && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5">
          <span className="text-sm font-medium text-rose-800">
            {selectedIds.size} producto{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCleanup}
              disabled={cleaning}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {cleaning ? "Eliminando..." : `🗑 Eliminar ${selectedIds.size}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Action bar (pestaña activos) ─────────────────────────────────── */}
      {activeTab === "active" && !someSelected && (
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
            >
              Nuevo producto
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
            >
              Importar Excel
            </button>
            <button
              type="button"
              onClick={() => setImportFromSupplierOpen(true)}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100 hover:text-emerald-800"
            >
              Importar desde proveedor
            </button>
          </div>
          <div className="w-full lg:max-w-md">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por producto, SKU, marca o categoría..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        </div>
      )}

      {/* ── Barra de búsqueda en pestañas inactivos/archivados ───────────── */}
      {activeTab !== "active" && !someSelected && (
        <div className="mb-5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar en ${TAB_LABELS[activeTab].toLowerCase()}...`}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
        </div>
      )}

      {/* ── Tabla ───────────────────────────────────────────────────────── */}
      {tabProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-base font-medium text-slate-900">
            {emptyMessages[activeTab].title}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {emptyMessages[activeTab].subtitle}
          </p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-base font-medium text-slate-900">Sin resultados</p>
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
                  {/* Checkbox "seleccionar todos" */}
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-rose-600 accent-rose-600 cursor-pointer"
                      title={allVisibleSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                    />
                  </th>
                  {[
                    "Producto",
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
                {filteredProducts.map((product) => {
                  const isSelected = selectedIds.has(product.id);
                  return (
                    <tr
                      key={product.id}
                      className={[
                        isSelected ? "bg-rose-50/60" : "",
                        !isSelected && product.hasLowStock && product.status === "active"
                          ? "bg-rose-50/40"
                          : "",
                        product.status !== "active" && !isSelected ? "opacity-70" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {/* Checkbox de fila */}
                      <td className="w-10 px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(product.id)}
                          className="h-4 w-4 rounded border-slate-300 text-rose-600 accent-rose-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {getProductImagePublicUrl(product.image_path) ? (
                            <img
                              src={getProductImagePublicUrl(product.image_path)!}
                              alt=""
                              className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-slate-100 object-cover transition hover:opacity-80"
                              onClick={() =>
                                setLightboxSrc(
                                  getProductImagePublicUrl(product.image_path),
                                )
                              }
                            />
                          ) : null}
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {product.name}
                            </p>
                            {product.model ? (
                              <p className="mt-0.5 text-xs text-slate-500">{product.model}</p>
                            ) : null}
                          </div>
                        </div>
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
                            product.hasLowStock && product.status === "active"
                              ? "font-semibold text-rose-700"
                              : undefined
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
                        <button
                          type="button"
                          onClick={() => setDetailProduct(product)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ProductImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ImportFromSupplierModal
        open={importFromSupplierOpen}
        onClose={() => setImportFromSupplierOpen(false)}
      />
      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
      />
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
}
