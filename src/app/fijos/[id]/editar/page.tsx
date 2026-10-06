import Link from "next/link";
import { notFound } from "next/navigation";
import { Tarjeta } from "@/components/ui";
import { FormularioRecurrente } from "@/components/formularios";
import { AccionConConfirmacion, BOTON_PELIGROSO } from "@/components/acciones";
import { borrarRecurrente } from "@/app/actions";
import { obtenerCategorias, obtenerCuentas, obtenerRecurrentes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editar pago fijo · Mi dinero" };

export default async function PaginaEditarFijo(props: PageProps<"/fijos/[id]/editar">) {
  const { id } = await props.params;
  const [recurrentes, cuentas, categorias] = await Promise.all([
    obtenerRecurrentes(),
    obtenerCuentas(),
    obtenerCategorias(),
  ]);
  const recurrente = recurrentes.find((r) => r.id === id);
  if (!recurrente) notFound();

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-xl font-bold">Editar pago fijo</h1>
        <p className="text-sm text-suave">{recurrente.concepto}</p>
      </header>
      <Tarjeta>
        <FormularioRecurrente
          recurrente={recurrente}
          cuentas={cuentas}
          categorias={categorias}
        />
      </Tarjeta>
      <div className="flex items-center justify-between">
        <Link href="/fijos" className="text-sm font-semibold text-blue-600 dark:text-blue-400">
          Volver
        </Link>
        <AccionConConfirmacion
          accion={borrarRecurrente.bind(null, recurrente.id)}
          mensaje={`¿Borrar "${recurrente.concepto}"?`}
          className={BOTON_PELIGROSO}
        >
          Borrar plantilla
        </AccionConConfirmacion>
      </div>
    </div>
  );
}
