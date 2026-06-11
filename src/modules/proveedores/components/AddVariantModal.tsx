"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addSupplierVariant } from "@/modules/proveedores/actions/supplier-actions";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100";

type Variant = {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  presentation: string | null;
  products: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
  } | null;
};

export function AddVariantModal({
  supplierId,
  existingVariantIds,
  open,
  onClose,
}: {
  supplierId: string;
  existingVariantIds: Set<string>;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantSearch, setVariantSearch] = useState("");
  const [selected, setSelected] = useState<Variant | null>(null);
  const [price, setPrice] = useState("");
  const [supplierSku, setSupplierSku] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch available variants when modal opens
  useEffect(() => {
    if (!open) {
      setVariants([]);
      setSelected(null);
      setVariantSearch("");
      setPrice("");
      setSupplierSku("");
      setIsActive(true);
      setError("");
      return;
    }

    setLoadingVariants(true);
    const supabase = createClient();
    supabase
      .from("product_variants")
      .select(
        `id, sku, color, size, presentation,
        products ( id, name, brand, category )`,
      )
      .eq("status", "active")
      .order("sku")
      .then(({ data }) => {
        const all = (data ?? []) as unknown as Variant[];
        // Exclude already-associated variants
        setVariants(all.filter((v) => !existingVariantIds.has(v.id)));
        setLoadingVariants(false);
      });
  }, [open, existingVariantIds]);

  const filtered = useMemo(() => {
    const q = variantSearch.trim().toLowerCase();
    if (!q) return variants;
    return variants.filter((v) => {
      const productName = v.products?.name ?? "";
      return [v.sku, productName, v.color, v.size, v.presentation].some((f) =>
        f?.toLowerCase().includes(q),
      );
    });
  }, [variantSearch, variants]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Selecciona una variante.");
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError("El precio debe ser un número mayor o igual a 0.");
      return;
    }
    setError("");
    setSaving(true);
    const result = await addSupplierVariant(
      supplierId,
      selected.id,
      numPrice,
      supplierSku.trim() || null,
      isActive,
    );
    setSaving(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    router.refresh();
    onClose();
  }

  function variantLabel(v: Variant) {
    const parts = [v.color, v.size, v.presentation].filter(Boolean).join(" · ");
    return parts ? `${v.sku} [${parts}]` : v.sku;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
              Agregar producto
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              Asociar variante a este proveedor
            </h3>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {/* Step 1 — Select variant */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Buscar variante
              </label>
              <input
                type="search"
                placeholder="SKU, producto, color, talla…"
                value={variantSearch}
                onChange={(e) => setVariantSearch(e.target.value)}
                className={inputCls}
              />
            </div>

            {loadingVariants ? (
              <p className="py-4 text-center text-sm text-slate-400">
                Cargando variantes…
              </p>
            ) : (
              <div className="mb-4 max-h-48 overflow-y-auto rounded-xl border border-slate-200">
                {filtered.length === 0 ? (
                  <p className="px-4 py-4 text-center text-sm text-slate-400">
                    {variants.length === 0
                      ? "Todas las variantes ya están asociadas a este proveedor."
                      : "Sin resultados."}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filtered.slice(0, 80).map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(v)}
                          className={`w-full px-4 py-2.5 text-left transition ${
                            selected?.id === v.id
                              ? "bg-cyan-50 text-cyan-800"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <span className="block text-xs font-semibold text-slate-800">
                            {v.products?.name ?? "—"}
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {variantLabel(v)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Step 2 — Price + supplierSku */}
            {selected ? (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
                <p className="mb-3 text-xs font-semibold text-cyan-700">
                  Variante seleccionada:{" "}
                  <span className="font-mono">{selected.sku}</span>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
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
                      placeholder="Código del proveedor"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex items-center gap-3 sm:col-span-2">
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
                    <span className="text-xs text-slate-600">
                      Precio {isActive ? "activo" : "inactivo"}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

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
              disabled={!selected || saving}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              {saving ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
