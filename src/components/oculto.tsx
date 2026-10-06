"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { guardarOculto } from "@/app/actions";

/**
 * Botón del ojo: oculta todos los importes de la web.
 *
 * El estado vive en el cliente para que el botón responda al instante, pero la
 * preferencia se guarda en una cookie (ver `guardarOculto`) para que el servidor
 * la lea al pintar la página y no haya parpadeo al recargar.
 *
 * Cómo se tapan las cifras: la regla de `globals.css` vacía todo elemento con
 * `tabular-nums` que cuelgue de `[data-oculto]`. Por eso todo importe tiene que
 * ir en un elemento con esa clase, ya sea directamente o dentro de un
 * `<span className="tabular-nums">`.
 */

interface ValorOculto {
  oculto: boolean;
  cambiar: (siguiente: boolean) => void;
}

const Contexto = createContext<ValorOculto>({ oculto: false, cambiar: () => {} });

export function ProveedorOculto({
  inicial,
  children,
}: {
  inicial: boolean;
  children: ReactNode;
}) {
  const [oculto, setOculto] = useState(inicial);
  const [, iniciarTransicion] = useTransition();

  function cambiar(siguiente: boolean) {
    setOculto(siguiente);
    iniciarTransicion(async () => {
      await guardarOculto(siguiente);
    });
  }

  return (
    <Contexto value={{ oculto, cambiar }}>
      <div data-oculto={oculto ? "" : undefined}>{children}</div>
    </Contexto>
  );
}

export function useOculto(): ValorOculto {
  return useContext(Contexto);
}

/** Botón flotante con el que se muestra u oculta el dinero. */
export function BotonOculto() {
  const { oculto, cambiar } = useOculto();
  const etiqueta = oculto ? "Mostrar dinero" : "Ocultar dinero";

  return (
    <button
      type="button"
      onClick={() => cambiar(!oculto)}
      aria-pressed={oculto}
      aria-label={etiqueta}
      title={etiqueta}
      className="fixed left-1/2 z-50 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-borde bg-tarjeta text-lg shadow-lg active:scale-95"
      style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
    >
      <span aria-hidden>{oculto ? "🙈" : "👁"}</span>
    </button>
  );
}