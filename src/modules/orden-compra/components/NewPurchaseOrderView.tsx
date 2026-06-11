"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { CartItem, SupplierAlternative } from "@/modules/orden-compra/types";
import type { SupplierCatalogItem, SupplierRecord } from "@/modules/proveedores/types";
import {
  getCatalogForSupplier,
  getAlternativesForCatalog,
  saveDraftPurchaseOrder,
  issuePurchaseOrder,
} from "@/modules/orden-compra/actions/purchase-order-actions";
import { formatCurrency } from "@/modules/productos/utils/format";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Sub-componente: comparativa de proveedores por ítem ──────────────────────
/**
 * Panel expandible que muestra este proveedor vs. alternativas encontradas.
 * Los diffs se recalculan en vivo usando currentPrice (precio editado en carrito).
 * No toma ninguna decisión — solo muestra información.
 */
function AlternativesPanel({
  currentPrice,
  alternatives,
}: {
  currentPrice: number;
  alternatives: SupplierAlternative[];
}) {
  const [open, setOpen] = useState(false);

  // Recalcular diferencias en vivo (el usuario puede haber editado el precio)
  const altsLive = alternatives.map((alt) => {
    const diff = currentPrice - alt.price;
    const pct = currentPrice > 0 ? (diff / currentPrice) * 100 : 0;
    return { ...alt, liveDiff: diff, livePct: pct };
  });

  const cheapest = altsLive.find((a) => a.liveDiff > 0);

  return (
    <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2">
      {/* Cabecera siempre visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-medium text-amber-700">
          {cheapest
            ? `⚠ ${cheapest.supplierName} lo tiene a ${formatCurrency(cheapest.price)} — S/ ${cheapest.liveDiff.toFixed(2)} menos`
            : `ℹ También disponible en ${alternatives.length} proveedor${alternatives.length !== 1 ? "es" : ""}`}
        </span>
        <span className="ml-2 shrink-0 text-[10px] text-amber-500">
          {open ? "▲ cerrar" : "▼ ver"}
        </span>
      </button>

      {/* Tabla expandida */}
      {open && (
        <div className="mt-2.5 space-y-1">
          {/* Fila: este proveedor */}
          <div className="flex items-center gap-2 rounded-md bg-cyan-50 px-2 py-1.5 text-[11px] ring-1 ring-cyan-100">
            <span className="min-w-0 flex-1 font-semibold text-cyan-800">Este proveedor</span>
            <span className="w-20 text-right font-semibold text-cyan-900">
              {formatCurrency(currentPrice)}
            </span>
            <span className="w-24 text-right text-cyan-400">—</span>
            <span className="w-16" />
          </div>

          {/* Alternativas */}
          {altsLive.map((alt) => (
            <div
              key={alt.catalogItemId}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-white"
            >
              <span className="min-w-0 flex-1 truncate text-slate-700">{alt.supplierName}</span>
              <span className="w-20 text-right font-semibold text-slate-800">
                {formatCurrency(alt.price)}
              </span>
              <span
                className={`w-24 text-right font-medium ${
                  alt.liveDiff > 0 ? "text-emerald-600" : "text-rose-500"
                }`}
              >
                {alt.liveDiff > 0
                  ? `−S/ ${alt.liveDiff.toFixed(2)}`
                  : `+S/ ${Math.abs(alt.liveDiff).toFixed(2)}`}{" "}
                <span className="opacity-70">({Math.abs(alt.livePct).toFixed(1)}%)</span>
              </span>
              <Link
                href={`/orden-compra/nueva?supplierId=${alt.supplierId}`}
                target="_blank"
                className="w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold text-cyan-600 ring-1 ring-cyan-200 hover:bg-cyan-50"
                title={`Abrir nueva OC con ${alt.supplierName} en nueva pestaña`}
              >
                Crear OC
              </Link>
            </div>
          ))}

          <p className="mt-1.5 text-[10px] text-amber-500">
            Esta OC pertenece a este proveedor. Para comprar de otra fuente, usa{" "}
            <strong>Crear OC</strong> en una nueva pestaña.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function NewPurchaseOrderView({
  suppliers,
  initialSupplierId = "",
  initialCatalog = [],
}: {
  suppliers: SupplierRecord[];
  initialSupplierId?: string;
  initialCatalog?: SupplierCatalogItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Estado del encabezado ────────────────────────────────────────────────
  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDate, setExpectedDate] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // ── Catálogo del proveedor ───────────────────────────────────────────────
  const [catalog, setCatalog] = useState<SupplierCatalogItem[]>(initialCatalog);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  // ── Comparativa de proveedores ───────────────────────────────────────────
  // Mapa: catalogItemId → alternativas de otros proveedores para ese producto
  const [alternatives, setAlternatives] = useState<Record<string, SupplierAlternative[]>>({});

  // ── Carrito ──────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Feedback ─────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Cargar alternativas para catálogo inicial (URL con ?supplierId=...)
  useEffect(() => {
    if (initialSupplierId && initialCatalog.length > 0) {
      getAlternativesForCatalog(
        initialSupplierId,
        initialCatalog.map((i) => i.id),
      )
        .then(setAlternatives)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Catálogo filtrado ────────────────────────────────────────────────────
  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((item) =>
      [
        item.product_name,
        item.brand,
        item.model,
        item.category,
        item.supplier_sku,
        item.color,
        item.size,
        item.presentation,
      ].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [catalog, catalogSearch]);

  // ── Totales ──────────────────────────────────────────────────────────────
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
    [cart],
  );

  // ── Cambiar proveedor → recargar catálogo y alternativas ─────────────────
  async function handleSupplierChange(id: string) {
    setSupplierId(id);
    setCart([]);
    setCatalogSearch("");
    setAlternatives({});
    if (!id) {
      setCatalog([]);
      return;
    }
    setCatalogLoading(true);
    const items = await getCatalogForSupplier(id);
    setCatalog(items);
    setCatalogLoading(false);
    // Cargar alternativas en background — no bloquea el render del catálogo
    if (items.length > 0) {
      getAlternativesForCatalog(id, items.map((i) => i.id))
        .then(setAlternatives)
        .catch(() => {});
    }
  }

  // ── Agregar al carrito ───────────────────────────────────────────────────
  function handleAddToCart(item: SupplierCatalogItem) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.catalogItemId === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          catalogItemId: item.id,
          supplierSku: item.supplier_sku,
          productName: item.product_name,
          brand: item.brand,
          model: item.model,
          category: item.category,
          presentation: item.presentation,
          color: item.color,
          size: item.size,
          unitCost: item.purchase_price,
          quantity: 1,
          notes: "",
        },
      ];
    });
  }

  // ── Actualizar campo del carrito ─────────────────────────────────────────
  function handleCartField(
    idx: number,
    field: "quantity" | "unitCost" | "notes",
    value: string,
  ) {
    setCart((prev) => {
      const next = [...prev];
      if (field === "quantity") {
        const q = Math.max(1, parseInt(value, 10) || 1);
        next[idx] = { ...next[idx], quantity: q };
      } else if (field === "unitCost") {
        const c = Math.max(0, parseFloat(value) || 0);
        next[idx] = { ...next[idx], unitCost: c };
      } else {
        next[idx] = { ...next[idx], notes: value };
      }
      return next;
    });
  }

  function handleRemoveFromCart(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Validaciones ─────────────────────────────────────────────────────────
  function validate(): string {
    if (!supplierId) return "Debes seleccionar un proveedor.";
    if (cart.length === 0) return "Debes agregar al menos un producto al carrito.";
    for (const item of cart) {
      if (item.quantity <= 0)
        return `La cantidad de "${item.productName}" debe ser mayor a 0.`;
    }
    return "";
  }

  // ── Guardar borrador ─────────────────────────────────────────────────────
  async function handleSaveDraft() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSaving(true);
    const result = await saveDraftPurchaseOrder({
      supplierId,
      orderDate,
      expectedDate,
      notes: orderNotes,
      items: cart,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setSuccess(result.message);
    startTransition(() => {
      router.push(`/orden-compra/${result.orderId}`);
    });
  }

  // ── Emitir OC ────────────────────────────────────────────────────────────
  async function handleIssue() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (
      !window.confirm(
        "¿Emitir la Orden de Compra? Esto creará o vinculará los productos en el Maestro con stock 0.",
      )
    )
      return;
    setError("");
    setSaving(true);

    // Primero guardar como borrador
    const draftResult = await saveDraftPurchaseOrder({
      supplierId,
      orderDate,
      expectedDate,
      notes: orderNotes,
      items: cart,
    });

    if (!draftResult.success || !draftResult.orderId) {
      setSaving(false);
      setError(draftResult.message);
      return;
    }

    // Luego emitir
    const issueResult = await issuePurchaseOrder(draftResult.orderId);
    setSaving(false);

    if (!issueResult.success) {
      setError(issueResult.message);
      // Borrador ya guardado → ir al detalle para reintentar o corregir
      startTransition(() => {
        router.push(`/orden-compra/${draftResult.orderId}`);
      });
      return;
    }

    setSuccess(issueResult.message);
    startTransition(() => {
      router.push(`/orden-compra/${draftResult.orderId}`);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Feedback ────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-100">
          {success}
        </div>
      )}

      {/* ── Datos de la orden ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Datos de la Orden</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Proveedor */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Proveedor <span className="text-rose-500">*</span>
            </label>
            <select
              value={supplierId}
              onChange={(e) => handleSupplierChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
            >
              <option value="">— Seleccionar proveedor —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha de emisión */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Fecha de emisión
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          {/* Entrega esperada */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Entrega esperada
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          {/* Notas */}
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Notas u observaciones
            </label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={2}
              placeholder="Condiciones de pago, instrucciones de entrega, etc."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        </div>
      </div>

      {/* ── Catálogo + carrito ───────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Panel catálogo ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Catálogo del proveedor</h2>
            {catalog.length > 0 && (
              <span className="text-xs text-slate-400">
                {filteredCatalog.length} / {catalog.length} ítems
              </span>
            )}
          </div>

          {!supplierId && (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
              Selecciona un proveedor para ver su catálogo.
            </p>
          )}
          {supplierId && catalogLoading && (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
              Cargando catálogo…
            </p>
          )}
          {supplierId && !catalogLoading && catalog.length === 0 && (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
              Este proveedor no tiene ítems activos en su catálogo.
            </p>
          )}

          {supplierId && !catalogLoading && catalog.length > 0 && (
            <>
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Buscar por nombre, marca, categoría…"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              />

              <div className="max-h-[420px] overflow-auto space-y-1">
                {filteredCatalog.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-400">
                    Sin resultados para &quot;{catalogSearch}&quot;
                  </p>
                )}
                {filteredCatalog.map((item) => {
                  const inCart = cart.some((c) => c.catalogItemId === item.id);
                  const itemAlts = alternatives[item.id];
                  const hasCheaperAlt = itemAlts?.some((a) => a.priceDiff > 0);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition ${
                        inCart ? "bg-cyan-50 ring-1 ring-cyan-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800">
                          {item.product_name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {[item.brand, item.color, item.size, item.presentation]
                            .filter(Boolean)
                            .join(" · ") || "Sin atributos"}
                          {item.supplier_sku && (
                            <span className="ml-2 font-mono">{item.supplier_sku}</span>
                          )}
                        </p>
                        {/* Badge: precio mejor en otro proveedor */}
                        {hasCheaperAlt && (
                          <p className="mt-0.5 text-[10px] font-medium text-amber-600">
                            💰 Precio mejor en otro proveedor
                          </p>
                        )}
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-2">
                        <span className="text-xs font-medium text-slate-700">
                          {formatCurrency(item.purchase_price)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          className="rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-cyan-700"
                        >
                          {inCart ? "+1" : "+ Agregar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Panel carrito ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Carrito de la OC</h2>
            {cart.length > 0 && (
              <span className="text-xs text-slate-400">
                {cart.length} ítem{cart.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
              Agrega productos desde el catálogo.
            </p>
          ) : (
            <>
              <div className="max-h-[480px] overflow-auto space-y-2">
                {cart.map((item, idx) => {
                  const itemAlts = alternatives[item.catalogItemId] ?? [];

                  return (
                    <div
                      key={item.catalogItemId}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                    >
                      {/* Nombre + quitar */}
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-800">
                            {item.productName}
                          </p>
                          {[item.color, item.size, item.presentation].filter(Boolean).length >
                            0 && (
                            <p className="text-[11px] text-slate-400">
                              {[item.color, item.size, item.presentation]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(idx)}
                          className="shrink-0 text-slate-400 hover:text-rose-500"
                          title="Quitar del carrito"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Cantidad + precio */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="mb-0.5 block text-[11px] text-slate-400">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleCartField(idx, "quantity", e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="mb-0.5 block text-[11px] text-slate-400">
                            Precio unit. (S/)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unitCost}
                            onChange={(e) => handleCartField(idx, "unitCost", e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
                          />
                        </div>
                        <div className="shrink-0 pt-4 text-xs font-semibold text-slate-700">
                          = {formatCurrency(item.quantity * item.unitCost)}
                        </div>
                      </div>

                      {/* Notas del ítem */}
                      <div className="mt-2">
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => handleCartField(idx, "notes", e.target.value)}
                          placeholder="Nota del ítem (opcional)"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
                        />
                      </div>

                      {/* Comparativa de proveedores (si hay alternativas) */}
                      {itemAlts.length > 0 && (
                        <AlternativesPanel
                          currentPrice={item.unitCost}
                          alternatives={itemAlts}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">Total OC</span>
                <span className="text-base font-bold text-slate-900">
                  {formatCurrency(total)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Footer: acciones ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || isPending}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar borrador"}
          </button>
          <button
            type="button"
            onClick={handleIssue}
            disabled={saving || isPending || cart.length === 0 || !supplierId}
            className="rounded-xl bg-cyan-600 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
          >
            {saving ? "Procesando…" : "Emitir Orden de Compra"}
          </button>
        </div>
      </div>
    </div>
  );
}
