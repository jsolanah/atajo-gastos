import Link from "next/link";
import { Tarjeta, Aviso, Seccion } from "@/components/ui";
import { SelectorMes } from "@/components/movimientos-ui";
import GraficoCategorias from "@/components/charts/grafico-categorias";
import GraficoEvolucion from "@/components/charts/grafico-evolucion";
import { AccionConConfirmacion, BOTON_OK, BOTON_SECUNDARIO } from "@/components/acciones";
import { confirmarPagoFijo, deshacerPagoFijo } from "@/app/actions";
import { proyectarSaldoFinal } from "@/lib/movimientos";
import {
  agruparPorCategoria,
  calcularSaldos,
  estadoFijosDelMes,
  estadoPrestamos,
  evolucionMensual,
  obtenerMovimientos,
  resumenDelMes,
  totalPorTipo,
  totalSaldos,
} from "@/lib/queries";
import { supabaseConfigurado } from "@/lib/supabase/server";
import { esMesValido, hoyISO, mesActual, primerValor, sumarMeses } from "@/lib/dates";
import { formatearEur, formatearEurCorto, formatearFecha } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PaginaInicio(props: PageProps<"/">) {
  if (!supabaseConfigurado()) return <AvisoSinConfigurar />;

  const params = await props.searchParams;
  const mesPedido = primerValor(params.mes);
  const mes = esMesValido(mesPedido) ? mesPedido : mesActual();

  const [saldos, resumen, movimientos, fijos, evolucion, prestamos, resumenPrevio, saldoPrevisto] =
    await Promise.all([
      calcularSaldos(),
      resumenDelMes(mes),
      obtenerMovimientos({ mes }),
      estadoFijosDelMes(mes),
      evolucionMensual(6, mes),
      estadoPrestamos(),
      resumenDelMes(sumarMeses(mes, -1)),
      proyectarSaldoFinal(mes),
    ]);

  const porCategoria = agruparPorCategoria(movimientos);
  const total = totalSaldos(saldos);
  const porTipo = [
    { etiqueta: "Liquidez", valor: totalPorTipo(saldos, "corriente") },
    { etiqueta: "Ahorro", valor: totalPorTipo(saldos, "ahorro") },
    { etiqueta: "Inversión", valor: totalPorTipo(saldos, "inversion") },
    { etiqueta: "Efectivo", valor: totalPorTipo(saldos, "efectivo") },
  ];
  const pendientes = fijos.filter((f) => !f.confirmado);
  const variacion =
    resumenPrevio.gastos > 0
      ? Math.round(((resumen.gastos - resumenPrevio.gastos) / resumenPrevio.gastos) * 1000) / 10
      : null;
  const esMesActual = mes === mesActual();

  return (
    <div className="space-y-5 pb-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mi dinero</h1>
        <Link
          href="/movimientos/nuevo"
          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
        >
          + Nuevo
        </Link>
      </header>

      <Tarjeta className="bg-gradient-to-br from-slate-800 to-slate-900 text-white">
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          Patrimonio total
        </p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{formatearEur(total)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-center sm:grid-cols-4">
          {porTipo.map((item) => (
            <div key={item.etiqueta}>
              <dt className="text-[11px] tracking-wide text-slate-400 uppercase">
                {item.etiqueta}
              </dt>
              <dd className="text-sm font-semibold tabular-nums">{formatearEur(item.valor)}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 space-y-1.5">
          {saldos.map((s) => (
            <li key={s.cuenta.id} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.cuenta.color }}
              />
              <span className="min-w-0 flex-1 truncate text-slate-300">{s.cuenta.nombre}</span>
              <span
                className={`shrink-0 font-semibold tabular-nums ${
                  s.saldo < 0 ? "text-rose-400" : "text-white"
                }`}
              >
                {formatearEur(s.saldo)}
              </span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <SelectorMes mes={mes} />

      <div className="grid grid-cols-3 gap-3">
        <Tarjeta className="text-center">
          <p className="text-[11px] font-semibold tracking-wide text-suave uppercase">Gastado</p>
          <p className="text-lg font-bold text-rose-600 tabular-nums dark:text-rose-400">
            {formatearEurCorto(resumen.gastos)}
          </p>
          {variacion !== null ? (
            <p
              className={`text-[11px] tabular-nums ${
                variacion > 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {variacion > 0 ? "▲" : "▼"} {Math.abs(variacion)}% vs. mes anterior
            </p>
          ) : (
            <p className="text-[11px] text-suave">sin comparativa</p>
          )}
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-[11px] font-semibold tracking-wide text-suave uppercase">Ingresos</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            {formatearEurCorto(resumen.ingresos)}
          </p>
        </Tarjeta>
        <Tarjeta className="text-center">
          <p className="text-[11px] font-semibold tracking-wide text-suave uppercase">Ahorrado</p>
          <p className="text-lg font-bold tabular-nums">
            {formatearEurCorto(resumen.neto)}
          </p>
        </Tarjeta>
      </div>

      <Seccion
        titulo={`Pagos fijos · ${pendientes.length ? `${pendientes.length} por confirmar` : "al día"}`}
        accion={
          <Link href="/fijos" className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            Gestionar
          </Link>
        }
      >
        <div className="rounded-2xl border border-borde bg-tarjeta p-4">
          <p className="text-sm text-suave">
            Gastos fijos:{" "}
            <strong className="text-texto tabular-nums">
              {formatearEur(resumen.fijos.gastosTotal)}
            </strong>
            {resumen.fijos.gastosPendientes > 0 ? (
              <>
                {" · "}
                <span className="tabular-nums">{formatearEur(resumen.fijos.gastosPagados)}</span>{" "}
                confirmados
              </>
            ) : (
              <> · todo confirmado</>
            )}
          </p>
          {resumen.fijos.traspasosTotal > 0 ? (
            <p className="mt-1 text-sm text-suave">
              Traspasos entre cuentas:{" "}
              <strong className="text-blue-600 tabular-nums dark:text-blue-400">
                {formatearEur(resumen.fijos.traspasosTotal)}
              </strong>
              {resumen.fijos.traspasosPendientes > 0 ? (
                <>
                  {" · "}
                  <span className="tabular-nums">
                    {formatearEur(resumen.fijos.traspasosPagados)}
                  </span>{" "}
                  confirmados
                </>
              ) : (
                <> · todo confirmado</>
              )}
            </p>
          ) : null}
          {resumen.fijos.ingresosTotal > 0 ? (
            <p className="mt-1 text-sm text-suave">
              Ingresos fijos:{" "}
              <strong className="text-emerald-600 tabular-nums dark:text-emerald-400">
                {formatearEur(resumen.fijos.ingresosTotal)}
              </strong>
              {resumen.fijos.ingresosPendientes > 0 ? (
                <>
                  {" · "}
                  <span className="tabular-nums">
                    {formatearEur(resumen.fijos.ingresosPagados)}
                  </span>{" "}
                  confirmados
                </>
              ) : (
                <> · todo confirmado</>
              )}
            </p>
          ) : null}
          {esMesActual ? (
            <p className="mt-2 text-xs text-suave">
              Si confirmas los que faltan, el patrimonio quedará en{" "}
              <strong className="text-texto tabular-nums">{formatearEur(saldoPrevisto)}</strong>.
            </p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {fijos.map((fijo) => (
              <li
                key={fijo.recurrente.id}
                className="flex items-center gap-2 border-t border-borde pt-2 text-sm"
              >
                <span className="text-xs text-suave tabular-nums">
                  {String(fijo.recurrente.dia).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate">{fijo.recurrente.concepto}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums">
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
                    mensaje={`¿Confirmar "${fijo.recurrente.concepto}" por ${formatearEur(fijo.recurrente.importe)}?`}
                    importes={[fijo.recurrente.importe]}
                    className={BOTON_OK}
                  >
                    Confirmar
                  </AccionConConfirmacion>
                )}
              </li>
            ))}
            {!fijos.length ? (
              <li className="pt-2 text-sm text-suave">
                No hay pagos fijos configurados.{" "}
                <Link href="/fijos" className="font-semibold text-blue-600 dark:text-blue-400">
                  Añadir
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </Seccion>

      <Seccion
        titulo="Gastos por categoría"
        accion={
          <Link
            href="/movimientos"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400"
          >
            Ver todo
          </Link>
        }
      >
        <Tarjeta>
          <GraficoCategorias datos={porCategoria} />
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Evolución (6 meses)">
        <Tarjeta>
          <GraficoEvolucion datos={evolucion} />
        </Tarjeta>
      </Seccion>

      {prestamos.map((p) => (
        <Seccion
          key={p.prestamo.id}
          titulo="Préstamo"
          accion={
            <Link
              href="/prestamos"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400"
            >
              Detalle
            </Link>
          }
        >
          <Tarjeta>
            <p className="text-sm font-semibold">{p.prestamo.nombre}</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatearEur(p.capitalPendiente)}
            </p>
            <p className="text-xs text-suave">
              {p.cuotasRestantes} cuotas restantes · queda{" "}
              <span className="tabular-nums">{formatearEur(p.prestamo.cuota)}</span> al mes
              {p.interesesPendientes > 0 ? (
                <>
                  {" · "}
                  <span className="tabular-nums">{formatearEur(p.interesesPendientes)}</span> de
                  intereses por pagar
                </>
              ) : null}
              {p.totalAbonado > 0 ? (
                <>
                  {" · "}
                  <span className="tabular-nums">{formatearEur(p.totalAbonado)}</span> abonados de
                  más
                </>
              ) : null}
              {p.fechaFinEstimada ? ` · fin estimado ${formatearFecha(p.fechaFinEstimada)}` : ""}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(p.porcentajeAmortizado, 100)}%` }}
              />
            </div>
          </Tarjeta>
        </Seccion>
      ))}

      {!esMesActual ? (
        <p className="pb-2 text-center text-xs text-suave">
         Estás viendo {mes}.{" "}
          <Link href="/" className="font-semibold text-blue-600 dark:text-blue-400">
            Volver a este mes
          </Link>
        </p>
      ) : null}

      <p className="pb-2 text-center text-[11px] text-suave">Hoy es {formatearFecha(hoyISO())}</p>
    </div>
  );
}

function AvisoSinConfigurar() {
  return (
    <div className="space-y-3 py-10">
      <Aviso tono="error">
        Faltan las variables de entorno <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
        <code>SUPABASE_SERVICE_ROLE_KEY</code>.
      </Aviso>
      <Tarjeta titulo="Para empezar">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-suave">
          <li>
            Ejecuta <code>supabase/schema.sql</code> en el SQL Editor de Supabase. Crea todas las
            tablas y no deja ningún dato. Si quieres verla llena antes de meter los tuyos, ejecuta
            después <code>supabase/demo.sql</code> (datos inventados; se borran con el
            <code>truncate</code> que lleva al final).
          </li>
          <li>
            Copia <code>.env.example</code> a <code>.env.local</code> y pega tu URL y tu service
            role key.
          </li>
          <li>
            Define <code>API_KEY</code> con una clave larga y aleatoria (la usará el Atajo de iOS).
          </li>
          <li>Reinicia <code>npm run dev</code>.</li>
        </ol>
      </Tarjeta>
    </div>
  );
}
