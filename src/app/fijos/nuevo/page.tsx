import Link from "next/link";
import { Tarjeta } from "@/components/ui";
import { FormularioRecurrente } from "@/components/formularios";
import { obtenerCategorias, obtenerCuentas } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuevo pago fijo · Mi dinero" };

export default async function PaginaNuevoFijo() {
  const [cuentas, categorias] = await Promise.all([obtenerCuentas(), obtenerCategorias()]);

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-xl font-bold">Nuevo pago fijo</h1>
        <p className="text-sm text-suave">
          Aparecerá cada mes para que confirmes si se ha pagado.
        </p>
      </header>
      <Tarjeta>
        <FormularioRecurrente cuentas={cuentas} categorias={categorias} />
      </Tarjeta>
      <p className="pb-2 text-center text-sm">
        <Link href="/fijos" className="font-semibold text-blue-600 dark:text-blue-400">
          Volver a pagos fijos
        </Link>
      </p>
    </div>
  );
}
