"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseExcelBuffer,
  type SmartProduct,
  type ParseStats,
} from "@/lib/excel/smart-product-import";
import {
  importProducts,
  type ProductImportResult,
} from "@/modules/productos/actions/import-products";

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<SmartProduct[] | null>(null);
  const [stats, setStats] = useState<ParseStats | null>(null);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductImportResult | null>(null);

  if (!open) return null;

  // ── File selection ─────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setProducts(null);
    setStats(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = await parseExcelBuffer(buffer, "master");
      if (!res.ok) {
        setParseError(res.error ?? "Error desconocido al leer el archivo.");
        return;
      }
      if (res.products.length === 0) {
        setParseError("No se encontraron filas válidas con nombre de producto.");
        return;
      }
      setProducts(res.products);
      setStats(res.stats);
    } catch {
      setParseError(
        "No se pudo leer el archivo. Asegúrate de que sea un .xlsx válido.",
      );
    }
  }

  // ── Confirm import ─────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!products) return;
    setLoading(true);
    const res = await importProducts(products);
    setLoading(false);
    setResult(res);
    if (res.success) router.refresh();
  }

  // ── Reset / Close ──────────────────────────────────────────────────────────

  function reset() {
    setProducts(null);
    setStats(null);
    setParseError("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/40"
        onClick={handleClose}
      />

      <div className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
            Importar Excel — Maestro de Productos
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            Productos y variantes
          </h3>
          {/* Disclaimer */}
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700 ring-1 ring-sky-100">
            <span className="mt-px shrink-0 text-sky-500">ℹ</span>
            <span>
              Este Excel se importará como{" "}
              <strong>inventario propio de la empresa</strong>. Los productos
              no estarán asociados a ningún proveedor.
            </span>
          </div>
          {/* Column hints */}
          <div className="mt-2 space-y-0.5 text-xs text-slate-400">
            <p>
              <span className="font-medium text-slate-600">Obligatoria:</span>{" "}
              <code className="rounded bg-slate-100 px-1 font-mono">
                nombre / producto / descripción
              </code>
            </p>
            <p>
              <span className="font-medium text-slate-600">Opcionales:</span>{" "}
              {[
                "sku / código",
                "marca",
                "categoría",
                "precio compra",
                "precio venta / pvp",
                "stock",
                "stock mínimo",
                "color",
                "talla / size",
                "presentación",
              ].map((c, i) => (
                <code
                  key={i}
                  className="mr-1 rounded bg-slate-100 px-1 font-mono"
                >
                  {c}
                </code>
              ))}
            </p>
            <p className="text-slate-400">
              Filas con el mismo nombre base se agrupan como un producto con
              múltiples variantes. Si no hay columnas de variante, se detectan
              desde el nombre (ej: &quot;Polo Azul&quot;, &quot;Polo Rojo&quot;).
            </p>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4 space-y-4">
          {/* File picker */}
          {!result && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="block w-full text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cyan-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-cyan-700 hover:file:bg-cyan-100"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
              {parseError}
            </div>
          )}

          {/* Stats */}
          {stats && !result && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-2">
                <StatPill label="Total filas" value={stats.totalRows} />
                <StatPill label="Válidas" value={stats.validRows} color="emerald" />
                {stats.skippedRows > 0 && (
                  <StatPill label="Omitidas" value={stats.skippedRows} color="amber" />
                )}
                <StatPill label="Productos" value={stats.detectedProducts} color="sky" />
                <StatPill
                  label={`Variante${stats.detectedVariants !== 1 ? "s" : ""}`}
                  value={stats.detectedVariants}
                  color="violet"
                />
              </div>
              {/* Detected columns */}
              {stats.detectedColumns.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-medium text-emerald-600">✓ Reconocidas:</span>
                  {stats.detectedColumns.map((c) => (
                    <code key={c} className="rounded bg-emerald-50 px-1 py-0.5 font-mono text-emerald-700">
                      {c}
                    </code>
                  ))}
                </div>
              )}
              {stats.ignoredColumns.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-medium">Ignoradas:</span>
                  {stats.ignoredColumns.slice(0, 5).map((c) => (
                    <code key={c} className="rounded bg-slate-100 px-1 font-mono">
                      {c}
                    </code>
                  ))}
                  {stats.ignoredColumns.length > 5 && (
                    <span>+{stats.ignoredColumns.length - 5} más</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {stats && stats.warnings.length > 0 && !result && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 ring-1 ring-amber-100">
              <p className="mb-1 font-semibold">
                {stats.warnings.length} advertencia(s):
              </p>
              <ul className="space-y-0.5">
                {stats.warnings.map((w, i) => (
                  <li key={i}>· {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div
              className={`rounded-xl px-4 py-3 text-sm ring-1 ${
                result.success
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                  : "bg-rose-50 text-rose-700 ring-rose-100"
              }`}
            >
              <p className="font-medium">{result.message}</p>
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {result.errors.map((err, i) => (
                    <li key={i}>· {err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Preview */}
          {products && !result && (
            <PreviewGrouped products={products} />
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {result?.success ? "Cerrar" : "Cancelar"}
            </button>

            {result?.success && (
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100"
              >
                Importar otro archivo
              </button>
            )}

            {products && !result && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {loading
                  ? "Importando…"
                  : `Confirmar (${stats?.detectedProducts ?? 0} producto${stats?.detectedProducts !== 1 ? "s" : ""}, ${stats?.detectedVariants ?? 0} variante${stats?.detectedVariants !== 1 ? "s" : ""})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color = "slate",
}: {
  label: string;
  value: number;
  color?: "slate" | "emerald" | "amber" | "sky" | "violet";
}) {
  const styles: Record<string, string> = {
    slate: "bg-slate-50 border-slate-200 text-slate-600",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    sky: "bg-sky-50 border-sky-200 text-sky-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
  };
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${styles[color]}`}
    >
      <span className="font-bold">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function PreviewGrouped({ products }: { products: SmartProduct[] }) {
  const MAX_PRODUCTS = 30;
  const shown = products.slice(0, MAX_PRODUCTS);

  return (
    <>
      <p className="text-xs font-medium text-slate-500">
        Vista previa —{" "}
        <span className="text-slate-800">{products.length} producto(s)</span>
        {products.length > MAX_PRODUCTS && (
          <span className="text-slate-400">
            {" "}
            (mostrando los primeros {MAX_PRODUCTS})
          </span>
        )}
      </p>
      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Producto / Variante", "SKU", "Color", "Talla", "Presentación", "P.Compra", "P.Venta", "Stock"].map(
                (h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((product) => (
              <>
                {/* Product header row */}
                <tr key={`p-${product.productName}`} className="bg-slate-50/80">
                  <td
                    colSpan={8}
                    className="px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <span className="mr-2 text-slate-400">📦</span>
                    {product.productName}
                    {product.brand && (
                      <span className="ml-2 font-normal text-slate-500">
                        · {product.brand}
                      </span>
                    )}
                    {product.category && (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 font-normal text-slate-600">
                        {product.category}
                      </span>
                    )}
                    <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 font-normal text-slate-500">
                      {product.variants.length} variante
                      {product.variants.length !== 1 ? "s" : ""}
                    </span>
                  </td>
                </tr>
                {/* Variant rows */}
                {product.variants.map((v) => (
                  <tr key={v.rowNum} className="hover:bg-slate-50/50">
                    <td className="pl-8 pr-3 py-2 text-xs text-slate-500">
                      Fila {v.rowNum}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
                      {v.variantSku || <span className="text-slate-300">auto</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {v.color || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {v.size || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {v.presentation || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-800">
                      {v.purchasePrice !== undefined ? (
                        `S/ ${v.purchasePrice.toFixed(2)}`
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-800">
                      {v.salePrice !== undefined ? (
                        `S/ ${v.salePrice.toFixed(2)}`
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-800">
                      {v.stock ?? 0}
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
        {products.length > MAX_PRODUCTS && (
          <p className="px-4 py-2 text-xs text-slate-400">
            … y {products.length - MAX_PRODUCTS} producto(s) más no mostrado(s).
          </p>
        )}
      </div>
    </>
  );
}
