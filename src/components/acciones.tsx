"use client";

import type { ReactNode } from "react";
import { useOculto } from "@/components/oculto";
import { formatearEur } from "@/lib/money";

/** Texto con el que se sustituye un importe en los diálogos de confirmación. */
const OCULTO = "••• €";

/**
 * Botón que pide confirmación antes de ejecutar una Server Action.
 *
 * `importes` son las cifras que aparecen dentro de `mensaje`: con el dinero
 * oculto se sustituyen por "••• €". Es un `window.confirm` nativo, así que la
 * regla de ocultado por CSS no puede llegar ahí.
 */
export function AccionConConfirmacion({
  accion,
  mensaje,
  importes,
  children,
  className = "",
  title,
}: {
  accion: () => Promise<void>;
  mensaje?: string;
  importes?: number[];
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const { oculto } = useOculto();
  const texto = mensaje && oculto
    ? importes?.reduce((t, importe) => t.replaceAll(formatearEur(importe), OCULTO), mensaje) ?? mensaje
    : mensaje;

  return (
    <form
      action={accion}
      onSubmit={(evento) => {
        if (texto && !window.confirm(texto)) evento.preventDefault();
      }}
    >
      <button type="submit" title={title} className={className}>
        {children}
      </button>
    </form>
  );
}

export const BOTON_SECUNDARIO =
  "rounded-lg border border-borde bg-tarjeta px-2.5 py-1 text-xs font-semibold text-suave";
export const BOTON_PELIGROSO =
  "rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:border-rose-900";
export const BOTON_OK =
  "rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
