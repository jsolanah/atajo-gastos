-- =============================================================================
-- atajo-gastos · Vaciar la base de datos
--
-- Borra TODO: cuentas, categorías, préstamos, pagos, plantillas y movimientos.
-- Deja la base con las tablas vacías, igual que después de ejecutar
-- `supabase/schema.sql`.
--
-- Úsalo cuando quieras quitarte los datos de ejemplo de `supabase/demo.sql`:
--
--   1. Ejecuta este fichero.
--   2. Ejecuta de nuevo `supabase/schema.sql` (es idempotente, no rompe nada).
--   3. Ya puedes meter tus cuentas desde la web.
--
-- ⚠️  Esto borra datos de verdad, también los tuyos.  ⚠️
-- No hay vuelta atrás: no es un `dry run`. Si te da miedo, míralo antes:
--
--   select 'cuentas', count(*) from public.cuentas
--   union all select 'movimientos', count(*) from public.movimientos;
--
-- -----------------------------------------------------------------------------
-- EL ORDEN IMPORTA
--
-- Los CHECK y las claves ajenas lo imponen: no puedes vaciar `cuentas` antes que
-- `movimientos`, ni `prestamos` antes que `pagos_prestamo` y `recurrentes`.
-- `cascade` se encarga de lo de abajo, pero el orden explícito deja el motivo
-- escrito para quien lea el fichero dentro de seis meses.
-- -----------------------------------------------------------------------------

-- Las hojas del libro: primero los movimientos, que cuelgan de todo lo demás.
truncate table public.movimientos;
truncate table public.pagos_prestamo;
truncate table public.recurrentes;
truncate table public.prestamos;

-- Los catálogos.
truncate table public.cuentas;
truncate table public.categorias;

-- Preferencias sueltas (el mes de arranque y compañía).
truncate table public.ajustes;

-- Si prefieres hacerlo todo de una vez, esto es equivalente a lo de arriba.
--   truncate table public.movimientos, public.pagos_prestamo, public.recurrentes,
--                    public.prestamos, public.cuentas, public.categorias,
--                    public.ajustes
--     restart identity cascade;
