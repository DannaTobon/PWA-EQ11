# Checklist de integración final — PWA-EQ11 (Semana 3)

Responsable de mantenerlo: Tonanzin (documentación, evidencia e integración). Cada casilla se marca solo después de comprobarla; la columna «Cómo comprobar» indica el comando o la revisión. Fuente de los criterios: kit de la Semana 3 (`ASSIGNMENT.md`, `evaluation.json`, `public-tests/check.sh` y el workflow `week-03-w03-service-worker-offline.yml`).

## A. Higiene del repositorio

| ✔ | Punto | Cómo comprobar |
|---|---|---|
| ☐ | Sin conflictos de Git ni marcadores `<<<<<<<`, `=======`, `>>>>>>>` | `git grep -nE '^(<<<<<<<\|>>>>>>>)'` y `git grep -nE '^={7}$'` sin resultados |
| ☐ | `git status` limpio y sin ramas de trabajo sin fusionar | `git status`; `git branch -r --no-merged origin/main` |
| ☐ | Sin archivos duplicados o de respaldo (`*copy*`, `*.bak`, `*.orig`, `(1)`) | `git ls-files \| grep -iE 'copy\|\.bak\|\.orig\|\(1\)'` |
| ☐ | Sin archivos `.env`, credenciales ni datos personales reales | `git ls-files \| grep -i '\.env'`; revisión manual de `src/lib/data/` |
| ☐ | Sin marcadores de pendiente en documentos | `git grep -nE 'COMPLETAR\|pendiente de crear\|<fecha\|\[Enlace'` sin resultados |
| ☐ | Referencias a rutas existentes en README, `docs/` y `evidence/` | Revisión manual de cada ruta citada |
| ☐ | Sin instrucciones obsoletas (Semana 1 que ya no aplican) | Revisión de README, `START_HERE.md`, `docs/` |

## B. Hallazgos de la revisión (estado al preparar este checklist)

| # | Hallazgo | Archivo | Responsable sugerido | Estado |
|---|---|---|---|---|
| 1 | Conflicto de merge sin resolver: las secciones de Semana 2 de Tonanzin y de Fernando quedaron en dos mitades del archivo, con separador `=======` y `>>>>>>>` | `evidence/individual.md` | Tonanzin | Resuelto en la versión propuesta |
| 2 | Clave `"test:manifest"` sobrante fuera de `scripts` | `package.json` | Tonanzin | Resuelto en la versión propuesta |
| 3 | README de Semana 1 desactualizado (pedía ver «las tres inspecciones» en `localhost:3000`; no cubría pruebas, offline ni evidencia) | `README.md` | Tonanzin | Resuelto en la versión propuesta |
| 4 | Escenario 1, RF-01 y sección 5 citan `src/app/page.tsx` como lugar donde se muestran las tres inspecciones; ahora están en `src/app/inspections/page.tsx` | `docs/requirements.md` | Danna | Pendiente |
| 5 | ADR-001 sigue en estado «Propuesta» con la fecha `<fecha en que el equipo la acepte>` | `docs/decision-record.md` | Equipo (decisión) | Pendiente |
| 6 | Placeholder `[Enlace al repositorio privado en GitHub]` en la cabecera | `evidence/individual.md` | Equipo | Pendiente |
| 7 | La sección de Semana 2 de Fernando lista «Commit de integración con `main` y evidencia individual» sin SHA | `evidence/individual.md` | Fernando | Pendiente |
| 8 | La ruta de QA `/test-error` va en el build de producción; su texto de error menciona «Tonanzi» y su etiqueta dice «Semana 2» | `src/app/test-error/page.tsx` | Fernando (decide si se mantiene) | Pendiente |
| 9 | Las páginas usan `<main>` dentro del `role="main"` del AppShell y repiten un `<footer>`: hay dos landmarks `main` y dos pies de página | `src/app/*/page.tsx`, `src/components/app-shell.tsx` | Fernando / Danna | Pendiente (RNF-02 es futuro) |
| 10 | **Faltan los cinco artefactos que exige el kit**: `public/sw.js`, `src/lib/pwa/register-service-worker.ts`, `docs/cache-strategy.md`, `tests/service-worker.spec.ts`, `tests/offline.spec.ts`. El workflow del kit los comprueba con `test -e` (AC-02, 3 puntos) | varios | Quien tenga el bloque de Service Worker y pruebas | **Pendiente, crítico** |
| 11 | `npm test` solo ejecutaba la prueba del starter; el workflow del kit invoca `npm run test -- --run`, así que las pruebas nuevas de Vitest no se habrían ejecutado en ese paso (AC-03, 2 puntos) | `package.json` | Tonanzin | Resuelto en la versión propuesta (`test` ahora corre también Vitest); el equipo confirma |
| 12 | El kit pide «configuración de Node declarada» y el repositorio no la tenía | `package.json`, `.nvmrc` | Tonanzin | Resuelto en la versión propuesta (`engines` `>=20.19.0` y `.nvmrc` `20.19.6`); el equipo confirma |
| 13 | Falta copiar el workflow del kit `.github/workflows/week-03-w03-service-worker-offline.yml` | `.github/workflows/` | Tonanzin | Pendiente (copiar tal cual) |
| 14 | El `public-tests/check.sh` del kit reemplaza al de la Semana 1 y **no es confiable como aprobado/reprobado**: por cómo usa `set -e` con cadenas `&&` y una línea negada con `!`, imprime `PUBLIC_OK` aunque falten los cinco artefactos o el escaneo de palabras clave encuentre coincidencias (comprobado ejecutándolo sin `public/sw.js`). La comprobación real de artefactos es el paso AC-02 del CI, que sí falla. No editar el script. Requiere Bash y `ripgrep`. No copiar `ASSIGNMENT.md` al repositorio y evitar esas palabras en los documentos nuevos, por si el check privado del docente es más estricto | `public-tests/` | Tonanzin | Pendiente: ejecutarlo en Git Bash, registrar la salida real y consultar al docente |
| 15 | El artefacto de CI de la Semana 3 solo sube `evaluation-result.json`, `coverage/` y `test-results/`; el proyecto no genera ninguno. El kit pide un «reporte de verificación generado por CI o localmente» | `.github/workflows/`, `vitest.config.mts` | Equipo (decisión) | Pendiente: generar `test-results/` con el reporter JSON de Vitest o adjuntar `reports/verification.json` |
| 16 | El kit prefiere trabajo individual; el equipo entrega sobre un repositorio compartido de tres. El kit admite equipos «si existe una razón operativa» | `README.md` (sección 12) | Equipo | Pendiente: completar la razón |

## C. Verificación técnica (sobre copia limpia del SHA a entregar)

| ✔ | Comando | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| ☐ | `npm ci` | Termina sin errores | |
| ☐ | `npm run test -- --run` (lo que ejecuta el CI del kit) | Prueba del starter en PASS y Vitest en verde, incluidos `service-worker.spec.ts` y `offline.spec.ts` | |
| ☐ | `npm run build` | Exit 0 | |
| ☐ | `npm run verify` (equivalente exacto de `make verify`) | «Verificación técnica: pass»; genera `reports/verification.json` | |
| ☐ | `Test-Path public\sw.js, src\lib\pwa\register-service-worker.ts, docs\cache-strategy.md, tests\service-worker.spec.ts, tests\offline.spec.ts` | Cinco `True` (es la comprobación local confiable de los artefactos) | |
| ☐ | `bash public-tests/check.sh` (Git Bash) | Solo informativo: puede imprimir `PUBLIC_OK` aunque falten artefactos (hallazgo 14) | |
| ☐ | CI en verde para el SHA final | Workflows de Semana 1, Semana 2 y Semana 3 | |

## D. Comprobación manual (build de producción: `npm run build && npm start`)

| ✔ | Punto | Cómo comprobar |
|---|---|---|
| ☐ | Rutas `/`, `/inspections` y `/maintenance` cargan y se navega con el menú | Navegador |
| ☐ | `/manifest.webmanifest` responde e iconos cargan | README, sección 6 |
| ☐ | Service Worker activo y controlando la página | README, sección 7 |
| ☐ | Cachés presentes con las entradas esperadas | README, sección 9 |
| ☐ | Rutas acordadas funcionan en modo sin conexión y hay página de respaldo cuando algo no está cacheado | README, sección 8 |
| ☐ | Una versión nueva no sirve una caché corrupta ni mezclada con la anterior | Cambiar la versión de caché, recargar y revisar Cache Storage |
| ☐ | La carga inicial no se bloquea por el registro del Service Worker | Pestaña Network / Performance |
| ☐ | `ErrorBoundary` en `/test-error` (si se conserva la ruta) | Botón «Lanzar Error Determinista» y «Reintentar» |

## E. Trazabilidad con el kit de Semana 3

Estado leído sobre `main` del ZIP entregado. «Falta» significa que el artefacto no existe hoy.

| Requisito del kit | Artefacto esperado | Evidencia esperada | Estado hoy |
|---|---|---|---|
| Registrar el Service Worker | `src/lib/pwa/register-service-worker.ts` y su invocación desde la app | `tests/service-worker.spec.ts`; README sección 7 | Falta |
| Precache | `public/sw.js` | `tests/service-worker.spec.ts`; `docs/cache-strategy.md` | Falta |
| Caché en tiempo de ejecución (runtime cache) | `public/sw.js` | `tests/service-worker.spec.ts`; `docs/cache-strategy.md` | Falta |
| Página o respuesta de respaldo offline | `public/sw.js` (y la ruta o página que se sirva) | `tests/offline.spec.ts`; README sección 8 | Falta |
| Actualización sin servir una versión corrupta | Versionado de cachés y limpieza en `activate` dentro de `public/sw.js` | Prueba negativa en `tests/service-worker.spec.ts`; `docs/cache-strategy.md` | Falta |
| No cachear indiscriminadamente datos sensibles | Lista de rutas y tipos permitidos en `public/sw.js` | Prueba negativa; `docs/cache-strategy.md` | Falta |
| No bloquear la carga | Registro diferido en `register-service-worker.ts` | Revisión manual (sección D) y/o prueba | Falta |
| Registrar errores | Manejo y registro de errores en `sw.js` y en el registro | Prueba que fuerza un fallo | Falta |
| Invalidación controlada | Mecanismo explícito de versión o borrado de caché | `docs/cache-strategy.md`; prueba | Falta |
| Datos exclusivamente sintéticos | `src/lib/data/inspections.ts` | Revisión de `src/lib/data/` | Cumple |
| `docs/cache-strategy.md` con decisiones justificadas y trade-offs (AC-04) | `docs/cache-strategy.md` | Legible para un evaluador externo | Falta |
| `tests/service-worker.spec.ts` y `tests/offline.spec.ts`, deterministas y capaces de fallar ante una regresión (AC-03) | Ambos archivos | Salida de `npm run test -- --run` | Faltan |
| `README.md` con ejecución, supuestos y evidencia | `README.md` | Secciones 3–5, 12 y 14 | Versión propuesta lista; pendiente completar campos `[COMPLETAR]` |
| Lockfile y Node declarado | `package-lock.json`, `package.json` (`engines`), `.nvmrc` | Archivos versionados | Cumple con la versión propuesta |
| `make verify` o equivalente exacto documentado | `Makefile`; README sección 5 | `npm run verify` | Cumple |
| Reporte de verificación generado por CI o localmente | `reports/verification.json` y/o artefacto de CI | Adjunto en la entrega | Parcial (hallazgo 15) |
| AC-01 Instalación y build limpios | `package-lock.json`, `npm run build` | `npm ci` y `npm run build` con exit 0 | Cumple hoy |
| AC-02 Los cinco artefactos existen | Ver filas anteriores | Paso «AC-02» del workflow | **No cumple** |
| AC-03 Suite ejecutable y en verde | `tests/`, script `test` | `npm run test -- --run` | Parcial: 19 pruebas de Vitest; faltan las de Semana 3 |
| AC-04 Reporte y evidencia individual presentes | `README.md`, `evidence/individual.md` | Ambos archivos con contenido real | Parcial |
| Sin credenciales ni datos personales | Repositorio completo | Revisión manual y hallazgo 14 | Sin hallazgos manuales hasta ahora |
| Workflow del kit presente | `.github/workflows/week-03-w03-service-worker-offline.yml` | CI en verde | Falta (hallazgo 13) |

## F. Evidencia por integrante (`evidence/individual.md`)

El kit pide que cada persona incluya estos puntos y que las afirmaciones enlacen requisito, prueba o evidencia. Solo se documenta lo que cada quien hizo, probó o decidió.

| Integrante | Commit SHA evaluado | Decisión técnica que puede explicar | Prueba ejecutada y resultado | Limitación o fallo diagnosticado | Cambio que podría defender o modificar en vivo | Uso declarado de IA |
|---|---|---|---|---|---|---|
| Danna | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Tonanzin | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Fernando | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

## G. Documentos

| ✔ | Documento | Punto a confirmar |
|---|---|---|
| ☐ | `README.md` | Sin campos `[COMPLETAR]`; secciones 7–9 reflejan el Service Worker real |
| ☐ | `docs/cache-strategy.md` | Existe; incluye estrategia, trade-offs, límites y cómo invalidar |
| ☐ | `docs/requirements.md` | Referencias a rutas actualizadas (hallazgo 4) |
| ☐ | `docs/decision-record.md` | ADR aceptado y fechado (hallazgo 5) |
| ☐ | `evidence/individual.md` | Sin marcadores de conflicto; una sección por integrante y semana |

## H. Cierre y entrega

Fecha límite según el kit: a más tardar el domingo de la semana 3. `[COMPLETAR: fecha y hora exactas en Classroom/LMS]`.

| ✔ | Paso |
|---|---|
| ☐ | Todos los PR fusionados en `main`; revisión final conjunta hecha |
| ☐ | Último commit hecho y `git status` limpio |
| ☐ | SHA final: `git rev-parse HEAD` (se pega en Classroom o en el LMS; **no** se escribe dentro de un commit) |
| ☐ | CI en verde para ese SHA; reporte descargado |
| ☐ | Cada integrante entrega según el kit: pull request o commit indicado por el LMS, reporte de CI, enlace o hash del commit evaluado y `evidence/individual.md` con su sección |

## I. Revisión final conjunta

| Revisor | Entregables revisados | Fecha | Observaciones |
|---|---|---|---|
| Danna | | | |
| Tonanzin | | | |
| Fernando | | | |
