import Link from "next/link";
import { Tarjeta, Seccion, Aviso } from "@/components/ui";
import { AccionConConfirmacion, BOTON_OK, BOTON_PELIGROSO } from "@/components/acciones";
import { borrarPrestamo, pagarCuotaPrestamo, borrarAbonoPrestamo } from "@/app/actions";
import { esMesValido, hoyISO, mesActual, primerValor } from "@/lib/dates";
import { formatearEur, formatearFecha } from "@/lib/money";
import { estadoFijosDelMes, estadoPrestamos, obtenerCuentas } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Préstamos · Mi dinero" };

export default async function PaginaPrestamos(props: PageProps<"/prestamos">) {
  const params = await props.searchParams;
  const mesPedido = primerValor(params.mes);
  const mes = esMesValido(mesPedido) ? mesPedido : mesActual();

  const [prestamos, cuentas, fijos] = await Promise.all([
    estadoPrestamos(),
    obtenerCuentas(),
    estadoFijosDelMes(mes),
  ]);

  const nombreCuenta = (id: string | null) => cuentas.find((c) => c.id === id)?.nombre ?? "—";

  return (
    <div className="space-y-5 pb-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Préstamos</h1>
        <Link
          href="/prestamos/nuevo"
          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
        >
          + Nuevo
        </Link>
      </header>

      {!prestamos.length ? (
        <p className="rounded-2xl border border-dashed border-borde px-4 py-10 text-center text-sm text-suave">
          No hay préstamos registrados.
        </p>
      ) : null}

      {prestamos.map((p) => {
        const fijoDelPrestamo = fijos.find(
          (f) => f.recurrente.prestamo_id === p.prestamo.id,
        );
        return (
          <Seccion key={p.prestamo.id} titulo={p.prestamo.nombre}>
            <Tarjeta>
              <p className="text-[11px] tracking-wide text-suave uppercase">Capital pendiente</p>
              <p className="text-3xl font-bold tabular-nums">
                {formatearEur(p.capitalPendiente)}
              </p>
              <p className="text-xs text-suave">
                de{" "}
                <span className="tabular-nums">
                  {formatearEur(p.prestamo.capital_inicial)}
                </span>{" "}
                originales · ya amortizado{" "}
                <span className="tabular-nums">{formatearEur(p.capitalPagado)}</span> (
                {p.porcentajeAmortizado}%)
              </p>

              {p.anclado && p.fechaAncla ? (
                <p className="mt-1.5 text-[11px] text-suave">
                  Anclado a la cifra del banco del {formatearFecha(p.fechaAncla)}: los pagos
                  anteriores a esa fecha no se tienen en cuenta.
                </p>
              ) : null}

              {p.cuotaNoAmortiza ? (
                <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  La cuota no llega ni a cubrir el interés del mes: con estos datos el préstamo no
                  terminaría nunca.
                </p>
              ) : null}

              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(p.porcentajeAmortizado, 100)}%` }}
                />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[11px] tracking-wide text-suave uppercase">Cuota mensual</dt>
                  <dd className="font-semibold tabular-nums">{formatearEur(p.prestamo.cuota)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-wide text-suave uppercase">Cuotas</dt>
                  <dd className="font-semibold tabular-nums">{p.cuotasRestantes} restantes</dd>
                  <dd className="text-[11px] text-suave">{p.cuotasRegistradas} registradas</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-wide text-suave uppercase">Quedan</dt>
                  <dd className="font-semibold tabular-nums">{p.cuotasRestantes} cuotas</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-wide text-suave uppercase">Fin estimado</dt>
                  <dd className="font-semibold">
                    {p.fechaFinEstimada ? formatearFecha(p.fechaFinEstimada) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-wide text-suave uppercase">Próximo cobro</dt>
                  <dd className="font-semibold">
                    {p.proximaCuota ? formatearFecha(p.proximaCuota) : "Terminado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-wide text-suave uppercase">Cuenta</dt>
                  <dd className="truncate font-semibold">
                    {nombreCuenta(p.prestamo.cuenta_origen)}
                  </dd>
                </div>
                {p.prestamo.interes_anual ? (
                  <>
                    <div>
                      <dt className="text-[11px] tracking-wide text-suave uppercase">Interés</dt>
                      <dd className="font-semibold tabular-nums">
                        {p.prestamo.interes_modo === "tae" ? "TAE" : "TAN"}{" "}
                        {String(p.prestamo.interes_anual).replace(".", ",")} %
                      </dd>
                    </div>
                    {p.anclado ? null : (
                      <div>
                        <dt className="text-[11px] tracking-wide text-suave uppercase">
                          Interés ya pagado
                        </dt>
                        <dd className="font-semibold tabular-nums">
                          {formatearEur(p.interesesPagados)}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-[11px] tracking-wide text-suave uppercase">
                        Interés por pagar
                      </dt>
                      <dd className="font-semibold tabular-nums">
                        {formatearEur(p.interesesPendientes)}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>

              {p.anclado ? (
                <p className="mt-3 text-xs text-suave">
                  El interés ya pagado antes del ancla no se cuenta: la app no conoce esas cuotas,
                  solo la cifra que te dio el banco.
                </p>
              ) : null}

              {p.prestamo.notas ? (
                <p className="mt-3 text-xs text-suave">{p.prestamo.notas}</p>
              ) : null}

              {p.capitalPendiente > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {fijoDelPrestamo && !fijoDelPrestamo.confirmado ? (
                    <AccionConConfirmacion
                      accion={pagarCuotaPrestamo.bind(null, p.prestamo.id, mes)}
                      mensaje={`¿Registrar el pago de la cuota (${formatearEur(p.prestamo.cuota)}) y descontar el capital pendiente?`}
                      importes={[p.prestamo.cuota]}
                      className={BOTON_OK}
                    >
                      Pagar cuota de {mes}
                    </AccionConConfirmacion>
                  ) : null}
                  <Link
                    href={`/prestamos/${p.prestamo.id}/abono`}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                  >
                    Abono con dinero ahorrado
                  </Link>
                  <Link
                    href={`/prestamos/${p.prestamo.id}/editar`}
                    className="rounded-lg border border-borde px-2.5 py-1 text-xs font-semibold text-suave"
                  >
                    Editar datos
                  </Link>
                  <AccionConConfirmacion
                    accion={borrarPrestamo.bind(null, p.prestamo.id)}
                    mensaje={`¿Borrar "${p.prestamo.nombre}"?`}
                    className={BOTON_PELIGROSO}
                  >
                    Borrar
                  </AccionConConfirmacion>
                </div>
              ) : null}

              {p.capitalPendiente === 0 ? <Aviso tono="ok">Préstamo terminado 🎉</Aviso> : null}

              {p.abonos.length ? (
                <div className="mt-4 border-t border-borde pt-3">
                  <p className="text-[11px] font-semibold tracking-wide text-suave uppercase">
                    Abonos hechos ·{" "}
                    <span className="tabular-nums">{formatearEur(p.totalAbonado)}</span>
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {p.abonos.map((abono) => (
                      <li
                        key={abono.id}
                        className="flex items-center gap-2 rounded-lg border border-borde px-2.5 py-1.5 text-xs"
                      >
                        <span className="text-suave tabular-nums">{formatearFecha(abono.fecha)}</span>
                        <span className="flex-1 font-semibold tabular-nums">
                          {formatearEur(abono.importe)}
                        </span>
                        <span className="text-suave">
                          {abono.modo === "reducir_plazo" ? (
                            "quitar cuotas"
                          ) : (
                            <>
                              cuota →{" "}
                              <span className="tabular-nums">
                                {formatearEur(abono.cuota_resultante ?? 0)}
                              </span>
                            </>
                          )}
                        </span>
                        <AccionConConfirmacion
                          accion={borrarAbonoPrestamo.bind(null, abono.id)}
                          mensaje={`¿Deshacer este abono de ${formatearEur(abono.importe)}? Se borrará el gasto y el capital volverá a la ficha${abono.cuota_previa ? `, y la cuota volverá a ${formatearEur(abono.cuota_previa)}` : ""}.`}
                          importes={
                            abono.cuota_previa
                              ? [abono.importe, abono.cuota_previa]
                              : [abono.importe]
                          }
                          className={BOTON_PELIGROSO}
                        >
                          ✕
                        </AccionConConfirmacion>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Tarjeta>
          </Seccion>
        );
      })}

      {prestamos.length ? (
        <Aviso>
          Cada cuota se reparte entre intereses y capital: el capital pendiente solo baja por la
          parte de la cuota que va a amortizar. Si haces un abono, el capital baja de golpe; si
          además eliges bajar la cuota, el pago fijo se actualiza solo.
        </Aviso>
      ) : null}

      <p className="pb-2 text-center text-[11px] text-suave">Hoy es {formatearFecha(hoyISO())}</p>
    </div>
  );
}
