import Link from "next/link";
import { Tarjeta, Seccion } from "@/components/ui";
import { FilaMovimiento, SelectorMes } from "@/components/movimientos-ui";
import { AccionConConfirmacion, BOTON_PELIGROSO, BOTON_SECUNDARIO } from "@/components/acciones";
import { borrarMovimiento, duplicarMovimiento } from "@/app/actions";
import { obtenerCategorias, obtenerCuentas, obtenerMovimientos } from "@/lib/queries";
import { esMesValido, hoyISO, mesActual, primerValor } from "@/lib/dates";
import { formatearEur, formatearFechaCorta } from "@/lib/money";
import type { MovimientoConDetalle } from "@/lib/types";

export const dynamic = "force-dynamic";

const CAMPOS_FILTRO = ["mes", "tipo", "cuenta", "categoria", "q"];

export default async function PaginaMovimientos(props: PageProps<"/movimientos">) {
  const params = await props.searchParams;
  const crudo = new URLSearchParams();
  for (const campo of CAMPOS_FILTRO) {
    const valor = primerValor(params[campo as keyof typeof params]);
    if (valor) crudo.set(campo, valor);
  }

  const mesPedido = crudo.get("mes") ?? "";
  const mes = esMesValido(mesPedido) ? mesPedido : mesActual();
  const tipo = ["gasto", "ingreso", "traspaso"].includes(crudo.get("tipo") ?? "")
    ? (crudo.get("tipo") as "gasto" | "ingreso" | "traspaso")
    : undefined;

  const [movimientos, cuentas, categorias] = await Promise.all([
    obtenerMovimientos({
      mes,
      tipo,
      cuentaId: crudo.get("cuenta") || undefined,
      categoriaId: crudo.get("categoria") || undefined,
      busqueda: crudo.get("q") || undefined,
    }),
    obtenerCuentas(),
    obtenerCategorias(),
  ]);

  const gastos = movimientos.filter((m) => m.tipo === "gasto");
  const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  const traspasos = movimientos.filter((m) => m.tipo === "traspaso");
  const totalGastos = gastos.reduce((a, m) => a + m.importe, 0);
  const totalIngresos = ingresos.reduce((a, m) => a + m.importe, 0);

  return (
    <div className="space-y-5 pb-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Movimientos</h1>
        <Link
          href="/movimientos/nuevo"
          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
        >
          + Nuevo
        </Link>
      </header>

      <SelectorMes mes={mes} base="/movimientos" />

      <form method="get" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input type="hidden" name="mes" value={mes} />
        <select
          name="tipo"
          defaultValue={tipo ?? ""}
          className="rounded-xl border border-borde bg-tarjeta px-3 py-2 text-sm"
        >
          <option value="">Todo</option>
          <option value="gasto">Gastos</option>
          <option value="ingreso">Ingresos</option>
          <option value="traspaso">Traspasos</option>
        </select>
        <select
          name="cuenta"
          defaultValue={crudo.get("cuenta") ?? ""}
          className="rounded-xl border border-borde bg-tarjeta px-3 py-2 text-sm"
        >
          <option value="">Toda cuenta</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          name="categoria"
          defaultValue={crudo.get("categoria") ?? ""}
          className="rounded-xl border border-borde bg-tarjeta px-3 py-2 text-sm"
        >
          <option value="">Toda categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            name="q"
            type="search"
            defaultValue={crudo.get("q") ?? ""}
            placeholder="Buscar…"
            className="min-w-0 flex-1 rounded-xl border border-borde bg-tarjeta px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl border border-borde px-3 text-sm font-semibold"
          >
            Filtrar
          </button>
        </div>
      </form>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Tarjeta>
          <p className="text-[11px] tracking-wide text-suave uppercase">Gastos</p>
          <p className="font-bold text-rose-600 tabular-nums dark:text-rose-400">
            {formatearEur(totalGastos)}
          </p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-[11px] tracking-wide text-suave uppercase">Ingresos</p>
          <p className="font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            {formatearEur(totalIngresos)}
          </p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-[11px] tracking-wide text-suave uppercase">Movimientos</p>
          <p className="font-bold tabular-nums">{movimientos.length}</p>
        </Tarjeta>
      </div>

      {movimientos.length ? (
        <div className="space-y-5">
          {agruparPorDia(movimientos).map(([dia, items]) => (
            <Seccion
              key={dia}
              titulo={
                <>
                  {formatearFechaCorta(dia)} ·{" "}
                  <span className="tabular-nums">
                    {formatearEur(
                      items.reduce((a, m) => a + (m.tipo === "gasto" ? m.importe : 0), 0),
                    )}
                  </span>
                </>
              }
            >
              <ul className="space-y-1.5">
                {items.map((m) => (
                  <FilaMovimiento key={m.id} movimiento={m} />
                ))}
              </ul>
            </Seccion>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-borde px-4 py-10 text-center text-sm text-suave">
          No hay movimientos con estos filtros.{" "}
          <Link
            href="/movimientos/nuevo"
            className="font-semibold text-blue-600 dark:text-blue-400"
          >
            Añadir el primero
          </Link>
        </p>
      )}

      {movimientos.length ? (
        <Seccion titulo="Acciones rápidas">
          <ul className="space-y-1.5">
            {movimientos.slice(0, 10).map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-xs text-suave">
                <span className="min-w-0 flex-1 truncate">{m.descripcion}</span>
                <AccionConConfirmacion
                  accion={duplicarMovimiento.bind(null, m.id)}
                  mensaje={`¿Duplicar "${m.descripcion}" con fecha de hoy?`}
                  className={BOTON_SECUNDARIO}
                >
                  Duplicar
                </AccionConConfirmacion>
                <AccionConConfirmacion
                  accion={borrarMovimiento.bind(null, m.id)}
                  mensaje={`¿Borrar "${m.descripcion}"?`}
                  className={BOTON_PELIGROSO}
                >
                  Borrar
                </AccionConConfirmacion>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      <p className="pb-2 text-center text-[11px] text-suave">
        Hoy es {formatearFechaCorta(hoyISO())} · {traspasos.length} traspasos no computan en gastos
      </p>
    </div>
  );
}

function agruparPorDia(movimientos: MovimientoConDetalle[]): [string, MovimientoConDetalle[]][] {
  const mapa = new Map<string, MovimientoConDetalle[]>();
  for (const m of movimientos) {
    const lista = mapa.get(m.fecha) ?? [];
    lista.push(m);
    mapa.set(m.fecha, lista);
  }
  return [...mapa.entries()];
}
