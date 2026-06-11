"use server";

import { revalidatePath } from "next/cache";

type ActionResult = { success: boolean; message: string };

function revalidateSupplier(supplierId: string) {
  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${supplierId}`);
  revalidatePath("/productos");
}

// ---------------------------------------------------------------------------
// Crear nuevo proveedor
// ---------------------------------------------------------------------------
export async function createSupplierRecord(data: {
  name: string;
  ruc?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
}): Promise<ActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.from("suppliers").insert({
    name: data.name.trim(),
    ruc: data.ruc?.trim() || null,
    contact_name: data.contact_name?.trim() || null,
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    address: data.address?.trim() || null,
    is_active: data.is_active,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, message: "Ya existe un proveedor con ese RUC." };
    }
    return { success: false, message: "Error al crear proveedor: " + error.message };
  }

  revalidatePath("/proveedores");
  return { success: true, message: "Proveedor creado correctamente." };
}

// ---------------------------------------------------------------------------
// Editar datos básicos del proveedor
// ---------------------------------------------------------------------------
export async function updateSupplierRecord(
  supplierId: string,
  data: {
    name: string;
    ruc?: string;
    contact_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    is_active: boolean;
  },
): Promise<ActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: data.name.trim(),
      ruc: data.ruc?.trim() || null,
      contact_name: data.contact_name?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      is_active: data.is_active,
    })
    .eq("id", supplierId);

  if (error) {
    return { success: false, message: "Error al actualizar proveedor: " + error.message };
  }

  revalidateSupplier(supplierId);
  return { success: true, message: "Proveedor actualizado correctamente." };
}

// ---------------------------------------------------------------------------
// Asociar una variante existente a este proveedor
// ---------------------------------------------------------------------------
export async function addSupplierVariant(
  supplierId: string,
  variantId: string,
  purchasePrice: number,
  supplierSku: string | null,
  isActive = true,
): Promise<ActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.from("supplier_products").upsert(
    {
      supplier_id: supplierId,
      variant_id: variantId,
      purchase_price: purchasePrice,
      supplier_sku: supplierSku,
      is_active: isActive,
    },
    { onConflict: "supplier_id,variant_id" },
  );

  if (error) {
    return { success: false, message: "Error al agregar variante: " + error.message };
  }

  revalidateSupplier(supplierId);
  return { success: true, message: "Variante agregada correctamente." };
}

// ---------------------------------------------------------------------------
// Editar precio y SKU proveedor de una entrada ya existente
// ---------------------------------------------------------------------------
export async function updateSupplierVariant(
  supplierId: string,
  supplierProductId: string,
  purchasePrice: number,
  supplierSku: string | null,
  isActive = true,
): Promise<ActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase
    .from("supplier_products")
    .update({
      purchase_price: purchasePrice,
      supplier_sku: supplierSku,
      is_active: isActive,
    })
    .eq("id", supplierProductId);

  if (error) {
    return { success: false, message: "Error al actualizar precio: " + error.message };
  }

  revalidateSupplier(supplierId);
  return { success: true, message: "Precio actualizado correctamente." };
}
