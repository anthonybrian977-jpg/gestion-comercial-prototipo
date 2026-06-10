const SKU_RANDOM_CHARS = "0123456789ABCDEF";

export function slugifyForSku(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function randomSkuSuffix(length = 4): string {
  let suffix = "";

  for (let index = 0; index < length; index += 1) {
    const charIndex = Math.floor(Math.random() * SKU_RANDOM_CHARS.length);
    suffix += SKU_RANDOM_CHARS[charIndex];
  }

  return suffix;
}

export function buildMainSkuBase(parts: Array<string | null | undefined>): string {
  const slug = parts
    .map((part) => (part ? slugifyForSku(part) : ""))
    .filter(Boolean)
    .join("-");

  return slug || "PRODUCTO";
}

export function generateMainSku(parts: Array<string | null | undefined>): string {
  return `AUTO-${buildMainSkuBase(parts)}-${randomSkuSuffix()}`;
}

export function generateVariantSku(
  mainSku: string | null,
  parts: Array<string | null | undefined>,
): string {
  const suffix = parts
    .map((part) => (part ? slugifyForSku(part) : ""))
    .filter(Boolean)
    .join("-");

  if (mainSku) {
    const base = slugifyForSku(mainSku.replace(/^AUTO-/, ""));
    if (suffix) {
      return `${base}-${suffix}-${randomSkuSuffix(3)}`;
    }
    return `${base}-VAR-${randomSkuSuffix(4)}`;
  }

  if (suffix) {
    return `VAR-${suffix}-${randomSkuSuffix(4)}`;
  }

  return `VAR-${randomSkuSuffix(8)}`;
}

export async function resolveUniqueMainSku(
  parts: Array<string | null | undefined>,
  isTaken: (sku: string) => Promise<boolean>,
  manualSku?: string,
): Promise<string> {
  const trimmedManual = manualSku?.trim();

  if (trimmedManual) {
    if (await isTaken(trimmedManual)) {
      throw new Error("El SKU principal ya existe. Usa otro código.");
    }
    return trimmedManual;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateMainSku(parts);
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }

  throw new Error("No se pudo generar un SKU principal único. Intenta ingresarlo manualmente.");
}

export async function resolveUniqueVariantSku(
  mainSku: string | null,
  parts: Array<string | null | undefined>,
  isTaken: (sku: string) => Promise<boolean>,
  manualSku?: string,
): Promise<string> {
  const trimmedManual = manualSku?.trim();

  if (trimmedManual) {
    if (await isTaken(trimmedManual)) {
      throw new Error(`El SKU "${trimmedManual}" ya existe. Usa otro código.`);
    }
    return trimmedManual;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateVariantSku(mainSku, parts);
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }

  throw new Error("No se pudo generar un SKU de variante único. Intenta ingresarlo manualmente.");
}
