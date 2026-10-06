import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cache: SupabaseClient | null | undefined;

export function supabaseConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Cliente de Supabase para uso exclusivo del servidor (Server Components,
 * Server Actions y Route Handlers). Usa la service_role porque las tablas
 * tienen RLS activado sin políticas: así la clave nunca llega al navegador.
 */
export function getSupabase(): SupabaseClient | null {
  if (cache !== undefined) return cache;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    cache = null;
    return null;
  }

  cache = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
  return cache;
}

/** Igual que getSupabase pero lanza si falta la configuración. */
export function supabaseRequerido(): SupabaseClient {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
  }
  return supabase;
}

/** Traduce el error de PostgREST a un mensaje legible. */
export function mensajeDeError(error: { message: string; code?: string } | null): string {
  if (!error) return "Error desconocido";
  switch (error.code) {
    case "23505":
      return "Ya existe un registro con esos datos (¿duplicado?).";
    case "23503":
      return "No se puede: hay movimientos asociados a ese registro.";
    case "23514":
      return "Algún valor no cumple las reglas de la base de datos (revisa importes y cuentas).";
    case "PGRST116":
      return "No se encontró el registro.";
    default:
      return error.message;
  }
}