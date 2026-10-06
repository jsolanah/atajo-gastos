"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/", etiqueta: "Inicio", icono: "🏠" },
  { href: "/movimientos", etiqueta: "Gastos", icono: "💸" },
  { href: "/fijos", etiqueta: "Fijos", icono: "🔁" },
  { href: "/cuentas", etiqueta: "Cuentas", icono: "🏦" },
  { href: "/ajustes", etiqueta: "Ajustes", icono: "⚙️" },
];

export default function Navegacion() {
  const ruta = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-borde bg-tarjeta/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
        {PESTANAS.map((pestana) => {
          const activa = ruta === pestana.href;
          return (
            <Link
              key={pestana.href}
              href={pestana.href}
              aria-current={activa ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                activa ? "text-blue-600 dark:text-blue-400" : "text-suave"
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {pestana.icono}
              </span>
              {pestana.etiqueta}
            </Link>
          );
        })}
      </div>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}