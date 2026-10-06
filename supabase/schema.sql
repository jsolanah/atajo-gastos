-- =============================================================================
-- atajo-gastos · Esquema de base de datos (Supabase / PostgreSQL)
--
-- Crea TODAS las tablas, índices y políticas RLS. **No inserta ni un solo
-- dato**: la base queda vacía y cada persona introduce sus cuentas, sus
-- saldos, sus gastos y sus préstamos desde la web.
--
-- Ejecutar en el SQL Editor de Supabase (una sola vez). Es idempotente: puedes
-- volver a ejecutarlo sin romper nada.
--
-- Este fichero es el estado FINAL del esquema. No hay migraciones aparte.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Cuentas
--
-- `saldo_inicial` es lo que había en la cuenta el día de `fecha_saldo`. El
-- saldo de hoy se deriva: saldo inicial + todos los movimientos.
--
-- El tipo solo agrupa: no cambia los cálculos. 'efectivo' es el dinero en
-- metálico (la cartera, el banco de una calle) para que puedasLlevarlo como
-- una cuenta más: los traspasos hacia o desde ahí son los que usas para sacar
-- o meter dinero, y los gastos en efectivo salen de ella igual que de un banco.
-- -----------------------------------------------------------------------------
create table if not exists public.cuentas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text        not null unique,
  entidad       text        not null default '',
  tipo          text        not null default 'corriente'
                            check (tipo in ('corriente', 'ahorro', 'inversion', 'efectivo')),
  saldo_inicial numeric(12,2) not null default 0,
  fecha_saldo   date        not null default current_date,
  color         text        not null default '#64748b',
  orden         integer     not null default 0,
  activa        boolean     not null default true,
  created_at    timestamptz not null default now()
);

comment on column public.cuentas.tipo is
  'corriente (liquidez) · ahorro · inversion · efectivo (dinero en metálico). Solo agrupa: no cambia los cálculos.';

-- -----------------------------------------------------------------------------
-- Categorías
-- -----------------------------------------------------------------------------
create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  nombre     text        not null unique,
  tipo       text        not null default 'gasto' check (tipo in ('gasto', 'ingreso')),
  color      text        not null default '#94a3b8',
  orden      integer     not null default 0,
  activa     boolean     not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Préstamos
--
-- El capital pendiente NO se guarda: la app lo deriva de los pagos
-- registrados, mes a mes, aplicando el interés. `capital_pendiente` se queda
-- por compatibilidad con consultas a mano, pero el código no la escribe ni la
-- lee. Si el préstamo es antiguo, `saldo_referencia` + `fecha_referencia`
-- anclan el cálculo a la cifra que dice el banco.
-- -----------------------------------------------------------------------------
create table if not exists public.prestamos (
  id                uuid primary key default gen_random_uuid(),
  nombre            text        not null,
  capital_inicial   numeric(12,2) not null check (capital_inicial >= 0),
  capital_pendiente numeric(12,2) not null check (capital_pendiente >= 0),
  cuota             numeric(12,2) not null check (cuota > 0),
  fecha_inicio      date        not null default current_date,
  interes_anual     numeric(6,3),
  interes_modo      text        check (interes_modo in ('tan', 'tae')),
  numero_cuotas     integer     check (numero_cuotas > 0),
  saldo_referencia  numeric(12,2) check (saldo_referencia >= 0),
  fecha_referencia  date,
  cuenta_origen     uuid        references public.cuentas (id) on delete restrict,
  categoria_id      uuid        references public.categorias (id) on delete set null,
  notas             text,
  created_at        timestamptz not null default now()
);

comment on column public.prestamos.capital_pendiente is
  'Solo informativa: la app deriva el capital pendiente de los pagos registrados.';
comment on column public.prestamos.interes_anual is
  'Tipo de interés anual en %, tal y como aparece en el contrato.';
comment on column public.prestamos.interes_modo is
  'tan = nominal (se divide entre 12) · tae = efectiva (se compone)';
comment on column public.prestamos.saldo_referencia is
  'Capital pendiente según el banco en fecha_referencia. Los pagos anteriores se ignoran.';
comment on column public.prestamos.fecha_referencia is
  'Fecha a la que se refiere saldo_referencia.';

-- -----------------------------------------------------------------------------
-- Abonos de préstamo: pagar de más para quitarse cuotas por delante
--
-- Cada abono hace tres cosas: baja el capital pendiente, registra un gasto en
-- la cuenta elegida (para que el saldo baje de verdad) y, si eliges BAJAR LA
-- CUOTA, actualiza el pago fijo correspondiente.
--
-- Que el abono no supere el capital pendiente no se puede expresar con un
-- CHECK (haría falta una subconsulta a `prestamos`): lo valida la Server
-- Action `registrarAbonoPrestamo`, que lee y escribe en la misma operación.
-- -----------------------------------------------------------------------------
create table if not exists public.pagos_prestamo (
  id               uuid primary key default gen_random_uuid(),
  prestamo_id      uuid        not null references public.prestamos (id) on delete cascade,
  fecha            date        not null default current_date,
  importe          numeric(12,2) not null check (importe > 0),
  modo             text        not null default 'reducir_plazo'
                              check (modo in ('reducir_plazo', 'reducir_cuota')),
  cuenta_id        uuid        references public.cuentas (id) on delete restrict,
  movimiento_id    uuid        references public.movimientos (id) on delete set null,
  cuota_resultante numeric(12,2),
  cuota_previa     numeric(12,2),
  notas            text,
  created_at       timestamptz not null default now()
);

create index if not exists pagos_prestamo_prestamo_idx
  on public.pagos_prestamo (prestamo_id, fecha desc);

comment on column public.pagos_prestamo.cuota_previa is
  'Cuota mensual del préstamo antes de este abono (para poder devolverla al deshacer).';
comment on column public.pagos_prestamo.cuota_resultante is
  'Cuota mensual del préstamo después de este abono.';

-- -----------------------------------------------------------------------------
-- Plantillas recurrentes: gastos fijos, ingresos fijos (nómina) y traspasos
--
-- No se aplican solas: cada mes aparecen en el panel de confirmaciones y
-- pulsas *Confirmar* en los que de verdad pagas, y ese movimiento ya cuenta.
--
-- `mes_inicio` evita proponer una plantilla en meses anteriores a su primer
-- cobro real (por ejemplo, una nómina cuya primera vez ya está dentro del
-- saldo inicial).
-- -----------------------------------------------------------------------------
create table if not exists public.recurrentes (
  id              uuid primary key default gen_random_uuid(),
  concepto        text        not null,
  tipo            text        not null check (tipo in ('gasto', 'ingreso', 'traspaso')),
  importe         numeric(12,2) not null check (importe > 0),
  dia             integer     not null check (dia between 1 and 31),
  mes_inicio      date        not null default date '2000-01-01',
  cuenta_origen   uuid        references public.cuentas (id) on delete restrict,
  cuenta_destino  uuid        references public.cuentas (id) on delete restrict,
  categoria_id    uuid        references public.categorias (id) on delete set null,
  prestamo_id     uuid        references public.prestamos (id) on delete cascade,
  activo          boolean     not null default true,
  created_at      timestamptz not null default now(),
  constraint recurrentes_cuentas check (
    (tipo = 'gasto'      and cuenta_origen is not null and cuenta_destino is null)
    or (tipo = 'ingreso'  and cuenta_origen is null     and cuenta_destino is not null)
    or (tipo = 'traspaso' and cuenta_origen is not null and cuenta_destino is not null
                                           and cuenta_origen <> cuenta_destino)
  )
);

create index if not exists recurrentes_activo_idx on public.recurrentes (activo, mes_inicio);

-- -----------------------------------------------------------------------------
-- Movimientos (libro único: gastos + ingresos + traspasos internos)
--
-- Saldo de una cuenta = saldo inicial + Σ movimientos. Por eso un traspaso no
-- cuenta ni como gasto ni como ingreso: solo mueve el dinero de sitio.
-- -----------------------------------------------------------------------------
create table if not exists public.movimientos (
  id                uuid primary key default gen_random_uuid(),
  tipo              text        not null check (tipo in ('gasto', 'ingreso', 'traspaso')),
  importe           numeric(12,2) not null check (importe > 0),
  descripcion       text        not null,
  categoria_id      uuid        references public.categorias (id) on delete set null,
  cuenta_origen     uuid        references public.cuentas (id) on delete restrict,
  cuenta_destino    uuid        references public.cuentas (id) on delete restrict,
  fecha             date        not null default current_date,
  recurrente_id     uuid        references public.recurrentes (id) on delete set null,
  prestamo_id       uuid        references public.prestamos (id) on delete set null,
  pago_prestamo_id  uuid        references public.pagos_prestamo (id) on delete set null,
  notas             text,
  origen            text        not null default 'web' check (origen in ('web', 'atajo')),
  created_at        timestamptz not null default now(),
  constraint movimientos_cuentas check (
    (tipo = 'gasto'      and cuenta_origen is not null and cuenta_destino is null)
    or (tipo = 'ingreso'  and cuenta_origen is null     and cuenta_destino is not null)
    or (tipo = 'traspaso' and cuenta_origen is not null and cuenta_destino is not null
                                           and cuenta_origen <> cuenta_destino)
  )
);

create index if not exists movimientos_fecha_idx        on public.movimientos (fecha desc);
create index if not exists movimientos_origen_idx      on public.movimientos (cuenta_origen);
create index if not exists movimientos_destino_idx     on public.movimientos (cuenta_destino);
create index if not exists movimientos_categoria_idx   on public.movimientos (categoria_id);
create index if not exists movimientos_recurrente_idx  on public.movimientos (recurrente_id);
create index if not exists movimientos_pago_prestamo_idx on public.movimientos (pago_prestamo_id);

-- Un mismo recurrente no puede confirmarse dos veces en el mismo mes.
-- El cast a timestamp (sin zona horaria) es necesario: la sobrecarga
-- date_trunc(text, timestamptz) es STABLE y los índices exigen IMMUTABLE.
create unique index if not exists movimientos_recurrente_mes_idx
  on public.movimientos (recurrente_id, (date_trunc('month', fecha::timestamp)::date))
  where recurrente_id is not null;

-- -----------------------------------------------------------------------------
-- Ajustes (valores sueltos: preferencias, mes de arranque…)
-- -----------------------------------------------------------------------------
create table if not exists public.ajustes (
  clave      text primary key,
  valor      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Row Level Security: sin políticas, solo service_role (que la ignora).
-- Toda la app accede desde el servidor con la service_role; la clave anónima
-- de Supabase nunca llega al navegador.
-- -----------------------------------------------------------------------------
alter table public.cuentas       enable row level security;
alter table public.categorias     enable row level security;
alter table public.prestamos     enable row level security;
alter table public.pagos_prestamo enable row level security;
alter table public.recurrentes   enable row level security;
alter table public.movimientos   enable row level security;
alter table public.ajustes       enable row level security;

-- -----------------------------------------------------------------------------
-- Si YA TENÍAS la base de datos creada con una versión anterior de este
-- fichero, `create table if not exists` no hace nada y el tipo 'efectivo' se te
-- quedaría rejecting. Ejecuta esto UNA vez (es idempotente):
--
--   alter table public.cuentas drop constraint if exists cuentas_tipo_check;
--   alter table public.cuentas add constraint cuentas_tipo_check
--     check (tipo in ('corriente', 'ahorro', 'inversion', 'efectivo'));
--
-- Y da de alta tu cuenta de efectivo, con el dinero que tengas encima hoy:
--
--   insert into public.cuentas (nombre, tipo, saldo_inicial, fecha_saldo, color, orden)
--   values ('Efectivo', 'efectivo', 0, current_date, '#22c55e', 6)
--   on conflict (nombre) do nothing;
--
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- OPCIONAL · un botón de categorías de muestra
--
-- Está comentado a propósito: este fichero no debe dejar datos. Si al empezar
-- te viene bien no teclear 19 categorías, descomenta el INSERT de abajo; si
-- prefieres la lista vacía, no hagas nada y créalas en *Ajustes*.
--
-- Para tus cuentas, tu saldo y tus movimientos, usa los formularios de la web
-- (Cuentas → + Nueva, Movimientos → + Nuevo, Fijos → + Nuevo). El patrón por
-- SQL sería:
--
--   insert into public.cuentas (nombre, entidad, tipo, saldo_inicial, fecha_saldo, color, orden)
--   values ('Mi cuenta', 'Un banco', 'corriente', 0, current_date, '#2563eb', 1);
--
-- `saldo_inicial` es lo que había en la cuenta el día de `fecha_saldo`: a
-- partir de ahí la app lleva el saldo sola sumando movimientos, así que no hace
-- falta meter el histórico anterior a esa fecha.
-- -----------------------------------------------------------------------------
-- insert into public.categorias (nombre, tipo, color, orden) values
--   ('Supermercado',  'gasto',   '#16a34a', 1),
--   ('Comida fuera',  'gasto',   '#22c55e', 2),
--   ('Transporte',    'gasto',   '#0891b2', 3),
--   ('Gasolina',      'gasto',   '#0ea5e9', 4),
--   ('Casa',          'gasto',   '#f59e0b', 5),
--   ('Suministros',   'gasto',   '#facc15', 6),
--   ('Salud',         'gasto',   '#ef4444', 7),
--   ('Ocio',          'gasto',   '#db2777', 8),
--   ('Suscripciones', 'gasto',   '#9333ea', 9),
--   ('Ropa',          'gasto',   '#ec4899', 10),
--   ('Viajes',        'gasto',   '#0d9488', 11),
--   ('Regalos',       'gasto',   '#e11d48', 12),
--   ('Préstamos',     'gasto',   '#64748b', 13),
--   ('Impuestos',     'gasto',   '#475569', 14),
--   ('Otros gastos',  'gasto',   '#94a3b8', 15),
--   ('Nómina',        'ingreso', '#059669', 16),
--   ('Freelance',     'ingreso', '#10b981', 17),
--   ('Otros ingresos','ingreso', '#34d399', 18),
--   ('Rendimientos',  'ingreso', '#6ee7b7', 19)
-- on conflict (nombre) do nothing;