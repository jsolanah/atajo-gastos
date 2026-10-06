# Mi dinero · control de gastos personal

Aplicación web para llevar las cuentas de casa (gastos, ingresos, traspasos entre cuentas y
préstamos) con un **Atajo de iOS** que registra cada gasto sin abrir la web.

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **Supabase** (PostgreSQL) como base de datos
- **Vercel** para el despliegue
- **Chart.js** vía `react-chartjs-2` para los gráficos

> [!WARNING]
> **Esta app no tiene login.** Es de uso personal y está pensada para una sola persona, así que
> quien conozca la URL puede ver los saldos y los movimientos. Si la despliegas en una URL
> pública, no la compartas: se lee con que alguien tenga el enlace. Ver
> [Seguridad](#seguridad) para cómo poner un PIN encima.

---

## 0. Licencia y datos

- **MIT** (ver [LICENSE](LICENSE)). Úsala como quieras, incluida comercialmente.
- **`supabase/schema.sql` no inserta ni una sola fila.** Al ejecutarlo tu base queda vacía y
  introduces todo desde la web.
- **Los tests no llevan datos reales.** Los bancos, los saldos y el préstamo de
  `src/lib/*.test.ts` son inventados y redondos, precisamente porque el repo se publica.

---

## 1. Puesta en marcha

### 1.1. Dependencias

```bash
npm install
```

### 1.2. Base de datos en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Abre **SQL Editor → New query**.
3. Pega y ejecuta `supabase/schema.sql`. Ya está.

Es un único fichero y es idempotente: puedes volver a ejecutarlo sin romper nada.

**No hay datos de nadie.** `schema.sql` crea todas las tablas, índices y RLS pero **no inserta ni
una sola fila**: la base queda vacía y cada persona introduce sus cuentas, saldos, pagos fijos,
préstamos y movimientos desde la web. Al final del fichero tienes, commented, un botón de 19
categorías de muestra y el patrón de SQL para meter una cuenta con su saldo, por si prefieres no
empezar de cero.

#### ¿Quieres verla llena antes de empezar?

Opcional: después de `schema.sql`, ejecuta `supabase/demo.sql`. Inserta **datos inventados**
(4 cuentas, 19 categorías, un préstamo de ejemplo y unos meses de movimientos) para que puedas abrir
la app y ver los gráficos con algo dentro sin teclear nada.

```bash
# borra los datos de ejemplo (el orden de las tablas lo impone el fichero)
# en Supabase: SQL Editor -> New query -> pega supabase/reset.sql -> Run
```

**Son ficticios.** Antes de meter tus cuentas de verdad, bórralos con el `truncate` que lleva al
principio del propio `demo.sql`.

### 1.3. Variables de entorno

```bash
cp .env.example .env.local
```

Rellena:

| Variable | Dónde se copia |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → *service_role* |
| `API_KEY` | La inventas tú: `openssl rand -hex 24` |

`SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor. Todas las tablas tienen **RLS activado sin
políticas**, así que la clave anónima de Supabase no da acceso a nada.

### 1.4. Arrancar y dar de alta tus cuentas

```bash
npm run dev
```

Abre <http://localhost:3000>. Arrancarás con el patrimonio a 0 € y sin ninguna cuenta, así que el
primer paso es crear las tuyas:

1. **Cuentas → + Nueva**, una por una. Pon el nombre, el tipo (Liquidez, Ahorro, Inversión o
   Efectivo), un color y el **saldo que había en la cuenta el día que elijas como `Fecha del
   saldo`**. No hace falta que metas los movimientos anteriores a esa fecha: a partir de ahí la app
   lleva el saldo sola.
2. **Fijos → + Nuevo**, para el alquiler, los suministros, la nómina o las aportaciones de ahorro.
   Cada mes saldrán en el panel y pulsarás *Confirmar* solo en los que de verdad pagas.
3. **Movimientos → + Nuevo**, para cada compra, ingreso o traspaso que vayas apuntando.
4. **Préstamos → Nuevo**, si tienes alguno. Los antiguos se anclan con *Editar datos → Cuadrar con
   el banco* en vez de meter el histórico.
5. **Ajustes**, para crear o retocar las categorías con las que etiquetas tus movimientos.

---

## 2. Cómo funciona el dinero

Un único libro de movimientos con tres tipos:

| Tipo | Qué hace | Ejemplo |
| --- | --- | --- |
| `gasto` | Sale de una cuenta | Compra en el súper (−12,50 € desde una cuenta) |
| `ingreso` | Entra en una cuenta | Nómina (a una cuenta) |
| `traspaso` | Sale de una cuenta y entra en otra | Los 400 € que van de una a otra |

**Saldo de una cuenta = saldo inicial + Σ movimientos.** Por eso los traspasos no cuentan ni como
gasto ni como ingreso: solo mueven el dinero de sitio.

### El dinero en efectivo también es una cuenta

El tipo `efectivo` existe para que el metálico cuente igual que el banco. Se usa como cualquier
otra cuenta, solo que sin entidad ni Extracto: no cambia ni un cálculo, únicamente lo agrupa bajo
su propia etiqueta en el resumen.

Lo normal es tener **una sola cuenta de efectivo** (la cartera) y dos movimientos:

| Cuándo | Qué registro | De dónde a dónde |
| --- | --- | --- |
| Sacas 100 € del cajero | `traspaso` | Tu cuenta → Efectivo |
| Pagas 12,50 € en el súper | `gasto` | Efectivo → (categoría) |
| El cine en efectivo | `traspaso` | Efectivo → Ahorro |

Sacarlo del cajero **no es un gasto**: por eso es un traspaso, no un `gasto`. Si lo apuntaras como
gasto, el patrimonio bajaría 100 € dos veces (una al sacar y otra al pagar con los billetes), y
además el dinero seguirías teniendo en la cartera cuando ya no lo tienes. Al revés, cuando vuelves a
meter efectivo en el banco, también es un traspaso.

Si solo quieres que el efectivo esté en el total pero sin sacarlo de la cuenta, funciona igual:
apúntalo como gasto directo desde la cuenta y el saldo de esa cuenta bajará. Lo que no puedes es
hacer las dos cosas para el mismo euro, o contarás el dinero dos veces.

Los **pagos fijos** son plantillas (importe, día y cuenta) que cada mes aparecen en el panel de
confirmaciones. No se registran solos: pulsas *Confirmar* en los que realmente se pagan, y ese
movimiento ya suma a los gastos y descuenta del saldo.

Cada plantilla tiene un **mes de inicio**: no se propone en meses anteriores. Así, por ejemplo, una
nómina que empieza a cobrarse en octubre no aparece en septiembre, porque ese mes ya está dentro
del saldo inicial.

### 2.1 · Mostrar y ocultar el dinero

Hay un botón 👁 flotante, sobre la barra de pestañas, que está en todas las páginas. Con él tapas
**todos** los importes de la web: saldos, totales, listas de movimientos, cuotas, porcentajes y los
dos gráficos (que se sustituyen por *🔒 Gráfico oculto*). Lo destapas cuando quieras.

La preferencia se guarda en la cookie `ocultar_dinero` y **la lee el servidor al pintar la página**,
no el navegador al abrirla. Por eso las cifras nunca aparecen un instante antes de taparse, que es
justo lo que fastidia al enseñarle la web a alguien. Se recuerda entre visitas y entre dispositivos.

| | |
| --- | --- |
| 👁 visible | El dinero se ve |
| 🙈 pulsado | El dinero está oculto |

#### La convención que hay que respetar al añadir cifras

No hay un componente `<Importe>` ni nada parecido: el tapado es **una regla de CSS** en
`src/app/globals.css` que vacía con `visibility: hidden` todo elemento con la clase `tabular-nums`
que cuelgue de `[data-oculto]`. Así que:

- Si el elemento **solo** contiene el importe, se le añade `tabular-nums`.
- Si el importe va **dentro de una frase**, se envuelve en `<span className="tabular-nums">`.

Ojo con `visibility`: se hereda, así que poner `tabular-nums` en un contenedor tapa también todo lo
que haya dentro, incluidas las etiquetas. Si quieres que un texto sin cifras siga leyéndose, la
clase va en el importe, no en el padre.

#### Lo que NO se tapa

| | Por qué |
| --- | --- |
| `GET /api/exportar` (CSV) y la API JSON | Son descargas y llamadas explícitas; enmascararlas sería peor |
| Los mensajes de confirmación (`¿Gasto registrado: 12,50 € · Cena fuera?`) | Repiten el importe que acabas de teclear. En los `window.confirm` de Préstamos, que sí llevan cifras derivadas, la cifra se sustituye por `••• €` |
| Los campos `<input>` ya rellenados (Editar movimiento, Editrar préstamo…) | Para eso haría falta cambiar el `type` de cada campo |

---

## 3. Préstamos: intereses, cuota, abono y plazo

Cada préstamo tiene una **cuota mensual** (que además es un pago fijo) y un **capital pendiente**
que la app **deriva de los pagos registrados**, mes a mes. No se guarda en ninguna columna: se
recalcula cada vez aplicando el interés, de forma que no puede desincronizarse de los movimientos.

#### El interés se guarda como aparece en el contrato

El banco da dos cifras y no son intercambiables:

| | Qué es | Tipo mensual |
| --- | --- | --- |
| **TAN** | Nominal anual. Es lo habitual en préstamos de coche. | `interes / 1200` |
| **TAE** | Efectiva anual. Se compone. | `(1 + interes)^(1/12) − 1` |

El 6 % de un préstamo de coche español es un **TAN** normal. Pero con ese mismo 6 % tomado como
**TAE** la cuota sale más baja: 385,18 € en vez de 386,66 € para 20.000 € a 60 meses, casi 1,50 €
de diferencia. Por eso la app guarda también cuál de los dos usaste.

Cada cuota se reparte entre **interés** y **capital**:

```
interés del mes      = capital pendiente × tipo mensual
amortización         = cuota − interés del mes
capital pendiente    = capital pendiente − amortización
```

Por eso una cuota de 386,66 € a TAN 6 % sobre 20.000 € no baja el capital 386,66 €: solo 286,66 €.
Los 100,00 € restantes son intereses, que también son dinero que sale de la cuenta pero que no
reduce lo que debes. Es la diferencia que hace que la app cuadre con el banco.

La cuota se redondea **hacia arriba** al céntimo, como hacen los bancos. En el ejemplo de arriba la
cuota exacta son 386,656 €: redondeada a 386,66 € el préstamo cierra en 60 pagos, pero si se
redondease a 386,65 € harían falta 61.

#### Anclar con la cifra del banco

Si el préstamo es más antiguo que la app, no hace falta meter todo su historial: en
**Editar datos → Cuadrar con el banco** se apunta lo que te queda hoy y la fecha de esa cifra. La
app parte de ese número exacto y continúa sola, ignorando los pagos anteriores. El único desvío
que queda es el redondeo del propio banco (su cuota real puede ser 386,656 € y la tuya 386,66 €).

#### Abonos: dos formas de pagar de más

| | Qué hace | Cuándo lo quieres |
| --- | --- | --- |
| **Quitarme cuotas** | El capital baja y la cuota se mantiene. Se acorta el plazo. | Terminar antes |
| **Bajarme la cuota** | El capital baja y se recalcula la cuota. El plazo se mantiene. | Pagar menos cada mes |

Un abono hace tres cosas a la vez: descuenta el capital pendiente, registra un gasto en la cuenta que
elijas (para que el saldo baje de verdad) y actualiza el pago fijo si has elegido bajar la cuota.

El plazo se cuenta **pagando cuotas de verdad**, no con la fórmula cerrada: al contar una a una con
el mismo redondeo a céntimos del banco, una cuota que es la annuity exacta de *n* meses no acaba
necesitando *n + 1*.

Los abonos se intercalan con las cuotas por fecha, así que un abono también baja el interés de las
cuotas que vengan después.

---

## 4. Estructura

```
supabase/schema.sql          Tablas, índices y RLS. Sin datos, es el estado final
src/lib/supabase/server.ts   Cliente de Supabase (solo servidor)
src/lib/api-key.ts           Validación de la clave x-api-key
src/lib/queries.ts           Lecturas y agregaciones (saldos, resúmenes, gráficos)
src/lib/movimientos.ts       Altas/bajas de movimientos y confirmación de fijos
src/lib/prestamos.ts      Cálculo de abonos y amortización (con tests)
src/lib/validation.ts        Esquemas zod
src/lib/money.ts dates.ts    Formato € (es-ES) y helpers de mes
src/lib/oculto.ts            Cookie de la preferencia «mostrar el dinero»
src/components/oculto.tsx    Proveedor + botón 👁 que tapa los importes
src/app/actions.ts           Server Actions del CRUD de la web
src/app/api/gasto            API que usa el Atajo de iOS
src/app/api/opciones         Listas para el Atajo (cuentas + categorías)
src/app/api/resumen          Totales del mes (atajo "Resumen")
src/app/api/exportar         Descarga CSV
```

---

## 5. API

Todas exigen la cabecera `x-api-key: <API_KEY>` (también vale `Authorization: Bearer <API_KEY>`).

### Registrar un gasto (lo usa el Atajo)

```bash
curl -X POST https://TU-APP.vercel.app/api/gasto \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_API_KEY" \
  -d '{"importe":"12,50","concepto":"Cena fuera","cuenta":"Día a día","categoria":"Comida fuera"}'
```

```json
{ "ok": true, "id": "…", "mensaje": "Gasto registrado: 12,50 € · Cena fuera",
  "cuenta": "Día a día", "categoria": "Comida fuera", "saldo": -4.05 }
```

- `importe` acepta `"12,50"`, `"12.50"`, `12.5` o `"12,50 €"`.
- `cuenta` y `categoria` se buscan por nombre (ignora mayúsculas, tildes y espacios) o por UUID.
- `fecha` es opcional (por defecto, hoy).
- Respuestas: `201` ok · `400` datos inválidos · `401` clave incorrecta · `404` cuenta o categoría
  desconocida (la respuesta incluye las opciones válidas).

### Listas para el Atajo

```bash
curl https://TU-APP.vercel.app/api/opciones -H "x-api-key: TU_API_KEY"
```

### Resumen del mes

```bash
curl "https://TU-APP.vercel.app/api/resumen?mes=2026-01" -H "x-api-key: TU_API_KEY"
```

---

## 6. Despliegue en Vercel

El despliegue se hace **desde el terminal**, no desde el botón *Deploy* del panel.

```bash
npx vercel login     # solo la primera vez: autoriza tu cuenta en el navegador
npm run deploy       # = vercel deploy --prod --yes
```

La primera vez Vercel pregunta el nombre del proyecto (el que tú quieras, por ejemplo
`atajo-gastos`) y detecta Next.js solo.
El despliegue responde con dos URLs: una con hash, que cambia en cada despliegue, y otra alias
estable (con el nombre de tu proyecto, algo como `https://gestion-abc.vercel.app`). **Usa
siempre el alias**: es el que va en el Atajo.

### Variables de entorno

El CLI **no** lee `.env.local`: hay que subirlas a Vercel explícitamente.

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production --sensitive
vercel env add API_KEY production --sensitive
```

`--sensitive` las marca como secret: Vercel las cifra y el CLI ya no puede volver a leerlas (se
ven como `[SENSITIVE]` en un `vercel env pull`). Cuando cambies una, elimínala y vuélvela a añadir:

```bash
vercel env rm API_KEY production --yes
```

### Despliegue automático con `git push`

Solo funciona si la app de Vercel en GitHub tiene acceso al repositorio: **Settings →
Applications → Vercel → Configure → Repository access**. Sin eso, usa siempre `npm run deploy`.

### ¿Afecta a que el repositorio sea privado?

No. Son tres cosas independientes:

| | Dónde vive | Le afecta que el repo sea privado |
| --- | --- | --- |
| **Web** | Vercel sirve una build ya compilada | No |
| **Datos** | Supabase | No |
| **Código** | GitHub | Sí, eso es lo que quieres proteger |

Solo `git push` depende de la visibilidad, porque pasa por GitHub.

### Seguridad

La app no tiene login, por diseño: es de uso personal y no queremos fricción.

- **Escribir** (registrar gastos) exige la cabecera `x-api-key`, que solo tienes tú. Sin ella, la API
  devuelve `401` y no toca la base de datos.
- **Leer** (saldo, movimientos, gráficos) es público para quien conozca la URL. Si algún día quieres
  cerrarlo: un PIN en un middleware de Next.js lo resuelve *sin* romper el Atajo, mientras que
  Supabase Auth lo rompería (el Atajo tendría que guardar credenciales).
- **Deployment Protection** de Vercel (Settings → Deployment Protection) rompe el Atajo si lo
  activas también para Production. Actívalo para Preview si quieres, no para Production.

#### Antes de compartir la URL

Es la parte que más se olvida: **la URL es el secreto**. No lleva login, así que publicarla en un
post, en un README o en un issue equivale a publicar tus cuentas y movimientos.

- Usa el botón 👁 para las capturas: tapa saldos, totales, cuotas y los dos gráficos.
- Si vas a compartir el enlace, ponle antes un PIN en un middleware (ver arriba).
- Y no pongas la URL de tu despliegue en este repositorio: aunque sea privado hoy, en cuanto pase a
  público queda expuesto.

### Qué revisar antes de publicar el repositorio

- [ ] `.env.local` y `.vercel/` están en `.gitignore` (lo están) y nunca se han commiteado.
- [ ] `supabase/schema.sql` no inserta datos (no lo hace).
- [ ] Los tests usan datos inventados, no los tuyos.
- [ ] El README y la guía no incluyen la URL de tu despliegue ni claves reales.
- [ ] Si en el historial de git hubo `seed.sql` o migraciones con tus saldos, reescribirlo no basta
      con borrarlos del último commit: hay que reescribir el historial (`git filter-repo`) y
      avisar a quien ya lo haya clonado.


---

## 7. Scripts

```bash
npm run dev     # desarrollo
npm run build   # compila y comprueba tipos
npm run start   # sirve el build de producción
npm run lint    # ESLint
npm test        # tests de la lógica de amortización
npm run deploy  # despliega en producción (Vercel)
```
