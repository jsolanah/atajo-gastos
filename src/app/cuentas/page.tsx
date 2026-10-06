import Link from "next/link";
import { Tarjeta, Seccion } from "@/components/ui";
import { AccionConConfirmacion, BOTON_PELIGROSO } from "@/components/acciones";
import { borrarCuenta } from "@/app/actions";
import { calcularSaldos, obtenerCuentas, totalPorTipo, totalSaldos } from "@/lib/queries";
import { formatearEur, formatearFecha } from "@/lib/money";
import { hoyISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

const ROTULOS = {
  corriente: "Liquidez",
  ahorro: "Ahorro",
  inversion: "Inversión",
  efectivo: "Efectivo",
} as const;

const TIPOS = ["corriente", "ahorro", "inversion", "efectivo"] as const;

export const metadata = { title: "Cuentas · Mi dinero" };

export default async function PaginaCuentas() {
  const [cuentas, saldos] = await Promise.all([obtenerCuentas(true), calcularSaldos()]);
  const total = totalSaldos(saldos);

  return (
    <div className="space-y-5 pb-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Cuentas</h1>
        <Link
          href="/cuentas/nueva"
          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
        >
          + Nueva
        </Link>
      </header>

      <Tarjeta>
        <p className="text-[11px] tracking-wide text-suave uppercase">Total</p>
        <p className="text-3xl font-bold tabular-nums">{formatearEur(total)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {TIPOS.map((tipo) => (
            <div key={tipo}>
              <dt className="text-[11px] tracking-wide text-suave uppercase">
                {ROTULOS[tipo]}
              </dt>
              <dd className="text-sm font-semibold tabular-nums">
                {formatearEur(totalPorTipo(saldos, tipo))}
              </dd>
            </div>
          ))}
        </dl>
      </Tarjeta>

      <Seccion titulo="Tus cuentas">
        <ul className="space-y-1.5">
          {cuentas.map((cuenta) => {
            const saldo = saldos.find((s) => s.cuenta.id === cuenta.id);
            return (
              <li
                key={cuenta.id}
                className="rounded-xl border border-borde bg-tarjeta px-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: cuenta.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {cuenta.nombre}
                      {!cuenta.activa ? (
                        <span className="ml-2 text-xs text-suave">(inactiva)</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-suave">
                      {ROTULOS[cuenta.tipo]} · saldo inicial{" "}
                      <span className="tabular-nums">
                        {formatearEur(cuenta.saldo_inicial)}
                      </span>{" "}
                      del {formatearFecha(cuenta.fecha_saldo)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold tabular-nums ${
                        (saldo?.saldo ?? 0) < 0 ? "text-rose-600 dark:text-rose-400" : ""
                      }`}
                    >
                      {formatearEur(saldo?.saldo ?? 0)}
                    </p>
                    {saldo && (saldo.ingresos > 0 || saldo.gastos > 0) ? (
                      <p className="text-[11px] text-suave tabular-nums">
                        −{formatearEur(saldo.gastos)} / +{formatearEur(saldo.ingresos)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Link
                    href={`/cuentas/${cuenta.id}/editar`}
                    className="rounded-lg border border-borde px-2.5 py-1 text-xs font-semibold text-suave"
                  >
                    Editar
                  </Link>
                  <AccionConConfirmacion
                    accion={borrarCuenta.bind(null, cuenta.id)}
                    mensaje={`¿Borrar la cuenta "${cuenta.nombre}"? Solo es posible si no tiene movimientos.`}
                    className={BOTON_PELIGROSO}
                  >
                    Borrar
                  </AccionConConfirmacion>
                </div>
              </li>
            );
          })}
        </ul>
      </Seccion>

      <p className="pb-2 text-center text-[11px] text-suave">
        El saldo de cada cuenta = saldo inicial + movimientos registrados. Hoy es{" "}
        {formatearFecha(hoyISO())}.
      </p>
    </div>
  );
}
