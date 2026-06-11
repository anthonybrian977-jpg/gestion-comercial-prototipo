"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseExcelBuffer,
  type SmartProduct,
  type ParseStats,
} from "@/lib/excel/smart-product-import";
import {
  importCatalogItemsSmart,
  type SmartCatalogImportMode,
  type SmartCatalogImportResult,
} from "@/modules/proveedores/actions/catalog-actions";

// ─── Component ────────────────────────────────────────────────────────────────

export function SupplierImportModal({
  supplierId,
  open,
  onClose,
}: {
  supplierId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<SmartProduct[] | null>(null);
  const [stats, setStats] = useState<ParseStats | null>(null);
  const [parseError, setParseError] = useState("");
  const [importMode, setImportMode] = useState<SmartCatalogImportMode>("update");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SmartCatalogImportResult | null>(null);

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
      const res = await parseExcelBuffer(buffer, "supplier");
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
      setParseError("No se pudo leer el archivo. Asegúrate de que sea un .xlsx válido.");
    }
  }

  // ── Confirm import ─────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!products) return;
    setLoading(true);
    const res = await importCatalogItemsSmart(supplierId, products, importMode);
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

  // ── Derived ────────────────────────────────────────────────────────────────

  const totalItems = products?.reduce((s, p) => s + p.variants.length, 0) ?? 0;

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

      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
            Importar catálogo del proveedor
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            Importar productos (Excel)
          </h3>
          {/* Disclaimer */}
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700 ring-1 ring-sky-100">
            <span className="mt-px shrink-0 text-sky-500">ℹ</span>
            <span>
              Este Excel se guardará como <strong>catálogo del proveedor</strong>.
              No creará productos en el Maestro ni modificará stock.
            </span>
          </div>
          {/* Column hint */}
          <p className="mt-2 text-xs text-slate-400">
            Columnas reconocidas:{" "}
            {[
              "nombre / producto / descripción",
              "sku / código / ref",
              "precio / costo",
              "marca",
              "categoría",
              "presentación",
              "color",
              "talla / size",
            ].map((c, i) => (
              <code
                key={i}
                className="mr-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-500"
              >
                {c}
              </code>
            ))}
          </p>
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

          {/* Stats row */}
          {stats && !result && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-2">
                <StatPill label="Total filas" value={stats.totalRows} />
                <StatPill label="Válidas" value={stats.validRows} color="emerald" />
                {stats.skippedRows > 0 && (
                  <StatPill label="Omitidas" value={stats.skippedRows} color="amber" />
                )}
                <StatPill label="Ítems" value={stats.detectedProducts} color="sky" />
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

          {/* Import mode toggle */}
          {products && !result && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600">Modo:</span>
              <div className="flex rounded-lg border border-slate-200 p-0.5">
                <ModeButton
                  label="Actualizar catálogo"
                  description="Agrega nuevos, actualiza existentes"
                  active={importMode === "update"}
                  onClick={() => setImportMode("update")}
                />
                <ModeButton
                  label="Reemplazar catálogo"
                  description="Elimina todo y carga desde cero"
                  active={importMode === "replace"}
                  onClick={() => setImportMode("replace")}
                  danger
                />
              </div>
            </div>
          )}

          {/* Replace warning */}
          {products && importMode === "replace" && !result && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700 ring-1 ring-rose-100">
              <span className="mt-px shrink-0">⚠️</span>
              <span>
                <strong>Modo Reemplazar:</strong> se eliminarán{" "}
                <strong>todos</strong> los productos actuales del catálogo de este
                proveedor y se cargarán los del archivo. Las variantes que tenían
                este catálogo como proveedor elegido quedarán sin elección.
              </span>
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
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {result.errors.map((err, i) => (
                    <li key={i}>· {err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Preview table */}
          {products && !result && (
            <PreviewTable products={products} />
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
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  importMode === "replace"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-cyan-600 hover:bg-cyan-700"
                }`}
              >
                {loading
                  ? "Importando…"
                  : importMode === "replace"
                  ? `Reemplazar (${totalItems} ítem${totalItems !== 1 ? "s" : ""})`
                  : `Actualizar catálogo (${totalItems} ítem${totalItems !== 1 ? "s" : ""})`}
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
  color?: "slate" | "emerald" | "amber" | "sky";
}) {
  const styles = {
    slate: "bg-slate-50 border-slate-200 text-slate-600",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    sky: "bg-sky-50 border-sky-200 text-sky-700",
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

function ModeButton({
  label,
  description,
  active,
  onClick,
  danger = false,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={description}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? danger
            ? "bg-rose-100 text-rose-700"
            : "bg-cyan-100 text-cyan-700"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function PreviewTable({ products }: { products: SmartProduct[] }) {
  const COLS = ["#", "Nombre", "SKU proveedor", "Marca", "Categoría", "Presentación", "Color", "Talla", "Precio"] as const;
  const MAX_ROWS = 50;

  // Flatten for preview
  const rows = products.flatMap((p) =>
    p.variants.map((v) => ({
      rowNum: v.rowNum,
      name: p.productName,
      sku: v.supplierSku,
      brand: p.brand,
      category: p.category,
      presentation: v.presentation,
      color: v.color,
      size: v.size,
      price: v.purchasePrice,
    })),
  );

  return (
    <>
      <p className="text-xs font-medium text-slate-500">
        Vista previa —{" "}
        <span className="text-slate-800">{rows.length} ítem(s)</span>
        {rows.length > MAX_ROWS && (
          <span className="text-slate-400"> (mostrando los primeros {MAX_ROWS})</span>
        )}
      </p>
      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {COLS.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, MAX_ROWS).map((row) => (
              <tr key={row.rowNum} className={!row.name ? "bg-rose-50/50" : undefined}>
                <td className="px-3 py-2 text-xs text-slate-400">{row.rowNum}</td>
                <td className="px-3 py-2 text-xs font-medium text-slate-800">
                  {row.name || <span className="text-rose-400">vacío</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">
                  {row.sku || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {row.brand || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {row.category || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {row.presentation || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {row.color || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {row.size || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 text-xs font-medium text-slate-800">
                  {row.price !== undefined ? (
                    <span className={row.price === 0 ? "text-amber-500" : undefined}>
                      S/ {row.price.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > MAX_ROWS && (
          <p className="px-4 py-2 text-xs text-slate-400">
            … y {rows.length - MAX_ROWS} ítem(s) más no mostrado(s).
          </p>
        )}
      </div>
    </>
  );
}
