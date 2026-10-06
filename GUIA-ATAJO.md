# Guía: Atajo "Anotar Gasto" en el iPhone

Requisitos: la app desplegada en Vercel y la variable `API_KEY` configurada.

Sustituye `https://TU-APP.vercel.app` y `TU_API_KEY` por los tuyos.

Hay dos versiones. **Empieza por la versión corta** (10 acciones, la recomendada): una lista fija de
5 categorías, que en el móvil es mucho más rápida de elegir que una lista de 15.

| Versión | Pasos | Cuándo usarla |
| --- | --- | --- |
| **[Corta](#versión-corta-recomendada)** | 10 | La de todos los días: solo gastas de un par de cuentas y de unas pocas categorías |
| [Larga](#versión-larga-listas-automáticas) | 12 | Si prefieres que el atajo lea las cuentas y categorías de la API y no se quede nunca desactualizado |

En ambas, las **claves del diccionario tienen que ser exactamente** `importe`, `concepto`, `cuenta` y
`categoria`. Si se llaman de otra forma, la API responde `400` con un error de validación.

---

## 0. Probarlo antes de desplegar (opcional)

Para hacer una prueba rápida sin desplegar nada, con el iPhone **en la misma Wi-Fi** que el
ordenador y `npm run dev` corriendo:

1. Averigua la IP del ordenador (Windows: `ipconfig` → *Dirección IPv4*, p. ej. `192.168.1.42`).
2. Usa `http://192.168.1.42:3000` en lugar de la URL de Vercel.

Dos cosas a tener en cuenta:

- Al arrancar `next dev`, Windows pregunta si permites Node.js en el firewall: hay que
  **aceptar en redes privadas**, o el iPhone no llegará al servidor.
- Es HTTP sin cifrar, así que iOS puede avisar de que la conexión no es segura. Y solo funciona
  con el ordenador encendido y en la misma red: sirve para probar, no para el día a día.

---

## 1. Crear el atajo

1. Abre la app **Atajos** (Shortcuts) en el iPhone.
2. `+` (arriba a la derecha) para crear un atajo nuevo.
3. Ponle de nombre **Anotar Gasto** y ábrelo con el ícono derayo.
4. Añade las acciones que se indican abajo, **en este orden**.

---

# Versión corta (recomendada)

Diez acciones. Las cuentas y las categorías están escritas a mano, así que no necesita ninguna
petición extra para pedir listas.

## C1. Pedir el importe

- **Buscar acción:** `Pedir entrada` → ponla la primera
- **Tipo de entrada:** Número
- **Título:** `¿Cuánto te has gastado?`

## C2. Pedir el concepto

- **Buscar acción:** `Pedir entrada`
- **Tipo de entrada:** Texto
- **Título:** `¿En qué ha sido?`

## C3. Crear la lista de cuentas

- **Buscar acción:** `Crear lista`
- Con estos elementos, en este orden:
  - `Cuenta principal`
  - `Día a día`

> Los nombres tienen que existir en la app (sección *Cuentas*), y son los tuyos: cámbialos por los
> que tengas. Da igual si escribes `Cuenta principal` o `cuenta principal`: la API ignora
> mayúsculas, tildes y espacios.

## C4. Elegir la cuenta

- **Buscar acción:** `Elegir de la lista`
- **Menú:** elige la lista del paso anterior
- **Título:** `¿Con qué cuenta has pagado?`

## C5. Crear la lista de categorías

- **Buscar acción:** `Crear lista`
- Con estos elementos, en este orden:
  - `Gimnasio`
  - `Restaurante`
  - `Gasolina`
  - `Ropa`
  - `Otras compras`

> Estas cinco tienen que existir en *Ajustes → Categorías*. Si añades una que no exista, el atajo
> responde `404 Categoría desconocida` con la lista de las que sí.

## C6. Elegir la categoría

- **Buscar acción:** `Elegir de la lista`
- **Menú:** la lista del paso C5
- **Título:** `¿En qué categoría?`

## C7. Crear el diccionario

- **Buscar acción:** `Crear diccionario`
- Botón **Añadir campo**, cuatro veces. Cada campo: pulsa el valor vacío y elige la variable
  correspondiente.

  | Clave (escribe esto) | Tipo | Variable |
  | --- | --- | --- |
  | `importe` | Texto | el número del paso C1 |
  | `concepto` | Texto | el texto del paso C2 |
  | `cuenta` | Texto | lo elegido en C4 |
  | `categoria` | Texto | lo elegido en C6 |

> **Las claves son en minúsculas y sin tildes, exactamente así.** Si escribes `Importe` o
> `Concepto`, la API no las reconoce.

## C8. Enviar el gasto

- **Buscar acción:** `Obtener el contenido de una URL`
- **URL:** `https://TU-APP.vercel.app/api/gasto`
- En *Opciones*:
  - **Método:** `POST`
  - **Cuerpo:** `JSON`
  - En el campo de abajo elige el **diccionario** del paso C7
- En *Cabeceras* → **Añadir cabecera**:
  - **Clave:** `x-api-key`
  - **Valor:** `TU_API_KEY`
  - **Tipo:** `JSON` ← importante: si se queda en Texto, la cabecera llega entre comillas y la API
    responde `401 Clave no válida`

No hace falta poner `Content-Type`: se añade solo al elegir el cuerpo JSON.

## C9. Mostrar el resultado

- **Buscar acción:** `Mostrar resultado`
- **Tipo:** `Mensaje de diálogo`

Este paso no es opcional en la práctica: sin él, si algo falla no te enteras.

Al terminar debe aparecer: `Gasto registrado: 12,50 € · Cena en el bar`

## C10. Probarlo

Ejecuta el atajo con un gasto pequeño (por ejemplo 0,50 € en *Restaurante*) y míralo en **Gastos**:
aparecerá con el icono 📱, que marca los que entran por el atajo.

---

# Versión larga (listas automáticas)

Doce acciones. Añade un paso más, pero las listas salen siempre de la API: si un día creas una
categoría nueva en la web, aparece en el atajo sin tocarlo.

## L1. Acción 1 — Pedir el importe

- **Buscar acción:** `Pedir entrada`
- Ponla la primera.
- Configúrala así:
  - **Tipo de entrada:** Texto
  - **valor:** (déjalo vacío, se rellena al ejecutar)
- Debajo, en *Opciones*, activa **Teclado numérico**.
- **Título:** `¿Cuánto?`
- **Mensaje:** `Importe en euros (ej: 12,50)`

---

## L2. Acción 2 — Pedir el concepto

- **Buscar acción:** `Pedir entrada`
- **Tipo de entrada:** Texto
- **Título:** `¿Qué has comprado?`

---

## L3. Acción 3 — Obtener las listas (cuentas y categorías)

- **Buscar acción:** `Obtener el contenido de una URL`
- **URL:** `https://TU-APP.vercel.app/api/opciones`
- En *Opciones*:
  - **Método:** `GET` (no toques nada más)
- En *Cabeceras* pulsa `Añadir cabecera`:
  - **Clave:** `x-api-key`
  - **Valor:** `TU_API_KEY`
  - **Tipo:** `JSON` (es el único que funciona para cabeceras)
- En *Avanzado* deja la casilla **JSON** desmarcada (o sea: no analyzes la respuesta aquí).

---

## L4. Acción 4 — Elegir la cuenta

- **Buscar acción:** `Elegir de la lista`
- **Menú:** `Obtener el contenido de una URL` → elige la acción del paso anterior (suele llamarse
  *Obtener el contenido de una URL*).
- En el campo **Lista con elementos**:
  - **Clave:** `cuentas`
  - **Tipo de valor:** `Valor` (usa el campo `nombre` de cada cuenta)
- **Título:** `¿Desde qué cuenta?`
- **Mensaje:** `Elige la cuenta de origen`

> Si la lista te sale vacía, es que la clave no es correcta: revisa que no tenga comillas ni
> espacios al principio o al final.

## L5. Acción 5 — Elegir la categoría

- **Buscar acción:** `Elegir de la lista`
- **Menú:** `Obtener el contenido de una URL` (la del paso 4).
- **Lista con elementos:**
  - **Clave:** `categorias`
  - **Tipo de valor:** `Valor` (nombre de la categoría)
- **Título:** `¿En qué categoría?`

---

## L6. Acción 6 — Enviar el gasto

- **Buscar acción:** `Obtener el contenido de una URL`
- **URL:** `https://TU-APP.vercel.app/api/gasto`
- En *Opciones*:
  - **Método:** `POST`
  - **Cuerpo:** `JSON`
  - **Tipo de entrada:** `Texto` → **Solicitar entrada** (para escribir la clave)
- En *Cabeceras*, `Añadir cabecera`:
  - `Content-Type` = `application/json`
  - `x-api-key` = `TU_API_KEY` (tipo `JSON`)
- En *Avanzado* → activa **JSON** para poder elegir el cuerpo con el botón *Json*.

Botón **Json** (a la derecha) → **Añadir otro parámetro** → **Añadir campo de texto** → elige la
variable. Repite para cada campo:

| Nombre del campo | Tipo | Valor |
| --- | --- | --- |
| `importe` | Texto | `Importe` (el resultado de la primera acción) |
| `concepto` | Texto | `Concepto` (el resultado de la segunda) |
| `cuenta` | Texto | `Cuenta` (la lista elegida) |
| `categoria` | Texto | `Categoría` (la lista elegida) |

Pulsa **Listo / Listo**.

---

## L7. Acción 7 — Confirmar

- **Buscar acción:** `Mostrar resultado`
- Deja activado **Tipo:** `Mensaje de diálogo`.

Al terminar debería aparecer: `Gasto registrado: 12,50 € · Cena fuera`.

---

## L8. Probarlo

Ejecuta el atajo una vez con un gasto pequeño (por ejemplo 0,50 € en Comida fuera) y mira la web:
debería aparecer en **Gastos** con el icono 📱 (los que entran por el atajo se marcan así).

Si algo falla, la app devuelve un mensaje explicativo, por ejemplo:
`Categoría desconocida: "Gimnasio". Categorías: Supermercado, Comida fuera, …`

---

## E1. Atajo extra: "Resumen del mes"

1. `Obtener el contenido de una URL`
2. URL: `https://TU-APP.vercel.app/api/resumen`
3. Cabecera `x-api-key` = `TU_API_KEY`
4. En *Avanzado*, activa **JSON**
5. Añade `Mostrar resultado` → **Tipo:** `Texto`, y en *Mostrar* marca **Attributed String**

Así puedes consultar a cuánto has ascended este mes sin abrir la web.

---

## E2. Añadirlo a la pantalla de bloqueo

En la app Atajos, toca el atajo `⋯` → **Detalles** → **Añadir a pantalla de bloqueo**. Así podrás
anotar un gasto desde la pantalla bloqueada del iPhone.

---

## E3. Si te lías con el cuerpo JSON

Si el paso C8 (el cuerpo JSON) da problemas, hay una forma de continuar sin él. En vez de
`Obtener el contenido de una URL` con cuerpo JSON, usa la acción **Diccionario** combinada con
`Texto de contenido`:

1. Monta el diccionario igual que en C7 (`importe`, `concepto`, `cuenta`, `categoria`).
2. Usa la acción **Convertir texto en… / Texto de contenido** con la opción **Diccionario**, y ponle
   el diccionario como entrada.
3. En `Obtener el contenido de una URL` pon **Cuerpo: Texto**, y en *Avanzado → JSON* elige esa
   variable.

El resultado en el servidor es idéntico. Si aun así falla, mira el error que te devuelve el atajo en el
paso C9: la API siempre explica qué ha ido mal en vez de fallar en silencio.

---

## E4. Problemas frecuentes

| Síntoma | Causa probable |
| --- | --- |
| `Clave no válida` | La cabecera `x-api-key` está puesta como **Texto** en vez de **JSON**, o la clave tiene espacios. |
| `Falta el importe` | El diccionario no tiene la clave `importe`, o el campo apunta a una variable vacía. |
| `Falta el concepto del gasto.` | El diccionario no tiene la clave `concepto`. |
| `Fecha no válida (AAAA-MM-DD)` | Has mandado una fecha con otro formato. **La solución fácil es no mandar la fecha**: bórrala del diccionario y la API pone la de hoy. |
| `{"ok":false,"error":"No se ha podido leer el cuerpo de la petición."}` | El método no es POST, o el cuerpo no es JSON válido. Revisa *Método* y *Cuerpo*. |
| `Categoría desconocida: "Gimnasio". Categorías: …` | Esa categoría no existe en *Ajustes → Categorías*. Crea la categoría o escribe el nombre exacto. |
| `Cuenta desconocida: "Mi banco"` | Esa cuenta no existe o está inactiva en *Cuentas*. |
| `"Mi banco" es la entidad de varias cuentas: …` | Has elegido la entidad en vez del nombre de la cuenta. Usa el nombre completo. |
| La lista de cuentas o categorías sale vacía (versión larga) | La clave es incorrecta, o el `GET` a `/api/opciones` no lleva la cabecera. |
| El atajo no encuentra el servidor | Estás en la URL local y el ordenador está apagado o no compartes Wi-Fi. |
