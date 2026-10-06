import { redondear } from "./money";
import type { ModoAbono, ModoTasa } from "./types";

/* -------------------------------------------------------------------------- */
/* Sistema francés: la cuota se reparte en interés + capital                    */
/* -------------------------------------------------------------------------- */

/**
 * Tipo de interés mensual equivalente al anual del contrato.
 *
 * El TAN (nominal) es lo habitual en un préstamo de coche: el banco lo divide
 * entre 12. La TAE (efectiva) se compone. Con un 6 % la una da una cuota de
 * 386,66 € sobre 20.000 € a 60 meses y la otra 385,18 €, así que importa cuál
 * se guarde.
 */
export function tasaMensual(tasa: number, modo: ModoTasa = "tan"): number {
  const t = Number.isFinite(tasa) ? tasa : 0;
  if (t <= 0) return 0;
  return modo === "tan" ? t / 1200 : (1 + t / 100) ** (1 / 12) - 1;
}

/**
 * Cuota constante para amortizar `capital` en `meses` (sistema francés).
 *
 * Se redondea la cuota hacia arriba al céntimo, como hacen los bancos: si se
 * redondea hacia abajo, al final sobra algún céntimo y el préstamo necesita una
 * cuota más (386,65 € en vez de 386,66 € sobre 20.000 € a 60 meses obliga a pagar
 * 61 cuotas en lugar de 60).
 */
export function cuotaDe(
  capital: number,
  meses: number,
  tasa = 0,
  modo: ModoTasa = "tan",
): number {
  const c = Math.max(capital, 0);
  const n = Math.floor(meses);
  if (c <= 0 || n <= 0) return 0;

  const r = tasaMensual(tasa, modo);
  if (r <= 0) return redondear(c / n);
  return Math.ceil((c * r) / (1 - (1 + r) ** -n) * 100 - 1e-9) / 100;
}

export interface RepartoCuota {
  interes: number;
  amortizacion: number;
  capitalRestante: number;
}

/**
 * Reparte una cuota en la parte de interés del mes y la parte que abate capital.
 * El interés se redondea a céntimos antes de restarlo, para que
 * `interes + amortizacion` sea exactamente la cuota, como en el banco.
 */
export function repartirCuota(
  capital: number,
  cuota: number,
  tasa = 0,
  modo: ModoTasa = "tan",
): RepartoCuota {
  const c = redondear(Math.max(capital, 0));
  if (c <= 0) return { interes: 0, amortizacion: 0, capitalRestante: 0 };

  const r = tasaMensual(tasa, modo);
  const interes = redondear(c * r);
  const amortizacion = redondear(Math.min(Math.max(cuota - interes, 0), c));
  return { interes, amortizacion, capitalRestante: redondear(c - amortizacion) };
}

/**
 * Meses que faltan para amortizar `capital` pagando `cuota`.
 * Devuelve `Infinity` si la cuota ni siquiera cubre el interés del mes: con
 * esa cuota el préstamo no se termina nunca.
 */
export function mesesRestantes(
  capital: number,
  cuota: number,
  tasa = 0,
  modo: ModoTasa = "tan",
): number {
  const c = Math.max(capital, 0);
  const q = Math.max(cuota, 0);
  if (c <= 0) return 0;
  if (q <= 0) return Number.POSITIVE_INFINITY;

  const r = tasaMensual(tasa, modo);
  if (r <= 0) return c / q;

  const factor = 1 - (c * r) / q;
  if (factor <= 0) return Number.POSITIVE_INFINITY;
  return -Math.log(factor) / Math.log(1 + r);
}

export interface CuotaPlan {
  numero: number;
  interes: number;
  amortizacion: number;
  capitalRestante: number;
}

export interface ResultadoAmortizacion {
  /** Pagos necesarios hasta dejar el capital a cero, o 0 si no llega nunca. */
  cuotas: number;
  /** El último pago suele ser menor que la cuota. */
  ultimaCuota: number;
  totalPagado: number;
  interesesTotales: number;
  /** False si la cuota no amortiza y se ha agotado el máximo de iteraciones. */
  completa: boolean;
}

/**
 * Cuenta cuántos pagos de `cuota` dejan el capital a cero, aplicando el mismo
 * redondeo a céntimos que el banco.
 *
 * Cuenta de uno en uno a propósito: la fórmula cerrada da 80,08 meses para una
 * cuota que es la annuity exacta de 80, y `ceil` de eso se iría a 81.
 */
export function amortizar(
  capital: number,
  cuota: number,
  tasa = 0,
  modo: ModoTasa = "tan",
  maxMeses = 1200,
): ResultadoAmortizacion {
  const q = redondear(Math.max(cuota, 0));
  let c = redondear(Math.max(capital, 0));
  let totalPagado = 0;
  let interesesTotales = 0;
  let ultimaCuota = 0;
  let cuotas = 0;

  if (c <= 0 || q <= 0) {
    return { cuotas, ultimaCuota, totalPagado, interesesTotales, completa: true };
  }

  for (let n = 1; n <= maxMeses && c > 0; n++) {
    const { interes, capitalRestante } = repartirCuota(c, q, tasa, modo);
    ultimaCuota = redondear(Math.min(q, interes + (c - capitalRestante)));
    totalPagado = redondear(totalPagado + ultimaCuota);
    interesesTotales = redondear(interesesTotales + interes);
    c = capitalRestante;
    cuotas = n;
  }

  const completa = c <= 0;
  return {
    // Si la cuota ni cubre el interés, no hay plazo que mostrar: mejor cero
    // ("no termina nunca") que un número inventado.
    cuotas: completa ? cuotas : 0,
    ultimaCuota: completa ? ultimaCuota : 0,
    totalPagado,
    interesesTotales,
    completa,
  };
}

/** Tabla de amortización mes a mes, desde el capital actual hasta terminar. */
export function planAmortizacion(
  capital: number,
  cuota: number,
  tasa = 0,
  modo: ModoTasa = "tan",
  maxMeses = 1200,
): CuotaPlan[] {
  const plan: CuotaPlan[] = [];
  const q = Math.max(cuota, 0);
  if (Math.max(capital, 0) <= 0 || q <= 0) return plan;

  let c = redondear(Math.max(capital, 0));
  for (let numero = 1; numero <= maxMeses && c > 0; numero++) {
    const r = repartirCuota(c, q, tasa, modo);
    c = r.capitalRestante;
    plan.push({ numero, ...r });
  }
  return plan;
}

/* -------------------------------------------------------------------------- */
/* Capital pendiente derivado de los pagos                                      */
/* -------------------------------------------------------------------------- */

export interface PrestamoSimulable {
  capital_inicial: number;
  cuota: number;
  fecha_inicio: string;
  interes_anual: number | null;
  interes_modo: ModoTasa | null;
  saldo_referencia: number | null;
  fecha_referencia: string | null;
}

/** Un pago ya registrado: la cuota mensual o un abono con dinero ahorrado. */
export interface EventoPrestamo {
  fecha: string;
  tipo: "cuota" | "abono";
  importe: number;
}

export interface EstadoSimuladoPrestamo {
  capitalPendiente: number;
  capitalAmortizado: number;
  cuotasRestantes: number;
  cuotasRegistradas: number;
  interesesPagados: number;
  interesesPendientes: number;
  /** El capital pendiente sale de la cifra que dio el banco, no de la firma. */
  anclado: boolean;
  fechaAncla: string | null;
  /** La cuota no cubre ni el interés: el préstamo no se amortizaría nunca. */
  cuotaNoAmortiza: boolean;
}

/**
 * Calcula el capital pendiente a partir de los pagos registrados, aplicando el
 * interés mes a mes. No se guarda en ninguna columna: se deriva siempre, así que
 * no puede desincronizarse de los movimientos.
 *
 * Con `saldo_referencia` la app se ancla a la cifra que dio el banco y todo lo
 * anterior a `fecha_referencia` se ignora. Es lo que permite usar la app con
 * préstamos más viejos que ella sin meter el histórico a mano.
 */
export function simularPrestamo(
  prestamo: PrestamoSimulable,
  eventos: EventoPrestamo[],
): EstadoSimuladoPrestamo {
  const tasa = prestamo.interes_anual ?? 0;
  const modo = prestamo.interes_modo ?? "tan";
  const anclado = prestamo.saldo_referencia !== null && prestamo.fecha_referencia !== null;
  const desde = prestamo.fecha_referencia ?? prestamo.fecha_inicio;

  const inicial = redondear(Math.max(Number(prestamo.capital_inicial), 0));
  let capital = redondear(Math.max(anclado ? Number(prestamo.saldo_referencia) : inicial, 0));
  let interesesPagados = 0;
  let cuotasRegistradas = 0;

  // Cuotas y abonos van en la misma lista y ordenados por fecha: un abono
  // cambia el capital y con él el interés de la cuota siguiente.
  const ordenados = [...eventos].sort((a, b) =>
    a.fecha === b.fecha ? 0 : a.fecha < b.fecha ? -1 : 1,
  );

  for (const evento of ordenados) {
    // Lo anterior al ancla (o a la firma) ya está dentro del saldo de partida.
    if (evento.fecha <= desde) continue;

    if (evento.tipo === "abono") {
      capital = redondear(Math.max(capital - Number(evento.importe), 0));
      continue;
    }

    const r = repartirCuota(capital, Number(evento.importe), tasa, modo);
    capital = r.capitalRestante;
    interesesPagados = redondear(interesesPagados + r.interes);
    cuotasRegistradas++;
  }

  const cuota = Number(prestamo.cuota);
  const plan = amortizar(capital, cuota, tasa, modo);

  return {
    capitalPendiente: capital,
    capitalAmortizado: redondear(Math.max(inicial - capital, 0)),
    // Con `amortizar` en vez de `ceil(mesesRestantes(...))`: al contar los pagos
    // de verdad, una cuota que es la annuity exacta de n meses no se va a n + 1
    // por el redondeo a céntimos.
    cuotasRestantes: plan.cuotas,
    cuotasRegistradas,
    interesesPagados,
    interesesPendientes: plan.completa ? redondear(Math.max(plan.totalPagado - capital, 0)) : 0,
    anclado,
    fechaAncla: prestamo.fecha_referencia,
    cuotaNoAmortiza: !plan.completa,
  };
}

/* -------------------------------------------------------------------------- */
/* Abono (pago por delante)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cálculo de un abono (pago por delante) sobre un préstamo.
 *
 * Un abono siempre descuenta capital pendiente. Lo que cambia después depende
 * del modo elegido:
 *
 * - `reducir_plazo` (quitar cuotas): la cuota mensual se mantiene y el
 *   préstamo se acorta. Es lo que quiere la mayoría: pagar de más para
 *   terminar antes.
 * - `reducir_cuota` (bajar la cuota): se mantiene el número de meses que
 *   quedaban y se recalcula la cuota, que baja.
 *
 * Devuelve también el detalle de lo que cambia, para poder previsualizarlo
 * antes de confirmar.
 */

export interface SimulacionAbono {
  modo: ModoAbono;
  importe: number;
  capitalAntes: number;
  capitalDespues: number;
  cuotaAntes: number;
  /** Cuota mensual después del abono (solo cambia en modo `reducir_cuota`). */
  cuotaDespues: number;
  cuotasRestantesAntes: number;
  cuotasRestantesDespues: number;
  cuotasAhorradas: number;
  /** Interés que se deja de pagar por adelantado, como aproximación. */
  interesAhorradoEstimado: number;
  aviso: string | null;
}

export interface DatosPrestamo {
  capitalPendiente: number;
  cuota: number;
  /** Tipo de interés anual en %. Si falta, el préstamo es a 0 %. */
  tasa?: number | null;
  modoTasa?: ModoTasa | null;
}

export function calcularAbono(
  prestamo: DatosPrestamo,
  importe: number,
  modo: ModoAbono,
): SimulacionAbono {
  const capitalAntes = redondear(Math.max(prestamo.capitalPendiente, 0));
  const cuotaAntes = redondear(Math.max(prestamo.cuota, 0));
  const tasa = prestamo.tasa ?? 0;
  const modoTasa = prestamo.modoTasa ?? "tan";
  const importeReal = redondear(Math.min(Math.max(importe, 0), capitalAntes));

  const capitalDespues = redondear(Math.max(capitalAntes - importeReal, 0));
  const cuotasAntes = capitalAntes > 0 ? amortizar(capitalAntes, cuotaAntes, tasa, modoTasa).cuotas : 0;

  let cuotaDespues = cuotaAntes;
  let cuotasDespues =
    capitalDespues > 0
      ? amortizar(capitalDespues, cuotaAntes, tasa, modoTasa).cuotas
      : 0;
  let aviso: string | null = null;

  if (modo === "reducir_cuota" && capitalDespues > 0 && cuotaAntes > 0 && cuotasAntes > 0) {
    // Se reparten los meses que quedaban entre el capital que queda: cuota
    // más baja, plazo el mismo. Con `amortizar` el plazo se mantiene de verdad,
    // porque la cuota recalculada es la de esos mismos meses.
    const cuotaRecalculada = cuotaDe(capitalDespues, cuotasAntes, tasa, modoTasa);
    if (cuotaRecalculada > 0) {
      cuotaDespues = cuotaRecalculada;
      cuotasDespues = amortizar(capitalDespues, cuotaRecalculada, tasa, modoTasa).cuotas;
    }
  }

  if (modo === "reducir_cuota" && cuotaAntes > 0 && cuotaDespues < 20) {
    aviso = "La cuota recalculada es muy baja: el banco normalmente impone un mínimo.";
  }

  if (cuotaAntes > 0 && cuotaDespues < cuotaAntes && cuotaDespues < 10) {
    aviso = aviso ?? "La cuota resultante es muy baja: revísala con el banco antes de aplicarlo.";
  }

  const cuotasAhorradas = Math.max(cuotasAntes - cuotasDespues, 0);

  // Adelantar dinero quita las cuotas del final del préstamo, que son las que
  // menos interés acumulan: se suman sus intereses de la tabla real.
  const plan = planAmortizacion(capitalAntes, cuotaAntes, tasa, modoTasa);
  const cola = plan.slice(Math.max(plan.length - cuotasAhorradas, 0));
  const interesAhorradoEstimado = redondear(cola.reduce((a, c) => a + c.interes, 0));

  return {
    modo,
    importe: importeReal,
    capitalAntes,
    capitalDespues,
    cuotaAntes,
    cuotaDespues,
    cuotasRestantesAntes: cuotasAntes,
    cuotasRestantesDespues: cuotasDespues,
    cuotasAhorradas,
    interesAhorradoEstimado,
    aviso,
  };
}
