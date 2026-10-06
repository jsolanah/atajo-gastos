import Link from "next/link";
import { notFound } from "next/navigation";
import { Tarjeta } from "@/components/ui";
import { FormularioPrestamo } from "@/components/formularios";
import { obtenerCategorias, obtenerCuentas, obtenerPrestamos } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editar préstamo · Mi dinero" };

export default async function PaginaEditarPrestamo(
  props: PageProps<"/prestamos/[id]/editar">,
) {
  const { id } = await props.params;
  const [prestamos, cuentas, categorias] = await Promise.all([
    obtenerPrestamos(),
    obtenerCuentas(),
    obtenerCategorias(),
  ]);
  const prestamo = prestamos.find((p) => p.id === id);
  if (!prestamo) notFound();

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-xl font-bold">Editar préstamo</h1>
        <p className="text-sm text-suave">{prestamo.nombre}</p>
      </header>
      <Tarjeta>
        <FormularioPrestamo
          prestamo={prestamo}
          cuentas={cuentas}
          categorias={categorias}
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
