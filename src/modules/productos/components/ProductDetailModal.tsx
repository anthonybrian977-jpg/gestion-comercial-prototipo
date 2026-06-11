"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductListItem, VariantSupplierPrice } from "@/modules/productos/types";
import { updateProduct } from "@/modules/productos/actions/update-product";
import {
  uploadProductImage,
  getProductImagePublicUrl,
} from "@/lib/supabase/upload-image";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import {
  formatCurrency,
  formatNumber,
} from "@/modules/productos/utils/format";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VariantRow = {
  tempId: string;
  dbId: string | null; // null = nueva variante aún no guardada
  sku: string;
  presentation: string;
  color: string;
  size: string;
  purchasePrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
  status: string;
  /** Path interno almacenado en BD. Ej: "variants/uuid.webp" */
  imagePath: string;
  /** UUID de supplier_catalog_items seleccionado como proveedor de compra */
  preferredCatalogItemId: string | null;
  /** true cuando el usuario cambió el precio manualmente después de elegir proveedor */
  isPriceManual: boolean;
};

type DetailForm = {
  name: string;
  brand: string;
  model: string;
  category: string;
  description: string;
  /** Path interno almacenado en BD. Ej: "products/uuid.webp" */
  imagePath: string;
  status: string;
  variants: VariantRow[];
};

function initForm(product: ProductListItem): DetailForm {
  return {
    name: product.name,
    brand: product.brand ?? "",
    model: product.model ?? "",
    category: product.category ?? "",
    description: product.description ?? "",
    imagePath: product.image_path ?? "",
    status: product.status,
    variants: product.variants.map((v) => ({
      tempId: v.id,
      dbId: v.id,
      sku: v.sku,
      presentation: v.presentation ?? "",
      color: v.color ?? "",
      size: v.size ?? "",
      purchasePrice: String(v.purchase_price ?? 0),
      salePrice: String(v.sale_price ?? 0),
      stock: String(v.stock ?? 0),
      minStock: String(v.min_stock ?? 0),
      status: v.status,
      imagePath: v.image_path ?? "",
      preferredCatalogItemId: v.preferred_catalog_item_id ?? null,
      isPriceManual: false,
    })),
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const cellInput =
  "w-full min-w-[70px] rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100";

const headerInput =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100";

const labelCls = "mb-1 block text-xs font-medium text-slate-500";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function VariantImageCell({
  tempId,
  displayImage,
  onChange,
}: {
  tempId: string;
  /** Blob URL (preview) o URL pública (ya guardada). Nunca path interno. */
  displayImage: string | undefined;
  onChange: (tempId: string, e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-1.5">
      {displayImage ? (
        <img
          src={displayImage}
          alt=""
          className="h-7 w-7 shrink-0 rounded border border-slate-100 object-cover"
        />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onChange(tempId, e)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {displayImage ? "Cambiar" : "Subir"}
      </button>
    </div>
  );
}

const VIEW_HEADERS = [
  "SKU",
  "Presentación",
  "Color",
  "Talla",
  "Precio compra",
  "Precio venta",
  "Stock",
  "Stock mín.",
  "Estado",
  "Imagen",
];

const EDIT_HEADERS = [
  "SKU",
  "Presentación",
  "Color",
  "Talla",
  "Precio compra",
  "Proveedor compra",
  "Precio venta",
  "Stock",
  "Stock mín.",
  "Estado",
  "Imagen",
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProductDetailModal({
  product,
  onClose,
}: {
  product: ProductListItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [form, setForm] = useState<DetailForm | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Precios por proveedor (view mode)
  const [supplierPrices, setSupplierPrices] = useState<VariantSupplierPrice[] | null>(null);

  // Blob URLs para preview inmediato — nunca se guardan en BD
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState("");
  const [variantImageFiles, setVariantImageFiles] = useState<
    Map<string, File>
  >(new Map());
  const [variantImagePreviews, setVariantImagePreviews] = useState<
    Map<string, string>
  >(new Map());

  const productImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      setForm(initForm(product));
      setMode("view");
      setError("");
      setLoading(false);
      resetImageStates();
    }
  }, [product]);

  // Cargar precios por proveedor cuando cambia el producto (lee supplier_catalog_items)
  useEffect(() => {
    if (!product) {
      setSupplierPrices(null);
      return;
    }

    const variantIds = product.variants.map((v) => v.id);
    if (variantIds.length === 0) {
      setSupplierPrices([]);
      return;
    }

    const supabase = createClient();
    supabase
      .from("supplier_catalog_items")
      .select("id, linked_variant_id, purchase_price, is_active, suppliers(id, name)")
      .in("linked_variant_id", variantIds)
      .eq("imported_to_master", true)
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) {
          setSupplierPrices([]);
          return;
        }

        type CatalogPriceRow = {
          id: string;
          linked_variant_id: string;
          purchase_price: number;
          is_active: boolean | null;
          suppliers: { id: string; name: string } | null;
        };

        const rows = data as unknown as CatalogPriceRow[];

        // Solo precios activos y con proveedor válido
        const activeRows = rows.filter(
          (r) => r.is_active !== false && r.suppliers !== null,
        );

        // Calcular precio mínimo por variante
        const minByVariant = new Map<string, number>();
        for (const row of activeRows) {
          const current = minByVariant.get(row.linked_variant_id);
          if (current === undefined || row.purchase_price < current) {
            minByVariant.set(row.linked_variant_id, row.purchase_price);
          }
        }

        const prices: VariantSupplierPrice[] = activeRows.map((row) => ({
          catalog_item_id: row.id,
          variant_id: row.linked_variant_id,
          supplier_id: row.suppliers!.id,
          supplier_name: row.suppliers!.name,
          purchase_price: row.purchase_price,
          is_best:
            row.purchase_price <=
            (minByVariant.get(row.linked_variant_id) ?? Infinity),
        }));

        setSupplierPrices(prices);
      });
  }, [product?.id]);

  // Revocar blob URLs al cambiar o desmontar
  useEffect(() => {
    return () => {
      if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    };
  }, [productImagePreview]);

  useEffect(() => {
    return () => {
      for (const url of variantImagePreviews.values())
        URL.revokeObjectURL(url);
    };
  }, [variantImagePreviews]);

  /** Opciones de proveedor agrupadas por variant_id (solo activas). */
  const supplierOptsByVariant = useMemo(() => {
    if (!supplierPrices) return new Map<string, VariantSupplierPrice[]>();
    const map = new Map<string, VariantSupplierPrice[]>();
    for (const sp of supplierPrices) {
      const arr = map.get(sp.variant_id) ?? [];
      arr.push(sp);
      map.set(sp.variant_id, arr);
    }
    return map;
  }, [supplierPrices]);

  if (!product || !form) return null;

  function resetImageStates() {
    setProductImageFile(null);
    setProductImagePreview("");
    setVariantImageFiles(new Map());
    setVariantImagePreviews(new Map());
  }

  // ── field helpers ─────────────────────────────────────────────────────────

  function setField<K extends keyof DetailForm>(
    field: K,
    value: DetailForm[K],
  ) {
    setForm((c) => (c ? { ...c, [field]: value } : c));
  }

  function setVariantField(
    tempId: string,
    field: keyof VariantRow,
    value: string,
  ) {
    setForm((c) =>
      c
        ? {
            ...c,
            variants: c.variants.map((v) =>
              v.tempId === tempId ? { ...v, [field]: value } : v,
            ),
          }
        : c,
    );
  }

  function setVariantPartial(tempId: string, partial: Partial<VariantRow>) {
    setForm((c) =>
      c
        ? {
            ...c,
            variants: c.variants.map((v) =>
              v.tempId === tempId ? { ...v, ...partial } : v,
            ),
          }
        : c,
    );
  }

  function addVariant() {
    const newRow: VariantRow = {
      tempId: crypto.randomUUID(),
      dbId: null,
      sku: "",
      presentation: "",
      color: "",
      size: "",
      purchasePrice: "0",
      salePrice: "0",
      stock: "0",
      minStock: "0",
      status: "active",
      imagePath: "",
      preferredCatalogItemId: null,
      isPriceManual: false,
    };
    setForm((c) => (c ? { ...c, variants: [...c.variants, newRow] } : c));
  }

  function cancelEdit() {
    if (product) setForm(initForm(product));
    setError("");
    setMode("view");
    resetImageStates();
  }

  // ── image handlers ─────────────────────────────────────────────────────────

  function handleProductImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    setProductImageFile(file);
    setProductImagePreview(URL.createObjectURL(file)); // blob URL, solo preview
  }

  function handleVariantImageChange(
    tempId: string,
    e: ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const prev = variantImagePreviews.get(tempId);
    if (prev) URL.revokeObjectURL(prev);
    setVariantImageFiles((m) => new Map(m).set(tempId, file));
    setVariantImagePreviews((m) =>
      new Map(m).set(tempId, URL.createObjectURL(file)), // blob URL, solo preview
    );
  }

  // ── submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !product) return;
    setError("");
    setLoading(true);

    // 1. Subir imagen del producto → guardar path interno en BD
    let finalProductImagePath: string | undefined =
      form.imagePath || undefined;
    if (productImageFile) {
      const upload = await uploadProductImage(productImageFile, "products");
      if (!upload.success) {
        setError(upload.message);
        setLoading(false);
        return;
      }
      finalProductImagePath = upload.path; // ← path interno, no publicUrl
    }

    // 2. Subir imágenes de variantes → guardar path interno en BD
    const resolvedVariantPaths = new Map<string, string>();
    for (const [tempId, file] of variantImageFiles) {
      const upload = await uploadProductImage(file, "variants");
      if (!upload.success) {
        setError(upload.message);
        setLoading(false);
        return;
      }
      resolvedVariantPaths.set(tempId, upload.path); // ← path interno, no publicUrl
    }

    const existing = form.variants.filter((v) => v.dbId !== null);
    const created = form.variants.filter((v) => v.dbId === null);

    const result = await updateProduct({
      id: product.id,
      name: form.name,
      brand: form.brand,
      model: form.model,
      category: form.category,
      description: form.description,
      mainSku: product.main_sku ?? "",
      imagePath: finalProductImagePath,         // path interno → se guarda en BD
      status: form.status,
      variants: existing.map((v) => ({
        id: v.dbId as string,
        sku: v.sku,
        presentation: v.presentation,
        color: v.color,
        size: v.size,
        purchasePrice: Number(v.purchasePrice),
        salePrice: Number(v.salePrice),
        stock: Number(v.stock),
        minStock: Number(v.minStock),
        status: v.status,
        imagePath:
          resolvedVariantPaths.get(v.tempId) ?? (v.imagePath || undefined), // path interno
        preferredCatalogItemId: v.preferredCatalogItemId,
      })),
      newVariants: created.map((v) => ({
        sku: v.sku || undefined,
        presentation: v.presentation || undefined,
        color: v.color || undefined,
        size: v.size || undefined,
        purchasePrice: Number(v.purchasePrice),
        salePrice: Number(v.salePrice),
        stock: Number(v.stock),
        minStock: Number(v.minStock),
        status: v.status,
        imagePath:
          resolvedVariantPaths.get(v.tempId) ?? (v.imagePath || undefined), // path interno
      })),
    });

    if (!result.success) {
      setError(result.message);
      setLoading(false);
      return;
    }

    onClose();
    router.refresh();
  }

  // ── render ────────────────────────────────────────────────────────────────

  const isEdit = mode === "edit";

  // Para mostrar la imagen del producto en modo edición:
  // blob URL (preview de archivo recién seleccionado) > URL pública generada desde path en BD
  // Nunca usamos form.imagePath directamente como src
  const productEditDisplayUrl: string | undefined =
    productImagePreview ||
    getProductImagePublicUrl(form.imagePath) ||
    undefined;

  // Para mostrar la imagen del producto en modo vista
  const productViewUrl = getProductImagePublicUrl(product.image_path);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />

      <div className="relative flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* ── HEADER ──────────────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-slate-100 px-6 py-5">
            {isEdit ? (
              <>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
                  Editar producto
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {/* Nombre */}
                  <div className="sm:col-span-2 xl:col-span-3">
                    <label className={labelCls}>Nombre *</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className={headerInput}
                    />
                  </div>
                  {/* Categoría */}
                  <div>
                    <label className={labelCls}>Categoría</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => setField("category", e.target.value)}
                      className={headerInput}
                    />
                  </div>
                  {/* Marca */}
                  <div>
                    <label className={labelCls}>Marca</label>
                    <input
                      type="text"
                      value={form.brand}
                      onChange={(e) => setField("brand", e.target.value)}
                      className={headerInput}
                    />
                  </div>
                  {/* Modelo */}
                  <div>
                    <label className={labelCls}>Modelo</label>
                    <input
                      type="text"
                      value={form.model}
                      onChange={(e) => setField("model", e.target.value)}
                      className={headerInput}
                    />
                  </div>
                  {/* Estado */}
                  <div>
                    <label className={labelCls}>Estado</label>
                    <select
                      value={form.status}
                      onChange={(e) => setField("status", e.target.value)}
                      className={headerInput}
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                  {/* Descripción */}
                  <div className="sm:col-span-2 xl:col-span-3">
                    <label className={labelCls}>Descripción</label>
                    <textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      className={headerInput}
                    />
                  </div>
                  {/* Imagen del producto */}
                  <div className="sm:col-span-2 xl:col-span-3">
                    <label className={labelCls}>Imagen del producto</label>
                    <div className="flex items-center gap-3">
                      {productEditDisplayUrl ? (
                        <img
                          src={productEditDisplayUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400">
                          Sin imagen
                        </div>
                      )}
                      <input
                        ref={productImageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleProductImageChange}
                      />
                      <button
                        type="button"
                        onClick={() => productImageInputRef.current?.click()}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {productEditDisplayUrl ? "Cambiar imagen" : "Subir imagen"}
                      </button>
                      <span className="text-xs text-slate-400">
                        JPG, PNG o WebP · máx. 2 MB
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* ── VIEW MODE header ───────────────────────────────────── */
              <div className="flex items-start gap-4">
                {productViewUrl ? (
                  <img
                    src={productViewUrl}
                    alt={product.name}
                    className="h-14 w-14 shrink-0 cursor-pointer rounded-xl border border-slate-200 object-cover transition hover:opacity-80"
                    onClick={() => setLightboxSrc(productViewUrl)}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
                    Detalle del producto
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    {product.name}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    {product.category ? (
                      <span>
                        Categoría:{" "}
                        <span className="font-medium text-slate-700">
                          {product.category}
                        </span>
                      </span>
                    ) : null}
                    {product.brand ? (
                      <span>
                        Marca:{" "}
                        <span className="font-medium text-slate-700">
                          {product.brand}
                        </span>
                      </span>
                    ) : null}
                    {product.model ? (
                      <span>
                        Modelo:{" "}
                        <span className="font-medium text-slate-700">
                          {product.model}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <StatusBadge status={product.status} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── TABLE ───────────────────────────────────────────────────── */}
          <div className="min-h-0 flex-1 overflow-auto">
            {/* Precios por proveedor — solo en modo vista */}
            {!isEdit && supplierPrices !== null && supplierPrices.length > 0 && (
              <div className="border-b border-slate-100 px-6 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Precios por proveedor
                </p>
                <div className="space-y-3">
                  {product.variants.map((v) => {
                    const prices = supplierPrices.filter(
                      (sp) => sp.variant_id === v.id,
                    );
                    if (prices.length === 0) return null;
                    const label = [v.sku, v.color, v.presentation ? `(${v.presentation})` : null]
                      .filter(Boolean)
                      .join(" — ");
                    return (
                      <div key={v.id}>
                        <p className="mb-1.5 text-xs font-medium text-slate-700">
                          {label}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {prices
                            .slice()
                            .sort((a, b) => a.purchase_price - b.purchase_price)
                            .map((sp) => (
                              <div
                                key={sp.supplier_id}
                                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                                  sp.is_best
                                    ? "border-emerald-200 bg-emerald-50"
                                    : "border-slate-200 bg-slate-50"
                                }`}
                              >
                                <span className="font-medium text-slate-800">
                                  {sp.supplier_name}
                                </span>
                                <span className="text-slate-500">
                                  {formatCurrency(sp.purchase_price)}
                                </span>
                                {sp.is_best ? (
                                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    Mejor precio
                                  </span>
                                ) : null}
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {form.variants.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                Este producto no tiene variantes registradas.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    {(isEdit ? EDIT_HEADERS : VIEW_HEADERS).map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.variants.map((v) => {
                    const isNewRow = v.dbId === null;
                    const isLowStock =
                      !isEdit && Number(v.stock) <= Number(v.minStock);

                    // Para mostrar imagen de variante:
                    // blob URL preview > URL pública de path de variante > URL pública de path de producto (fallback)
                    // Nunca usamos v.imagePath ni form.imagePath directamente como src
                    const variantDisplayUrl: string | undefined =
                      variantImagePreviews.get(v.tempId) ||
                      getProductImagePublicUrl(v.imagePath) ||
                      getProductImagePublicUrl(form.imagePath) ||
                      undefined;

                    return isEdit ? (
                      <tr
                        key={v.tempId}
                        className={isNewRow ? "bg-cyan-50/50" : undefined}
                      >
                        {/* SKU */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={v.sku}
                            placeholder="Auto"
                            onChange={(e) =>
                              setVariantField(v.tempId, "sku", e.target.value)
                            }
                            className={cellInput}
                          />
                        </td>
                        {/* Presentación — siempre editable */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={v.presentation}
                            onChange={(e) =>
                              setVariantField(
                                v.tempId,
                                "presentation",
                                e.target.value,
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        {/* Color */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={v.color}
                            onChange={(e) =>
                              setVariantField(v.tempId, "color", e.target.value)
                            }
                            className={cellInput}
                          />
                        </td>
                        {/* Talla */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={v.size}
                            onChange={(e) =>
                              setVariantField(v.tempId, "size", e.target.value)
                            }
                            className={cellInput}
                          />
                        </td>
                        {/* Precio compra */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={v.purchasePrice}
                            onChange={(e) => {
                              const opts = v.dbId
                                ? (supplierOptsByVariant.get(v.dbId) ?? [])
                                : [];
                              setVariantPartial(v.tempId, {
                                purchasePrice: e.target.value,
                                isPriceManual:
                                  opts.length > 0 &&
                                  !!v.preferredCatalogItemId,
                              });
                            }}
                            className={`${cellInput} ${v.isPriceManual ? "border-amber-300 ring-1 ring-amber-100" : ""}`}
                          />
                          {v.isPriceManual && (
                            <div className="mt-0.5 text-[10px] text-amber-600">
                              precio manual
                            </div>
                          )}
                        </td>
                        {/* Proveedor compra */}
                        <td className="px-3 py-2">
                          {(() => {
                            const opts = v.dbId
                              ? (supplierOptsByVariant.get(v.dbId) ?? [])
                              : [];
                            if (opts.length === 0)
                              return (
                                <span className="text-xs text-slate-400">
                                  —
                                </span>
                              );
                            return (
                              <select
                                value={v.preferredCatalogItemId ?? ""}
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  const opt = opts.find(
                                    (o) =>
                                      o.catalog_item_id === selectedId,
                                  );
                                  setVariantPartial(v.tempId, {
                                    preferredCatalogItemId:
                                      selectedId || null,
                                    purchasePrice: opt
                                      ? String(opt.purchase_price)
                                      : v.purchasePrice,
                                    isPriceManual: false,
                                  });
                                }}
                                className={cellInput}
                              >
                                <option value="">— Manual —</option>
                                {opts
                                  .slice()
                                  .sort(
                                    (a, b) =>
                                      a.purchase_price - b.purchase_price,
                                  )
                                  .map((opt) => (
                                    <option
                                      key={opt.catalog_item_id}
                                      value={opt.catalog_item_id}
                                    >
                                      {opt.supplier_name} ·{" "}
                                      {formatCurrency(opt.purchase_price)}
                                      {opt.is_best ? " ★" : ""}
                                    </option>
                                  ))}
                              </select>
                            );
                          })()}
                        </td>
                        {/* Precio venta */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={v.salePrice}
                            onChange={(e) =>
                              setVariantField(
                                v.tempId,
                                "salePrice",
                                e.target.value,
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        {/* Stock */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            required
                            value={v.stock}
                            onChange={(e) =>
                              setVariantField(
                                v.tempId,
                                "stock",
                                e.target.value,
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        {/* Stock mín. */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            required
                            value={v.minStock}
                            onChange={(e) =>
                              setVariantField(
                                v.tempId,
                                "minStock",
                                e.target.value,
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        {/* Estado */}
                        <td className="px-3 py-2">
                          <select
                            value={v.status}
                            onChange={(e) =>
                              setVariantField(
                                v.tempId,
                                "status",
                                e.target.value,
                              )
                            }
                            className={cellInput}
                          >
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                          </select>
                        </td>
                        {/* Imagen */}
                        <td className="px-3 py-2">
                          <VariantImageCell
                            tempId={v.tempId}
                            displayImage={variantDisplayUrl}
                            onChange={handleVariantImageChange}
                          />
                        </td>
                      </tr>
                    ) : (
                      /* ── VIEW ROW ─────────────────────────────────────── */
                      <tr
                        key={v.tempId}
                        className={isLowStock ? "bg-rose-50/60" : undefined}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {v.sku}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {v.presentation || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {v.color || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {v.size || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-600">
                            {formatCurrency(Number(v.purchasePrice))}
                          </div>
                          {(() => {
                            const opts = v.dbId
                              ? (supplierOptsByVariant.get(v.dbId) ?? [])
                              : [];
                            if (opts.length === 0) return null;
                            const tag = v.preferredCatalogItemId
                              ? opts.find(
                                  (o) =>
                                    o.catalog_item_id ===
                                    v.preferredCatalogItemId,
                                )
                              : opts.find((o) => o.is_best);
                            if (!tag) return null;
                            return (
                              <div className="mt-0.5 text-[10px] text-slate-400">
                                {tag.supplier_name}
                                {tag.is_best ? " · Mejor precio" : ""}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatCurrency(Number(v.salePrice))}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          <span
                            className={
                              isLowStock
                                ? "font-semibold text-rose-700"
                                : undefined
                            }
                          >
                            {formatNumber(Number(v.stock))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatNumber(Number(v.minStock))}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={v.status} />
                        </td>
                        <td className="px-4 py-3">
                          {variantDisplayUrl ? (
                            <img
                              src={variantDisplayUrl}
                              alt=""
                              className="h-8 w-8 cursor-pointer rounded border border-slate-100 object-cover transition hover:opacity-80"
                              onClick={() => setLightboxSrc(variantDisplayUrl)}
                            />
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── FOOTER ──────────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-slate-100 px-6 py-4">
            {error ? (
              <p className="mb-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-rose-100">
                {error}
              </p>
            ) : null}

            {isEdit ? (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={addVariant}
                  className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-100"
                >
                  + Agregar variante
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={loading}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
                  >
                    {loading ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
                >
                  Editar
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
