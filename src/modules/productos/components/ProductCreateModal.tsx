"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createProduct } from "@/modules/productos/actions/create-product";
import type { CreateVariantInput } from "@/modules/productos/types";

type ProductCreateModalProps = {
  open: boolean;
  onClose: () => void;
};

type VariantFormState = {
  id: string;
  sku: string;
  presentation: string;
  color: string;
  size: string;
  purchasePrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
  status: string;
};

function createEmptyVariant(presentation = ""): VariantFormState {
  return {
    id: crypto.randomUUID(),
    sku: "",
    presentation,
    color: "",
    size: "",
    purchasePrice: "0",
    salePrice: "0",
    stock: "0",
    minStock: "0",
    status: "active",
  };
}

function createInitialFormState() {
  return {
    name: "",
    brand: "",
    model: "",
    category: "",
    description: "",
    mainSku: "",
    hasVariants: false,
    status: "active",
    variants: [createEmptyVariant("Principal")],
  };
}

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100";

const labelClassName = "mb-1.5 block text-sm font-medium text-slate-700";

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

function VariantFields({
  variant,
  index,
  hasVariants,
  onChange,
  onRemove,
  canRemove,
}: {
  variant: VariantFormState;
  index: number;
  hasVariants: boolean;
  onChange: (id: string, field: keyof VariantFormState, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">
          {hasVariants ? `Variante ${index + 1}` : "Variante principal"}
        </p>
        {hasVariants && canRemove ? (
          <button
            type="button"
            onClick={() => onRemove(variant.id)}
            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
          >
            Quitar
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className={labelClassName}>SKU</label>
          <input
            type="text"
            value={variant.sku}
            onChange={(event) => onChange(variant.id, "sku", event.target.value)}
            placeholder="Automático si se deja vacío"
            className={inputClassName}
          />
        </div>

        {hasVariants ? (
          <div>
            <label className={labelClassName}>Presentación</label>
            <input
              type="text"
              value={variant.presentation}
              onChange={(event) =>
                onChange(variant.id, "presentation", event.target.value)
              }
              placeholder="Ej. 50ml, Switch azul"
              className={inputClassName}
            />
          </div>
        ) : (
          <div>
            <label className={labelClassName}>Presentación</label>
            <input
              type="text"
              value="Principal"
              disabled
              className={`${inputClassName} cursor-not-allowed opacity-70`}
            />
          </div>
        )}

        <div>
          <label className={labelClassName}>Color</label>
          <input
            type="text"
            value={variant.color}
            onChange={(event) => onChange(variant.id, "color", event.target.value)}
            className={inputClassName}
          />
        </div>

        <div>
          <label className={labelClassName}>Talla</label>
          <input
            type="text"
            value={variant.size}
            onChange={(event) => onChange(variant.id, "size", event.target.value)}
            className={inputClassName}
          />
        </div>

        <div>
          <label className={labelClassName}>Precio compra *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={variant.purchasePrice}
            onChange={(event) =>
              onChange(variant.id, "purchasePrice", event.target.value)
            }
            className={inputClassName}
          />
        </div>

        <div>
          <label className={labelClassName}>Precio venta *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={variant.salePrice}
            onChange={(event) =>
              onChange(variant.id, "salePrice", event.target.value)
            }
            className={inputClassName}
          />
        </div>

        <div>
          <label className={labelClassName}>Stock inicial *</label>
          <input
            type="number"
            min="0"
            step="1"
            required
            value={variant.stock}
            onChange={(event) => onChange(variant.id, "stock", event.target.value)}
            className={inputClassName}
          />
        </div>

        <div>
          <label className={labelClassName}>Stock mínimo *</label>
          <input
            type="number"
            min="0"
            step="1"
            required
            value={variant.minStock}
            onChange={(event) =>
              onChange(variant.id, "minStock", event.target.value)
            }
            className={inputClassName}
          />
        </div>
      </div>
    </div>
  );
}

export function ProductCreateModal({ open, onClose }: ProductCreateModalProps) {
  const router = useRouter();
  const [form, setForm] = useState(createInitialFormState);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(createInitialFormState());
      setError("");
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  function updateField<K extends keyof typeof form>(
    field: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateVariantField(
    id: string,
    field: keyof VariantFormState,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.id === id ? { ...variant, [field]: value } : variant,
      ),
    }));
  }

  function handleHasVariantsChange(checked: boolean) {
    setForm((current) => ({
      ...current,
      hasVariants: checked,
      variants: checked
        ? current.variants.length > 0
          ? current.variants.map((variant) => ({
              ...variant,
              presentation: variant.presentation === "Principal" ? "" : variant.presentation,
            }))
          : [createEmptyVariant()]
        : [createEmptyVariant("Principal")],
    }));
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [...current.variants, createEmptyVariant()],
    }));
  }

  function removeVariant(id: string) {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((variant) => variant.id !== id),
    }));
  }

  function mapVariantsForSubmit(): CreateVariantInput[] {
    return form.variants.map((variant) => ({
      sku: variant.sku.trim() || undefined,
      presentation: form.hasVariants
        ? variant.presentation.trim() || undefined
        : "Principal",
      color: variant.color.trim() || undefined,
      size: variant.size.trim() || undefined,
      purchasePrice: Number(variant.purchasePrice),
      salePrice: Number(variant.salePrice),
      stock: Number(variant.stock),
      minStock: Number(variant.minStock),
      status: variant.status,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await createProduct({
      name: form.name,
      brand: form.brand,
      model: form.model,
      category: form.category,
      description: form.description,
      mainSku: form.mainSku,
      hasVariants: form.hasVariants,
      status: form.status,
      variants: mapVariantsForSubmit(),
    });

    if (!result.success) {
      setError(result.message);
      setLoading(false);
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
            Maestro de Productos
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            Nuevo producto
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Registra un producto base y sus variantes con stock y precios iniciales.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-y-auto px-6 py-5">
            <section className="mb-8">
              <SectionTitle
                title="Datos generales"
                subtitle="Información principal del producto base."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelClassName}>Nombre del producto *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Marca</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(event) => updateField("brand", event.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Modelo</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(event) => updateField("model", event.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Categoría</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(event) => updateField("category", event.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>SKU principal</label>
                  <input
                    type="text"
                    value={form.mainSku}
                    onChange={(event) => updateField("mainSku", event.target.value)}
                    placeholder="Automático si se deja vacío"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Estado</label>
                  <select
                    value={form.status}
                    onChange={(event) => updateField("status", event.target.value)}
                    className={inputClassName}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClassName}>Descripción</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    className={inputClassName}
                  />
                </div>
              </div>
            </section>

            <section className="mb-8">
              <SectionTitle
                title="Configuración de variantes"
                subtitle="Define si el producto es simple o maneja variantes visibles."
              />
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.hasVariants}
                  onChange={(event) => handleHasVariantsChange(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-sm font-medium text-slate-800">
                  Tiene variantes
                </span>
              </label>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <SectionTitle
                  title="Stock y precios"
                  subtitle={
                    form.hasVariants
                      ? "Agrega una o más variantes antes de guardar."
                      : "Se creará una variante principal interna para el producto simple."
                  }
                />
                {form.hasVariants ? (
                  <button
                    type="button"
                    onClick={addVariant}
                    className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-100"
                  >
                    Agregar variante
                  </button>
                ) : null}
              </div>

              <div className="space-y-4">
                {form.variants.map((variant, index) => (
                  <VariantFields
                    key={variant.id}
                    variant={variant}
                    index={index}
                    hasVariants={form.hasVariants}
                    onChange={updateVariantField}
                    onRemove={removeVariant}
                    canRemove={form.variants.length > 1}
                  />
                ))}
              </div>
            </section>

            {error ? (
              <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
