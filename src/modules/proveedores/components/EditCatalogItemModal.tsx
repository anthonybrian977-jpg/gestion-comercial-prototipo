"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupplierCatalogItem } from "@/modules/proveedores/types";
import { updateCatalogItem } from "@/modules/proveedores/actions/catalog-actions";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100";
const labelCls = "mb-1 block text-xs font-medium text-slate-500";

export function EditCatalogItemModal({
  supplierId,
  item,
  onClose,
}: {
  supplierId: string;
  item: SupplierCatalogItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [supplierSku, setSupplierSku] = useState("");
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState("");
  const [presentation, setPresentation] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (item) {
      setSupplierSku(item.supplier_sku ?? "");
      setProductName(item.product_name);
      setBrand(item.brand ?? "");
      setModel(item.model ?? "");
      setCategory(item.category ?? "");
      setPresentation(item.presentation ?? "");
      setColor(item.color ?? "");
      setSize(item.size ?? "");
      setPrice(String(item.purchase_price));
      setIsActive(item.is_active);
      setError("");
    }
  }, [item]);

  if (!item) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError("El precio debe ser un número ≥ 0.");
      return;
    }
    setError("");
    setSaving(true);
    const result = await updateCatalogItem(item.id, supplierId, {
      supplier_sku: supplierSku,
      product_name: productName,
      brand, model, category, presentation, color, size,
      purchase_price: numPrice,
      is_active: isActive,
    });
    setSaving(false);
    if (!result.success) { setError(result.message); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Editar producto del catálogo</p>
            <h3 className="mt-0.5 text-base font-semibold text-slate-900 truncate">{item.product_name}</h3>
          </div>

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Nombre del producto *</label>
                <input required value={productName} onChange={(e) => setProductName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>SKU proveedor</label>
                <input value={supplierSku} onChange={(e) => setSupplierSku(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Precio de compra *</label>
                <input type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Marca</label>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Modelo</label>
                <input value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Categoría</label>
                <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Presentación</label>
                <input value={presentation} onChange={(e) => setPresentation(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Color</label>
                <input value={color} onChange={(e) => setColor(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Talla / Tamaño</label>
                <input value={size} onChange={(e) => setSize(e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-5" : "translate-x-1"}`} />
                </button>
                <span className="text-xs text-slate-600">Precio {isActive ? "activo" : "inactivo"}</span>
              </div>
            </div>
            {error ? (
              <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-rose-100">{error}</p>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
