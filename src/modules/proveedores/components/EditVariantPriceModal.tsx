"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupplierVariantItem } from "@/modules/proveedores/types";
import { updateSupplierVariant } from "@/modules/proveedores/actions/supplier-actions";
import { formatCurrency } from "@/modules/productos/utils/format";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100";

export function EditVariantPriceModal({
  supplierId,
  item,
  onClose,
}: {
  supplierId: string;
  item: SupplierVariantItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [supplierSku, setSupplierSku] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item) {
      setPrice(String(item.purchase_price));
      setSupplierSku(item.supplier_sku ?? "");
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
      setError("El precio debe ser un número mayor o igual a 0.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await updateSupplierVariant(
      supplierId,
      item.supplier_product_id,
      numPrice,
      supplierSku.trim() || null,
      isActive,
    );
    setLoading(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
              Editar precio
            </p>
            <h3 className="mt-0.5 text-base font-semibold text-slate-900">
              {item.product_name}
            </h3>
            <p className="mt-0.5 font-mono text-sm text-slate-500">{item.sku}</p>
            {[item.color, item.size, item.presentation].filter(Boolean).length > 0 ? (
              <p className="mt-1 text-xs text-slate-400">
                {[item.color, item.size, item.presentation].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-400">
              Precio actual: {formatCurrency(item.purchase_price)}
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Precio de compra *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  SKU proveedor{" "}
                  <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={supplierSku}
                  onChange={(e) => setSupplierSku(e.target.value)}
                  placeholder="Código interno del proveedor"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive((v) => !v)}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  isActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    isActive ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-xs font-medium text-slate-600">
                Precio {isActive ? "activo" : "inactivo"}
              </span>
            </div>

            {error ? (
              <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-rose-100">
                {error}
              </p>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              {loading ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
