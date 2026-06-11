"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProductVariantForInvoice } from "@/modules/facturacion/types";
import { formatCurrency } from "@/modules/productos/utils/format";
import { saveCustomerInvoice } from "@/modules/facturacion/actions/customer-invoice-actions";

// ─── Tipos locales ────────────────────────────────────────────────────────────

type CartLine = {
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  salePrice: number;
  stock: number;
  quantity: number;
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function NewCustomerInvoiceView({
  variants,
}: {
  variants: ProductVariantForInvoice[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Campos del cliente ────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [notes, setNotes] = useState("");

  // ── Carrito ───────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<string[]>([]);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);

  // ── Búsqueda de variantes ─────────────────────────────────────────────────
  const filteredVariants =
    search.trim().length === 0
      ? variants
      : variants.filter(
          (v) =>
            v.product_name.toLowerCase().includes(search.toLowerCase()) ||
            v.variant_label.toLowerCase().includes(search.toLowerCase()) ||
            v.sku.toLowerCase().includes(search.toLowerCase()),
        );

  // ── Agregar al carrito ───────────────────────────────────────────────────
  function addToCart(v: ProductVariantForInvoice) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === v.variant_id);
      if (existing) {
        // Incrementar cantidad si ya existe, respetando stock
        return prev.map((l) =>
          l.variantId === v.variant_id
            ? { ...l, quantity: Math.min(l.quantity + 1, l.stock) }
            : l,
        );
      }
      if (v.stock <= 0) return prev; // no agregar si sin stock
      return [
        ...prev,
        {
          variantId: v.variant_id,
          productName: v.product_name,
          variantLabel: v.variant_label,
          sku: v.sku,
          salePrice: v.sale_price,
          stock: v.stock,
          quantity: 1,
        },
      ];
    });
  }

  function removeFromCart(variantId: string) {
    setCart((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  function updateQty(variantId: string, qty: number) {
    if (qty <= 0) {
      removeFromCart(variantId);
      return;
    }
    setCart((prev) =>
      prev.map((l) =>
        l.variantId === variantId
          ? { ...l, quantity: Math.min(qty, l.stock) }
          : l,
      ),
    );
  }

  // ── Totales ───────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, l) => s + l.salePrice * l.quantity, 0);

  // ── Advertencias de precio ────────────────────────────────────────────────
  const zeroPriceLines = cart.filter((l) => l.salePrice <= 0);

  // ── Envío ─────────────────────────────────────────────────────────────────
  async function handleSubmit(action: "draft" | "issue") {
    setErrors([]);
    setGlobalMsg(null);

    if (!customerName.trim()) {
      setErrors(["El nombre del cliente es obligatorio."]);
      return;
    }
    if (cart.length === 0) {
      setErrors(["Debes agregar al menos un producto al carrito."]);
      return;
    }
    if (action === "issue" && zeroPriceLines.length > 0) {
      setErrors([
        "No puedes emitir la factura porque los siguientes ítems tienen precio S/ 0:",
        ...zeroPriceLines.map((l) => `• ${l.productName} — ${l.variantLabel}`),
      ]);
      return;
    }

    startTransition(async () => {
      const result = await saveCustomerInvoice(
        {
          customerName,
          customerDocument,
          customerPhone,
          customerEmail,
          customerAddress,
          notes,
          items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        },
        action,
      );

      if (result.success && result.invoiceId) {
        router.push(`/facturacion/clientes/${result.invoiceId}`);
      } else {
        setGlobalMsg(result.message);
        setErrors(result.errors ?? []);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

      {/* ── Columna izquierda: cliente + selector de productos ───────────── */}
      <div className="space-y-6">

        {/* Datos del cliente */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Datos del cliente</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Nombre / Razón social <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                DNI / RUC
              </label>
              <input
                type="text"
                value={customerDocument}
                onChange={(e) => setCustomerDocument(e.target.value)}
                placeholder="Ej: 12345678"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Teléfono</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Ej: 999 888 777"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Dirección de envío
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Av. Principal 123, Lima"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Notas</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones adicionales…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
              />
            </div>
          </div>
        </div>

        {/* Selector de productos */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Seleccionar productos
            </h3>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, variante o SKU…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
            />
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filteredVariants.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">
                No se encontraron productos.
              </p>
            ) : (
              filteredVariants.map((v) => {
                const inCart = cart.find((l) => l.variantId === v.variant_id);
                const noStock = v.stock <= 0;
                const noPrice = v.sale_price <= 0;

                return (
                  <div
                    key={v.variant_id}
                    className={`flex items-center justify-between px-4 py-3 ${
                      noStock ? "opacity-50" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-800">
                        {v.product_name}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{v.variant_label}</p>
                      <p className="font-mono text-[10px] text-slate-400">{v.sku}</p>
                    </div>

                    <div className="ml-4 flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        {noPrice ? (
                          <p className="text-xs font-semibold text-amber-600">Sin precio</p>
                        ) : (
                          <p className="text-xs font-semibold text-slate-700">
                            {formatCurrency(v.sale_price)}
                          </p>
                        )}
                        <p className={`text-[10px] ${noStock ? "text-rose-500" : "text-slate-400"}`}>
                          Stock: {v.stock}
                        </p>
                      </div>

                      {inCart ? (
                        <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-700">
                          ✓ {inCart.quantity}
                        </span>
                      ) : (
                        <button
                          onClick={() => addToCart(v)}
                          disabled={noStock}
                          className="rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          + Agregar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Columna derecha: carrito + acciones ──────────────────────────── */}
      <div className="space-y-4">

        {/* Errores */}
        {(errors.length > 0 || globalMsg) && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 space-y-1">
            {globalMsg && <p className="font-semibold">{globalMsg}</p>}
            {errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {/* Aviso precios 0 */}
        {zeroPriceLines.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            <p className="font-semibold">⚠ Ítems sin precio de venta</p>
            <p className="mt-1">
              Puedes guardar como borrador, pero no podrás emitir hasta asignar precio en el Maestro.
            </p>
          </div>
        )}

        {/* Carrito */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Carrito ({cart.length} productos)
            </h3>
          </div>

          {cart.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">
              Agrega productos desde el selector.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {cart.map((line) => (
                <div key={line.variantId} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-800">
                        {line.productName}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{line.variantLabel}</p>
                      {line.salePrice <= 0 && (
                        <p className="text-[10px] font-semibold text-amber-600">Sin precio</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromCart(line.variantId)}
                      className="shrink-0 text-slate-300 hover:text-rose-500"
                      title="Eliminar"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    {/* Cantidad */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(line.variantId, line.quantity - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={line.stock}
                        value={line.quantity}
                        onChange={(e) => updateQty(line.variantId, parseInt(e.target.value) || 1)}
                        className="w-12 rounded border border-slate-200 py-0.5 text-center text-xs outline-none focus:border-cyan-400"
                      />
                      <button
                        onClick={() => updateQty(line.variantId, line.quantity + 1)}
                        disabled={line.quantity >= line.stock}
                        className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        +
                      </button>
                      <span className="ml-1 text-[10px] text-slate-400">/ {line.stock}</span>
                    </div>

                    {/* Precio × cantidad */}
                    <p className="text-xs font-semibold text-slate-700">
                      {line.salePrice > 0
                        ? formatCurrency(line.salePrice * line.quantity)
                        : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subtotal */}
          {cart.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">Subtotal</p>
                <p className="text-sm font-bold text-slate-900">{formatCurrency(subtotal)}</p>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {/* TODO: agregar IGV cuando se implemente */}
                Sin IGV
              </p>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleSubmit("issue")}
            disabled={isPending || cart.length === 0}
            className="w-full rounded-xl bg-cyan-600 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {isPending ? "Procesando…" : "Emitir factura"}
          </button>
          <button
            onClick={() => handleSubmit("draft")}
            disabled={isPending || cart.length === 0}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Guardar borrador
          </button>
        </div>
      </div>
    </div>
  );
}
