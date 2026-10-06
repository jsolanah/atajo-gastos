import Link from "next/link";
import { notFound } from "next/navigation";
import { Tarjeta, Aviso } from "@/components/ui";
import { FormularioAbono } from "@/components/formularios";
import { obtenerCuentas, obtenerEstadoPrestamo } from "@/lib/queries";
import { formatearEur } from "@/lib/money";

export const metadata = { title: "Abono al préstamo · Mi dinero" };
export const dynamic = "force-dynamic";

export default async function PaginaAbono(props: PageProps<"/prestamos/[id]/abono">) {
  const { id } = await props.params;
  const [estado, cuentas] = await Promise.all([obtenerEstadoPrestamo(id), obtenerCuentas()]);
  if (!estado) notFound();

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-xl font-bold">Abono al préstamo</h1>
        <p className="text-sm text-suave">
          {estado.prestamo.nombre} · quedan{" "}
          <span className="tabular-nums">{formatearEur(estado.capitalPendiente)}</span> de{" "}
          <span className="tabular-nums">{formatearEur(estado.prestamo.capital_inicial)}</span>
        </p>
      </header>

      <Aviso>
        Antes de hacerlo, mira las condiciones de tu banco: algunos cobran comisión por
        amortización anticipada o un mínimo de importe.
      </Aviso>

      <Tarjeta>
        <FormularioAbono
          prestamo={estado.prestamo}
          cuentas={cuentas}
          capitalPendiente={estado.capitalPendiente}
        />
      </Tarjeta>

      <p className="pb-2 text-center text-sm">
        <Link href="/prestamos" className="font-semibold text-blue-600 dark:text-blue-400">
          Volver a préstamos
        </Link>
      </p>
    </div>
  );
}