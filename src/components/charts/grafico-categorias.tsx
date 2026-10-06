"use client";

import dynamic from "next/dynamic";
import { registrarGraficos } from "./registro";
import { useOculto } from "@/components/oculto";
import { formatearEur } from "@/lib/money";
import type { ApunteCategoria } from "@/lib/types";

registrarGraficos();

const Doughnut = dynamic(() => import("react-chartjs-2").then((m) => m.Doughnut), {
  ssr: false,
});

export default function GraficoCategorias({ datos }: { datos: ApunteCategoria[] }) {
  const { oculto } = useOculto();

  if (!datos.length) {
    return (
      <p className="py-8 text-center text-sm text-suave">
        Todavía no hay gastos registrados este mes.
      </p>
    );
  }

  // El anillo se dibuja en un <canvas>, al que la regla de ocultado no llega:
  // con el dinero tapado se sustituye entero.
  if (oculto) {
    return (
      <p className="py-10 text-center text-sm text-suave">🔒 Gráfico oculto</p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-56 w-56 shrink-0">
        <Doughnut
          data={{
            labels: datos.map((d) => d.categoria?.nombre ?? "Sin categoría"),
            datasets: [
              {
                data: datos.map((d) => d.total),
                backgroundColor: datos.map((d) => d.categoria?.color ?? "#94a3b8"),
                borderWidth: 0,
                hoverOffset: 6,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (contexto) => {
                    const valor = Number(contexto.raw ?? 0);
                    const suma = datos.reduce((a, d) => a + d.total, 0);
                    const pct = suma ? Math.round((valor / suma) * 1000) / 10 : 0;
                    return ` ${formatearEur(valor)} · ${pct}%`;
                  },
                },
              },
            },
          }}
        />
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {datos.map((d) => (
          <li key={d.categoria?.id ?? "sin-categoria"} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.categoria?.color ?? "#94a3b8" }}
            />
            <span className="min-w-0 flex-1 truncate">{d.categoria?.nombre ?? "Sin categoría"}</span>
            <span className="shrink-0 tabular-nums text-suave">
              {d.porcentaje}%
            </span>
            <span className="w-20 shrink-0 text-right font-semibold tabular-nums">
              {formatearEur(d.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
