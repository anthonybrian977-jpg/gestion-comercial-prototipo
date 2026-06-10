export function formatCurrency(value: number | null): string {
  if (value === null) return "—";

  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-PE").format(value);
}
