import Link from "next/link";
import { Tarjeta } from "@/components/ui";
import { FormularioCuenta } from "@/components/formularios";
import { obtenerCuentas } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nueva cuenta · Mi dinero" };

export default async function PaginaNuevaCuenta() {
  const cuentas = await obtenerCuentas();

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-xl font-bold">Nueva cuenta</h1>
        <p className="text-sm text-suave">
          El saldo inicial es el dinero que tenías en la cuenta el día que empezaste a usar la app.
        </p>
      </header>
      <Tarjeta>
        <FormularioCuenta />
      </Tarjeta>
      {cuentas.length ? (
        <p className="pb-2 text-center text-sm">
          Ya tienes {cuentas.length} cuenta(s).{" "}
          <Link href="/cuentas" className="font-semibold text-blue-600 dark:text-blue-400">
            Ver cuentas
          </Link>
        </p>
      ) : null}
    </div>
  );
}
