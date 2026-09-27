# Decisión técnica — Semana 4: CSR/SSR con estados verificables

> Documento de la Semana 4 (`PWA-w04-kit-estudiante`), a cargo del bloque de
> estados, pruebas, documentación y CI (Tonanzin). Describe la decisión sobre
> cómo se verifica el contraste CSR/SSR ya implementado por Fernando
> (`/inspecciones`) y Danna (`/inspecciones/[id]`), y no repite código de
> implementación ya documentado por ellos en `evidence/individual.md`.

## 1. Objetivo

Dejar constancia verificable — con pruebas automatizadas reproducibles y
documentación — de que la aplicación expone un contraste real entre:

- **CSR** en `/inspecciones`: la página es un componente cliente que obtiene
  datos vía `fetch` a `/api/inspecciones` y expone cuatro estados (carga,
  error, reintento, lista).
- **SSR dinámica** en `/inspecciones/[id]`: un Server Component que resuelve
  el detalle según `params.id` en cada solicitud (`export const dynamic =
  "force-dynamic"`), con `notFound()` para un id inexistente.

## 2. Decisión técnica

- **Reutilizar `LoadingState` y `ErrorState` existentes** (`src/components/ui/`,
  creados en la Semana 2) en lugar de crear un nuevo
  `src/components/loading-state.tsx`. El kit sugiere esa ubicación como punto
  de partida para equipos que no tengan ya un estado de carga reutilizable;
  este equipo ya lo tiene, ya es accesible (`role="status"`, `aria-live`,
  `aria-busy`) y ya se usa en `/inspecciones`, así que crear un segundo
  componente habría duplicado lógica sin aportar cobertura nueva.
- **Pruebas en `tests/rendering.spec.tsx`, no `.spec.ts`.** El archivo
  necesita renderizar JSX (`@testing-library/react`) para probar las páginas
  de `/inspecciones` y `/inspecciones/[id]`; con extensión `.ts` el
  transformador de Vitest (`esbuild`) rechaza la sintaxis JSX. Se usa `.spec.tsx`
  siguiendo la misma convención ya establecida en el repositorio
  (`tests/ui-states.spec.tsx`, `tests/app-shell.spec.tsx`). El patrón de
  inclusión de `vitest.config.mts` ya cubre `tests/**/*.spec.tsx`, así que no
  fue necesario tocar la configuración.
- **`notFound()` se mockea en la prueba de SSR.** Fuera del runtime de
  Next.js, `notFound()` no dispara el mecanismo interno que renderiza
  `not-found.tsx`; Vitest + Testing Library no reproducen ese pipeline. Se
  mockeó `next/navigation` para que `notFound()` lance un error explícito, y
  la prueba comprueba que la función se invoca y que el render se interrumpe
  ante un id inexistente. Esto verifica la lógica de la página, no la
  interceptación real de Next.js — ver limitación en la sección 5.
- **Se agregaron al arreglo `required` de `scripts/verify.mjs`** los
  artefactos nuevos de la Semana 4 (`src/app/inspecciones/page.tsx`,
  `src/app/inspecciones/[id]/page.tsx`, `tests/rendering.spec.tsx`,
  `docs/rendering-decision.md`) para que la comprobación de estructura
  (`npm run verify -- --structure` y `npm run verify`) también los exija.
  Antes de este cambio, `verify.mjs` seguía validando solo el contrato de la
  Semana 3.
- **No fue necesario modificar `package.json` ni `vitest.config.mts`.**
  `npm test` (`node tests/starter.spec.mjs && vitest run`) y, por lo tanto,
  `npm run verify` y `make verify`, ya ejecutan `tests/rendering.spec.tsx` de
  forma automática gracias al patrón `include` existente. Se confirmó
  ejecutando la suite completa localmente (ver sección 6).

## 3. Supuestos

- El endpoint `/api/inspecciones` y su parámetro `?fallar=1` (implementados
  por Fernando) son la única fuente de datos para el listado CSR; las
  pruebas no acceden a una API real ni a red externa, solo mockean `fetch`.
- Los datos usados en las pruebas son sintéticos y coherentes con
  `src/lib/data/inspections.ts` (mismos campos y forma que usa la UI real).
- La ruta `/inspections` (en inglés) se mantiene sin cambios por decisión
  del equipo (punto 4 del plan de la semana); no se migró ni se tocó su
  precache.

## 4. Métrica de carga

El retardo de 800 ms en `/api/inspecciones` (implementado por Fernando) es
una **medición de desarrollo**, no de red ni de producción: simula latencia
para que los cuatro estados de la página CSR sean observables y probables de
forma determinista. No representa el tiempo real de una API en producción.

## 5. Límites documentados

- La prueba de `notFound()` verifica que la función se invoca y que el
  render se interrumpe, pero no reproduce el pipeline completo de Next.js
  que sustituye la salida por `not-found.tsx`. Esa parte se comprobó de
  forma manual: `npm run build && npm start`, visitar
  `/inspecciones/no-existe` y confirmar que se muestra la vista de
  `not-found.tsx` con el enlace de regreso al listado.
- La navegación (`AppShell`) y el precache del Service Worker (`public/sw.js`)
  **no se actualizaron** para incluir `/inspecciones`: el listado se
  consulta del lado del cliente contra un endpoint que puede fallar
  deliberadamente (`?fallar=1`), y el detalle es dinámico por solicitud
  (`force-dynamic`), por lo que precachearlos como página estática iría en
  contra de lo que la actividad pide demostrar. Se documenta como decisión,
  no como pendiente.
- No se agregaron pruebas de integración end-to-end (por ejemplo, con
  Playwright); la cobertura de esta semana es a nivel de componente con
  Vitest + Testing Library, igual que en semanas anteriores.
- Las pruebas nuevas no cubren accesibilidad exhaustiva del listado ni del
  detalle (por ejemplo, orden de foco); solo los cuatro comportamientos
  críticos pedidos por el kit.

## 6. Fallos encontrados y cómo se resolvieron

Registro real de lo que falló al escribir `tests/rendering.spec.tsx` (no una
descripción idealizada):

1. Crear el archivo como `tests/rendering.spec.ts` con JSX dentro provocó un
   error de `esbuild` (`Expected ">" but found "/"`). Se resolvió renombrando
   el archivo a `tests/rendering.spec.tsx` (ver decisión en la sección 2).
2. La prueba de reintento intentaba pulsar un botón con
   `aria-label="Actualizar datos"`, que solo existe en la vista de éxito
   (botón "Refrescar"). En el estado de error, el control real es el botón
   "Reintentar" de `ErrorState`, con `aria-label="Reintentar cargar la
   página"`. Se corrigió la prueba para usar ese control, que es el que la
   persona usuaria realmente ve tras un error.
3. `screen.getByText("Laboratorio de Redes")` fallaba en la prueba de detalle
   SSR por ambigüedad: el texto aparece dos veces en `/inspecciones/[id]`
   (en el `<h1>` y en la `<dd>` de "Laboratorio"). Se resolvió consultando el
   encabezado por rol y nivel (`getByRole("heading", { level: 1, name:
   "Laboratorio de Redes" })`) y verificando un dato adicional único
   (`inspector: "Técnica A"`).

## 7. Validación (resultados reales)

- `npm ci` → instalación reproducible sin errores de dependencias.
- `npx vitest run tests/rendering.spec.tsx` → **5/5 pruebas en verde**
  (carga→lista, error, reintento, detalle válido, id inexistente).
- `npm test` (suite completa) → **7 archivos, 62 pruebas, 100 % en verde**
  (los 57 casos previos de la Semana 3 más los 5 nuevos de esta semana).
- `npm run build` → compiló correctamente; el reporte de rutas de Next.js
  confirma el contraste pedido: `/inspecciones` como `○ (Static)` y
  `/inspecciones/[id]` como `ƒ (Dynamic)` (server-rendered on demand).

Los comandos y resultados exactos con el SHA final del commit propio se
registran en `evidence/individual.md`.
