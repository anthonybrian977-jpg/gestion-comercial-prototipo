"use client";

import { useState } from "react";
import { CreateSupplierModal } from "@/modules/proveedores/components/CreateSupplierModal";

export function NewSupplierButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
      >
        + Nuevo proveedor
      </button>
      <CreateSupplierModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
