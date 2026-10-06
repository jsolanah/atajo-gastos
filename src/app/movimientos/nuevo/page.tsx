import Link from "next/link";
import { Tarjeta } from "@/components/ui";
import { FormularioMovimiento } from "@/components/formularios";
import { obtenerCategorias, obtenerCuentas } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuevo movimiento · Mi dinero" };

export default async function PaginaNuevoMovimiento() {
  const [cuentas, categorias] = await Promise.all([obtenerCuentas(), obtenerCategorias()]);

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-xl font-bold">Nuevo movimiento</h1>
        <p className="text-sm text-suave">
          Es exactamente lo mismo que envía el Atajo del iPhone.
        </p>
      </header>

      {!cuentas.length ? (
        <p className="rounded-xl border border-dashed border-borde px-4 py-6 text-center text-sm text-suave">
          Primero crea una cuenta en{" "}
          <Link href="/cuentas" className="font-semibold text-blue-600 dark:text-blue-400">
            Cuentas
          </Link>
          .
        </p>
      ) : (
        <Tarjeta>
          <FormularioMovimiento cuentas={cuentas} categorias={categorias} />
        </Tarjeta>
      )}
    </div>
  );
}
