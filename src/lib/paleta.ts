/** Paleta de colores para cuentas y categorías. */
export const PALETA = [
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#f59e0b",
  "#ef4444",
  "#0d9488",
  "#9333ea",
  "#64748b",
  "#059669",
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#db2777",
];

export function colorPorIndice(indice: number): string {
  return PALETA[indice % PALETA.length];
}