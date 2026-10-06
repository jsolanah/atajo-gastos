import Link from "next/link";
import { notFound } from "next/navigation";
import { Tarjeta, Aviso } from "@/components/ui";
import { FormularioMovimiento } from "@/components/formularios";
import { AccionConConfirmacion, BOTON_PELIGROSO } from "@/components/acciones";
import { borrarMovimiento } from "@/app/actions";
import { obtenerCategorias, obtenerCuentas, movimientoPorId } from "@/lib/queries";
import { formatearEur } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editar movimiento · Mi dinero" };

export default async function PaginaEditarMovimiento(props: PageProps<"/movimientos/[id]/editar">) {
  const { id } = await props.params;
  const movimiento = await movimientoPorId(id);
  if (!movimiento) notFound();

  const [cuentas, categorias] = await Promise.all([obtenerCuentas(), obtenerCategorias()]);

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-xl font-bold">Editar movimiento</h1>
        <p className="text-sm text-suave">
          {movimiento.descripcion} ·{" "}
          <span className="tabular-nums">{formatearEur(movimiento.importe)}</span>
        </p>
      </header>

      {movimiento.recurrente_id ? (
        <Aviso>
          Este movimiento viene de un pago fijo. Si lo editas seguirá siendo un movimiento manual
          (para no romper la confirmación mensual).
        </Aviso>
      ) : null}

      <Tarjeta>
        <FormularioMovimiento
          cuentas={cuentas}
          categorias={categorias}
          movimiento={movimiento}
        />
      </Tarjeta>

      <div className="flex items-center justify-between">
        <Link href="/movimientos" className="text-sm font-semibold text-blue-600 dark:text-blue-400">
          Volver
        </Link>
        <AccionConConfirmacion
          accion={borrarMovimiento.bind(null, movimiento.id)}
          mensaje={`¿Borrar "${movimiento.descripcion}"?`}
          className={BOTON_PELIGROSO}
        >
          Borrar movimiento
        </AccionConConfirmacion>
      </div>
    </div>
  );
}
