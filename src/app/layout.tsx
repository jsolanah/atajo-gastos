import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import "./globals.css";
import Navegacion from "@/components/navegacion";
import { BotonOculto, ProveedorOculto } from "@/components/oculto";
import { COOKIE_OCULTO, OCULTO_SI } from "@/lib/oculto";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mi dinero",
  description: "Control personal de gastos, cuentas, traspasos y préstamos",
  appleWebApp: { capable: true, title: "Mi dinero", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // La cookie se lee aquí y no en el botón para que la página llegue ya
  // pintada con el dinero tapado si toca: sin parpadeo al abrir la web.
  const almacen = await cookies();
  const oculto = almacen.get(COOKIE_OCULTO)?.value === OCULTO_SI;

  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ProveedorOculto inicial={oculto}>
          <div className="mx-auto w-full max-w-3xl px-4 pt-4">{children}</div>
          {/* Dentro del proveedor a propósito: el botón lee el mismo estado que
              aplica el ocultado, si no siempre creería que el dinero se ve. */}
          <BotonOculto />
        </ProveedorOculto>
        <Navegacion />
      </body>
    </html>
  );
}