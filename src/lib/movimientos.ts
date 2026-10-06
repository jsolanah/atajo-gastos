import { getSupabase, mensajeDeError } from "./supabase/server";
import { buscarCuenta, type ResultadoBusquedaCuenta } from "./cuentas";
import { normalizarTexto, type MovimientoInput } from "./validation";
import { fechaEnMes, hoyISO, mesDe, rangoDelMes } from "./dates";
import type { Categoria, Cuenta, OrigenMovimiento } from "./types";

/* -------------------------------------------------------------------------- */
/* Resolución de nombres -> ids                                               */
/* -------------------------------------------------------------------------- */

export async function resolverCuenta(valor: string): Promise<ResultadoBusquedaCuenta> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "La base de datos no está configurada.", candidatas: [] };
  }

  const { data } = await supabase
    .from("cuentas")
    .select("*")
    .eq("activa", true)
    .order("orden");

  return buscarCuenta((data ?? []) as Cuenta[], valor);
}

export async function resolverCategoria(
  valor: string,
  tipo: "gasto" | "ingreso",
): Promise<{ ok: true; categoria: Categoria | null } | { ok: false; error: string; candidatas: string[] }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está configurada.", candidatas: [] };

  const { data } = await supabase
    .from("categorias")
    .select("*")
    .eq("activa", true)
    .eq("tipo", tipo)
    .order("orden");

  const categorias = (data ?? []) as Categoria[];
  const candidatas = categorias.map((c) => c.nombre);
  if (!valor?.trim()) return { ok: true, categoria: null };

  const porId = categorias.find((c) => c.id === valor.trim());
  if (porId) return { ok: true, categoria: porId };

  const normalizado = normalizarTexto(valor);
  const encontrada = categorias.find((c) => normalizarTexto(c.nombre) === normalizado);
  if (encontrada) return { ok: true, categoria: encontrada };

  return { ok: false, error: `Categoría desconocida: "${valor}".`, candidatas };
}

/* -------------------------------------------------------------------------- */
/* Altas y bajas                                                               */
/* -------------------------------------------------------------------------- */

export interface ResultadoAlta {
  ok: boolean;
  id?: string;
  error?: string;
  detalle?: string;
  saldo?: number;
  cuenta?: string;
  categoria?: string | null;
  descripcion?: string;
  fecha?: string;
}

function filaDesdeInput(input: MovimientoInput, origen: OrigenMovimiento) {
  return {
    tipo: input.tipo,
    importe: input.importe,
    descripcion: input.descripcion,
    categoria_id: input.categoria_id || null,
    cuenta_origen: input.tipo === "ingreso" ? null : input.cuenta_origen || null,
    cuenta_destino: input.tipo === "gasto" ? null : input.cuenta_destino || null,
    fecha: input.fecha,
    notas: input.notas || null,
    origen,
  };
}

export async function crearMovimiento(
  input: MovimientoInput,
  origen: OrigenMovimiento = "web",
): Promise<ResultadoAlta> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está configurada." };

  const { data, error } = await supabase
    .from("movimientos")
    .insert(filaDesdeInput(input, origen))
    .select("id")
    .single();

  if (error) return { ok: false, error: mensajeDeError(error) };

  return {
    ok: true,
    id: data.id,
    descripcion: input.descripcion,
    fecha: input.fecha,
  };
}

export async function actualizarMovimiento(input: MovimientoInput): Promise<ResultadoAlta> {
  const supabase = getSupabase();
  if (!supabase || !input.id) {
    return { ok: false, error: "Movimiento no válido." };
  }

  const { data, error } = await supabase
    .from("movimientos")
    .update({
      tipo: input.tipo,
      importe: input.importe,
      descripcion: input.descripcion,
      categoria_id: input.categoria_id || null,
      cuenta_origen: input.tipo === "ingreso" ? null : input.cuenta_origen || null,
      cuenta_destino: input.tipo === "gasto" ? null : input.cuenta_destino || null,
      fecha: input.fecha,
      notas: input.notas || null,
    })
    .eq("id", input.id)
    .select("id")
    .single();

  if (error) return { ok: false, error: mensajeDeError(error) };
  return { ok: true, id: data.id };
}

export async function eliminarMovimiento(id: string): Promise<ResultadoAlta> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está configurada." };

  // El capital pendiente de un préstamo no se guarda: se deriva de los pagos que
  // hay registrados, así que borrar un movimiento ya lo descuenta por sí solo.
  const { error } = await supabase.from("movimientos").delete().eq("id", id);
  if (error) return { ok: false, error: mensajeDeError(error) };
  return { ok: true, id };
}

/* -------------------------------------------------------------------------- */
/* Atajo de iOS                                                               */
/* -------------------------------------------------------------------------- */

export interface EntradaAtajo {
  importe: number;
  concepto: string;
  cuenta: string;
  categoria: string;
  fecha: string;
  notas?: string | null;
}

export async function registrarGastoAtajo(entrada: EntradaAtajo): Promise<ResultadoAlta> {
  const cuenta = await resolverCuenta(entrada.cuenta);
  if (!cuenta.ok) {
    return {
      ok: false,
      error: cuenta.error,
      detalle: cuenta.candidatas.length ? `Cuentas: ${cuenta.candidatas.join(", ")}` : undefined,
    };
  }

  const categoria = await resolverCategoria(entrada.categoria, "gasto");
  if (!categoria.ok) {
    return {
      ok: false,
      error: categoria.error,
      detalle: categoria.candidatas.length
        ? `Categorías: ${categoria.candidatas.join(", ")}`
        : undefined,
    };
  }

  const resultado = await crearMovimiento(
    {
      tipo: "gasto",
      importe: entrada.importe,
      descripcion: entrada.concepto,
      cuenta_origen: cuenta.cuenta.id,
      cuenta_destino: null,
      categoria_id: categoria.categoria?.id ?? null,
      fecha: entrada.fecha,
      notas: entrada.notas ?? null,
    },
    "atajo",
  );

  if (!resultado.ok) return resultado;

  return {
    ...resultado,
    cuenta: cuenta.cuenta.nombre,
    categoria: categoria.categoria?.nombre ?? null,
    saldo: await saldoDeCuenta(cuenta.cuenta.id),
  };
}

/* -------------------------------------------------------------------------- */
/* Saldos                                                                     */
/* -------------------------------------------------------------------------- */

export async function saldoDeCuenta(cuentaId: string): Promise<number | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("saldo_inicial")
    .eq("id", cuentaId)
    .maybeSingle();
  if (!cuenta) return undefined;

  const { data: salientes } = await supabase
    .from("movimientos")
    .select("importe")
    .eq("cuenta_origen", cuentaId);
  const { data: entrantes } = await supabase
    .from("movimientos")
    .select("importe")
    .eq("cuenta_destino", cuentaId);

  const resta = (salientes ?? []).reduce((a, m) => a + Number(m.importe), 0);
  const suma = (entrantes ?? []).reduce((a, m) => a + Number(m.importe), 0);

  return Math.round((cuenta.saldo_inicial + suma - resta) * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* Pagos fijos                                                                */
/* -------------------------------------------------------------------------- */

export async function confirmarFijo(
  recurrenteId: string,
  mes: string,
): Promise<ResultadoAlta> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está configurada." };

  const { data: recurrente, error: errorRecurrente } = await supabase
    .from("recurrentes")
    .select("*")
    .eq("id", recurrenteId)
    .maybeSingle();

  if (errorRecurrente) return { ok: false, error: mensajeDeError(errorRecurrente) };
  if (!recurrente) return { ok: false, error: "El pago fijo no existe." };

  if (mesDe(recurrente.mes_inicio ?? "2000-01-01") > mes) {
    return {
      ok: false,
      error: `Este ingreso fijo no se propone hasta ${mesDe(recurrente.mes_inicio)}.`,
    };
  }

  const { desde, hasta } = rangoDelMes(mes);
  const { data: yaExiste } = await supabase
    .from("movimientos")
    .select("id")
    .eq("recurrente_id", recurrenteId)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .maybeSingle();

  if (yaExiste) {
    return { ok: false, id: yaExiste.id, error: "Este pago fijo ya está confirmado este mes." };
  }

  const esIngreso = recurrente.tipo === "ingreso";
  const fecha = fechaEnMes(mes, recurrente.dia);
  const { data, error } = await supabase
    .from("movimientos")
    .insert({
      tipo: recurrente.tipo,
      importe: recurrente.importe,
      descripcion: recurrente.concepto,
      categoria_id: recurrente.categoria_id,
      cuenta_origen: esIngreso ? null : recurrente.cuenta_origen,
      cuenta_destino: recurrente.tipo === "gasto" ? null : recurrente.cuenta_destino,
      fecha,
      recurrente_id: recurrente.id,
      prestamo_id: recurrente.prestamo_id,
      origen: "web",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: mensajeDeError(error) };

  // El capital pendiente lo deduce `simularPrestamo` de este movimiento: no hay
  // ninguna columna que actualizar aquí.
  return { ok: true, id: data.id, descripcion: recurrente.concepto, fecha };
}

export async function deshacerFijo(movimientoId: string): Promise<ResultadoAlta> {
  return eliminarMovimiento(movimientoId);
}

/** Saldo previsto a fin de mes si se confirman todos los fijos pendientes. */
export async function proyectarSaldoFinal(mes: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const { data: cuentas } = await supabase.from("cuentas").select("*").eq("activa", true);
  if (!cuentas?.length) return 0;

  const { data: movimientos } = await supabase.from("movimientos").select("*").lte("fecha", hoyISO());
  const hastaFinDeMes = fechaEnMes(mes, 31) > hoyISO() ? hoyISO() : fechaEnMes(mes, 31);

  const saldoPorCuenta = new Map<string, number>();
  for (const cuenta of cuentas ?? []) saldoPorCuenta.set(cuenta.id, Number(cuenta.saldo_inicial));

  for (const m of movimientos ?? []) {
    if (m.fecha > hastaFinDeMes) continue;
    if (m.cuenta_origen) {
      saldoPorCuenta.set(m.cuenta_origen, (saldoPorCuenta.get(m.cuenta_origen) ?? 0) - Number(m.importe));
    }
    if (m.cuenta_destino) {
      saldoPorCuenta.set(m.cuenta_destino, (saldoPorCuenta.get(m.cuenta_destino) ?? 0) + Number(m.importe));
    }
  }

  const { data: recurrentes } = await supabase.from("recurrentes").select("*").eq("activo", true);
  const { desde, hasta } = rangoDelMes(mes);
  const { data: pagados } = await supabase
    .from("movimientos")
    .select("recurrente_id")
    .not("recurrente_id", "is", null)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const yaPagados = new Set((pagados ?? []).map((m) => m.recurrente_id));

  for (const r of recurrentes ?? []) {
    if (yaPagados.has(r.id)) continue;
    if (mesDe(r.mes_inicio ?? "2000-01-01") > mes) continue;
    if (r.cuenta_origen) {
      saldoPorCuenta.set(r.cuenta_origen, (saldoPorCuenta.get(r.cuenta_origen) ?? 0) - Number(r.importe));
    }
    if (r.cuenta_destino) {
      saldoPorCuenta.set(r.cuenta_destino, (saldoPorCuenta.get(r.cuenta_destino) ?? 0) + Number(r.importe));
    }
  }

  return Math.round([...saldoPorCuenta.values()].reduce((a, b) => a + b, 0) * 100) / 100;
}