/**
 * Smart Excel import engine.
 *
 * Shared by:
 *  - SupplierImportModal  (mode: "supplier") → supplier_catalog_items
 *  - ProductImportModal   (mode: "master")   → products + product_variants
 *
 * Features:
 *  - Flexible column-header detection via synonym maps (Spanish + English)
 *  - Handles "Tipo de variante" + "Valor de variante" dispatch pattern
 *  - Variant auto-detection from product-name suffixes in master mode
 *  - Structured SmartProduct[] / SmartVariant[] output
 *  - Stats: detected columns, ignored columns, warnings, row counts
 *
 * This file runs CLIENT-SIDE only (uses dynamic xlsx import).
 * Server actions receive the already-parsed SmartProduct[] payload.
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export type ParseMode = "supplier" | "master";

export type SmartVariant = {
  rowNum: number;
  /** Supplier mode: SKU assigned by the supplier */
  supplierSku?: string;
  /** Master mode: explicit SKU for the variant (optional) */
  variantSku?: string;
  presentation?: string;
  color?: string;
  size?: string;
  purchasePrice?: number;
  /** Master mode only */
  salePrice?: number;
  /** Master mode only — defaults to 0 */
  stock?: number;
  /** Master mode only — defaults to 0 */
  minStock?: number;
};

export type SmartProduct = {
  productName: string;
  brand?: string;
  model?: string;
  category?: string;
  /** Master mode only */
  description?: string;
  variants: SmartVariant[];
};

export type ParseStats = {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  detectedProducts: number;
  detectedVariants: number;
  /** Excel column headers that were mapped to a known field */
  detectedColumns: string[];
  /** Excel column headers that couldn't be matched to any known field */
  ignoredColumns: string[];
  warnings: string[];
};

export type SmartParseResult = {
  ok: boolean;
  /** Only set when ok === false */
  error?: string;
  products: SmartProduct[];
  stats: ParseStats;
};

// ─── Limits ───────────────────────────────────────────────────────────────────

const MAX_ROWS = 2_000;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Normalise a string for fuzzy matching.
 * Strip diacritics → lowercase → keep alphanumerics only.
 *
 * "Precio Compra"              → "preciocompra"
 * "Precio proveedor S/."       → "precioproveedors"
 * "Nombre comercial del prod." → "nombrecomercialdelproducto"
 * "Categoría"                  → "categoria"
 */
export function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Parse a cell value to a number.
 * Handles standard decimals ("12.50"), European format ("1.250,50" → 1250.50),
 * and comma-thousands ("1,250.50" → 1250.50).
 * Returns undefined for blank / non-numeric values.
 */
export function safeNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const raw = String(v).trim();
  if (raw === "") return undefined;

  // Direct parse first — handles "12.50", "1250", "0.99", integers, etc.
  const direct = Number(raw);
  if (!isNaN(direct)) return direct;

  // Both separators present: determine which is thousands vs decimal by position
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // "1.250,50" → period = thousands separator, comma = decimal
      const n = Number(raw.replace(/\./g, "").replace(",", "."));
      if (!isNaN(n)) return n;
    } else {
      // "1,250.50" → comma = thousands separator, period = decimal
      const n = Number(raw.replace(/,/g, ""));
      if (!isNaN(n)) return n;
    }
  } else if (lastComma !== -1) {
    // "12,50" → European decimal notation (comma as decimal separator)
    const n = Number(raw.replace(",", "."));
    if (!isNaN(n)) return n;
  }

  return undefined;
}

// ─── Column synonym maps ──────────────────────────────────────────────────────

/**
 * Fields common to both supplier and master modes.
 * Key = normKey(columnHeader), Value = canonical field name.
 */
const BASE_COLS: Record<string, string> = {
  // ── product_name ──────────────────────────────────────────────────────────
  producto: "product_name",
  nombre: "product_name",
  nombreproducto: "product_name",
  productonombre: "product_name",
  descripcion: "product_name",
  description: "product_name",
  item: "product_name",
  articulo: "product_name",
  detalle: "product_name",
  name: "product_name",
  productname: "product_name",
  // Real-world column variants
  nombrecomercialdelproducto: "product_name",  // "Nombre comercial del producto"
  nombrecomercial: "product_name",
  nombredelproducto: "product_name",
  productobase: "product_name",               // "Producto base" (fallback only)
  denominacion: "product_name",

  // ── purchase_price ────────────────────────────────────────────────────────
  precio: "purchase_price",
  costo: "purchase_price",
  preciocompra: "purchase_price",
  preciocosto: "purchase_price",
  purchaseprice: "purchase_price",
  cost: "purchase_price",
  pcompra: "purchase_price",
  preciounitario: "purchase_price",
  costopromedio: "purchase_price",
  costounitario: "purchase_price",
  // Real-world variants
  precioproveedor: "purchase_price",          // "Precio proveedor"
  precioproveedors: "purchase_price",         // "Precio proveedor S/."
  precioproveeedors: "purchase_price",        // typo guard
  preciocompras: "purchase_price",
  preciolista: "purchase_price",
  preciobase: "purchase_price",

  // ── brand ─────────────────────────────────────────────────────────────────
  marca: "brand",
  brand: "brand",
  fabricante: "brand",
  proveedor: "brand",
  proveedormarca: "brand",

  // ── model ─────────────────────────────────────────────────────────────────
  modelo: "model",
  model: "model",

  // ── category ──────────────────────────────────────────────────────────────
  categoria: "category",
  category: "category",
  rubro: "category",
  familia: "category",
  tipo: "category",
  linea: "category",
  clasificacion: "category",
  departamento: "category",

  // ── presentation ──────────────────────────────────────────────────────────
  presentacion: "presentation",
  unidad: "presentation",
  unit: "presentation",
  empaque: "presentation",
  presentation: "presentation",
  contenido: "presentation",
  // Real-world catch-all for variant column
  presentacioncolormodelo: "variant_value",   // "Presentación / Color / Modelo"
  // "Unidad de compra" (frasco, unidad, caja...) es metadata de compra, NO un atributo
  // de variante. Se deja sin mapear para que quede en ignoredColumns y no pise el
  // valor real que viene de "Tipo de variante" + "Valor de variante".
  // unidaddecompra: "presentation",  ← removido intencionalmente

  // ── color ─────────────────────────────────────────────────────────────────
  color: "color",
  colour: "color",
  tono: "color",
  coloropcion: "color",

  // ── size ──────────────────────────────────────────────────────────────────
  talla: "size",
  size: "size",
  numero: "size",
  tamanio: "size",
  tallanumero: "size",

  // ── variant_type + variant_value (real-world pattern) ─────────────────────
  // "Tipo de variante" + "Valor de variante" → dispatched to color/size/presentation
  tipodevariante: "variant_type",             // "Tipo de variante"
  tipovariante: "variant_type",
  tipodevar: "variant_type",
  atributo: "variant_type",
  tipodeatributo: "variant_type",
  valordevariante: "variant_value",           // "Valor de variante"
  valorvariante: "variant_value",
  valoratributo: "variant_value",
  valordevar: "variant_value",
  valoropcion: "variant_value",
  opcion: "variant_value",
};

/** Extra column synonyms specific to supplier mode. */
const SUPPLIER_EXTRA: Record<string, string> = {
  sku: "supplier_sku",
  skuproveedor: "supplier_sku",
  skuprov: "supplier_sku",
  codigoproveedor: "supplier_sku",
  codprov: "supplier_sku",
  barcode: "supplier_sku",
  codigobarras: "supplier_sku",
  ref: "supplier_sku",
  referencia: "supplier_sku",
  cod: "supplier_sku",
  codigo: "supplier_sku",
  code: "supplier_sku",
  codigointerno: "supplier_sku",
};

/** Extra column synonyms specific to master mode. */
const MASTER_EXTRA: Record<string, string> = {
  // variant_sku
  sku: "variant_sku",
  skuvariante: "variant_sku",
  skuvar: "variant_sku",
  variantsku: "variant_sku",
  codigovariante: "variant_sku",
  codigosku: "variant_sku",
  codigo: "variant_sku",
  cod: "variant_sku",
  ref: "variant_sku",
  referencia: "variant_sku",
  code: "variant_sku",
  // sale_price
  precioventa: "sale_price",
  pvp: "sale_price",
  preciopublico: "sale_price",
  saleprice: "sale_price",
  pventa: "sale_price",
  precio2: "sale_price",
  preciofinal: "sale_price",
  preciosugerido: "sale_price",
  // stock
  stock: "stock",
  cantidad: "stock",
  existencias: "stock",
  inventario: "stock",
  qty: "stock",
  cantidaddisponible: "stock",
  unidades: "stock",
  // min_stock
  stockminimo: "min_stock",
  minimo: "min_stock",
  minstock: "min_stock",
  puntopedido: "min_stock",
  stockmin: "min_stock",
  minimostock: "min_stock",
  // description
  descripcionlarga: "description",
  notas: "description",
  detallecompleto: "description",
  notasproducto: "description",
};

function getColumnMap(mode: ParseMode): Record<string, string> {
  return mode === "supplier"
    ? { ...BASE_COLS, ...SUPPLIER_EXTRA }
    : { ...BASE_COLS, ...MASTER_EXTRA };
}

// ─── Variant-type dispatch ────────────────────────────────────────────────────

/**
 * Dispatch a "variant value" to the correct attribute field
 * based on the "variant type" string from the Excel.
 *
 * Examples:
 *   variantType="Color"        → field "color"
 *   variantType="Presentación" → field "presentation"
 *   variantType="Tamaño"       → field "size"
 */
function dispatchVariantType(variantType: string): "color" | "size" | "presentation" {
  const t = normKey(variantType);
  if (t === "color" || t === "colour" || t === "tono") return "color";
  if (
    t === "talla" ||
    t === "tamano" ||
    t === "size" ||
    t === "numero" ||
    t === "longitud" ||
    t === "largo"
  )
    return "size";
  // "presentacion", "capacidad", "volumen", "peso", "contenido", and catch-all
  return "presentation";
}

// ─── Variant suffix extraction ─────────────────────────────────────────────────

const KNOWN_COLORS = new Set([
  "rojo", "azul", "verde", "amarillo", "negro", "blanco", "rosado", "rosa",
  "morado", "violeta", "naranja", "marron", "cafe", "gris", "beige", "dorado",
  "plateado", "celeste", "turquesa", "fucsia", "lila", "crema", "coral",
  "negra", "blanca", "roja", "azules", "verdes",  // Spanish gendered forms
  "red", "blue", "green", "yellow", "black", "white", "orange", "pink",
  "purple", "brown", "gray", "grey", "gold", "silver", "magenta",
]);

/**
 * Try to extract a variant suffix (size, color, presentation) from a product name.
 *
 * Examples:
 *   "Polo Básico Rojo"     → { baseName:"Polo Básico",  color:"Rojo" }
 *   "Shampoo 500ml"        → { baseName:"Shampoo",       presentation:"500ml" }
 *   "Camiseta Polo XL"     → { baseName:"Camiseta Polo", size:"XL" }
 *   "Zapato Talla 40"      → { baseName:"Zapato",        size:"40" }
 *   "Botella (1L)"         → { baseName:"Botella",       presentation:"1L" }
 */
export function extractSuffixVariant(rawName: string): {
  baseName: string;
  color?: string;
  size?: string;
  presentation?: string;
} {
  let name = rawName.trim();
  let color: string | undefined;
  let size: string | undefined;
  let presentation: string | undefined;

  // 1. Parenthesised suffix: "Product (500ml)" or "Product (Rojo)"
  const parenMatch = name.match(/\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    if (/^\d+(?:[.,]\d+)?\s*(?:ml|cc|lt?|g|kg|oz|gr|mg|lb)\s*$/i.test(inner)) {
      presentation = inner.replace(/\s+/g, "");
    } else if (KNOWN_COLORS.has(normKey(inner))) {
      color = inner;
    } else {
      size = inner;
    }
    name = name.slice(0, name.length - parenMatch[0].length).trim();
  }

  // 2. Volume / weight at end: "Shampoo 250ml", "Arroz 5 kg"
  if (!presentation) {
    const volMatch = name.match(/\s+(\d+(?:[.,]\d+)?\s*(?:ml|cc|lt?|g|kg|oz|gr|mg|lb))\s*$/i);
    if (volMatch) {
      presentation = volMatch[1].trim().replace(/\s+/g, "");
      name = name.slice(0, name.length - volMatch[0].length).trim();
    }
  }

  // 3. Clothing sizes: XS, S, M, L, XL, XXL, XXXL, 2XL, 3XL, 4XL
  if (!size) {
    const clothMatch = name.match(/\s+(X{0,3}S|X{1,3}L|[2-4]XL)\s*$/i);
    if (clothMatch) {
      size = clothMatch[1].toUpperCase();
      name = name.slice(0, name.length - clothMatch[0].length).trim();
    }
  }

  // 4. Shoe / numeric size: "Talla 38", "T38", "N°38", "Nro 38"
  if (!size) {
    const shoeMatch = name.match(/\s+(?:talla\s*|t|n[°º]?\s*|nro\.?\s*|num\.?\s*)(\d{2})\s*$/i);
    if (shoeMatch) {
      size = shoeMatch[1];
      name = name.slice(0, name.length - shoeMatch[0].length).trim();
    }
  }

  // 5. Bare colour word at the end (Spanish / English list)
  if (!color) {
    const words = name.split(/\s+/);
    if (words.length >= 2) {
      const last = words[words.length - 1];
      if (KNOWN_COLORS.has(normKey(last))) {
        color = last;
        name = words.slice(0, -1).join(" ");
      }
    }
  }

  return { baseName: name.trim() || rawName.trim(), color, size, presentation };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

function emptyStats(): ParseStats {
  return {
    totalRows: 0,
    validRows: 0,
    skippedRows: 0,
    detectedProducts: 0,
    detectedVariants: 0,
    detectedColumns: [],
    ignoredColumns: [],
    warnings: [],
  };
}

function emptyResult(error: string): SmartParseResult {
  return { ok: false, error, products: [], stats: emptyStats() };
}

/**
 * Parse an Excel ArrayBuffer and return structured products.
 *
 * @param buffer   - File content as ArrayBuffer (from file.arrayBuffer())
 * @param mode     - "supplier" (flat catalog rows) | "master" (grouped products+variants)
 */
export async function parseExcelBuffer(
  buffer: ArrayBuffer,
  mode: ParseMode,
): Promise<SmartParseResult> {
  // ── File size guard ────────────────────────────────────────────────────────
  if (buffer.byteLength > MAX_BYTES) {
    return emptyResult("El archivo supera el límite de 10 MB.");
  }

  // ── Read workbook ──────────────────────────────────────────────────────────
  const XLSX = await import("xlsx");
  let wb: ReturnType<typeof XLSX.read>;
  try {
    wb = XLSX.read(buffer, { type: "array" });
  } catch {
    return emptyResult("No se pudo leer el archivo. ¿Es un .xlsx o .xls válido?");
  }

  if (!wb.SheetNames.length) {
    return emptyResult("El archivo no contiene hojas.");
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];

  if (raw.length === 0) {
    return emptyResult(
      "La primera hoja está vacía o no tiene encabezados reconocibles.",
    );
  }

  if (raw.length > MAX_ROWS) {
    return emptyResult(
      `El archivo tiene ${raw.length} filas. El máximo permitido es ${MAX_ROWS}.`,
    );
  }

  // ── Column mapping ─────────────────────────────────────────────────────────
  const colMap = getColumnMap(mode);
  const excelHeaders = Object.keys(raw[0]);

  // canonicalField → first Excel header that matched it (first-win)
  const canonicalToHeader = new Map<string, string>();
  const ignoredColumns: string[] = [];
  const detectedColumns: string[] = [];

  for (const header of excelHeaders) {
    const nk = normKey(header);
    const canonical = colMap[nk];
    if (canonical && !canonicalToHeader.has(canonical)) {
      canonicalToHeader.set(canonical, header);
      detectedColumns.push(header);
    } else if (!canonical) {
      ignoredColumns.push(header);
    }
    // Duplicate mapping for same canonical: silently skip (secondary columns ignored)
  }

  // If no product_name column found, fail with a helpful message
  if (!canonicalToHeader.has("product_name")) {
    const detected = detectedColumns.length > 0
      ? ` Columnas reconocidas: ${detectedColumns.join(", ")}.`
      : "";
    const present = excelHeaders.slice(0, 6).join(", ");
    return emptyResult(
      `No se encontró columna de nombre de producto.${detected} ` +
      `Columnas en el archivo: ${present}${excelHeaders.length > 6 ? "…" : ""}.`,
    );
  }

  // ── Accessor helpers ───────────────────────────────────────────────────────
  const str = (row: Record<string, unknown>, canonical: string): string => {
    const h = canonicalToHeader.get(canonical);
    return h !== undefined ? String(row[h] ?? "").trim() : "";
  };
  const num = (row: Record<string, unknown>, canonical: string): number | undefined => {
    const h = canonicalToHeader.get(canonical);
    return h !== undefined ? safeNum(row[h]) : undefined;
  };

  // ── Detect whether explicit variant-attribute columns are present ──────────
  const hasExplicitVariantCols =
    canonicalToHeader.has("color") ||
    canonicalToHeader.has("size") ||
    canonicalToHeader.has("presentation");
  const hasVariantTypePattern =
    canonicalToHeader.has("variant_type") || canonicalToHeader.has("variant_value");
  const useNameExtraction = mode === "master" && !hasExplicitVariantCols && !hasVariantTypePattern;

  // ── Process rows ───────────────────────────────────────────────────────────
  const warnings: string[] = [];
  const supplierProducts: SmartProduct[] = []; // supplier mode: flat list
  const masterGroups = new Map<string, SmartProduct>(); // master mode: grouped

  let validRows = 0;
  let skippedRows = 0;

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const rowNum = i + 2;

    const rawName = str(row, "product_name");
    if (!rawName) {
      skippedRows++;
      continue;
    }

    // ── Optional name-suffix extraction (master, no explicit variant cols) ───
    let baseName = rawName;
    let autoColor: string | undefined;
    let autoSize: string | undefined;
    let autoPresentation: string | undefined;

    if (useNameExtraction) {
      const ex = extractSuffixVariant(rawName);
      baseName = ex.baseName;
      autoColor = ex.color;
      autoSize = ex.size;
      autoPresentation = ex.presentation;
    }

    // ── Product-level fields ─────────────────────────────────────────────────
    const brand = str(row, "brand") || undefined;
    const model = str(row, "model") || undefined;
    const category = str(row, "category") || undefined;
    const description =
      mode === "master" ? str(row, "description") || undefined : undefined;

    // ── Variant-level fields from explicit columns ───────────────────────────
    let colorVal = str(row, "color") || autoColor || undefined;
    let sizeVal = str(row, "size") || autoSize || undefined;
    let presentationVal =
      str(row, "presentation") ||
      (hasVariantTypePattern ? undefined : str(row, "variant_value") || undefined) ||
      autoPresentation ||
      undefined;

    // ── variant_type + variant_value dispatch ────────────────────────────────
    // Cuando el Excel tiene columnas "Tipo de variante" + "Valor de variante",
    // esas columnas son la fuente AUTORITATIVA de los atributos de variante.
    // El dispatch SIEMPRE sobreescribe lo que haya, sin importar si ya había un valor
    // de otra columna (ej: una columna "presentacion" ambigua).
    if (hasVariantTypePattern) {
      const variantType = str(row, "variant_type");
      const variantValue = str(row, "variant_value");
      if (variantValue) {
        const target = variantType
          ? dispatchVariantType(variantType)
          : "presentation";
        // Sin guardia !field: variant_type siempre gana
        if (target === "color") colorVal = variantValue;
        else if (target === "size") sizeVal = variantValue;
        else presentationVal = variantValue;
      }
    }

    const purchasePrice = num(row, "purchase_price");

    // ── Supplier mode: flat list ─────────────────────────────────────────────
    if (mode === "supplier") {
      const supplierSku = str(row, "supplier_sku") || undefined;

      if (purchasePrice === undefined) {
        const h = canonicalToHeader.get("purchase_price");
        if (h) {
          const rawVal = String(row[h] ?? "").trim();
          if (rawVal !== "")
            warnings.push(
              `Fila ${rowNum}: precio no numérico "${rawVal}" → se guardará como 0.`,
            );
        }
      }

      supplierProducts.push({
        productName: rawName,
        brand,
        model,
        category,
        variants: [
          {
            rowNum,
            supplierSku,
            presentation: presentationVal,
            color: colorVal,
            size: sizeVal,
            purchasePrice: purchasePrice ?? 0,
          },
        ],
      });
      validRows++;
      continue;
    }

    // ── Master mode: group by normalised base name ───────────────────────────
    const variantSku = str(row, "variant_sku") || undefined;
    const salePrice = num(row, "sale_price");
    const stock = num(row, "stock") ?? 0;
    const minStock = num(row, "min_stock") ?? 0;

    const key = normKey(baseName);

    if (!masterGroups.has(key)) {
      masterGroups.set(key, {
        productName: baseName,
        brand,
        model,
        category,
        description,
        variants: [],
      });
    }

    masterGroups.get(key)!.variants.push({
      rowNum,
      variantSku,
      presentation: presentationVal,
      color: colorVal,
      size: sizeVal,
      purchasePrice,
      salePrice,
      stock,
      minStock,
    });
    validRows++;
  }

  const products =
    mode === "supplier" ? supplierProducts : Array.from(masterGroups.values());

  return {
    ok: true,
    products,
    stats: {
      totalRows: raw.length,
      validRows,
      skippedRows,
      detectedProducts: products.length,
      detectedVariants: products.reduce((s, p) => s + p.variants.length, 0),
      detectedColumns,
      ignoredColumns,
      warnings,
    },
  };
}
