import { NextResponse } from "next/server";
import { claveApiConfigurada, peticiónAutorizada } from "@/lib/api-key";
import { registrarGastoAtajo } from "@/lib/movimientos";
import { erroresDeFormulario, gastoAtajoSchema } from "@/lib/validation";
import { supabaseConfigurado } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function error(mensaje: string, estado: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: mensaje, ...extra }, { status: estado });
}

async function cuerpoDeLaPeticion(request: Request): Promise<unknown> {
  const tipo = request.headers.get("content-type") ?? "";
  try {
    if (tipo.includes("application/json")) return await request.json();
    const formulario = await request.formData();
    return Object.fromEntries(formulario.entries());
  } catch {
    return null;
  }
}

/**
 * POST /api/gasto
 *
 * Endpoint que consume el Atajo de iOS. Requiere la cabecera `x-api-key`.
 *
 * Cuerpo: { importe, concepto, cuenta, categoria, fecha? }
 */
export async function POST(request: Request) {
  if (!claveApiConfigurada()) {
    return error("API_KEY no está configurada en el servidor.", 500);
  }
  if (!supabaseConfigurado()) {
    return error("La base de datos no está configurada.", 500);
  }
  if (!peticiónAutorizada(request)) {
    return error("Clave no válida.", 401);
  }

  const cuerpo = await cuerpoDeLaPeticion(request);
  if (cuerpo === null) {
    return error("No se ha podido leer el cuerpo de la petición.", 400);
  }

  const parseado = gastoAtajoSchema.safeParse(cuerpo);
  if (!parseado.success) {
    const errores = erroresDeFormulario(parseado.error);
    return error(
      errores.importe ?? errores.concepto ?? errores.cuenta ?? errores.categoria ?? "Datos no válidos.",
      400,
      { errores },
    );
  }

  const { importe, concepto, cuenta, categoria, fecha, notas } = parseado.data;

  if (!concepto) {
    return error("Falta el concepto del gasto.", 400);
  }

  const resultado = await registrarGastoAtajo({
    importe,
    concepto,
    cuenta,
    categoria,
    fecha,
    notas,
  });

  if (!resultado.ok) {
    const desconocido = resultado.error?.includes("desconocida");
    return NextResponse.json(
      {
        ok: false,
        error: resultado.error,
        detalle: resultado.detalle,
      },
      { status: desconocido ? 404 : 400 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      id: resultado.id,
      mensaje: `Gasto registrado: ${importe.toFixed(2).replace(".", ",")} € · ${concepto}`,
      concepto,
      cuenta: resultado.cuenta,
      categoria: resultado.categoria,
      fecha: resultado.fecha,
      saldo: resultado.saldo,
    },
    { status: 201 },
  );
}

export async function GET() {
  return error(
    "Usa POST: { importe, concepto, cuenta, categoria } con la cabecera x-api-key.",
    405,
  );
}