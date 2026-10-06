import { NextResponse } from "next/server";
import { claveApiConfigurada, peticiónAutorizada } from "@/lib/api-key";
import { agruparPorCategoria, estadoFijosDelMes, obtenerMovimientos, resumenDelMes } from "@/lib/queries";
import { mesActual, tituloMes } from "@/lib/dates";
import { supabaseConfigurado } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/resumen?mes=YYYY-MM
 *
 * Totales del mes para un posible atajo "Resumen". Requiere `x-api-key`.
 */
export async function GET(request: Request) {
  if (!claveApiConfigurada()) {
    return NextResponse.json(
      { ok: false, error: "API_KEY no está configurada en el servidor." },
      { status: 500 },
    );
  }
  if (!supabaseConfigurado()) {
    return NextResponse.json(
      { ok: false, error: "La base de datos no está configurada." },
      { status: 500 },
    );
  }
  if (!peticiónAutorizada(request)) {
    return NextResponse.json({ ok: false, error: "Clave no válida." }, { status: 401 });
  }

  const url = new URL(request.url);
  const mesParam = url.searchParams.get("mes");
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesActual();

  const [resumen, movimientos, fijos] = await Promise.all([
    resumenDelMes(mes),
    obtenerMovimientos({ mes }),
    estadoFijosDelMes(mes),
  ]);

  const porCategoria = agruparPorCategoria(movimientos).map((a) => ({
    categoria: a.categoria?.nombre ?? "Sin categoría",
    total: a.total,
    porcentaje: a.porcentaje,
  }));

  return NextResponse.json(
    {
      ok: true,
      mes,
      titulo: tituloMes(mes),
      gastado: resumen.gastos,
      ingresos: resumen.ingresos,
      neto: resumen.neto,
      num_gastos: movimientos.filter((m) => m.tipo === "gasto").length,
      fijos: {
        gastos: {
          total: resumen.fijos.gastosTotal,
          pagados: resumen.fijos.gastosPagados,
          pendientes: resumen.fijos.gastosPendientes,
          sin_confirmar: fijos
            .filter((f) => f.recurrente.tipo === "gasto" && !f.confirmado)
            .map((f) => f.recurrente.concepto),
        },
        traspasos: {
          total: resumen.fijos.traspasosTotal,
          pagados: resumen.fijos.traspasosPagados,
          pendientes: resumen.fijos.traspasosPendientes,
          sin_confirmar: fijos
            .filter((f) => f.recurrente.tipo === "traspaso" && !f.confirmado)
            .map((f) => f.recurrente.concepto),
        },
        ingresos: {
          total: resumen.fijos.ingresosTotal,
          pagados: resumen.fijos.ingresosPagados,
          pendientes: resumen.fijos.ingresosPendientes,
          sin_confirmar: fijos
            .filter((f) => f.recurrente.tipo === "ingreso" && !f.confirmado)
            .map((f) => f.recurrente.concepto),
        },
      },
      por_categoria: porCategoria,
    },
    { headers: { "cache-control": "no-store" } },
  );
}