import Link from "next/link";
import type { SupplierListItem } from "@/modules/proveedores/types";

type SupplierTableProps = {
  suppliers: SupplierListItem[];
};

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

export function SupplierTable({ suppliers }: SupplierTableProps) {
  return (
    <>

      {/* ── Tabla ─────────────────────────────────────────────────── */}
      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-base font-medium text-slate-900">
            No hay proveedores registrados
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Ejecuta{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
              schema.sql
            </code>{" "}
            y luego{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
              seed.sql
            </code>{" "}
            en el SQL Editor de Supabase para cargar los datos demo.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Proveedor",
                    "RUC",
                    "Contacto",
                    "Teléfono",
                    "Email",
                    "En catálogo",
                    "Mapeados",
                    "Elegidos",
                    "Solo catálogo",
                    "Estado",
                    "Acciones",
                  ].map((header) => (
                    <th
                      key={header}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {supplier.name}
                      </p>
                      {supplier.address ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {supplier.address}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {supplier.ruc ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {supplier.contact_name ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {supplier.phone ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {supplier.email ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-900">
                      {supplier.catalog_count > 0 ? (
                        <span className="font-medium">{supplier.catalog_count}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {supplier.mapped_count > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-100">
                          {supplier.mapped_count}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {supplier.elected_count > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                          {supplier.elected_count}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {supplier.solo_catalog_count > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                          {supplier.solo_catalog_count}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <ActiveBadge active={supplier.is_active} />
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/proveedores/${supplier.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
                      >
                        Ver productos
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </>
  );
}
