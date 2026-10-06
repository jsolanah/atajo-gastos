# Cómo contribuir

Gracias por querer echar un ojo. Esto es una app personal, pero está pensada para que funcione
como punto de partida de la tuya: los datos son tuyos, el código es de todos.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local    # y rellena las tres variables
npm run dev
```

Las variables están explicadas una a una en el [README](README.md#13-variables-de-entorno). El paso
más fácil de saltarse es el de Supabase: crea un proyecto, pega `supabase/schema.sql` en el SQL
Editor y ya está. Ese fichero crea las tablas pero **no inserta ni un solo dato**, así que tu base
empieza vacía y introduces todo desde la web.

## Antes de abrir un PR

```bash
npm test          # 40 tests de la lógica de préstamos y cuentas
npm run lint
npm run build     # también comprueba los tipos
```

Los tests cubren lo que de verdad importa y es fácil romper sin darse cuenta:

- **La tabla de amortización** y su redondeo al céntimo. Una cuota redondeada hacia abajo hace que
  el préstamo necesita **una cuota más** de la que dice el contrato. Hay un test que lo comprueba
  en las dos direcciones.
- **El capital pendiente**, que no se guarda en ninguna columna: se deriva de los pagos
  registrados, mes a mes. Si añades una columna para "cachearlo", hay que actualizar los tests.
- **La búsqueda de cuentas**, donde el nombre gana siempre sobre la entidad bancaria y hay un
  banco que se llama igual que una de sus cuentas. Es un caso real que costó un PR entero.

## Dos cosas que conviene saber antes de tocar el código

**El botón 👁 que oculta el dinero es una regla de CSS, no un componente.** Vacía con
`visibility: hidden` todo elemento `.tabular-nums` dentro de `[data-oculto]`, y la preferencia se
lee en el servidor al pintar la página. Si añades una cifra nueva, decide si lleva `tabular-nums`
ella misma o si va dentro de una frase, porque poner la clase en el padre tapa también las
etiquetas.

**Los imports dinámicos de los tests se calculan en el script.** Si añades un fichero de test,
no hace falta registrarlo: `npm test` coge todos los de `src/lib/`.

## Dos cosas que no deberías subir nunca

- **Tu `.env.local`**: está en `.gitignore` y no se versiona, pero revisa `git status` antes de
  commitear si tienes dudas.
- **La URL de tu despliegue**. La app no tiene login, así que esa URL da acceso a tus cuentas y
  movimientos. El README explica por qué es el secreto que hay que proteger.

## Alcance

Los cambios pequeños y bien explicados son los más fáciles de revisar, y los que más probabilidad
tienen de que entren. Las features grandes (nuevo tipo de movimiento, categorías nuevas, un plan de
ahorros) se pueden hacer en un PR aparte, sobre `main` actualizado.

Si no estás de acuerdo con cómo está hecho algo, abre un issue antes de escribir código: es más
barato cambiar de rumbo que reescribir un PR.
