"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSupabase, mensajeDeError } from "@/lib/supabase/server";
import { COOKIE_OCULTO, OCULTO_NO, OCULTO_SI } from "@/lib/oculto";
import {
  actualizarMovimiento,
  confirmarFijo,
  crearMovimiento,
  eliminarMovimiento,
} from "@/lib/movimientos";
import {
  categoriaSchema,
  cuentaSchema,
  erroresDeFormulario,
  abonoSchema,
  movimientoSchema,
  prestamoSchema,
  recurrenteSchema,
} from "@/lib/validation";
import { calcularAbono } from "@/lib/prestamos";
import { obtenerEstadoPrestamo } from "@/lib/queries";
import { mesActual, hoyISO } from "@/lib/dates";
import { PALETA } from "@/lib/paleta";

export interface EstadoFormulario {
  ok: boolean;
  mensaje?: string;
  error?: string;
  errores?: Record<string, string>;
  detalle?: string;
}

function aTexto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor : "";
}

function limpiar(base: string) {
  revalidatePath(base);
  revalidatePath("/");
  revalidatePath("/movimientos");
}

/* -------------------------------------------------------------------------- */
/* Movimientos                                                                 */
/* -------------------------------------------------------------------------- */

export async function guardarMovimiento(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseado = movimientoSchema.safeParse({
    id: aTexto(datos.get("id")) || undefined,
    tipo: aTexto(datos.get("tipo")),
    importe: aTexto(datos.get("importe")),
    descripcion: aTexto(datos.get("descripcion")),
    cuenta_origen: aTexto(datos.get("cuenta_origen")) || null,
    cuenta_destino: aTexto(datos.get("cuenta_destino")) || null,
    categoria_id: aTexto(datos.get("categoria_id")) || null,
    fecha: aTexto(datos.get("fecha")),
    notas: aTexto(datos.get("notas")) || null,
  });

  if (!parseado.success) {
    return { ok: false, error: "Revisa los campos marcados.", errores: erroresDeFormulario(parseado.error) };
  }

  const resultado = parseado.data.id
    ? await actualizarMovimiento(parseado.data)
    : await crearMovimiento(parseado.data, "web");

  if (!resultado.ok) return { ok: false, error: resultado.error };

  limpiar("/movimientos");
  return {
    ok: true,
    mensaje: parseado.data.id ? "Movimiento actualizado." : "Movimiento creado.",
  };
}

export async function borrarMovimiento(id: string): Promise<void> {
  await eliminarMovimiento(id);
  limpiar("/movimientos");
}

export async function duplicarMovimiento(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.from("movimientos").select("*").eq("id", id).maybeSingle();
  if (!data) return;

  const original = data as Record<string, unknown>;
  const copia = {
    tipo: original.tipo,
    importe: original.importe,
    descripcion: original.descripcion,
    categoria_id: original.categoria_id,
    cuenta_origen: original.cuenta_origen,
    cuenta_destino: original.cuenta_destino,
    fecha: hoyISO(),
    prestamo_id: original.prestamo_id,
    notas: original.notas,
    origen: "web",
  };
  await supabase.from("movimientos").insert(copia);
  revalidatePath("/movimientos");
}

/* -------------------------------------------------------------------------- */
/* Cuentas                                                                     */
/* -------------------------------------------------------------------------- */

export async function guardarCuenta(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseado = cuentaSchema.safeParse({
    id: aTexto(datos.get("id")) || undefined,
    nombre: aTexto(datos.get("nombre")),
    entidad: aTexto(datos.get("entidad")) || null,
    tipo: aTexto(datos.get("tipo")),
    saldo_inicial: aTexto(datos.get("saldo_inicial")),
    fecha_saldo: aTexto(datos.get("fecha_saldo")) || undefined,
    color: aTexto(datos.get("color")) || PALETA[0],
    activa: datos.get("activa") === "on" || datos.get("activa") === "true",
  });

  if (!parseado.success) {
    return { ok: false, error: "Revisa los campos marcados.", errores: erroresDeFormulario(parseado.error) };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está configurada." };

  const { id, ...campos } = parseado.data;
  if (id) {
    const { error } = await supabase.from("cuentas").update(campos).eq("id", id);
    if (error) return { ok: false, error: mensajeDeError(error) };
    revalidatePath("/cuentas");
    return { ok: true, mensaje: "Cuenta actualizada." };
  }

  const { error } = await supabase.from("cuentas").insert(campos);
  if (error) return { ok: false, error: mensajeDeError(error) };
  revalidatePath("/cuentas");
  return { ok: true, mensaje: "Cuenta creada." };
}

export async function borrarCuenta(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("cuentas").delete().eq("id", id);
revalidatePath("/cuentas");
  revalidatePath("/");
}

/* -------------------------------------------------------------------------- */
/* Mostrar / ocultar el dinero                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Guarda la preferencia del botón del ojo en una cookie.
 *
 *Va en cookie y no en localStorage para que el servidor la lea al pintar: si no,
 * la primera carga de cada página mostraría las cifras un instante antes de
 * taparlas, que es justo lo que no queremos al enseñarle la web a alguien.
 */
export async function guardarOculto(oculto: boolean): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE_OCULTO, oculto ? OCULTO_SI : OCULTO_NO, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // El layout raíz se conserva entre páginas en la navegación del cliente, así
  // que sin esto no se volvería a pintar tras alternar el botón.
  revalidatePath("/", "layout");
}

/* -------------------------------------------------------------------------- */
/* Categorías                                                                  */
/* -------------------------------------------------------------------------- */

export async function guardarCategoria(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseado = categoriaSchema.safeParse({
    id: aTexto(datos.get("id")) || undefined,
    nombre: aTexto(datos.get("nombre")),
    tipo: aTexto(datos.get("tipo")),
    color: aTexto(datos.get("color")) || PALETA[0],
    activa: datos.get("activa") === "on" || datos.get("activa") === "true",
  });

  if (!parseado.success) {
    return { ok: false, error: "Revisa los campos marcados.", errores: erroresDeFormulario(parseado.error) };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está configurada." };

  const { id, ...campos } = parseado.data;
  if (id) {
    const { error } = await supabase.from("categorias").update(campos).eq("id", id);
    if (error) return { ok: false, error: mensajeDeError(error) };
  } else {
    const { error } = await supabase.from("categorias").insert(campos);
    if (error) return { ok: false, error: mensajeDeError(error) };
  }

  revalidatePath("/ajustes");
  revalidatePath("/");
  revalidatePath("/movimientos");
  return { ok: true, mensaje: id ? "Categoría actualizada." : "Categoría creada." };
}

export async function borrarCategoria(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("categorias").delete().eq("id", id);
  revalidatePath("/ajustes");
  revalidatePath("/");
  revalidatePath("/movimientos");
}

/* -------------------------------------------------------------------------- */
/* Pagos fijos                                                                 */
/* -------------------------------------------------------------------------- */

export async function guardarRecurrente(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseado = recurrenteSchema.safeParse({
    id: aTexto(datos.get("id")) || undefined,
    concepto: aTexto(datos.get("concepto")),
    tipo: aTexto(datos.get("tipo")),
    importe: aTexto(datos.get("importe")),
    dia: aTexto(datos.get("dia")),
    mes_inicio: aTexto(datos.get("mes_inicio")) || "2000-01",
    cuenta_origen: aTexto(datos.get("cuenta_origen")) || null,
    cuenta_destino: aTexto(datos.get("cuenta_destino")) || null,
    categoria_id: aTexto(datos.get("categoria_id")) || null,
    activo: datos.get("activo") === "on" || datos.get("activo") === "true",
  });

  if (!parseado.success) {
    return { ok: false, error: "Revisa los campos marcados.", errores: erroresDeFormulario(parseado.error) };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está configurada." };

  const { id, ...campos } = parseado.data;
  const origen = campos.tipo === "ingreso" ? null : (campos.cuenta_origen ?? null);
  const destino = campos.tipo === "gasto" ? null : (campos.cuenta_destino ?? null);
  const limpio = { ...campos, cuenta_origen: origen, cuenta_destino: destino };

  if (id) {
    const { error } = await supabase.from("recurrentes").update(limpio).eq("id", id);
    if (error) return { ok: false, error: mensajeDeError(error) };
  } else {
    const { error } = await supabase.from("recurrentes").insert(limpio);
    if (error) return { ok: false, error: mensajeDeError(error) };
  }

  revalidatePath("/fijos");
  revalidatePath("/");
  return { ok: true, mensaje: id ? "Pago fijo actualizado." : "Pago fijo creado." };
}

export async function borrarRecurrente(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("recurrentes").delete().eq("id", id);
  revalidatePath("/fijos");
  revalidatePath("/");
}

export async function alternarRecurrente(id: string, activo: boolean): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("recurrentes").update({ activo }).eq("id", id);
  revalidatePath("/fijos");
  revalidatePath("/");
}

export async function confirmarPagoFijo(recurrenteId: string, mes?: string): Promise<void> {
  await confirmarFijo(recurrenteId, mes ?? mesActual());
  revalidatePath("/fijos");
  revalidatePath("/");
  revalidatePath("/movimientos");
}

export async function deshacerPagoFijo(movimientoId: string): Promise<void> {
  await eliminarMovimiento(movimientoId);
  revalidatePath("/fijos");
  revalidatePath("/");
  revalidatePath("/movimientos");
}

/* -------------------------------------------------------------------------- */
/* Préstamos                                                                   */
/* -------------------------------------------------------------------------- */

export async function guardarPrestamo(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseado = prestamoSchema.safeParse({
    id: aTexto(datos.get("id")) || undefined,
    nombre: aTexto(datos.get("nombre")),
    capital_inicial: aTexto(datos.get("capital_inicial")),
    cuota: aTexto(datos.get("cuota")),
    fecha_inicio: aTexto(datos.get("fecha_inicio")),
    interes_anual: aTexto(datos.get("interes_anual")),
    interes_modo: aTexto(datos.get("interes_modo")) || null,
    numero_cuotas: aTexto(datos.get("numero_cuotas")),
    saldo_referencia: aTexto(datos.get("saldo_referencia")),
    fecha_referencia: aTexto(datos.get("fecha_referencia")) || null,
    cuenta_origen: aTexto(datos.get("cuenta_origen")) || null,
    categoria_id: aTexto(datos.get("categoria_id")) || null,
    notas: aTexto(datos.get("notas")) || null,
  });

  if (!parseado.success) {
    return { ok: false, error: "Revisa los campos marcados.", errores: erroresDeFormulario(parseado.error) };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está configurada." };

  const { id, ...resto } = parseado.data;
  // El capital pendiente ya no se edita a mano: se deriva de los pagos. En una
  // alta nueva arranca en el capital inicial, y `capital_pendiente` solo se
  // escribe para que la columna no quede anticuada si alguien la mira por SQL.
  const campos = { ...resto, capital_pendiente: Number(resto.capital_inicial) };
  if (id) {
    const { error } = await supabase.from("prestamos").update(campos).eq("id", id);
    if (error) return { ok: false, error: mensajeDeError(error) };
  } else {
    const { error } = await supabase.from("prestamos").insert(campos);
    if (error) return { ok: false, error: mensajeDeError(error) };
  }

  revalidatePath("/prestamos");
  return { ok: true, mensaje: id ? "Préstamo actualizado." : "Préstamo creado." };
}

/**
 * Registra un abono: pago por delante del préstamo con dinero ahorrado.
 *
 * Hace tres cosas en la misma operación lógica:
 *   1. crea el pago en `pagos_prestamo`
 *   2. crea el movimiento de gasto, para que el saldo de la cuenta baje
 *   3. en modo `reducir_cuota`, recalcula la cuota mensual (y el pago fijo asociado)
 *
 * El capital pendiente no se toca: se deriva de los pagos, así que el abono
 * cuenta solo en cuanto existe su fila.
 */
export async function registrarAbonoPrestamo(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario & { detalle?: string }> {
  const parseado = abonoSchema.safeParse({
    prestamo_id: aTexto(datos.get("prestamo_id")),
    importe: aTexto(datos.get("importe")),
    fecha: aTexto(datos.get("fecha")),
    modo: aTexto(datos.get("modo")) || "reducir_plazo",
    cuenta_id: aTexto(datos.get("cuenta_id")) || null,
    notas: aTexto(datos.get("notas")) || null,
    actualizar_fijo: datos.get("actualizar_fijo") === "on" || datos.get("actualizar_fijo") === "true",
  });

  if (!parseado.success) {
    return {
      ok: false,
      error: "Revisa los campos marcados.",
      errores: erroresDeFormulario(parseado.error),
    };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está configurada." };

  const { prestamo_id, importe, fecha, modo, cuenta_id, notas, actualizar_fijo } = parseado.data;

  const { data: prestamo, error: errorPrestamo } = await supabase
    .from("prestamos")
    .select("*")
    .eq("id", prestamo_id)
    .maybeSingle();

  if (errorPrestamo) return { ok: false, error: mensajeDeError(errorPrestamo) };
  if (!prestamo) return { ok: false, error: "El préstamo no existe." };

  const estado = await obtenerEstadoPrestamo(prestamo_id);
  if (!estado) return { ok: false, error: "El préstamo no existe." };

  const simulacion = calcularAbono(
    {
      capitalPendiente: estado.capitalPendiente,
      cuota: Number(prestamo.cuota),
      tasa: prestamo.interes_anual,
      modoTasa: prestamo.interes_modo,
    },
    importe,
    modo,
  );

  if (simulacion.importe <= 0) {
    return { ok: false, error: "El importe del abono debe ser mayor que 0." };
  }
  if (importe > simulacion.capitalAntes) {
    return {
      ok: false,
      error: `El abono (${importe} €) supera el capital pendiente (${simulacion.capitalAntes} €).`,
    };
  }

  const cuotaAnterior = Number(prestamo.cuota);
  let movimientoId: string | null = null;

  // 1) El pago del abono.
  const { data: pago, error: errorPago } = await supabase
    .from("pagos_prestamo")
    .insert({
      prestamo_id,
      fecha,
      importe: simulacion.importe,
      modo,
      cuenta_id,
      cuota_resultante: simulacion.cuotaDespues,
      cuota_previa: cuotaAnterior,
      notas,
    })
    .select("id")
    .single();

  if (errorPago) return { ok: false, error: mensajeDeError(errorPago) };
  if (!pago) return { ok: false, error: "No se ha podido registrar el abono." };

  /** Da atrás el abono entero: el pago, su movimiento y la cuota que tocó. */
  const deshacer = async () => {
    if (movimientoId) await supabase.from("movimientos").delete().eq("id", movimientoId);
    await supabase.from("pagos_prestamo").delete().eq("id", pago.id);
    await supabase.from("prestamos").update({ cuota: cuotaAnterior }).eq("id", prestamo_id);
  };

  // 2) El movimiento de gasto, para que el dinero salga de la cuenta.
  if (cuenta_id) {
    const { data: movimiento, error: errorMovimiento } = await supabase
      .from("movimientos")
      .insert({
        tipo: "gasto",
        importe: simulacion.importe,
        descripcion: `Abono ${prestamo.nombre}`,
        categoria_id: prestamo.categoria_id,
        cuenta_origen: cuenta_id,
        cuenta_destino: null,
        fecha,
        prestamo_id,
        pago_prestamo_id: pago.id,
        notas: notas ?? (modo === "reducir_plazo" ? "Abono para quitar cuotas" : "Abono para bajar la cuota"),
        origen: "web",
      })
      .select("id")
      .single();

    if (errorMovimiento) {
      // No dejamos el pago huérfano si falla el movimiento.
      await deshacer();
      return { ok: false, error: mensajeDeError(errorMovimiento) };
    }
    movimientoId = movimiento.id;
    await supabase.from("pagos_prestamo").update({ movimiento_id: movimientoId }).eq("id", pago.id);
  }

  // 3) La cuota recalculada, si el modo es bajar cuota.
  if (modo === "reducir_cuota") {
    const { error: errorUpdate } = await supabase
      .from("prestamos")
      .update({ cuota: simulacion.cuotaDespues })
      .eq("id", prestamo_id);

    if (errorUpdate) {
      await deshacer();
      return { ok: false, error: mensajeDeError(errorUpdate) };
    }

    if (actualizar_fijo) {
      await supabase
        .from("recurrentes")
        .update({ importe: simulacion.cuotaDespues })
        .eq("prestamo_id", prestamo_id);
    }
  }

  revalidatePath("/prestamos");
  revalidatePath("/");
  revalidatePath("/fijos");
  revalidatePath("/movimientos");

  const interes = simulacion.interesAhorradoEstimado
    ? ` Te ahorras unos ${simulacion.interesAhorradoEstimado} € de intereses.`
    : "";
  const detalle =
    modo === "reducir_plazo"
      ? `Abono de ${simulacion.importe} €. Quitas ${simulacion.cuotasAhorradas} cuota(s): quedan ${simulacion.cuotasRestantesDespues} y la cuota sigue en ${simulacion.cuotaAntes} €.${interes}`
      : `Abono de ${simulacion.importe} €. La cuota baja de ${simulacion.cuotaAntes} € a ${simulacion.cuotaDespues} € y quedan ${simulacion.cuotasRestantesDespues} cuotas.`;

  return { ok: true, mensaje: "Abono registrado.", detalle };
}

export async function borrarAbonoPrestamo(pagoId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: pago } = await supabase
    .from("pagos_prestamo")
    .select("*")
    .eq("id", pagoId)
    .maybeSingle();
  if (!pago) return;

  // El abono se revierte: el movimiento desaparece y el capital vuelve solo al
  // derivarse de los pagos. La cuota sí se guardaba, así que se restituye.
  if (pago.movimiento_id) await supabase.from("movimientos").delete().eq("id", pago.movimiento_id);
  await supabase.from("pagos_prestamo").delete().eq("id", pagoId);

  if (pago.cuota_previa) {
    await supabase
      .from("prestamos")
      .update({ cuota: Number(pago.cuota_previa) })
      .eq("id", pago.prestamo_id);
    await supabase
      .from("recurrentes")
      .update({ importe: Number(pago.cuota_previa) })
      .eq("prestamo_id", pago.prestamo_id);
  }

  revalidatePath("/prestamos");
  revalidatePath("/");
  revalidatePath("/fijos");
  revalidatePath("/movimientos");
}

/**
 * Confirma la cuota del mes del préstamo. El capital pendiente no se toca aquí:
 * se deriva del movimiento que crea `confirmarFijo`.
 * Es idempotente por mes gracias al índice único de la base de datos.
 */
export async function pagarCuotaPrestamo(prestamoId: string, mes?: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: recurrente } = await supabase
    .from("recurrentes")
    .select("id")
    .eq("prestamo_id", prestamoId)
    .maybeSingle();
  if (!recurrente) return;

  const resultado = await confirmarFijo(recurrente.id, mes ?? mesActual());
  if (!resultado.ok) return;

  revalidatePath("/prestamos");
  revalidatePath("/");
  revalidatePath("/movimientos");
}

export async function borrarPrestamo(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("prestamos").delete().eq("id", id);
  revalidatePath("/prestamos");
  revalidatePath("/");
}

/* -------------------------------------------------------------------------- */
/* Saldo manual (ajuste rápido)                                                */
/* -------------------------------------------------------------------------- */

export async function ajustarSaldoCuenta(cuentaId: string, nuevoSaldo: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !Number.isFinite(nuevoSaldo)) return;

  const { data: movimientos } = await supabase
    .from("movimientos")
    .select("tipo, importe, cuenta_origen, cuenta_destino")
    .or(`cuenta_origen.eq.${cuentaId},cuenta_destino.eq.${cuentaId}`);

  let delta = 0;
  for (const m of movimientos ?? []) {
    if (m.tipo === "gasto") delta -= Number(m.importe);
    else if (m.tipo === "ingreso") delta += Number(m.importe);
    else {
      if (m.cuenta_origen === cuentaId) delta -= Number(m.importe);
      if (m.cuenta_destino === cuentaId) delta += Number(m.importe);
    }
  }

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("saldo_inicial")
    .eq("id", cuentaId)
    .maybeSingle();
  if (!cuenta) return;

  const inicial = Math.round((nuevoSaldo - delta) * 100) / 100;
  await supabase
    .from("cuentas")
    .update({ saldo_inicial: inicial, fecha_saldo: new Date().toISOString().slice(0, 10) })
    .eq("id", cuentaId);

  revalidatePath("/cuentas");
  revalidatePath("/");
}