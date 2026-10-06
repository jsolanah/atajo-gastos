import { format } from "date-fns";
import { es } from "date-fns/locale";

/** Mes actual en formato "YYYY-MM". */
export function mesActual(): string {
  return format(new Date(), "yyyy-MM");
}

/** Extrae el mes de una fecha ISO ("2026-09-30" -> "2026-09"). */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

function partes(mes: string): [number, number] {
  const [anio, m] = mes.split("-").map(Number);
  return [anio || 1970, m || 1];
}

/** Día 31 en un mes de 28 días -> último día real del mes. */
export function fechaEnMes(mes: string, dia: number): string {
  const [anio, m] = partes(mes);
  const ultimo = new Date(anio, m, 0).getDate();
  const d = Math.min(Math.max(dia, 1), ultimo);
  return `${mes}-${String(d).padStart(2, "0")}`;
}

/** Rango [desde, hasta] inclusivo del mes, en formato ISO. */
export function rangoDelMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = partes(mes);
  const ultimo = new Date(anio, m, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/** Suma (o resta) meses a un "YYYY-MM". */
export function sumarMeses(mes: string, cantidad: number): string {
  const [anio, m] = partes(mes);
  return format(new Date(anio, m - 1 + cantidad, 1), "yyyy-MM");
}

/** Los `n` meses que terminan en `mes` (incluido), en orden cronológico. */
export function ultimosMeses(mes: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => sumarMeses(mes, i - (n - 1)));
}

export function nombreMes(mes: string): string {
  const [anio, m] = partes(mes);
  const texto = format(new Date(anio, m - 1, 1), "MMMM", { locale: es });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "sep 26" */
export function etiquetaMesCorta(mes: string): string {
  const [anio, m] = partes(mes);
  const texto = format(new Date(anio, m - 1, 1), "MMM", { locale: es }).replace(".", "");
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} ${String(anio).slice(2)}`;
}

/** "Septiembre de 2026" */
export function tituloMes(mes: string): string {
  const [anio] = partes(mes);
  return `${nombreMes(mes)} de ${anio}`;
}

export function hoyISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** "¿2026-13" no es un mes válido. */
export function esMesValido(valor: unknown): valor is string {
  return (
    typeof valor === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(valor)
  );
}

/** Normaliza un parámetro de búsqueda a un único string. */
export function primerValor(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export function esFechaFutura(fecha: string): boolean {
  return fecha > hoyISO();
}