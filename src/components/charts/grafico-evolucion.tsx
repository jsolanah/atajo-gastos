"use client";

import dynamic from "next/dynamic";
import { registrarGraficos } from "./registro";
import { useOculto } from "@/components/oculto";
import { etiquetaMesCorta } from "@/lib/dates";
import { formatearEur } from "@/lib/money";

registrarGraficos();

export interface PuntoEvolucion {
  mes: string;
  gastos: number;
  ingresos: number;
}

const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });

export default function GraficoEvolucion({ datos }: { datos: PuntoEvolucion[] }) {
  const { oculto } = useOculto();

  if (!datos.length) return null;

  // El eje Y pinta importes dentro del <canvas>, al que la regla de ocultado no
  // llega: con el dinero tapado se sustituye entero.
  if (oculto) {
    return (
      <p className="py-12 text-center text-sm text-suave">🔒 Gráfico oculto</p>
    );
  }

  return (
    <div className="h-60 w-full">
      <Bar
        data={{
          labels: datos.map((d) => etiquetaMesCorta(d.mes)),
          datasets: [
            {
              label: "Gastos",
              data: datos.map((d) => d.gastos),
              backgroundColor: "rgba(244, 63, 94, 0.75)",
              borderRadius: 6,
              maxBarThickness: 26,
            },
            {
              label: "Ingresos",
              data: datos.map((d) => d.ingresos),
              backgroundColor: "rgba(16, 185, 129, 0.75)",
              borderRadius: 6,
              maxBarThickness: 26,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 10, usePointStyle: true } },
            tooltip: {
              callbacks: { label: (c) => ` ${c.dataset.label}: ${formatearEur(Number(c.raw ?? 0))}` },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => formatearEur(Number(v)).replace(",00", "") },
              grid: { color: "rgba(100, 116, 139, 0.18)" },
            },
            x: { grid: { display: false } },
          },
        }}
      />
    </div>
  );
}
