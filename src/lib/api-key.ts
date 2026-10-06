/**
 * Autenticación de la API del Atajo de iOS.
 *
 * El Atajo envía la variable de entorno API_KEY en la cabecera `x-api-key`.
 * La comparación es de tiempo constante para no filtrar información por
 * análisis temporal.
 */

function comparar(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function normalizar(valor: string): string {
  return valor.trim().toLowerCase().replace(/\s+/g, "");
}

export function claveApiConfigurada(): boolean {
  return Boolean(process.env.API_KEY && process.env.API_KEY.trim().length > 0);
}

export function claveApiEsperada(): string {
  return (process.env.API_KEY ?? "").trim();
}

/** Extrae la clave de la petición (cabecera x-api-key o Authorization Bearer). */
export function claveApiDeLaPeticion(request: Request): string {
  const headers = request.headers;
  const directa = headers.get("x-api-key");
  if (directa) return directa.trim();
  const auth = headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

export function claveApiValida(valor: string): boolean {
  const esperada = claveApiEsperada();
  if (!esperada || !valor) return false;
  return comparar(normalizar(esperada), normalizar(valor));
}

/** true si la petición lleva una clave válida. */
export function peticiónAutorizada(request: Request): boolean {
  return claveApiValida(claveApiDeLaPeticion(request));
}