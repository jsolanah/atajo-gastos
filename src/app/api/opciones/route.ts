import { NextResponse } from "next/server";
import { claveApiConfigurada, peticiónAutorizada } from "@/lib/api-key";
import { obtenerCategorias, obtenerCuentas } from "@/lib/queries";
import { supabaseConfigurado } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/opciones
 *
 * Listas de cuentas y categorías para que el Atajo de iOS ofrezca
 * "Elegir de lista" siempre actualizado. Requiere la cabecera `x-api-key`.
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

  const [cuentas, categorias] = await Promise.all([
    obtenerCuentas(true),
    obtenerCategorias(),
  ]);

  return NextResponse.json(
    {
      ok: true,
      cuentas: cuentas.map((c) => ({ id: c.id, nombre: c.nombre, entidad: c.entidad, activa: c.activa })),
      categorias: categorias.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}