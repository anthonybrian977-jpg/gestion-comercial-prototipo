"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  importCatalogItems,
  type CatalogImportResult,
  type CatalogImportRow,
} from "@/modules/proveedores/actions/catalog-actions";

type ParsedRow = CatalogImportRow & { _row: number };

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

  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CatalogImportResult | null>(null);

  if (!open) return null;

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
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];

      if (raw.length === 0) {
        setParseError("El archivo está vacío o la primera hoja no tiene datos.");
        return;
      }

      const parsed: ParsedRow[] = raw.map((row, idx) => ({
        _row: idx + 2,
        supplier_sku: String(row["supplier_sku"] ?? "").trim() || undefined,
        product_name: String(row["product_name"] ?? "").trim(),
        brand: String(row["brand"] ?? "").trim() || undefined,
        model: String(row["model"] ?? "").trim() || undefined,
        category: String(row["category"] ?? "").trim() || undefined,
        presentation: String(row["presentation"] ?? "").trim() || undefined,
        color: String(row["color"] ?? "").trim() || undefined,
        size: String(row["size"] ?? "").trim() || undefined,
        purchase_price: row["purchase_price"] as string | number,
      }));

      setRows(parsed);
    } catch {
      setParseError("No se pudo leer el archivo. Asegúrate de que sea un .xlsx válido.");
    }
  }

  async function handleConfirm() {
    if (!rows) return;
    setLoading(true);
    const res = await importCatalogItems(supplierId, rows);
    setLoading(false);
    setResult(res);
    if (res.success) router.refresh();
  }

  function reset() {
    setRows(null);
    setParseError("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() { reset(); onClose(); }

  const PREVIEW_COLS = ["#", "product_name", "supplier_sku", "brand", "category", "color", "size", "purchase_price"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-slate-900/40" onClick={handleClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Importar catálogo del proveedor</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Importar lista de productos (Excel)</h3>
          <p className="mt-1.5 text-sm text-slate-500">
            Columnas requeridas:{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono font-semibold">product_name</code>{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono font-semibold">purchase_price</code>
            {" · "}Opcionales:{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-400">supplier_sku</code>{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-400">brand</code>{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-400">model</code>{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-400">category</code>{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-400">presentation</code>{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-400">color</code>{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-400">size</code>
          </p>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
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

          {parseError ? (
            <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">{parseError}</div>
          ) : null}

          {result ? (
            <div className={`mb-4 rounded-xl px-4 py-3 text-sm ring-1 ${result.success ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-rose-100"}`}>
              <p className="font-medium">{result.message}</p>
              {result.errors && result.errors.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {result.errors.map((err, i) => <li key={i}>• {err}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}

          {rows && !result ? (
            <>
              <p className="mb-2 text-xs font-medium text-slate-500">
                Vista previa — <span className="text-slate-800">{rows.length} fila(s)</span>
              </p>
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {PREVIEW_COLS.map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 50).map((row) => (
                      <tr key={row._row} className={!row.product_name ? "bg-rose-50/50" : undefined}>
                        <td className="px-3 py-2 text-xs text-slate-400">{row._row}</td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-800">
                          {row.product_name || <span className="text-rose-400">vacío</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.supplier_sku || "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{row.brand || "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{row.category || "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{row.color || "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{row.size || "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-800">{String(row.purchase_price ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 ? (
                  <p className="px-4 py-2 text-xs text-slate-400">… y {rows.length - 50} fila(s) más.</p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button type="button" onClick={handleClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {result?.success ? "Cerrar" : "Cancelar"}
            </button>
            {result?.success ? (
              <button type="button" onClick={reset} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100">
                Importar otro archivo
              </button>
            ) : null}
            {rows && !result ? (
              <button type="button" onClick={handleConfirm} disabled={loading} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
                {loading ? "Importando…" : `Confirmar (${rows.length} filas)`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
