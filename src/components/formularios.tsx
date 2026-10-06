"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  guardarMovimiento,
  guardarCuenta,
  guardarCategoria,
  guardarRecurrente,
  guardarPrestamo,
  registrarAbonoPrestamo,
  type EstadoFormulario,
} from "@/app/actions";
import { calcularAbono, cuotaDe } from "@/lib/prestamos";
import { parseImporte, formatearEur } from "@/lib/money";
import { hoyISO } from "@/lib/dates";
import type {
  Categoria,
  Cuenta,
  ModoAbono,
  ModoTasa,
  MovimientoConDetalle,
  Prestamo,
  Recurrente,
  TipoMovimiento,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Campos base                                                                 */
/* -------------------------------------------------------------------------- */

const CLASE_CAMPO =
  "w-full rounded-xl border border-borde bg-tarjeta px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

function Envolvente({
  etiqueta,
  error,
  ayuda,
  children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold tracking-wide text-suave uppercase">{etiqueta}</span>
      {children}
      {ayuda ? <span className="block text-xs text-suave">{ayuda}</span> : null}
      {error ? <span className="block text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}

function Botones({ volver, pendiente }: { volver: string; pendiente: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        type="submit"
        disabled={pendiente}
        className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
      <Link
        href={volver}
        className="rounded-xl border border-borde px-4 py-3 text-sm font-semibold text-suave"
      >
        Cancelar
      </Link>
    </div>
  );
}

function Resultado({ estado }: { estado: EstadoFormulario }) {
  if (!estado.ok && !estado.error) return null;
  return (
    <p
      className={`rounded-xl border px-3 py-2 text-sm ${
        estado.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100"
      }`}
    >
      {estado.ok ? estado.mensaje : estado.error}
    </p>
  );
}

const CAMPOS_POR_TIPO: Record<string, readonly string[]> = {
  gasto: ["cuenta_origen", "categoria_id"],
  ingreso: ["cuenta_destino", "categoria_id"],
  traspaso: ["cuenta_origen", "cuenta_destino"],
};

/* -------------------------------------------------------------------------- */
/* Movimiento                                                                  */
/* -------------------------------------------------------------------------- */

export function FormularioMovimiento({
  cuentas,
  categorias,
  movimiento,
}: {
  cuentas: Cuenta[];
  categorias: Categoria[];
  movimiento?: MovimientoConDetalle;
}) {
  const [estado, accion, pendiente] = useActionState(guardarMovimiento, { ok: false });
  const [tipo, setTipo] = useState<"gasto" | "ingreso" | "traspaso">(movimiento?.tipo ?? "gasto");
  const visibles = CAMPOS_POR_TIPO[tipo];
  const mostrar = (campo: string) => visibles.includes(campo);

  return (
    <form action={accion} className="space-y-3">
      {movimiento ? <input type="hidden" name="id" value={movimiento.id} /> : null}

      <Envolvente etiqueta="Tipo">
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
          className={CLASE_CAMPO}
        >
          <option value="gasto">Gasto (sale dinero)</option>
          <option value="ingreso">Ingreso (entra dinero)</option>
          <option value="traspaso">Traspaso entre cuentas</option>
        </select>
      </Envolvente>

      <div className="grid grid-cols-2 gap-3">
        <Envolvente etiqueta="Importe (€)" error={estado.errores?.importe}>
          <input
            name="importe"
            type="text"
            inputMode="decimal"
            defaultValue={movimiento ? String(movimiento.importe).replace(".", ",") : ""}
            placeholder="12,50"
            className={CLASE_CAMPO}
            required
          />
        </Envolvente>
        <Envolvente etiqueta="Fecha" error={estado.errores?.fecha}>
          <input
            name="fecha"
            type="date"
            defaultValue={movimiento?.fecha ?? new Date().toISOString().slice(0, 10)}
            className={CLASE_CAMPO}
            required
          />
        </Envolvente>
      </div>

      <Envolvente etiqueta="Concepto" error={estado.errores?.descripcion}>
        <input
          name="descripcion"
          type="text"
          defaultValue={movimiento?.descripcion ?? ""}
          placeholder="Compra en el súper"
          className={CLASE_CAMPO}
          required
        />
      </Envolvente>

      {mostrar("cuenta_origen") ? (
        <Envolvente etiqueta="Cuenta de origen" error={estado.errores?.cuenta_origen}>
          <select
            name="cuenta_origen"
            defaultValue={movimiento?.cuenta_origen ?? cuentas[0]?.id ?? ""}
            className={CLASE_CAMPO}
          >
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Envolvente>
      ) : (
        <input type="hidden" name="cuenta_origen" value="" />
      )}

      {mostrar("cuenta_destino") ? (
        <Envolvente etiqueta="Cuenta de destino" error={estado.errores?.cuenta_destino}>
          <select
            name="cuenta_destino"
            defaultValue={movimiento?.cuenta_destino ?? cuentas[0]?.id ?? ""}
            className={CLASE_CAMPO}
          >
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Envolvente>
      ) : (
        <input type="hidden" name="cuenta_destino" value="" />
      )}

      {mostrar("categoria_id") ? (
        <Envolvente etiqueta="Categoría" error={estado.errores?.categoria_id}>
          <select
            name="categoria_id"
            defaultValue={movimiento?.categoria_id ?? ""}
            className={CLASE_CAMPO}
          >
            <option value="">Sin categoría</option>
            {categorias
              .filter((c) => c.tipo === (tipo === "ingreso" ? "ingreso" : "gasto"))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </select>
        </Envolvente>
      ) : (
        <input type="hidden" name="categoria_id" value="" />
      )}

      <Envolvente etiqueta="Notas" error={estado.errores?.notas}>
        <textarea
          name="notas"
          defaultValue={movimiento?.notas ?? ""}
          rows={2}
          className={`${CLASE_CAMPO} resize-none`}
        />
      </Envolvente>

      <Resultado estado={estado} />
      <Botones volver="/movimientos" pendiente={pendiente} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Cuenta                                                                      */
/* -------------------------------------------------------------------------- */

export function FormularioCuenta({ cuenta }: { cuenta?: Cuenta }) {
  const [estado, accion, pendiente] = useActionState(guardarCuenta, { ok: false });

  return (
    <form action={accion} className="space-y-3">
      {cuenta ? <input type="hidden" name="id" value={cuenta.id} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <Envolvente etiqueta="Nombre" error={estado.errores?.nombre}>
          <input
            name="nombre"
            type="text"
            defaultValue={cuenta?.nombre ?? ""}
            placeholder="Mi cuenta"
            className={CLASE_CAMPO}
            required
          />
        </Envolvente>
        <Envolvente etiqueta="Entidad" error={estado.errores?.entidad}>
          <input
            name="entidad"
            type="text"
            defaultValue={cuenta?.entidad ?? ""}
            placeholder="Mi banco"
            className={CLASE_CAMPO}
          />
        </Envolvente>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Envolvente etiqueta="Tipo" error={estado.errores?.tipo}>
          <select name="tipo" defaultValue={cuenta?.tipo ?? "corriente"} className={CLASE_CAMPO}>
            <option value="corriente">Corriente</option>
            <option value="ahorro">Ahorro</option>
            <option value="inversion">Inversión</option>
            <option value="efectivo">Efectivo</option>
          </select>
        </Envolvente>
        <Envolvente etiqueta="Color" error={estado.errores?.color}>
          <input
            name="color"
            type="color"
            defaultValue={cuenta?.color ?? "#2563eb"}
            className="h-11 w-full rounded-xl border border-borde bg-tarjeta px-2"
          />
        </Envolvente>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Envolvente etiqueta="Saldo inicial (€)" error={estado.errores?.saldo_inicial}>
          <input
            name="saldo_inicial"
            type="text"
            inputMode="decimal"
            defaultValue={
              cuenta ? String(cuenta.saldo_inicial).replace(".", ",") : ""
            }
            className={CLASE_CAMPO}
          />
        </Envolvente>
        <Envolvente etiqueta="Fecha del saldo" error={estado.errores?.fecha_saldo}>
          <input
            name="fecha_saldo"
            type="date"
            defaultValue={cuenta?.fecha_saldo ?? new Date().toISOString().slice(0, 10)}
            className={CLASE_CAMPO}
          />
        </Envolvente>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="activa"
          defaultChecked={cuenta?.activa ?? true}
          className="size-4 accent-blue-600"
        />
        Cuenta activa
      </label>

      <Resultado estado={estado} />
      <Botones volver="/cuentas" pendiente={pendiente} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Categoría                                                                   */
/* -------------------------------------------------------------------------- */

export function FormularioCategoria({ categoria }: { categoria?: Categoria }) {
  const [estado, accion, pendiente] = useActionState(guardarCategoria, { ok: false });

  return (
    <form action={accion} className="space-y-3">
      {categoria ? <input type="hidden" name="id" value={categoria.id} /> : null}

      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Envolvente etiqueta="Nombre" error={estado.errores?.nombre}>
          <input
            name="nombre"
            type="text"
            defaultValue={categoria?.nombre ?? ""}
            className={CLASE_CAMPO}
            required
          />
        </Envolvente>
        <Envolvente etiqueta="Color" error={estado.errores?.color}>
          <input
            name="color"
            type="color"
            defaultValue={categoria?.color ?? "#16a34a"}
            className="h-11 w-full rounded-xl border border-borde bg-tarjeta px-2"
          />
        </Envolvente>
      </div>

      <Envolvente etiqueta="Tipo" error={estado.errores?.tipo}>
        <select name="tipo" defaultValue={categoria?.tipo ?? "gasto"} className={CLASE_CAMPO}>
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
      </Envolvente>

      <Resultado estado={estado} />
      <Botones volver="/ajustes" pendiente={pendiente} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Pago fijo                                                                   */
/* -------------------------------------------------------------------------- */

export function FormularioRecurrente({
  recurrente,
  cuentas,
  categorias,
}: {
  recurrente?: Recurrente;
  cuentas: Cuenta[];
  categorias: Categoria[];
}) {
  const [estado, accion, pendiente] = useActionState(guardarRecurrente, { ok: false });
  const [tipo, setTipo] = useState<TipoMovimiento>(recurrente?.tipo ?? "gasto");

  const cuentaOrigen = tipo === "ingreso" ? null : (recurrente?.cuenta_origen ?? cuentas[0]?.id ?? "");
  const cuentaDestino =
    tipo === "gasto" ? null : (recurrente?.cuenta_destino ?? cuentas[1]?.id ?? cuentas[0]?.id ?? "");
  const catTipo = tipo === "ingreso" ? "ingreso" : "gasto";

  return (
    <form action={accion} className="space-y-3">
      {recurrente ? <input type="hidden" name="id" value={recurrente.id} /> : null}

      <Envolvente etiqueta="Tipo">
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoMovimiento)}
          className={CLASE_CAMPO}
        >
          <option value="gasto">Gasto fijo (sale dinero)</option>
          <option value="ingreso">Ingreso fijo (entra dinero, p. ej. nómina)</option>
          <option value="traspaso">Traspaso fijo entre cuentas</option>
        </select>
      </Envolvente>

      <Envolvente etiqueta="Concepto" error={estado.errores?.concepto}>
        <input
          name="concepto"
          type="text"
          defaultValue={recurrente?.concepto ?? ""}
          placeholder="Nómina"
          className={CLASE_CAMPO}
          required
        />
      </Envolvente>

      <div className="grid grid-cols-2 gap-3">
        <Envolvente etiqueta="Importe (€)" error={estado.errores?.importe}>
          <input
            name="importe"
            type="text"
            inputMode="decimal"
            defaultValue={recurrente ? String(recurrente.importe).replace(".", ",") : ""}
            placeholder="2000,00"
            className={CLASE_CAMPO}
            required
          />
        </Envolvente>
        <Envolvente etiqueta="Día de cobro" error={estado.errores?.dia}>
          <input
            name="dia"
            type="number"
            min={1}
            max={31}
            defaultValue={recurrente?.dia ?? 1}
            className={CLASE_CAMPO}
            required
          />
        </Envolvente>
      </div>

      <Envolvente
        etiqueta="Empezar a aplicarse en"
        error={estado.errores?.mes_inicio}
        ayuda="No se propondrá en meses anteriores a este."
      >
        <input
          name="mes_inicio"
          type="month"
          defaultValue={recurrente ? recurrente.mes_inicio.slice(0, 7) : "2000-01"}
          className={CLASE_CAMPO}
        />
      </Envolvente>

      {tipo === "ingreso" ? (
        <input type="hidden" name="cuenta_origen" value="" />
      ) : (
        <Envolvente etiqueta="Cuenta de origen" error={estado.errores?.cuenta_origen}>
          <select name="cuenta_origen" defaultValue={cuentaOrigen ?? ""} className={CLASE_CAMPO}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Envolvente>
      )}

      {tipo === "gasto" ? (
        <input type="hidden" name="cuenta_destino" value="" />
      ) : (
        <Envolvente
          etiqueta={tipo === "ingreso" ? "Cuenta donde entra" : "Cuenta de destino"}
          error={estado.errores?.cuenta_destino}
        >
          <select name="cuenta_destino" defaultValue={cuentaDestino ?? ""} className={CLASE_CAMPO}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Envolvente>
      )}

      <Envolvente etiqueta="Categoría" error={estado.errores?.categoria_id}>
        <select
          name="categoria_id"
          defaultValue={recurrente?.categoria_id ?? ""}
          className={CLASE_CAMPO}
        >
          <option value="">Sin categoría</option>
          {categorias
            .filter((c) => c.tipo === catTipo)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
        </select>
      </Envolvente>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={recurrente?.activo ?? true}
          className="size-4 accent-blue-600"
        />
        Activo (aparece en el panel de pagos del mes)
      </label>

      <Resultado estado={estado} />
      <Botones volver="/fijos" pendiente={pendiente} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Abono (pago por delante del préstamo)                                      */
/* -------------------------------------------------------------------------- */

export function FormularioAbono({
  prestamo,
  cuentas,
  capitalPendiente,
}: {
  prestamo: Prestamo;
  cuentas: Cuenta[];
  /** Capital pendiente ya derivado de los pagos, no el de la ficha. */
  capitalPendiente: number;
}) {
  const [estado, accion, pendiente] = useActionState(registrarAbonoPrestamo, { ok: false });
  const [importe, setImporte] = useState("");
  const [modo, setModo] = useState<ModoAbono>("reducir_plazo");
  const [actualizarFijo, setActualizarFijo] = useState(true);

  const numero = parseImporte(importe) ?? 0;
  const simulacion = calcularAbono(
    {
      capitalPendiente,
      cuota: Number(prestamo.cuota),
      tasa: prestamo.interes_anual,
      modoTasa: prestamo.interes_modo,
    },
    numero,
    modo,
  );
  const haySimulacion = numero > 0 && numero <= capitalPendiente;
  const sePasa = numero > capitalPendiente;

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="prestamo_id" value={prestamo.id} />
      <input type="hidden" name="modo" value={modo} />
      <input
        type="hidden"
        name="actualizar_fijo"
        value={actualizarFijo && modo === "reducir_cuota" ? "true" : "false"}
      />

      <div className="rounded-xl border border-borde bg-slate-50 p-3 text-xs dark:bg-slate-900/40">
        Capital pendiente actual:{" "}
        <strong className="tabular-nums">{formatearEur(capitalPendiente)}</strong> · cuota{" "}
        <span className="tabular-nums">{formatearEur(prestamo.cuota)}</span>/mes
        {prestamo.interes_anual
          ? ` · ${prestamo.interes_modo === "tae" ? "TAE" : "TAN"} ${String(prestamo.interes_anual).replace(".", ",")} %`
          : ""}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Envolvente etiqueta="Importe del abono (€)" error={estado.errores?.importe}>
          <input
            name="importe"
            type="text"
            inputMode="decimal"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="500,00"
            className={CLASE_CAMPO}
            required
          />
        </Envolvente>
        <Envolvente etiqueta="Fecha" error={estado.errores?.fecha}>
          <input
            name="fecha"
            type="date"
            defaultValue={hoyISO()}
            max={hoyISO()}
            className={CLASE_CAMPO}
            required
          />
        </Envolvente>
      </div>

      {sePasa ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          El abono no puede superar el capital pendiente (
          <span className="tabular-nums">{formatearEur(capitalPendiente)}</span>).
        </p>
      ) : null}

      <div className="space-y-1.5">
        <span className="text-xs font-semibold tracking-wide text-suave uppercase">
          ¿Qué quieres conseguir?
        </span>
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${
            modo === "reducir_plazo"
              ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
              : "border-borde"
          }`}
        >
          <input
            type="radio"
            name="modo_ui"
            value="reducir_plazo"
            checked={modo === "reducir_plazo"}
            onChange={() => setModo("reducir_plazo")}
            className="mt-0.5 size-4 accent-blue-600"
          />
          <span>
            <span className="block text-sm font-semibold">Quitarme cuotas</span>
            <span className="block text-xs text-suave">
              La cuota sigue igual, pero terminas antes.
            </span>
          </span>
        </label>
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${
            modo === "reducir_cuota"
              ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
              : "border-borde"
          }`}
        >
          <input
            type="radio"
            name="modo_ui"
            value="reducir_cuota"
            checked={modo === "reducir_cuota"}
            onChange={() => setModo("reducir_cuota")}
            className="mt-0.5 size-4 accent-blue-600"
          />
          <span>
            <span className="block text-sm font-semibold">Bajarme la cuota</span>
            <span className="block text-xs text-suave">
              Pagas lo mismo de plazo, pero cada mes es más barata.
            </span>
          </span>
        </label>
      </div>

      {haySimulacion ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="font-semibold">Así queda el préstamo</p>
          <ul className="mt-1.5 space-y-1 text-xs">
            <li className="flex justify-between gap-2">
              <span className="text-suave">Capital pendiente</span>
              <span>
                <span className="tabular-nums">{formatearEur(simulacion.capitalAntes)}</span> →{" "}
                <strong className="tabular-nums">
                  {formatearEur(simulacion.capitalDespues)}
                </strong>
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-suave">Cuota mensual</span>
              <span>
                <span className="tabular-nums">{formatearEur(simulacion.cuotaAntes)}</span>
                {simulacion.cuotaDespues !== simulacion.cuotaAntes ? (
                  <>
                    {" → "}
                    <strong className="tabular-nums">
                      {formatearEur(simulacion.cuotaDespues)}
                    </strong>
                  </>
                ) : null}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-suave">Cuotas que quedan</span>
              <span>
                {simulacion.cuotasRestantesAntes} →{" "}
                <strong>{simulacion.cuotasRestantesDespues}</strong>
              </span>
            </li>
            {simulacion.cuotasAhorradas > 0 ? (
              <>
                <li className="flex justify-between gap-2 font-semibold">
                  <span>Te ahorras</span>
                  <span className="text-emerald-700 dark:text-emerald-300">
                    {simulacion.cuotasAhorradas} cuota
                    {simulacion.cuotasAhorradas === 1 ? "" : "s"} (
                    <span className="tabular-nums">
                      {formatearEur(simulacion.cuotasAhorradas * simulacion.cuotaAntes)}
                    </span>
                    )
                  </span>
                </li>
                {simulacion.interesAhorradoEstimado > 0 ? (
                  <li className="flex justify-between gap-2 text-emerald-700 dark:text-emerald-300">
                    <span>de los cuales, intereses</span>
                    <span className="tabular-nums">
                      {formatearEur(simulacion.interesAhorradoEstimado)}
                    </span>
                  </li>
                ) : null}
              </>
            ) : null}
          </ul>
          {simulacion.aviso ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{simulacion.aviso}</p>
          ) : null}
        </div>
      ) : null}

      <Envolvente
        etiqueta="Cuenta de la que sale el dinero"
        error={estado.errores?.cuenta_id}
        ayuda="Se registra como un gasto en esa cuenta, para que el saldo baje."
      >
        <select name="cuenta_id" className={CLASE_CAMPO} defaultValue="">
          <option value="">No mover dinero de ninguna cuenta</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </Envolvente>

      {modo === "reducir_cuota" ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={actualizarFijo}
            onChange={(e) => setActualizarFijo(e.target.checked)}
            className="mt-0.5 size-4 accent-blue-600"
          />
          <span>
            Actualizar también el pago fijo mensual
            <span className="block text-xs text-suave">
              Para que el mes que viene la app cobre{" "}
              <span className="tabular-nums">{formatearEur(simulacion.cuotaDespues)}</span> en vez
              de <span className="tabular-nums">{formatearEur(simulacion.cuotaAntes)}</span>.
            </span>
          </span>
        </label>
      ) : null}

      <Envolvente etiqueta="Notas" error={estado.errores?.notas}>
        <textarea
          name="notas"
          rows={2}
          placeholder="Ahorro de las vacaciones"
          className={`${CLASE_CAMPO} resize-none`}
        />
      </Envolvente>

      {estado.ok ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {estado.detalle ?? estado.mensaje}
        </p>
      ) : (
        <Resultado estado={estado} />
      )}

      <Botones volver="/prestamos" pendiente={pendiente} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Préstamo                                                                    */
/* -------------------------------------------------------------------------- */

export function FormularioPrestamo({
  prestamo,
  cuentas,
  categorias,
}: {
  prestamo?: Prestamo;
  cuentas: Cuenta[];
  categorias: Categoria[];
}) {
  const [estado, accion, pendiente] = useActionState(guardarPrestamo, { ok: false });
  const numero = (valor: number | null) => (valor === null ? "" : String(valor).replace(".", ","));

  const [capital, setCapital] = useState(numero(prestamo?.capital_inicial ?? null));
  const [cuota, setCuota] = useState(numero(prestamo?.cuota ?? null));
  const [modoTasa, setModoTasa] = useState<ModoTasa>(prestamo?.interes_modo ?? "tan");
  const [tasa, setTasa] = useState(numero(prestamo?.interes_anual ?? null));
  const [cuotas, setCuotas] = useState(numero(prestamo?.numero_cuotas ?? null));

  // Con capital, tipo y número de cuotas se puede ver la cuota que saldría, que
  // es la forma rápida de comprobar que el tipo de interés está bien apuntado.
  const cuotaPrevista = cuotaDe(
    parseImporte(capital) ?? 0,
    Math.floor(parseImporte(cuotas) ?? 0),
    parseImporte(tasa) ?? 0,
    modoTasa,
  );
  const cuotaActual = parseImporte(cuota);
  const cuotaDistinta =
    cuotaPrevista > 0 && cuotaActual !== null && Math.abs(cuotaPrevista - cuotaActual) > 0.02;

  return (
    <form action={accion} className="space-y-3">
      {prestamo ? <input type="hidden" name="id" value={prestamo.id} /> : null}

      <Envolvente etiqueta="Nombre" error={estado.errores?.nombre}>
        <input
          name="nombre"
          type="text"
          defaultValue={prestamo?.nombre ?? ""}
          placeholder="Préstamo coche"
          className={CLASE_CAMPO}
          required
        />
      </Envolvente>

      <Envolvente
        etiqueta="Capital inicial (€)"
        error={estado.errores?.capital_inicial}
        ayuda="Lo que te prestó el banco, sin intereses."
      >
        <input
          name="capital_inicial"
          type="text"
          inputMode="decimal"
          value={capital}
          onChange={(e) => setCapital(e.target.value)}
          className={CLASE_CAMPO}
        />
      </Envolvente>

      <div className="grid grid-cols-2 gap-3">
        <Envolvente etiqueta="Cuota mensual (€)" error={estado.errores?.cuota}>
          <input
            name="cuota"
            type="text"
            inputMode="decimal"
            value={cuota}
            onChange={(e) => setCuota(e.target.value)}
            className={CLASE_CAMPO}
            required
          />
        </Envolvente>
        <Envolvente
          etiqueta="Nº de cuotas"
          error={estado.errores?.numero_cuotas}
          ayuda={
            cuotaDistinta ? (
              <>
                Con estos datos serían{" "}
                <span className="tabular-nums">{formatearEur(cuotaPrevista)}</span> al mes.
              </>
            ) : undefined
          }
        >
          <input
            name="numero_cuotas"
            type="text"
            inputMode="numeric"
            value={cuotas}
            onChange={(e) => setCuotas(e.target.value)}
            placeholder="80"
            className={CLASE_CAMPO}
          />
        </Envolvente>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Envolvente
          etiqueta="Tipo de interés"
          error={estado.errores?.interes_modo}
          ayuda="El banco suele dar dos: mira cuál de los dos te aparece en el contrato."
        >
          <select
            name="interes_modo"
            value={modoTasa}
            onChange={(e) => setModoTasa(e.target.value as ModoTasa)}
            className={CLASE_CAMPO}
          >
            <option value="tan">TAN · nominal</option>
            <option value="tae">TAE · efectiva</option>
          </select>
        </Envolvente>
        <Envolvente
          etiqueta="Interés anual (%)"
          error={estado.errores?.interes_anual}
          ayuda="Vacío = sin intereses."
        >
          <input
            name="interes_anual"
            type="text"
            inputMode="decimal"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
            placeholder="6"
            className={CLASE_CAMPO}
          />
        </Envolvente>
      </div>

      <Envolvente etiqueta="Fecha de firma" error={estado.errores?.fecha_inicio}>
        <input
          name="fecha_inicio"
          type="date"
          defaultValue={prestamo?.fecha_inicio ?? new Date().toISOString().slice(0, 10)}
          className={CLASE_CAMPO}
          required
        />
      </Envolvente>

      <fieldset className="space-y-2 rounded-xl border border-borde p-3">
        <legend className="px-1 text-xs font-semibold tracking-wide text-suave uppercase">
          Cuadrar con el banco
        </legend>
        <p className="text-xs text-suave">
          Si el préstamo es más antiguo que la app, no hace falta meter todas sus cuotas: apunta
          aquí lo que te queda hoy y la app continúa sola desde ese número exacto.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Envolvente
            etiqueta="Capital que te dice el banco (€)"
            error={estado.errores?.saldo_referencia}
          >
            <input
              name="saldo_referencia"
              type="text"
              inputMode="decimal"
              defaultValue={numero(prestamo?.saldo_referencia ?? null)}
              className={CLASE_CAMPO}
            />
          </Envolvente>
          <Envolvente
            etiqueta="Fecha de esa cifra"
            error={estado.errores?.fecha_referencia}
            ayuda="Los pagos anteriores a esta fecha se ignoran."
          >
            <input
              name="fecha_referencia"
              type="date"
              defaultValue={prestamo?.fecha_referencia ?? ""}
              className={CLASE_CAMPO}
            />
          </Envolvente>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Envolvente etiqueta="Cuenta de pago" error={estado.errores?.cuenta_origen}>
          <select
            name="cuenta_origen"
            defaultValue={prestamo?.cuenta_origen ?? cuentas[0]?.id ?? ""}
            className={CLASE_CAMPO}
          >
            <option value="">—</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Envolvente>
        <Envolvente etiqueta="Categoría" error={estado.errores?.categoria_id}>
          <select
            name="categoria_id"
            defaultValue={prestamo?.categoria_id ?? ""}
            className={CLASE_CAMPO}
          >
            <option value="">Sin categoría</option>
            {categorias
              .filter((c) => c.tipo === "gasto")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </select>
        </Envolvente>
      </div>

      <Envolvente etiqueta="Notas" error={estado.errores?.notas}>
        <textarea
          name="notas"
          defaultValue={prestamo?.notas ?? ""}
          rows={2}
          className={`${CLASE_CAMPO} resize-none`}
        />
      </Envolvente>

      <Resultado estado={estado} />
      <Botones volver="/prestamos" pendiente={pendiente} />
    </form>
  );
}
