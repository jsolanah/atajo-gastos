import Link from "next/link";
import { Tarjeta } from "@/components/ui";
import { FormularioPrestamo } from "@/components/formularios";
import { obtenerCategorias, obtenerCuentas } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuevo préstamo · Mi dinero" };

export default async function PaginaNuevoPrestamo() {
  const [cuentas, categorias] = await Promise.all([obtenerCuentas(), obtenerCategorias()]);

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-xl font-bold">Nuevo préstamo</h1>
        <p className="text-sm text-suave">
          La cuota fija se puede registrar aparte como pago fijo en la sección de Fijos.
        </p>
      </header>
      <Tarjeta>
        <FormularioPrestamo cuentas={cuentas} categorias={categorias} />
      </Tarjeta>
      <p className="pb-2 text-center text-sm">
        <Link href="/prestamos" className="font-semibold text-blue-600 dark:text-blue-400">
          Volver a préstamos
        </Link>
      </p>
    </div>
  );
}
