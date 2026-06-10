import { createClient } from "@/lib/supabase/client";

const BUCKET = "product-images";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadImageResult =
  | {
      success: true;
      /** Path interno a guardar en BD. Ej: "products/uuid.webp" */
      path: string;
      /** URL pública lista para <img src>. Solo para preview inmediato. */
      publicUrl: string;
    }
  | { success: false; message: string };

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

/** Devuelve mensaje de error si el archivo es inválido, null si pasa. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Solo se permiten imágenes JPG, PNG o WebP.";
  }
  if (file.size > MAX_BYTES) {
    return "La imagen no debe superar 2 MB.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Subida
// ---------------------------------------------------------------------------

/**
 * Sube una imagen al bucket `product-images`.
 * Llamar solo desde componentes cliente.
 *
 * @returns path  → guardar en BD (image_path)
 * @returns publicUrl → usar solo para preview/render
 */
export async function uploadProductImage(
  file: File,
  folder: "products" | "variants",
): Promise<UploadImageResult> {
  const validationError = validateImageFile(file);
  if (validationError) {
    return { success: false, message: validationError };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const supabase = createClient();

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,   // siempre archivo nuevo — solo necesita policy INSERT
    contentType: file.type,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return { success: true, path, publicUrl };
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

/**
 * Convierte un path interno almacenado en BD a URL pública para mostrar.
 * Usar en <img src={...}>, nunca para guardar en BD.
 *
 * @example getProductImagePublicUrl("products/abc.webp")
 *   → "https://xyz.supabase.co/storage/v1/object/public/product-images/products/abc.webp"
 */
export function getProductImagePublicUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}
