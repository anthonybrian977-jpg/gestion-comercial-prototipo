"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupplierCatalogItem } from "@/modules/proveedores/types";
import { importCatalogItemToMaster } from "@/modules/proveedores/actions/catalog-actions";
import { formatCurrency } from "@/modules/productos/utils/format";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100";
const labelCls = "mb-1 block text-xs font-medium text-slate-500";

export function ImportToMasterModal({
  supplierId,
  item,
  onClose,
}: {
  supplierId: string;
  item: SupplierCatalogItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [salePrice, setSalePrice] = useState("");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [mainSku, setMainSku] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!item) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    const numSalePrice = Number(salePrice);
    if (isNaN(numSalePrice) || numSalePrice < 0) {
      setError("El precio de venta debe ser ≥ 0.");
      return;
    }
    setError("");
    setSaving(true);
    const result = await importCatalogItemToMaster(item.id, supplierId, {
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

  const attrs = [item.color, item.size, item.presentation].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Importar al Maestro de Productos</p>
            <h3 className="mt-1 text-base font-semibold text-slate-900 truncate">{item.product_name}</h3>
            {attrs && <p className="mt-0.5 text-xs text-slate-500">{attrs}</p>}
            <p className="mt-1 text-xs text-slate-400">
              Precio de compra del proveedor: <span className="font-medium text-slate-600">{formatCurrency(item.purchase_price)}</span>
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-amber-100">
              <strong>Alta manual</strong> — crea el producto directamente sin pasar por una Orden de Compra.
              Para el flujo estándar con trazabilidad de compra, usa <strong>Órdenes de Compra</strong>.
            </div>
            <p className="mb-4 text-xs text-slate-500 leading-relaxed">
              Se creará un nuevo producto y variante en el Maestro usando los datos del proveedor. Completa los campos faltantes.
            </p>
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
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {saving ? "Importando…" : "Importar al Maestro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
