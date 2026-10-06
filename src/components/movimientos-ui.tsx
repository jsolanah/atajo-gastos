import Link from "next/link";
import { formatearFechaCorta, formatearEur, porcentaje } from "@/lib/money";
import { sumarMeses, tituloMes } from "@/lib/dates";
import type { MovimientoConDetalle } from "@/lib/types";

const ROTULOS: Record<MovimientoConDetalle["tipo"], { texto: string; clase: string; signo: string }> = {
  gasto: { texto: "Gasto", clase: "text-rose-600 dark:text-rose-400", signo: "−" },
  ingreso: { texto: "Ingreso", clase: "text-emerald-600 dark:text-emerald-400", signo: "+" },
  traspaso: { texto: "Traspaso", clase: "text-blue-600 dark:text-blue-400", signo: "→" },
};

export function FilaMovimiento({
  movimiento,
  total,
  mostrarFecha = false,
}: {
  movimiento: MovimientoConDetalle;
  total?: number;
  mostrarFecha?: boolean;
}) {
  const rotulo = ROTULOS[movimiento.tipo];
  const color = movimiento.categoria?.color ?? "#94a3b8";
  const cuentas =
    movimiento.tipo === "traspaso"
      ? `${movimiento.cuenta_origen_detalle?.nombre ?? "?"} → ${movimiento.cuenta_destino_detalle?.nombre ?? "?"}`
      : (movimiento.cuenta_origen_detalle?.nombre ?? movimiento.cuenta_destino_detalle?.nombre ?? "");

  return (
    <li className="flex items-center gap-3 rounded-xl border border-borde bg-tarjeta px-3 py-2.5">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: movimiento.tipo === "traspaso" ? "#3b82f6" : color }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{movimiento.descripcion}</p>
        <p className="truncate text-xs text-suave">
          {cuentas}
          {movimiento.categoria ? ` · ${movimiento.categoria.nombre}` : ""}
          {mostrarFecha ? ` · ${formatearFechaCorta(movimiento.fecha)}` : ""}
          {movimiento.origen === "atajo" ? " · 📱" : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold tabular-nums ${rotulo.clase}`}>
          {rotulo.signo}
          {formatearEur(movimiento.importe)}
        </p>
        {total && movimiento.tipo === "gasto" ? (
          <p className="text-[11px] text-suave tabular-nums">
            {porcentaje(movimiento.importe, total)}%
          </p>
        ) : (
          <Link
            href={`/movimientos/${movimiento.id}/editar`}
            className="text-[11px] text-blue-600 underline dark:text-blue-400"
          >
            editar
          </Link>
        )}
      </div>
    </li>
  );
}

export function SelectorMes({
  mes,
  base = "/",
  extra = {},
}: {
  mes: string;
  base?: string;
  extra?: Record<string, string>;
}) {
  const construir = (valor: string) => {
    const params = new URLSearchParams({ ...extra, mes: valor });
    return `${base}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={construir(sumarMeses(mes, -1))}
        className="rounded-lg border border-borde bg-tarjeta px-3 py-1.5 text-sm"
        aria-label="Mes anterior"
      >
        ‹
      </Link>
      <span className="text-sm font-semibold capitalize">{tituloMes(mes)}</span>
      <Link
        href={construir(sumarMeses(mes, 1))}
        className="rounded-lg border border-borde bg-tarjeta px-3 py-1.5 text-sm"
        aria-label="Mes siguiente"
      >
        ›
      </Link>
    </div>
  );
}
