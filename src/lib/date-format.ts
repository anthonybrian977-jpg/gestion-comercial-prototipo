/**
 * Helpers de formato de fechas/horas para la UI.
 *
 * REGLA DE NEGOCIO:
 *   - Los timestamps (created_at, updated_at) vienen de Supabase en UTC.
 *     Deben mostrarse siempre en hora Perú: America/Lima (UTC-5).
 *   - Las fechas puras (receipt_date, order_date) son tipo "date" SQL.
 *     Vienen como "YYYY-MM-DD" sin hora ni timezone.
 *     Se formatean SIN pasar por Date constructor para evitar el
 *     desplazamiento de día por la conversión UTC midnight → local.
 */

// ─── Timestamp (timestamptz / UTC) → DD/MM/YYYY HH:mm hora Lima ──────────────
/**
 * Formatea un timestamp ISO (e.g. "2026-06-11T12:06:00+00:00") en
 * hora Perú: "11/06/2026 07:06"
 */
export function formatDateTimeLima(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value as string);
  if (isNaN(d.getTime())) return "—";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    year:   "numeric",
    month:  "2-digit",
    day:    "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;

  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

// ─── Fecha pura ("YYYY-MM-DD") → DD/MM/YYYY ──────────────────────────────────
/**
 * Formatea una fecha pura SQL (e.g. "2026-06-11") como "11/06/2026".
 * NO usa Date constructor para evitar desplazamiento de día por UTC.
 */
export function formatDateLima(value: string | null | undefined): string {
  if (!value) return "—";
  const match = (value as string).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value as string;
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}
