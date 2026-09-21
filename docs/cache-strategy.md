# Estrategia de caché — Semana 3

> Documento de contrato técnico para la implementación del Service Worker de la Semana 3.
> Describe qué se cachea, con qué estrategia y por qué, sobre el estado real del proyecto
> (rama `feat/week3-danna-service-worker`, base `063e287`, hygiene cleanup en `56b4a2a`).
> No contiene código de implementación.

## 1. Objetivo

Definir, antes de escribir `public/sw.js`, el contrato de caché de la aplicación
«Inspecciones de laboratorio» para:

- que la aplicación sea consultable con conectividad intermitente (Escenario 2 del
  producto, RF-03);
- mantener contenido fresco cuando hay red;
- servir un fallback legible cuando no hay red ni respuesta válida en caché;
- invalidar de forma controlada las cachés cuando se despliega una versión nueva.

La estrategia refleja los principios de las diapositivas de la Semana 3: Cache First para
recursos estáticos, Network First para información cambiante, Network Only para
información sensible, precache pequeño e indispensable, fallback offline legible,
actualización segura e invalidación controlada. Stale While Revalidate **no se aplica en
esta semana** porque no existe ningún recurso no crítico independiente que lo justifique.

## 2. Contexto actual de la aplicación

### 2.1 Rutas actuales

| Ruta | Origen | Notas |
|---|---|---|
| `/` | `src/app/page.tsx` | Página de bienvenida con acceso a las secciones |
| `/inspections` | `src/app/inspections/page.tsx` | Listado de inspecciones sintéticas |
| `/maintenance` | `src/app/maintenance/page.tsx` | Sección en estructura inicial, sin datos |
| `/test-error` | `src/app/test-error/page.tsx` | Ruta de QA de la Semana 2 que lanza un error determinista |

Además, Next.js genera la ruta de error `/_not-found` (404).

Las cinco rutas son estáticas y se prerenderizan en el build (`next build` genera
HTML y payload RSC para `/`, `/inspections`, `/maintenance`, `/test-error` y
`/_not-found`). No existen rutas dinámicas `[slug]`.

### 2.2 Datos

- Los datos viven en `src/lib/data/inspections.ts` (`inspections: Inspection[]`, tres
  registros sintéticos).
- Son importados directamente por `src/app/inspections/page.tsx` y se renderizan en
  tiempo de build.
- No existe ningún `fetch`, `XMLHttpRequest`, cliente HTTP, route handler, endpoint
  `/api/*` ni servicio externo en `src/`.
- Consecuencia: los datos de inspecciones forman parte del **HTML y payload RSC
  prerenderizado** de la ruta `/inspections`. No existe hoy un request de datos que el
  Service Worker pueda interceptar ni un endpoint que justifique Network First o
  Stale While Revalidate para datos.

### 2.3 Configuración

- `next.config.mjs` solo define `reactStrictMode: true`. No hay `output: "export"`,
  rewrites, redirects ni headers personalizados. La aplicación se sirve con el servidor
  Node de Next.js (`next start`).
- Los assets generados por el build viven bajo `/_next/static/**` (JS/CSS) con nombres
  **hasheados por build** (inmutables entre builds: si el contenido cambia, cambia el
  hash y por tanto la URL).

## 3. Recursos y clasificación

| Recurso / request | Estrategia | Precache / runtime / no cache |
|---|---|---|
| `/` | Network First | Precache |
| `/inspections` | Network First | Precache |
| `/maintenance` | Network First | Precache |
| Payload RSC de las rutas (soft navigation, header `RSC: 1`) | Compatible con Network First de navegación | Runtime |
| `/_next/static/**` (JS/CSS hasheados) | Cache First | Runtime |
| `/manifest.webmanifest` | Cache First | Precache |
| `/icon-192x192.png` | Cache First | Precache |
| `/icon-512x512.png` | Cache First | Precache |
| `/offline.html` | Cache First | Precache (se creará con la implementación) |
| `/test-error` | — | No cache (no precachear) |
| `/_not-found` | — | No cache |
| `POST` / `PUT` / `PATCH` / `DELETE` | Network Only | No cache |
| Requests con `Authorization` o PII | Network Only | No cache |
| `/sw.js` | — | No cache (el Service Worker nunca se cachea a sí mismo) |

## 4. Estrategias de caché

### 4.1 Network First — navegación

Se usa para `/`, `/inspections` y `/maintenance`: documentos de navegación cuyo contenido
es **información cambiante** (el listado de inspecciones cambiará con las funcionalidades
futuras de registro y sincronización, RF-02 a RF-04).

Comportamiento deseado:

1. Intentar la red primero y actualizar la caché con la respuesta válida.
2. Si la red falla o no hay respuesta válida, servir la copia en caché.
3. Si tampoco hay caché, servir el fallback offline (`/offline.html`).

Motivo: se quiere contenido fresco cuando existe conexión, pero consulta de la versión
previamente cacheada cuando no existe conexión.

### 4.2 RSC / soft navigation

Las navegaciones internas del App Router de Next.js (clics en `<Link>`) pueden
disparar **requests RSC** (payload `text/x-component` con cabecera `RSC: 1`) en lugar de
una navegación de documento completa. Un request de este tipo **no pasa necesariamente
por `event.request.mode === "navigate"`**, por lo que **no debe asumirse** que el manejo
solo de navegaciones cubre todo el comportamiento offline.

Se documenta la decisión de tratar estos requests de forma **compatible con la estrategia
de navegación** (misma ruta: red primero, luego caché), de modo que la soft navigation
siga funcionando sin conexión. El detalle exacto de cabeceras y de la negociación del
servidor sobre `next start` **se validará posteriormente con pruebas** (sección 12 y
Limitaciones).

### 4.3 Cache First — recursos estáticos

Se usa para:

- `/_next/static/**` (JS/CSS);
- `/manifest.webmanifest`;
- `/icon-192x192.png`;
- `/icon-512x512.png`.

Motivo: son recursos estáticos e inmutables. En particular, los assets de `/_next/static/`
tienen nombres hasheados por build: si el contenido cambia, cambia la URL, por lo que una
entrada en caché nunca es "vieja" respecto de una URL dada, y Cache First es seguro y rápido.

Comportamiento deseado:

1. Servir desde caché si existe una respuesta válida.
2. Si no existe, ir a la red y guardar la respuesta en caché.

### 4.4 Stale While Revalidate

**No se utiliza en esta semana.** No existe en la aplicación un catálogo no crítico
independiente que lo justifique: los únicos datos (inspecciones) van embebidos en el
HTML/RSC prerenderizado y se cubren con Network First en la navegación. No se inventa un
caso de uso para esta regla.

### 4.5 Network Only — información sensible

Regla de protección preventiva: los requests que **no deben cachearse** son

- métodos no seguros: `POST`, `PUT`, `PATCH`, `DELETE`;
- requests con cabecera `Authorization`;
- información sensible / PII;
- el propio `/sw.js` (debe resolverse siempre contra la red para que el navegador detecte
  actualizaciones).

Actualmente **no existen requests reales de este tipo** en la aplicación: no hay
autenticación, no se envían datos de usuario y no hay mutaciones. La regla queda
documentada como blindaje para las funcionalidades futuras (registro de inspecciones y
sincronización), y se implementará como guarda genérica en el handler `fetch`.

## 5. Precache

Precache **pequeño e indispensable**. La propuesta inicial:

- `/`
- `/inspections`
- `/maintenance`
- `/manifest.webmanifest`
- `/icon-192x192.png`
- `/icon-512x512.png`
- `/offline.html`

El precache se completa en el evento `install`.

**¿Por qué no está `/test-error` en el precache?**

- Es una ruta de QA de la Semana 2 (lanza un error determinista para probar el Error
  Boundary).
- No forma parte del flujo offline principal del usuario ni de la navegación del AppShell
  (los enlaces de la aplicación son `/`, `/inspections` y `/maintenance`).
- Precachear una ruta de pruebas agranda el precache sin aportar valor de producto.

**¿Por qué no se incluyen manualmente archivos `_next/static` con hashes concretos?**

- Esos nombres cambian entre builds.
- Actualmente no contamos con un proceso de generación de precache basado en el build
  (no hay `output: "export"`, script de generación de manifiesto de precache ni build-step
  del Service Worker).
- Por eso el precache manual se limita a las rutas y archivos estables; los assets
  hasheados se cachean en runtime con Cache First (sección 6).

**¿Por qué no está `/_not-found` en el precache?**

- Es una respuesta de error (404) que Next genera internamente.
- Cuando una navegación falla sin caché se sirve el fallback `/offline.html`, no el 404.

## 6. Runtime cache

Los recursos no contemplados en el precache se cachean al primer uso, durante la vida del
Service Worker:

- **`/_next/static/**`**: Cache First en una caché de recursos estáticos. Al ser
  hasheados e inmutables, la primera visita con red los guarda y las siguientes (incluidas
  las offline) se sirven desde caché.
- **Payload RSC de rutas precacheadas**: tratado igual que las navegaciones (4.2).

No se define runtime caching para datos, porque hoy no hay endpoint de datos.

## 7. Fallback offline

Se propone `/offline.html` como **fallback legible** cuando:

1. una navegación falla (no hay red) y
2. no existe una respuesta válida en caché.

`/offline.html` no existe todavía; debe crearse como parte de la implementación del
Service Worker (archivo estático en `public/`). Debe ser un documento mínimo
autocontenido (sin depender de JS ni de assets del build), con el nombre de la aplicación
y un mensaje claro de falta de conexión, en idioma `es-MX` y coherente con el estilo
visual actual.

## 8. Exclusiones

No se cachean:

- métodos no seguros (`POST`, `PUT`, `PATCH`, `DELETE`);
- requests con `Authorization` o información sensible / PII;
- `/sw.js`;
- `/test-error` (no precache; se puede ignorar en runtime);
- `/_not-found`;
- requests cross-origin (no los genera la aplicación actual).

## 9. Versionado e invalidación

Se propone un esquema de nombres de caché **versionados** con un prefijo de versión común:

- `pwa-eq11-v1-pages` — navegaciones y payloads RSC de rutas;
- `pwa-eq11-v1-static` — recursos estáticos de `/_next/static/**`;
- `pwa-eq11-v1-core` — precache (manifest, iconos, `offline.html` y, en su caso, los
  documentos del precache).

El cambio de versión (por ejemplo, a `pwa-eq11-v2-*`) en una **nueva release** permite:

1. identificar qué cachés pertenecen a la versión actual; y
2. limpiar en `activate` todas las cachés cuyo nombre no corresponda a la versión actual.

Así la invalidación es **controlada**: se elimina la versión anterior completa, en lugar de
acumular entradas huérfanas.

## 10. Actualización segura

Objetivo: una actualización segura y controlada que **no mezcle recursos de builds
diferentes** (por ejemplo, HTML de una build con assets de otra).

Consideraciones:

- `skipWaiting()` **no se documenta como obligatorio**. Es una decisión a validar durante
  la implementación (o el integrante a cargo la decide de forma informada), junto con
  `clients.claim()`, según el flujo de despliegue y las pruebas.
- Al activar una versión nueva se purgan las cachés de versiones anteriores, evitando que
  sigan sirviéndose recursos viejos.
- Como los assets de `/_next/static/**` cambian de hash por build y no se precachean
  manualmente, el riesgo de mezclar recursos se acota manteniendo la estrategia de
  navegación Network First: con red se obtiene el documento fresco, que referencia los
  assets de esa misma build.

## 11. Limitaciones

- **No existe API de inspecciones.** No hay endpoint runtime que requiera Network First
  para datos ni que justifique Stale While Revalidate.
- **Los datos son sintéticos y están incluidos en el HTML/RSC prerenderizado.** La capa de
  datos offline se apoya en el precache de la ruta `/inspections`, no en un request
  cacheado.
- **El comportamiento exacto de las soft navigations RSC debe validarse con `next start`
  y navegador** (cabeceras, tipo de payload, negociación del servidor). No puede
  determinarse de forma estática solo con el código.
- **Los assets hasheados no se precachean manualmente.** No hay proceso de generación de
  precache basado en el build; el precache debe mantenerse pequeño y manual.
- **`/offline.html` aún no existe** y se creará junto con el Service Worker.
- La validación offline real requiere navegador (Service Worker y Cache Storage no
  existen en entornos `node`); las pruebas unitarias cubrirán la lógica, no la ejecución
  real del SW.

## 12. Plan de pruebas

Comportamiento que se deberá validar durante la implementación:

- **`service-worker.spec.ts`**: el archivo `public/sw.js` existe y es JS válido; el
  precache incluye exactamente `/`, `/inspections`, `/maintenance`, `/manifest.webmanifest`,
  `/icon-192x192.png`, `/icon-512x512.png` y `/offline.html`; no incluye `/test-error` ni
  hashes concretos de `/_next/static`; usa nombres de caché versionados bajo
  `pwa-eq11-v1-*`; en `install` precachea en el evento correspondiente; en `activate`
  elimina cachés de versiones anteriores; el handler `fetch` no cachea métodos no seguros,
  requests con `Authorization`, ni `/sw.js`; implementa la guarda que excluye
  `/_next/static` de ser servido por navigations y aplica la estrategia correcta por
  tipo de request.
- **`offline.spec.ts`** (simulada): con la red "caída" y una navegación a una ruta
  precacheada con datos en caché, se sirve la copia; con navegación sin caché se sirve
  `/offline.html`; los requests no cacheables pasan de largo; la activación elimina cachés
  de versiones antiguas.
- **Validación empírica RSC**: sobre `next build` + `next start` y navegador, confirmar
  que las soft navigations funcionan en modo sin conexión y ajustar el handler si la
  negociación RSC lo exige.