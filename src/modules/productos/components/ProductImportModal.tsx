"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  importProducts,
  type ProductImportResult,
  type ProductImportRow,
} from "@/modules/productos/actions/import-products";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParsedRow = ProductImportRow & { _row: number };

const REQUIRED_COLS = ["product_name", "variant_sku"] as const;

const ALL_COLS: Array<{ key: keyof ProductImportRow; label: string }> = [
  { key: "product_name", label: "product_name" },
  { key: "brand", label: "brand" },
  { key: "model", label: "model" },
  { key: "category", label: "category" },
  { key: "variant_sku", label: "variant_sku" },
  { key: "presentation", label: "presentation" },
  { key: "color", label: "color" },
  { key: "size", label: "size" },
  { key: "purchase_price", label: "purchase_price" },
  { key: "sale_price", label: "sale_price" },
  { key: "stock", label: "stock" },
  { key: "min_stock", label: "min_stock" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductImportResult | null>(null);

  if (!open) return null;

  // ── File parsing ──────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError("");
    setRows(null);
    setResult(null);

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, {
        defval: "",
      }) as Record<string, unknown>[];

      if (raw.length === 0) {
        setParseError("El archivo está vacío o la primera hoja no tiene datos.");
        return;
      }

      // Check required columns exist
      const firstRow = raw[0];
      const missing = REQUIRED_COLS.filter((col) => !(col in firstRow));
      if (missing.length > 0) {
        setParseError(
          `Faltan columnas obligatorias: ${missing.map((c) => `"${c}"`).join(", ")}`,
        );
        return;
      }

      const parsed: ParsedRow[] = raw.map((row, idx) => ({
        _row: idx + 2,
        product_name: String(row["product_name"] ?? "").trim(),
        brand: String(row["brand"] ?? "").trim() || undefined,
        model: String(row["model"] ?? "").trim() || undefined,
        category: String(row["category"] ?? "").trim() || undefined,
        description: String(row["description"] ?? "").trim() || undefined,
        variant_sku: String(row["variant_sku"] ?? "").trim(),
        presentation: String(row["presentation"] ?? "").trim() || undefined,
        color: String(row["color"] ?? "").trim() || undefined,
        size: String(row["size"] ?? "").trim() || undefined,
        purchase_price: row["purchase_price"] as string | number | undefined,
        sale_price: row["sale_price"] as string | number | undefined,
        stock: row["stock"] as string | number | undefined,
        min_stock: row["min_stock"] as string | number | undefined,
      }));

      setRows(parsed);
    } catch {
      setParseError(
        "No se pudo leer el archivo. Asegúrate de que sea un .xlsx válido.",
      );
    }
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!rows) return;
    setLoading(true);
    const res = await importProducts(rows);
    setLoading(false);
    setResult(res);
    if (res.success) router.refresh();
  }

  // ── Reset / Close ─────────────────────────────────────────────────────────

  function reset() {
    setRows(null);
    setParseError("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  // ── Compute grouping summary for preview ──────────────────────────────────

  const productCount = rows
    ? new Set(rows.map((r) => r.product_name)).size
    : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/40"
        onClick={handleClose}
      />

      <div className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
            Importar Excel — Maestro de Productos
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            Productos y variantes
          </h3>
          <div className="mt-1.5 text-sm text-slate-500">
            <span className="font-medium text-slate-700">Obligatorias:</span>{" "}
            {REQUIRED_COLS.map((col) => (
              <code
                key={col}
                className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono"
              >
                {col}
              </code>
            ))}
            <span className="mx-2 text-slate-300">|</span>
            <span className="font-medium text-slate-700">Opcionales:</span>{" "}
            {(
              [
                "brand",
                "model",
                "category",
                "description",
                "presentation",
                "color",
                "size",
                "purchase_price",
                "sale_price",
                "stock",
                "min_stock",
              ] as const
            ).map((col) => (
              <code
                key={col}
                className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono"
              >
                {col}
              </code>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Filas con el mismo <code className="font-mono">product_name</code> se
            agrupan en un producto con múltiples variantes.
          </p>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {/* Selector de archivo */}
          {!result && (
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="block w-full text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cyan-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-cyan-700 hover:file:bg-cyan-100"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Error de parseo */}
          {parseError ? (
            <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
              {parseError}
            </div>
          ) : null}

          {/* Resultado de importación */}
          {result ? (
            <div
              className={`mb-4 rounded-xl px-4 py-3 text-sm ring-1 ${
                result.success
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                  : "bg-rose-50 text-rose-700 ring-rose-100"
              }`}
            >
              <p className="font-medium">{result.message}</p>
              {result.errors && result.errors.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {result.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {/* Vista previa */}
          {rows && !result ? (
            <>
              <p className="mb-2 text-xs font-medium text-slate-500">
                Vista previa —{" "}
                <span className="text-slate-800">{rows.length} fila(s)</span>,{" "}
                <span className="text-slate-800">{productCount} producto(s)</span>{" "}
                detectado(s)
              </p>
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        #
                      </th>
                      {ALL_COLS.map(({ label }) => (
                        <th
                          key={label}
                          className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 50).map((row) => {
                      const missing =
                        !row.product_name || !row.variant_sku;
                      return (
                        <tr
                          key={row._row}
                          className={missing ? "bg-rose-50/50" : undefined}
                        >
                          <td className="px-4 py-2 text-xs text-slate-400">
                            {row._row}
                          </td>
                          {ALL_COLS.map(({ key }) => {
                            const value = row[key];
                            const isEmpty =
                              value === undefined ||
                              value === "" ||
                              value === null;
                            const isRequired =
                              key === "product_name" || key === "variant_sku";
                            return (
                              <td key={key} className="px-4 py-2">
                                {isEmpty ? (
                                  isRequired ? (
                                    <span className="text-rose-400">vacío</span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )
                                ) : (
                                  <span
                                    className={
                                      key === "variant_sku"
                                        ? "font-mono text-xs text-slate-700"
                                        : "text-slate-800"
                                    }
                                  >
                                    {String(value)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length > 50 ? (
                  <p className="px-4 py-2 text-xs text-slate-400">
                    … y {rows.length - 50} fila(s) más no mostrada(s).
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {result?.success ? "Cerrar" : "Cancelar"}
            </button>

            {result?.success ? (
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100"
              >
                Importar otro archivo
              </button>
            ) : null}

            {rows && !result ? (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {loading
                  ? "Importando…"
                  : `Confirmar (${rows.length} fila${rows.length !== 1 ? "s" : ""}, ${productCount} producto${productCount !== 1 ? "s" : ""})`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
