"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SupplierCatalogItem, SupplierDetail } from "@/modules/proveedores/types";
import { formatCurrency } from "@/modules/productos/utils/format";
import { EditSupplierModal } from "@/modules/proveedores/components/EditSupplierModal";
import { AddCatalogItemModal } from "@/modules/proveedores/components/AddCatalogItemModal";
import { EditCatalogItemModal } from "@/modules/proveedores/components/EditCatalogItemModal";
import { ImportToMasterModal } from "@/modules/proveedores/components/ImportToMasterModal";
import { SupplierImportModal } from "@/modules/proveedores/components/SupplierImportModal";

// ---------------------------------------------------------------------------
// Filtro de búsqueda sobre el catálogo
// ---------------------------------------------------------------------------

function filterCatalog(items: SupplierCatalogItem[], query: string): SupplierCatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    [item.product_name, item.brand, item.model, item.category,
     item.supplier_sku, item.color, item.size, item.presentation]
      .some((f) => f?.toLowerCase().includes(q)),
  );
}

// ---------------------------------------------------------------------------
// Badge de estado de importación
// ---------------------------------------------------------------------------

function ImportedBadge({ imported }: { imported: boolean }) {
  return imported ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
      ✓ Vinculado
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
      Sin vincular
    </span>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function SupplierDetailView({ supplier }: { supplier: SupplierDetail }) {
  const [search, setSearch] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [addCatalogOpen, setAddCatalogOpen] = useState(false);
  const [editingCatalogItem, setEditingCatalogItem] = useState<SupplierCatalogItem | null>(null);
  const [importToMasterItem, setImportToMasterItem] = useState<SupplierCatalogItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filteredCatalog = useMemo(
    () => filterCatalog(supplier.catalog, search),
    [search, supplier.catalog],
  );

  return (
    <>
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href="/proveedores"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-cyan-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a proveedores
        </Link>

        <div className="flex items-center gap-2">
          {supplier.is_active ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">Activo</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">Inactivo</span>
          )}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
          >
            Editar proveedor
          </button>
        </div>
      </div>

      {/* ── Info card ────────────────────────────────────────────────── */}
      {[supplier.ruc, supplier.contact_name, supplier.phone, supplier.email, supplier.address].some(Boolean) ? (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Datos del proveedor</p>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "RUC", value: supplier.ruc },
              { label: "Contacto", value: supplier.contact_name },
              { label: "Teléfono", value: supplier.phone },
              { label: "Email", value: supplier.email },
              { label: "Dirección", value: supplier.address },
            ]
              .filter((f) => f.value)
              .map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      ) : null}

      {/* ── Action bar ───────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, SKU, marca, categoría…"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
        </div>
        <button
          type="button"
          onClick={() => setAddCatalogOpen(true)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
        >
          + Agregar al catálogo
        </button>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
        >
          Importar Excel
        </button>
      </div>

      {/* ── Catalog table ─────────────────────────────────────────────── */}
      {supplier.catalog.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-base font-medium text-slate-900">Catálogo vacío</p>
          <p className="mt-2 text-sm text-slate-500">
            Usa &ldquo;Agregar al catálogo&rdquo; o &ldquo;Importar Excel&rdquo; para agregar productos de este proveedor.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Si acabas de ejecutar el SQL, recarga la página.
          </p>
        </div>
      ) : filteredCatalog.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-base font-medium text-slate-900">Sin resultados</p>
          <p className="mt-2 text-sm text-slate-500">Prueba con otro nombre, SKU, marca o categoría.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Catálogo del proveedor
            </p>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {supplier.catalog.length} producto{supplier.catalog.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {["SKU prov.", "Producto", "Marca", "Cat.", "Color", "Talla", "Presentación", "Precio compra", "Estado", "Vínculo", ""].map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCatalog.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-slate-50/50 ${!item.is_active ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {item.supplier_sku ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-900">{item.product_name}</span>
                      {item.model ? <span className="ml-1.5 text-xs text-slate-400">{item.model}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.brand ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.category ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.color ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.size ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.presentation ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {formatCurrency(item.purchase_price)}
                    </td>
                    <td className="px-4 py-3">
                      {item.is_active ? (
                        <span className="text-xs text-emerald-600">Activo</span>
                      ) : (
                        <span className="text-xs text-slate-400">Inactivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ImportedBadge imported={item.imported_to_master} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingCatalogItem(item)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                        >
                          Editar
                        </button>
                        {!item.imported_to_master && (
                          <button
                            type="button"
                            onClick={() => setImportToMasterItem(item)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                          >
                            → Maestro
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <EditSupplierModal supplier={supplier} open={editOpen} onClose={() => setEditOpen(false)} />
      <AddCatalogItemModal supplierId={supplier.id} open={addCatalogOpen} onClose={() => setAddCatalogOpen(false)} />
      <EditCatalogItemModal supplierId={supplier.id} item={editingCatalogItem} onClose={() => setEditingCatalogItem(null)} />
      <ImportToMasterModal supplierId={supplier.id} item={importToMasterItem} onClose={() => setImportToMasterItem(null)} />
      <SupplierImportModal supplierId={supplier.id} open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
