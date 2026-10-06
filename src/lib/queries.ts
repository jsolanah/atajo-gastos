import { getSupabase, supabaseConfigurado } from "./supabase/server";
import {
  fechaEnMes,
  hoyISO,
  mesActual,
  mesDe,
  rangoDelMes,
  sumarMeses,
  ultimosMeses,
} from "./dates";
import type {
  ApunteCategoria,
  Categoria,
  Cuenta,
  Movimiento,
  MovimientoConDetalle,
  PagoPrestamo,
  Prestamo,
  Recurrente,
  ResumenMes,
  SaldoCuenta,
} from "./types";
import { redondear } from "./money";
import { simularPrestamo, type EventoPrestamo } from "./prestamos";

const CAMPOS_MOVIMIENTO = "*, categoria:categorias(*), cuenta_origen_detalle:cuentas!movimientos_cuenta_origen_fkey(id,nombre,color), cuenta_destino_detalle:cuentas!movimientos_cuenta_destino_fkey(id,nombre,color)";

/* -------------------------------------------------------------------------- */
/* Cuentas, categorías y préstamos                                             */
/* -------------------------------------------------------------------------- */

export async function obtenerCuentas(incluirInactivas = false): Promise<Cuenta[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("cuentas")
    .select("*")
    .order("orden", { ascending: true });
  const cuentas = (data ?? []) as Cuenta[];
  return incluirInactivas ? cuentas : cuentas.filter((c) => c.activa);
}

export async function obtenerCuenta(id: string): Promise<Cuenta | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from("cuentas").select("*").eq("id", id).maybeSingle();
  return (data as Cuenta) ?? null;
}

export async function obtenerCategorias(tipo?: "gasto" | "ingreso"): Promise<Categoria[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let consulta = supabase.from("categorias").select("*").eq("activa", true).order("orden");
  if (tipo) consulta = consulta.eq("tipo", tipo);
  const { data } = await consulta;
  return (data ?? []) as Categoria[];
}

export async function obtenerPrestamos(): Promise<Prestamo[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("prestamos").select("*").order("created_at");
  return (data ?? []) as Prestamo[];
}

/* -------------------------------------------------------------------------- */
/* Movimientos                                                                 */
/* -------------------------------------------------------------------------- */

export interface FiltrosMovimiento {
  mes?: string;
  tipo?: "gasto" | "ingreso" | "traspaso";
  cuentaId?: string;
  categoriaId?: string;
  busqueda?: string;
  limite?: number;
}

export async function obtenerMovimientos(
  filtros: FiltrosMovimiento = {},
): Promise<MovimientoConDetalle[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let consulta = supabase
    .from("movimientos")
    .select(CAMPOS_MOVIMIENTO)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filtros.limite ?? 1000);

  if (filtros.mes) {
    const { desde, hasta } = rangoDelMes(filtros.mes);
    consulta = consulta.gte("fecha", desde).lte("fecha", hasta);
  }
  if (filtros.tipo) consulta = consulta.eq("tipo", filtros.tipo);
  if (filtros.categoriaId) consulta = consulta.eq("categoria_id", filtros.categoriaId);
  if (filtros.cuentaId) {
    consulta = consulta.or(`cuenta_origen.eq.${filtros.cuentaId},cuenta_destino.eq.${filtros.cuentaId}`);
  }
  if (filtros.busqueda) {
    const limpio = filtros.busqueda.replace(/[%,()]/g, " ").trim();
    if (limpio) consulta = consulta.ilike("descripcion", `%${limpio}%`);
  }

  const { data } = await consulta;
  return (data ?? []) as MovimientoConDetalle[];
}

export async function movimientoPorId(id: string): Promise<MovimientoConDetalle | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("movimientos")
    .select(CAMPOS_MOVIMIENTO)
    .eq("id", id)
    .maybeSingle();
  return (data as MovimientoConDetalle) ?? null;
}

/** Todos los movimientos (o de un rango de fechas) para calcular saldos. */
export async function obtenerTodosLosMovimientos(desde?: string): Promise<Movimiento[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let consulta = supabase.from("movimientos").select("*").order("fecha", { ascending: true });
  if (desde) consulta = consulta.gte("fecha", desde);
  const { data } = await consulta;
  return (data ?? []) as Movimiento[];
}

/* -------------------------------------------------------------------------- */
/* Agregaciones                                                                */
/* -------------------------------------------------------------------------- */

function Signed(movimientos: Movimiento[]): Map<string, number> {
  const mapa = new Map<string, number>();
  const sumar = (cuenta: string | null, delta: number) => {
    if (!cuenta) return;
    mapa.set(cuenta, (mapa.get(cuenta) ?? 0) + delta);
  };
  for (const m of movimientos) {
    if (m.tipo === "gasto") sumar(m.cuenta_origen, -m.importe);
    else if (m.tipo === "ingreso") sumar(m.cuenta_destino, m.importe);
    else {
      sumar(m.cuenta_origen, -m.importe);
      sumar(m.cuenta_destino, m.importe);
    }
  }
  return mapa;
}

/** Saldo actual de cada cuenta = saldo inicial + movimientos. */
export async function calcularSaldos(): Promise<SaldoCuenta[]> {
  const [cuentas, movimientos] = await Promise.all([
    obtenerCuentas(true),
    obtenerTodosLosMovimientos(),
  ]);
  const netos = Signed(movimientos);
  const ingresos = Signed(movimientos.filter((m) => m.tipo === "ingreso"));
  const gastos = Signed(movimientos.filter((m) => m.tipo === "gasto"));

  return cuentas.map((cuenta) => ({
    cuenta,
    saldo: redondear(cuenta.saldo_inicial + (netos.get(cuenta.id) ?? 0)),
    ingresos: redondear(Math.abs(ingresos.get(cuenta.id) ?? 0)),
    gastos: redondear(Math.abs(gastos.get(cuenta.id) ?? 0)),
  }));
}

export function totalPorTipo(saldos: SaldoCuenta[], tipo: string): number {
  return redondear(
    saldos
      .filter((s) => s.cuenta.tipo === tipo)
      .reduce((acc, s) => acc + s.saldo, 0),
  );
}

export function totalSaldos(saldos: SaldoCuenta[]): number {
  return redondear(saldos.reduce((acc, s) => acc + s.saldo, 0));
}

/** Gastos por categoría en un mes, de mayor a menor. */
export function agruparPorCategoria(
  movimientos: MovimientoConDetalle[],
): ApunteCategoria[] {
  const mapa = new Map<string, ApunteCategoria>();
  let total = 0;

  for (const m of movimientos) {
    if (m.tipo !== "gasto") continue;
    const clave = m.categoria_id ?? "sin-categoria";
    const actual = mapa.get(clave) ?? {
      categoria: m.categoria ?? null,
      total: 0,
      porcentaje: 0,
      numMovimientos: 0,
    };
    actual.total = redondear(actual.total + m.importe);
    actual.numMovimientos += 1;
    mapa.set(clave, actual);
    total += m.importe;
  }

  return [...mapa.values()]
    .map((a) => ({ ...a, porcentaje: total ? Math.round((a.total / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Totales por mes para los últimos `n` meses (para el gráfico de evolución). */
export async function evolucionMensual(n = 6, mesHasta = mesActual()) {
  const meses = ultimosMeses(mesHasta, n);
  const movimientos = await obtenerMovimientos({ limite: 10000 });

  const gastosPorMes = new Map<string, number>();
  const ingresosPorMes = new Map<string, number>();
  const inicio = `${meses[0]}-01`;

  for (const m of movimientos) {
    if (m.fecha < inicio) continue;
    const mes = mesDe(m.fecha);
    if (!meses.includes(mes)) continue;
    if (m.tipo === "gasto") {
      gastosPorMes.set(mes, redondear((gastosPorMes.get(mes) ?? 0) + m.importe));
    } else if (m.tipo === "ingreso") {
      ingresosPorMes.set(mes, redondear((ingresosPorMes.get(mes) ?? 0) + m.importe));
    }
  }

  return meses.map((mes) => ({
    mes,
    gastos: gastosPorMes.get(mes) ?? 0,
    ingresos: ingresosPorMes.get(mes) ?? 0,
  }));
}

/* -------------------------------------------------------------------------- */
/* Recurrentes                                                                 */
/* -------------------------------------------------------------------------- */

export async function obtenerRecurrentes(soloActivos = false): Promise<Recurrente[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let consulta = supabase.from("recurrentes").select("*").order("dia", { ascending: true });
  if (soloActivos) consulta = consulta.eq("activo", true);
  const { data } = await consulta;
  return (data ?? []) as Recurrente[];
}

export interface EstadoFijo {
  recurrente: Recurrente;
  fechaPrevista: string;
  confirmado: boolean;
  movimientoId: string | null;
  /** Mes a partir del cual la plantilla se propone (p. ej. la nómina en oct 2026). */
  mesInicio: string;
}

/** Mes a partir del cual se propone una plantilla (por defecto, siempre). */
function mesInicioDe(recurrente: Recurrente): string {
  return mesDe(recurrente.mes_inicio ?? "2000-01-01");
}

/**
 * Estado de los fijos de un mes: previstos, confirmados y pendientes.
 * Las plantillas cuyo `mes_inicio` es posterior al mes pedido no aparecen
 * (p. ej. la nómina de octubre no se propone en septiembre).
 */
export async function estadoFijosDelMes(mes: string): Promise<EstadoFijo[]> {
  const recurrentes = await obtenerRecurrentes(true);
  const supabase = getSupabase();
  const aplicables = recurrentes.filter((r) => mesInicioDe(r) <= mes);
  if (!aplicables.length || !supabase) {
    return aplicables.map((recurrente) => ({
      recurrente,
      fechaPrevista: fechaEnMes(mes, recurrente.dia),
      confirmado: false,
      movimientoId: null,
      mesInicio: mesDe(recurrente.mes_inicio),
    }));
  }

  const { desde, hasta } = rangoDelMes(mes);
  const { data } = await supabase
    .from("movimientos")
    .select("id, recurrente_id, fecha")
    .in(
      "recurrente_id",
      aplicables.map((r) => r.id),
    )
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const confirmados = new Map(
    ((data ?? []) as { id: string; recurrente_id: string; fecha: string }[]).map((m) => [
      m.recurrente_id,
      m,
    ]),
  );

  return aplicables.map((recurrente) => {
    const movimiento = confirmados.get(recurrente.id);
    return {
      recurrente,
      fechaPrevista: fechaEnMes(mes, recurrente.dia),
      confirmado: Boolean(movimiento),
      movimientoId: movimiento?.id ?? null,
      mesInicio: mesDe(recurrente.mes_inicio),
    };
  });
}

export async function resumenDelMes(mes: string): Promise<ResumenMes> {
  const movimientos = await obtenerMovimientos({ mes });
  const fijos = await estadoFijosDelMes(mes);

  const gastos = redondear(
    movimientos.filter((m) => m.tipo === "gasto").reduce((a, m) => a + m.importe, 0),
  );
  const ingresos = redondear(
    movimientos.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.importe, 0),
  );

  const fijosGasto = fijos.filter((f) => f.recurrente.tipo === "gasto");
  const fijosTraspaso = fijos.filter((f) => f.recurrente.tipo === "traspaso");
  const fijosIngreso = fijos.filter((f) => f.recurrente.tipo === "ingreso");
  const suma = (lista: EstadoFijo[], soloConfirmados: boolean) =>
    redondear(
      lista
        .filter((f) => (soloConfirmados ? f.confirmado : true))
        .reduce((a, f) => a + f.recurrente.importe, 0),
    );

  const gastosTotal = suma(fijosGasto, false);
  const traspasosTotal = suma(fijosTraspaso, false);
  const ingresosTotal = suma(fijosIngreso, false);

  return {
    mes,
    gastos,
    ingresos,
    neto: redondear(ingresos - gastos),
    fijos: {
      gastosTotal,
      gastosPagados: suma(fijosGasto, true),
      gastosPendientes: redondear(gastosTotal - suma(fijosGasto, true)),
      traspasosTotal,
      traspasosPagados: suma(fijosTraspaso, true),
      traspasosPendientes: redondear(traspasosTotal - suma(fijosTraspaso, true)),
      ingresosTotal,
      ingresosPagados: suma(fijosIngreso, true),
      ingresosPendientes: redondear(ingresosTotal - suma(fijosIngreso, true)),
      neto: redondear(ingresosTotal - gastosTotal - traspasosTotal),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Préstamos                                                                   */
/* -------------------------------------------------------------------------- */

export interface EstadoPrestamo {
  prestamo: Prestamo;
  /** Capital pendiente derivado de los pagos (nunca la columna `capital_pendiente`). */
  capitalPendiente: number;
  capitalPagado: number;
  /** Cuotas que quedan con la cuota vigente (las recalculadas tras un abono). */
  cuotasRestantes: number;
  /** Cuotas mensuales ya registradas en la app. */
  cuotasRegistradas: number;
  porcentajeAmortizado: number;
  fechaFinEstimada: string | null;
  proximaCuota: string | null;
  diaCobro: number;
  /** Intereses ya pagados en las cuotas registradas. */
  interesesPagados: number;
  /** Intereses que quedan por pagar si se mantiene la cuota hasta el final. */
  interesesPendientes: number;
  /** El capital pendiente sale de la cifra que dio el banco, no de la firma. */
  anclado: boolean;
  fechaAncla: string | null;
  /** La cuota no cubre ni el interés del mes. */
  cuotaNoAmortiza: boolean;
  abonos: PagoPrestamo[];
  totalAbonado: number;
  /** Capital que aún se puede abonar sin pasarse. */
  abonoMaximo: number;
}

export async function obtenerAbonos(prestamoId?: string): Promise<PagoPrestamo[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let consulta = supabase.from("pagos_prestamo").select("*").order("fecha", { ascending: false });
  if (prestamoId) consulta = consulta.eq("prestamo_id", prestamoId);
  const { data } = await consulta;
  return (data ?? []) as PagoPrestamo[];
}

export async function estadoPrestamos(): Promise<EstadoPrestamo[]> {
  const [prestamos, movimientos, abonos] = await Promise.all([
    obtenerPrestamos(),
    obtenerTodosLosMovimientos(),
    obtenerAbonos(),
  ]);

  const eventosPorPrestamo = new Map<string, EventoPrestamo[]>();
  const anota = (prestamoId: string, evento: EventoPrestamo) => {
    const lista = eventosPorPrestamo.get(prestamoId) ?? [];
    lista.push(evento);
    eventosPorPrestamo.set(prestamoId, lista);
  };

  for (const m of movimientos) {
    // Los abonos también son gastos con prestamo_id, pero su capital lo lleva
    // `pagos_prestamo`: si se contaran como cuota, se descontarían dos veces.
    if (!m.prestamo_id || m.tipo !== "gasto" || m.pago_prestamo_id) continue;
    anota(m.prestamo_id, { fecha: m.fecha, tipo: "cuota", importe: Number(m.importe) });
  }
  for (const abono of abonos) {
    anota(abono.prestamo_id, {
      fecha: abono.fecha,
      tipo: "abono",
      importe: Number(abono.importe),
    });
  }

  return prestamos.map((prestamo) => {
    const simulado = simularPrestamo(prestamo, eventosPorPrestamo.get(prestamo.id) ?? []);
    const diaCobro = Number(prestamo.fecha_inicio.slice(8, 10)) || 1;
    const propios = abonos.filter((a) => a.prestamo_id === prestamo.id);

    return {
      prestamo,
      capitalPendiente: simulado.capitalPendiente,
      capitalPagado: simulado.capitalAmortizado,
      cuotasRestantes: simulado.cuotasRestantes,
      cuotasRegistradas: simulado.cuotasRegistradas,
      porcentajeAmortizado:
        prestamo.capital_inicial > 0
          ? Math.round((simulado.capitalAmortizado / prestamo.capital_inicial) * 1000) / 10
          : 0,
      // El plazo se calcula desde hoy con la cuota vigente: así sigue siendo
      // cierto aunque los abonos hayan cambiado la cuota o el número de meses.
      fechaFinEstimada:
        simulado.cuotasRestantes > 0
          ? fechaEnMes(sumarMeses(mesActual(), simulado.cuotasRestantes - 1), diaCobro)
          : null,
      proximaCuota: proximaFechaDeCobro(diaCobro),
      diaCobro,
      interesesPagados: simulado.interesesPagados,
      interesesPendientes: simulado.interesesPendientes,
      anclado: simulado.anclado,
      fechaAncla: simulado.fechaAncla,
      cuotaNoAmortiza: simulado.cuotaNoAmortiza,
      abonos: propios,
      totalAbonado: redondear(propios.reduce((a, x) => a + Number(x.importe), 0)),
      abonoMaximo: simulado.capitalPendiente,
    };
  });
}

/** Estado de un solo préstamo, para las acciones y páginas que lo necesitan. */
export async function obtenerEstadoPrestamo(id: string): Promise<EstadoPrestamo | null> {
  const estados = await estadoPrestamos();
  return estados.find((e) => e.prestamo.id === id) ?? null;
}

/** Próxima fecha de cobro a partir de hoy según el día de cobro. */
function proximaFechaDeCobro(dia: number): string | null {
  const hoy = hoyISO();
  const esteMes = fechaEnMes(mesActual(), dia);
  if (esteMes >= hoy) return esteMes;
  return fechaEnMes(sumarMeses(mesActual(), 1), dia);
}

/* -------------------------------------------------------------------------- */
/* Utilidades varias                                                           */
/* -------------------------------------------------------------------------- */

export async function hayDatos(): Promise<boolean> {
  if (!supabaseConfigurado()) return false;
  const supabase = getSupabase()!;
  const { count } = await supabase
    .from("movimientos")
    .select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

export async function mesesConMovimientos(limite = 24): Promise<string[]> {
  const movimientos = await obtenerMovimientos({ limite: 5000 });
  const meses = new Set(movimientos.map((m) => mesDe(m.fecha)));
  return [...meses].sort().reverse().slice(0, limite);
}