import Link from "next/link";
import { notFound } from "next/navigation";
import { Tarjeta, Aviso } from "@/components/ui";
import { FormularioCuenta } from "@/components/formularios";
import { obtenerCuenta } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editar cuenta · Mi dinero" };

export default async function PaginaEditarCuenta(props: PageProps<"/cuentas/[id]/editar">) {
  const { id } = await props.params;
  const cuenta = await obtenerCuenta(id);
  if (!cuenta) notFound();

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-xl font-bold">Editar cuenta</h1>
        <p className="text-sm text-suave">{cuenta.nombre}</p>
      </header>
      <Aviso>
        Cambiar el saldo inicial recalcula el saldo actual de la cuenta y el patrimonio total.
      </Aviso>
      <Tarjeta>
        <FormularioCuenta cuenta={cuenta} />
      </Tarjeta>
      <p className="pb-2 text-center text-sm">
        <Link href="/cuentas" className="font-semibold text-blue-600 dark:text-blue-400">
          Volver a cuentas
        </Link>
      </p>
    </div>
  );
}
