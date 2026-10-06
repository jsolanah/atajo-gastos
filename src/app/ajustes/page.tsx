import Link from "next/link";
import { Tarjeta, Seccion, Aviso } from "@/components/ui";
import { FormularioCategoria } from "@/components/formularios";
import { AccionConConfirmacion, BOTON_PELIGROSO } from "@/components/acciones";
import { borrarCategoria } from "@/app/actions";
import { claveApiConfigurada, claveApiEsperada } from "@/lib/api-key";
import { obtenerCategorias } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ajustes · Mi dinero" };

function enmascarar(clave: string): string {
  if (clave.length < 10) return "•".repeat(clave.length);
  return `${clave.slice(0, 4)}${"•".repeat(8)}${clave.slice(-4)}`;
}

export default async function PaginaAjustes() {
  const categorias = await obtenerCategorias();
  const clave = claveApiConfigurada() ? claveApiEsperada() : "";
  const gastos = categorias.filter((c) => c.tipo === "gasto");
  const ingresos = categorias.filter((c) => c.tipo === "ingreso");

  return (
    <div className="space-y-5 pb-4">
      <header>
        <h1 className="text-xl font-bold">Ajustes</h1>
        <p className="text-sm text-suave">Categorías, atajo de iPhone y datos.</p>
      </header>

      <Seccion titulo="Atajo de iPhone">
        <Tarjeta>
          <p className="text-sm text-suave">
            Clave actual:{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
              {clave ? enmascarar(clave) : "API_KEY no configurada"}
            </code>
          </p>
          <p className="mt-2 text-sm">
            La clave completa vive en las variables de entorno del proyecto (en local,{" "}
            <code className="text-xs">.env.local</code>; en Vercel,{" "}
            <em>Project → Settings → Environment Variables</em>). Cópiala desde ahí para el Atajo.
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {[
              ["Registrar gasto", "POST /api/gasto", "{ importe, concepto, cuenta, categoria }"],
              ["Listas del atajo", "GET /api/opciones", "cuentas + categorías"],
              ["Resumen del mes", "GET /api/resumen?mes=2026-09", "totales y fijos"],
            ].map(([titulo, endpoint, cuerpo]) => (
              <li key={endpoint} className="rounded-xl border border-borde p-2.5">
                <p className="font-semibold">{titulo}</p>
                <p className="text-suave">
                  <code>{endpoint}</code> · cabecera <code>x-api-key</code>
                </p>
                <p className="text-suave">
                  <code>{cuerpo}</code>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-suave">
            Guía paso a paso en{" "}
            <code>GUIA-ATAJO.md</code> del repositorio.
          </p>
        </Tarjeta>
      </Seccion>

      <Seccion
        titulo={`Categorías de gasto (${gastos.length})`}
        accion={
          <Link href="/api/exportar" className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            Exportar CSV
          </Link>
        }
      >
        <Tarjeta>
          <FormularioCategoria />
        </Tarjeta>
        <ul className="mt-3 space-y-1.5">
          {gastos.map((c) => (
            <li key={c.id} className="rounded-xl border border-borde bg-tarjeta px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{c.nombre}</span>
                <details className="shrink-0">
                  <summary className="cursor-pointer text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Editar
                  </summary>
                  <div className="mt-2 w-64 rounded-xl border border-borde p-2">
                    <FormularioCategoria categoria={c} />
                  </div>
                </details>
                <AccionConConfirmacion
                  accion={borrarCategoria.bind(null, c.id)}
                  mensaje={`¿Borrar la categoría "${c.nombre}"? Los movimientos se quedan sin categoría.`}
                  className={BOTON_PELIGROSO}
                >
                  ✕
                </AccionConConfirmacion>
              </div>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo={`Categorías de ingreso (${ingresos.length})`}>
        <ul className="space-y-1.5">
          {ingresos.map((c) => (
            <li key={c.id} className="rounded-xl border border-borde bg-tarjeta px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{c.nombre}</span>
                <details className="shrink-0">
                  <summary className="cursor-pointer text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Editar
                  </summary>
                  <div className="mt-2 w-64 rounded-xl border border-borde p-2">
                    <FormularioCategoria categoria={c} />
                  </div>
                </details>
                <AccionConConfirmacion
                  accion={borrarCategoria.bind(null, c.id)}
                  mensaje={`¿Borrar la categoría "${c.nombre}"?`}
                  className={BOTON_PELIGROSO}
                >
                  ✕
                </AccionConConfirmacion>
              </div>
            </li>
          ))}
          {!ingresos.length ? (
            <li className="rounded-xl border border-dashed border-borde px-3 py-6 text-center text-sm text-suave">
              Añade arriba una categoría de tipo «Ingreso».
            </li>
          ) : null}
        </ul>
      </Seccion>

      <Aviso>
        La app no tiene login: está pensada para uso personal. Si el dominio queda público,
        conviene protegerlo con una contraseña de despliegue en Vercel (Deployment Protection) o
        añadir autenticación más adelante.
      </Aviso>
    </div>
  );
}
