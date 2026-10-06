"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

let registrado = false;

export function registrarGraficos() {
  if (registrado) return;
  ChartJS.register(
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Legend,
    Tooltip,
  );
  registrado = true;
}
