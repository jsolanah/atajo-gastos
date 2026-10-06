import { normalizarTexto } from "./validation";
import type { Cuenta } from "./types";

/**
 * Busca una cuenta por nombre o por entidad bancaria.
 *
 * El orden importa. Una cuenta se puede llamar igual que su entidad (una
 * corriente y una hucha del mismo banco, por ejemplo), así que si se buscaran
 * nombre y entidad en el mismo paso ese nombre sería ambiguo y el atajo de iOS
 * no podría elegir. Por eso:
 *
 *   1. gana siempre la coincidencia exacta por nombre (es clave única)
 *   2. si no hay ninguna, se prueba por entidad bancaria
 *   3. si por entidad hay varias, hay que concretizar cuál
 */
export type ResultadoBusquedaCuenta =
  | { ok: true; cuenta: Cuenta }
  | { ok: false; error: string; candidatas: string[] };

export function buscarCuenta(cuentas: Cuenta[], valor: string): ResultadoBusquedaCuenta {
  const candidatos = cuentas.map((c) => c.nombre);
  const texto = normalizarTexto(valor);

  if (!texto) {
    return { ok: false, error: "Falta indicar la cuenta.", candidatas: candidatos };
  }

  // Un UUID siempre manda: es inequívoco.
  const porId = cuentas.find((c) => c.id === valor.trim());
  if (porId) return { ok: true, cuenta: porId };

  // 1) Nombre exacto. El nombre es único, pero por si acaso cogemos el primero.
  const porNombre = cuentas.find((c) => normalizarTexto(c.nombre) === texto);
  if (porNombre) return { ok: true, cuenta: porNombre };

  // 2) Entidad bancaria. Aquí sí puede haber varias cuentas del mismo banco.
  const porEntidad = cuentas.filter((c) => normalizarTexto(c.entidad) === texto);
  if (porEntidad.length === 1) return { ok: true, cuenta: porEntidad[0] };
  if (porEntidad.length > 1) {
    return {
      ok: false,
      error: `"${valor}" es el banco de varias cuentas: ${porEntidad.map((c) => c.nombre).join(", ")}.`,
      candidatas: porEntidad.map((c) => c.nombre),
    };
  }

  return { ok: false, error: `Cuenta desconocida: "${valor}".`, candidatas: candidatos };
}