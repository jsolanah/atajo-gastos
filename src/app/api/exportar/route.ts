import { obtenerMovimientos } from "@/lib/queries";

export const dynamic = "force-dynamic";

function celda(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  if (/[";\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  if (/^[=+@-]/.test(texto)) return `"${texto}"`;
  return texto.replace(/;/g, ",");
}

/** Descarga CSV de todos los movimientos (separador `;`, para Excel en español). */
export async function GET() {
  const movimientos = await obtenerMovimientos({ limite: 10000 });

  const cabecera = [
    "fecha",
    "tipo",
    "importe",
    "descripcion",
    "cuenta_origen",
    "cuenta_destino",
    "categoria",
    "origen",
    "notas",
  ];

  const filas = movimientos.map((m) =>
    [
      m.fecha,
      m.tipo,
      m.importe.toFixed(2).replace(".", ","),
      m.descripcion,
      m.cuenta_origen_detalle?.nombre ?? "",
      m.cuenta_destino_detalle?.nombre ?? "",
      m.categoria?.nombre ?? "",
      m.origen,
      m.notas ?? "",
    ]
      .map(celda)
      .join(";"),
  );

  const csv = [cabecera.join(";"), ...filas].join("\n");

  return new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="movimientos-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
