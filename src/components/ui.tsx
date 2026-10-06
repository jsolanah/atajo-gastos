import Link from "next/link";
import type { ReactNode } from "react";

export function Tarjeta({
  children,
  className = "",
  titulo,
}: {
  children: ReactNode;
  className?: string;
  titulo?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-borde bg-tarjeta p-4 shadow-sm ${className}`}
    >
      {titulo ? (
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-suave uppercase">
          {titulo}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export function Seccion({
  titulo,
  children,
  accion,
}: {
  titulo: ReactNode;
  children: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <header className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold tracking-wide text-suave uppercase">{titulo}</h2>
        {accion}
      </header>
      {children}
    </section>
  );
}

export function Aviso({ children, tono = "info" }: { children: ReactNode; tono?: "info" | "ok" | "error" }) {
  const estilos = {
    info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    error:
      "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100",
  }[tono];

  return (
    <p className={`rounded-xl border px-3 py-2 text-sm ${estilos}`}>{children}</p>
  );
}

export function EnlaceMesVacio({ texto = "Añadir movimiento" }: { texto?: string }) {
  return (
    <p className="rounded-xl border border-dashed border-borde px-3 py-6 text-center text-sm text-suave">
      {texto}{" "}
      <Link href="/movimientos/nuevo" className="font-semibold text-blue-600 underline dark:text-blue-400">
        Añadir
      </Link>
    </p>
  );
}
