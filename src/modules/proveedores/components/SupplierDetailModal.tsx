"use client";

import { useEffect, useState } from "react";
import type {
  SupplierListItem,
  SupplierProductGroup,
  SupplierVariantItem,
} from "@/modules/proveedores/types";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/modules/productos/utils/format";

// ---------------------------------------------------------------------------
// Types for Supabase nested select result
// ---------------------------------------------------------------------------

type SpJoinRow = {
  id: string;
  purchase_price: number;
  supplier_sku: string | null;
  variant_id: string;
  product_variants: {
    id: string;
    sku: string;
    color: string | null;
    size: string | null;
    presentation: string | null;
    product_id: string;
    products: {
      id: string;
      name: string;
      brand: string | null;
      category: string | null;
    };
  };
};

// ---------------------------------------------------------------------------
// Data fetch (client-side)
// ---------------------------------------------------------------------------

async function fetchSupplierGroups(
  supplierId: string,
): Promise<SupplierProductGroup[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("supplier_products")
    .select(
      `
      id,
      purchase_price,
      supplier_sku,
      variant_id,
      product_variants (
        id,
        sku,
        color,
        size,
        presentation,
        product_id,
        products (
          id,
          name,
          brand,
          category
        )
      )
    `,
    )
    .eq("supplier_id", supplierId)
    .order("purchase_price");

  if (error || !data) return [];

  // Group by product
  const groupMap = new Map<string, SupplierProductGroup>();

  for (const row of data as unknown as SpJoinRow[]) {
    const pv = row.product_variants;
    if (!pv) continue;
    const prod = pv.products;
    if (!prod) continue;

    const variantItem: SupplierVariantItem = {
      supplier_product_id: row.id,
      variant_id: row.variant_id,
      sku: pv.sku,
      supplier_sku: row.supplier_sku,
      is_active: true, // SupplierDetailModal (legacy) no selecciona is_active; default true
      color: pv.color,
      size: pv.size,
      presentation: pv.presentation,
      product_id: pv.product_id,
      product_name: prod.name,
      product_brand: prod.brand,
      product_category: prod.category,
      purchase_price: row.purchase_price,
    };

    const group = groupMap.get(prod.id) ?? {
      product_id: prod.id,
      product_name: prod.name,
      product_brand: prod.brand,
      product_category: prod.category,
      variants: [],
    };
    group.variants.push(variantItem);
    groupMap.set(prod.id, group);
  }

  // Sort groups by product name
  return Array.from(groupMap.values()).sort((a, b) =>
    a.product_name.localeCompare(b.product_name),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  supplier: SupplierListItem | null;
  onClose: () => void;
};

export function SupplierDetailModal({ supplier, onClose }: Props) {
  const [groups, setGroups] = useState<SupplierProductGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supplier) {
      setGroups([]);
      return;
    }
    setLoading(true);
    fetchSupplierGroups(supplier.id).then((g) => {
      setGroups(g);
      setLoading(false);
    });
  }, [supplier?.id]);

  if (!supplier) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />

      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
                Detalle del proveedor
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                {supplier.name}
              </h3>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
                {supplier.ruc ? (
                  <span>
                    RUC:{" "}
                    <span className="font-medium text-slate-700">
                      {supplier.ruc}
                    </span>
                  </span>
                ) : null}
                {supplier.contact_name ? (
                  <span>
                    Contacto:{" "}
                    <span className="font-medium text-slate-700">
                      {supplier.contact_name}
                    </span>
                  </span>
                ) : null}
                {supplier.phone ? (
                  <span>
                    Teléfono:{" "}
                    <span className="font-medium text-slate-700">
                      {supplier.phone}
                    </span>
                  </span>
                ) : null}
                {supplier.email ? (
                  <span>
                    Email:{" "}
                    <span className="font-medium text-slate-700">
                      {supplier.email}
                    </span>
                  </span>
                ) : null}
              </div>
              {supplier.address ? (
                <p className="mt-1 text-sm text-slate-500">
                  Dirección:{" "}
                  <span className="font-medium text-slate-700">
                    {supplier.address}
                  </span>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <span className="text-sm text-slate-400">Cargando productos…</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Este proveedor no tiene productos asignados.
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <div key={group.product_id}>
                  {/* Product header */}
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-slate-900">
                      {group.product_name}
                    </span>
                    {group.product_brand ? (
                      <span className="text-xs text-slate-500">
                        {group.product_brand}
                      </span>
                    ) : null}
                    {group.product_category ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {group.product_category}
                      </span>
                    ) : null}
                  </div>

                  {/* Variants table */}
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50">
                        <tr>
                          {["SKU", "Color", "Talla", "Presentación", "Precio compra"].map(
                            (h) => (
                              <th
                                key={h}
                                className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.variants.map((v) => (
                          <tr key={v.variant_id}>
                            <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                              {v.sku}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-600">
                              {v.color ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-600">
                              {v.size ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-600">
                              {v.presentation ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                              {formatCurrency(v.purchase_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
