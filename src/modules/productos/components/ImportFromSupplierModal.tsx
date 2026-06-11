"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { importCatalogItemToMaster } from "@/modules/proveedores/actions/catalog-actions";
import { formatCurrency } from "@/modules/productos/utils/format";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100";
const labelCls = "mb-1 block text-xs font-medium text-slate-500";

type Supplier = { id: string; name: string };
type CatalogItem = {
  id: string;
  supplier_sku: string | null;
  product_name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  presentation: string | null;
  color: string | null;
  size: string | null;
  purchase_price: number;
};

type Step = "supplier" | "item" | "details";

export function ImportFromSupplierModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("supplier");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  const [salePrice, setSalePrice] = useState("");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [mainSku, setMainSku] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Cargar proveedores cuando se abre
  useEffect(() => {
    if (!open) return;
    setStep("supplier");
    setSelectedSupplier(null);
    setSelectedItem(null);
    setItemSearch("");
    setSalePrice(""); setStock("0"); setMinStock("0");
    setMainSku(""); setVariantSku(""); setError("");

    setLoadingSuppliers(true);
    const supabase = createClient();
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setSuppliers((data ?? []) as Supplier[]);
        setLoadingSuppliers(false);
      });
  }, [open]);

  // Cargar items del catálogo cuando se elige proveedor
  useEffect(() => {
    if (!selectedSupplier) return;
    setLoadingItems(true);
    setCatalogItems([]);
    const supabase = createClient();
    supabase
      .from("supplier_catalog_items")
      .select("id, supplier_sku, product_name, brand, model, category, presentation, color, size, purchase_price")
      .eq("supplier_id", selectedSupplier.id)
      .eq("imported_to_master", false)
      .eq("is_active", true)
      .order("product_name")
      .then(({ data }) => {
        setCatalogItems((data ?? []) as CatalogItem[]);
        setLoadingItems(false);
      });
  }, [selectedSupplier]);

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return catalogItems;
    return catalogItems.filter((item) =>
      [item.product_name, item.brand, item.category, item.supplier_sku, item.color, item.size]
        .some((f) => f?.toLowerCase().includes(q)),
    );
  }, [itemSearch, catalogItems]);

  if (!open) return null;

  function handleSelectSupplier(s: Supplier) {
    setSelectedSupplier(s);
    setStep("item");
  }

  function handleSelectItem(item: CatalogItem) {
    setSelectedItem(item);
    setStep("details");
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedItem || !selectedSupplier) return;
    const numSalePrice = Number(salePrice);
    if (isNaN(numSalePrice) || numSalePrice < 0) {
      setError("El precio de venta debe ser ≥ 0.");
      return;
    }
    setError("");
    setSaving(true);
    const result = await importCatalogItemToMaster(selectedItem.id, selectedSupplier.id, {
      mainSku: mainSku.trim() || undefined,
      variantSku: variantSku.trim() || undefined,
      salePrice: numSalePrice,
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 0,
    });
    setSaving(false);
    if (!result.success) { setError(result.message); return; }
    router.refresh();
    onClose();
  }

  const stepLabel = step === "supplier" ? "1 · Elegir proveedor" : step === "item" ? "2 · Elegir producto del catálogo" : "3 · Configurar producto";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Importar desde proveedor</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Nuevo producto desde catálogo</h3>
          <p className="mt-1 text-xs text-slate-400">{stepLabel}</p>
          {/* Breadcrumb */}
          {selectedSupplier && (
            <p className="mt-1 text-xs text-slate-600">
              Proveedor: <span className="font-medium">{selectedSupplier.name}</span>
              {selectedItem && <> · <span className="font-medium">{selectedItem.product_name}</span></>}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">

          {/* STEP 1: Elegir proveedor */}
          {step === "supplier" && (
            <div>
              {loadingSuppliers ? (
                <p className="py-8 text-center text-sm text-slate-400">Cargando proveedores…</p>
              ) : suppliers.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No hay proveedores activos.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {suppliers.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectSupplier(s)}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:bg-cyan-50 hover:text-cyan-800"
                      >
                        {s.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* STEP 2: Elegir item del catálogo */}
          {step === "item" && (
            <div>
              <input
                type="search"
                placeholder="Buscar producto, marca, categoría…"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className={`${inputCls} mb-3`}
              />
              {loadingItems ? (
                <p className="py-6 text-center text-sm text-slate-400">Cargando catálogo…</p>
              ) : filteredItems.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  {catalogItems.length === 0
                    ? "Este proveedor no tiene productos en el catálogo o todos ya fueron importados."
                    : "Sin resultados."}
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                  {filteredItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className="w-full px-4 py-3 text-left transition hover:bg-cyan-50"
                      >
                        <p className="text-sm font-medium text-slate-800">{item.product_name}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          {item.brand && <span>{item.brand}</span>}
                          {item.category && <span>{item.category}</span>}
                          {item.color && <span>{item.color}</span>}
                          {item.size && <span>{item.size}</span>}
                          <span className="font-medium text-slate-700">{formatCurrency(item.purchase_price)}</span>
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* STEP 3: Configurar producto */}
          {step === "details" && selectedItem && (
            <form id="import-form" onSubmit={handleSubmit}>
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-600">
                <p className="font-medium text-slate-800">{selectedItem.product_name}</p>
                {[selectedItem.brand, selectedItem.category, selectedItem.color, selectedItem.size, selectedItem.presentation]
                  .filter(Boolean).join(" · ")}
                <p className="mt-1">
                  Precio de compra del proveedor: <span className="font-medium text-slate-800">{formatCurrency(selectedItem.purchase_price)}</span>
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>SKU principal <span className="font-normal text-slate-400">(auto si vacío)</span></label>
                  <input value={mainSku} onChange={(e) => setMainSku(e.target.value)} placeholder="Auto-generado" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>SKU variante <span className="font-normal text-slate-400">(auto si vacío)</span></label>
                  <input value={variantSku} onChange={(e) => setVariantSku(e.target.value)} placeholder="Auto-generado" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Precio de venta *</label>
                  <input type="number" min="0" step="0.01" required value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Stock inicial</label>
                  <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Stock mínimo</label>
                  <input type="number" min="0" step="1" value={minStock} onChange={(e) => setMinStock(e.target.value)} className={inputCls} />
                </div>
              </div>
              {error ? (
                <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-rose-100">{error}</p>
              ) : null}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              {step !== "supplier" && (
                <button
                  type="button"
                  onClick={() => {
                    if (step === "item") setStep("supplier");
                    if (step === "details") setStep("item");
                  }}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Atrás
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              {step === "details" && (
                <button
                  type="submit"
                  form="import-form"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Importando…" : "Importar al Maestro"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
