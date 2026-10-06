import Link from "next/link";
import { Tarjeta, Seccion, Aviso } from "@/components/ui";
import { SelectorMes } from "@/components/movimientos-ui";
import {
  AccionConConfirmacion,
  BOTON_OK,
  BOTON_PELIGROSO,
  BOTON_SECUNDARIO,
} from "@/components/acciones";
import {
  alternarRecurrente,
  borrarRecurrente,
  confirmarPagoFijo,
  deshacerPagoFijo,
} from "@/app/actions";
import {
  esMesValido,
  hoyISO,
  mesActual,
  primerValor,
} from "@/lib/dates";
import { formatearEur, formatearFecha } from "@/lib/money";
import {
  estadoFijosDelMes,
  obtenerCuentas,
  obtenerRecurrentes,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PaginaFijos(props: PageProps<"/fijos">) {
  const params = await props.searchParams;
  const mesPedido = primerValor(params.mes);
  const mes = esMesValido(mesPedido) ? mesPedido : mesActual();

  const [recurrentes, estado, cuentas] = await Promise.all([
    obtenerRecurrentes(),
    estadoFijosDelMes(mes),
    obtenerCuentas(),
  ]);

  const nombreCuenta = (id: string | null) =>
    cuentas.find((c) => c.id === id)?.nombre ?? "—";
  const describe = (r: (typeof recurrentes)[number]) =>
    r.tipo === "traspaso"
      ? `${nombreCuenta(r.cuenta_origen)} → ${nombreCuenta(r.cuenta_destino)}`
      : r.tipo === "ingreso"
        ? `entra en ${nombreCuenta(r.cuenta_destino)}`
        : nombreCuenta(r.cuenta_origen);

  const activos = recurrentes.filter((r) => r.activo);
  const sumaTipo = (tipo: string) =>
    activos.filter((r) => r.tipo === tipo).reduce((a, r) => a + Number(r.importe), 0);
  const pendiente = (tipo: string) =>
    estado
      .filter((f) => f.recurrente.tipo === tipo && !f.confirmado)
      .reduce((a, f) => a + Number(f.recurrente.importe), 0);

  const salidaTotal = sumaTipo("gasto") + sumaTipo("traspaso");
  const entradaTotal = sumaTipo("ingreso");

  return (
    <div className="space-y-5 pb-4">
      <header>
        <h1 className="text-xl font-bold">Movimientos fijos</h1>
        <p className="text-sm text-suave">
          Se proponen el día de cobro de cada mes; tú confirmas los que se pagan de verdad.
        </p>
      </header>

      <Tarjeta>
        <p className="text-[11px] tracking-wide text-suave uppercase">Cada mes</p>
        <p className="text-sm">
          Entra{" "}
          <strong className="text-emerald-600 tabular-nums dark:text-emerald-400">
            {formatearEur(entradaTotal)}
          </strong>{" "}
          y sale{" "}
          <strong className="text-texto tabular-nums">{formatearEur(salidaTotal)}</strong> →{" "}
          <strong
            className={`tabular-nums ${entradaTotal - salidaTotal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {entradaTotal - salidaTotal >= 0 ? "+" : "−"}
            {formatearEur(Math.abs(entradaTotal - salidaTotal))}
          </strong>
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { clave: "gasto", etiqueta: "Gastos fijos", valor: sumaTipo("gasto"), clase: "text-rose-600 dark:text-rose-400" },
            { clave: "traspaso", etiqueta: "Traspasos", valor: sumaTipo("traspaso"), clase: "text-blue-600 dark:text-blue-400" },
            { clave: "ingreso", etiqueta: "Entradas fijas", valor: sumaTipo("ingreso"), clase: "text-emerald-600 dark:text-emerald-400" },
          ].map((item) => {
            const sinConfirmar = pendiente(item.clave);
            return (
              <div key={item.clave} className="rounded-xl border border-borde px-2 py-2">
                <p className="text-[10px] leading-tight tracking-wide text-suave uppercase">
                  {item.etiqueta}
                </p>
                <p className={`text-xs font-bold tabular-nums ${item.clase}`}>
                  {formatearEur(item.valor)}
                </p>
                <p className="text-[10px] text-suave tabular-nums">
                  {sinConfirmar > 0 ? `${formatearEur(sinConfirmar)} pend.` : "todo ok"}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <SelectorMes mes={mes} base="/fijos" />
        </div>
      </Tarjeta>

      <Aviso>
        Un traspaso entre cuentas (de la principal al día a día, por ejemplo) mueve el dinero de
        sitio: no cuenta como gasto, solo cambia de cuenta. Un ingreso fijo (la nómina) suma al mes
        en el que lo confirmas.
      </Aviso>

      <Seccion titulo={`Confirmaciones de ${mes}`}>
        <ul className="space-y-1.5">
          {estado.map((fijo) => (
            <li
              key={fijo.recurrente.id}
              className="flex items-center gap-2 rounded-xl border border-borde bg-tarjeta px-3 py-2.5"
            >
              <span
                aria-hidden
                className={`size-2.5 shrink-0 rounded-full ${
                  fijo.confirmado ? "bg-emerald-500" : "bg-amber-400"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fijo.recurrente.concepto}</p>
                <p className="truncate text-xs text-suave">
                  {formatearFecha(fijo.fechaPrevista)} · {describe(fijo.recurrente)}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  fijo.recurrente.tipo === "ingreso"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : ""
                }`}
              >
                {fijo.recurrente.tipo === "ingreso" ? "+" : "−"}
                {formatearEur(fijo.recurrente.importe)}
              </span>
              {fijo.confirmado && fijo.movimientoId ? (
                <AccionConConfirmacion
                  accion={deshacerPagoFijo.bind(null, fijo.movimientoId)}
                  mensaje={`¿Deshacer el pago de "${fijo.recurrente.concepto}"?`}
                  className={BOTON_SECUNDARIO}
                >
                  Deshacer
                </AccionConConfirmacion>
              ) : (
                <AccionConConfirmacion
                  accion={confirmarPagoFijo.bind(null, fijo.recurrente.id, mes)}
                  mensaje={`¿Confirmar "${fijo.recurrente.concepto}"?`}
                  className={BOTON_OK}
                >
                  Confirmar
                </AccionConConfirmacion>
              )}
            </li>
          ))}
          {!estado.length ? (
            <li className="rounded-xl border border-dashed border-borde px-3 py-6 text-center text-sm text-suave">
              No hay pagos fijos activos.
            </li>
          ) : null}
        </ul>
      </Seccion>

      <Seccion
        titulo="Plantillas"
        accion={
          <Link href="/fijos/nuevo" className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            + Añadir
          </Link>
        }
      >
        <ul className="space-y-1.5">
          {recurrentes.map((r) => (
            <li
              key={r.id}
              className={`rounded-xl border border-borde bg-tarjeta px-3 py-2.5 ${r.activo ? "" : "opacity-60"}`}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.concepto}
                    {r.tipo === "ingreso" ? (
                      <span className="ml-2 text-[10px] font-semibold tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
                        ingreso
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-suave">
                    día {r.dia} ·{" "}
                    <span className="tabular-nums">
                      {r.tipo === "ingreso" ? "+" : ""}
                      {formatearEur(r.importe)}
                    </span>{" "}
                    · {describe(r)}
                    {r.mes_inicio > "2000-01-01" ? (
                      <> · desde {formatearFecha(r.mes_inicio)}</>
                    ) : null}
                  </p>
                </div>
                <Link
                  href={`/fijos/${r.id}/editar`}
                  className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  Editar
                </Link>
                <AccionConConfirmacion
                  accion={alternarRecurrente.bind(null, r.id, !r.activo)}
                  className={BOTON_SECUNDARIO}
                >
                  {r.activo ? "Pausar" : "Activar"}
                </AccionConConfirmacion>
                <AccionConConfirmacion
                  accion={borrarRecurrente.bind(null, r.id)}
                  mensaje={`¿Borrar "${r.concepto}"? Los movimientos ya registrados se conservan.`}
                  className={BOTON_PELIGROSO}
                >
                  ✕
                </AccionConConfirmacion>
              </div>
            </li>
          ))}
          {!recurrentes.length ? (
            <li className="rounded-xl border border-dashed border-borde px-3 py-6 text-center text-sm text-suave">
              Aún no has definido pagos fijos.
            </li>
          ) : null}
        </ul>
      </Seccion>

      <p className="pb-2 text-center text-[11px] text-suave">Hoy es {formatearFecha(hoyISO())}</p>
    </div>
  );
}
