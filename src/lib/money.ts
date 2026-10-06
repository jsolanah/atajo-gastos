export const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const eurCompact = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatearEur(valor: number): string {
  return eur.format(valor ?? 0);
}

export function formatearEurCorto(valor: number): string {
  return eurCompact.format(valor ?? 0);
}

export function formatearFecha(fecha: string | Date): string {
  const d = typeof fecha === "string" ? new Date(`${fecha}T00:00:00`) : fecha;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatearFechaCorta(fecha: string | Date): string {
  const d = typeof fecha === "string" ? new Date(`${fecha}T00:00:00`) : fecha;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

/** Etiqueta corta de mes: "sep 26". */
export function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split("-");
  const d = new Date(Number(anio), Number(m) - 1, 1);
  return new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" })
    .format(d)
    .replace(".", "");
}

/** "12,50" | "12.50" | "12,5 €" -> 12.5 */
export function parseImporte(valor: string | number): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const limpio = valor
    .replace(/[€\s]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  if (limpio === "" || !/^-?\d*\.?\d*$/.test(limpio)) return null;
  const n = Number.parseFloat(limpio);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Redondeo a céntimos, evitando los errores de coma flotante. */
export function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function porcentaje(valor: number, total: number): number {
  if (!total) return 0;
  return Math.round((valor / total) * 1000) / 10;
}