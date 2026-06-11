"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupplierRecord } from "@/modules/proveedores/types";
import { updateSupplierRecord } from "@/modules/proveedores/actions/supplier-actions";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100";
const labelCls = "mb-1 block text-xs font-medium text-slate-500";

export function EditSupplierModal({
  supplier,
  open,
  onClose,
}: {
  supplier: SupplierRecord;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const [name, setName] = useState(supplier.name);
  const [ruc, setRuc] = useState(supplier.ruc ?? "");
  const [contactName, setContactName] = useState(supplier.contact_name ?? "");
  const [phone, setPhone] = useState(supplier.phone ?? "");
  const [email, setEmail] = useState(supplier.email ?? "");
  const [address, setAddress] = useState(supplier.address ?? "");
  const [isActive, setIsActive] = useState(supplier.is_active);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await updateSupplierRecord(supplier.id, {
      name,
      ruc,
      contact_name: contactName,
      phone,
      email,
      address,
      is_active: isActive,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
              Editar proveedor
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              {supplier.name}
            </h3>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Nombre *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>RUC</label>
                <input
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Contacto</label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Dirección</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isActive ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-700">
                  {isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-rose-100">
                {error}
              </p>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              {loading ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
