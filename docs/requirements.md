# Requisitos del producto — documento del equipo

> Análisis del equipo basado en ACTIVIDAD-01.md, README.md, el starter y el código de la
> aplicación. Los requisitos futuros se documentan ahora y se implementarán en las semanas
> correspondientes. Ningún requisito etiquetado como "Futuro" está implementado esta semana.

## 1. Problema y contexto

El proyecto busca apoyar el registro y el seguimiento de inspecciones de mantenimiento de
laboratorios en un contexto de conectividad intermitente. El starter presenta un caso
académico: registrar un hallazgo no debe perderse ni quedar sin seguimiento cuando quien
inspecciona está en un lugar con red irregular.

Por qué importa la conectividad: quien realiza una inspección puede encontrarse en un
laboratorio sin conexión estable. Si el registro depende de la red en ese momento, un
hallazgo detectado podría no conservarse ni poder enviarse después, dificultando su
seguimiento.

Importante: el contexto de la UTT aparece en la documentación como caso académico del
curso (ACTIVIDAD-01.md, sección "Scenario"), no como un diagnóstico institucional real.
El proyecto se limita a este alcance; cualquier implicación institucional fuera del curso
queda fuera de este documento.

Queda fuera del alcance de esta semana: manifest, service worker, operación offline,
sincronización, notificaciones y autenticación (ACTIVIDAD-01.md). Estos se documentan como
requisitos futuros, no se implementan en la Semana 1.

## 2. Usuarios y escenarios

### Usuarios

El usuario principal es el personal encargado de realizar inspecciones de mantenimiento
de los laboratorios. El starter lo representa mediante responsables de inspección
("Técnica A", "Técnico B", "Técnica C") en los datos sintéticos
(src/lib/data/inspections.ts). No se definen aquí otros perfiles (supervisores,
administradores, etc.): el starter no aporta evidencia de ellos.

### Escenario 1 — Consulta de inspecciones disponibles (actual)

- Situación inicial: el personal de inspección abre la aplicación.
- Acción: consulta el listado de inspecciones recientes.
- Resultado esperado: se muestran las tres inspecciones sintéticas con laboratorio,
  fecha, responsable, estado y número de hallazgos (src/app/page.tsx).

Este escenario no impone una condición de red; la consulta se describe como la
funcionalidad actual del starter.

### Escenario 2 — Registro y conservación de un hallazgo con conectividad intermitente (futuro)

- Situación inicial: el personal detecta un hallazgo en un laboratorio sin conexión
  estable.
- Acción: registra el hallazgo y espera conservarlo en el dispositivo para enviarlo
  después, cuando haya conexión.
- Resultado esperado: el registro queda guardado incluso sin conexión y se sincroniza
  cuando la red se recupera. Esta es una capacidad futura; no es una función exigida en
  la Semana 1 (ACTIVIDAD-01.md).

## 3. Requisitos funcionales

Los requisitos se vinculan a los escenarios de la sección 2. Cada requisito indica su
estado actual o futuro. Los marcados como "Futuro" no están implementados esta semana.

| ID | Escenario | Acción del producto | Condición observable de aceptación | Ahora o futuro |
|----|-----------|--------------------|-------------------------------------|----------------|
| RF-01 | Escenario 1 | Mostrar el listado de inspecciones sintéticas del starter | Al abrir la aplicación se ven las tres inspecciones proporcionadas, con laboratorio, fecha, responsable, estado y hallazgos | Ahora |
| RF-02 | Escenario 2 | Registrar una inspección nueva | Al guardar datos válidos aparece un registro con esos mismos valores | Futuro |
| RF-03 | Escenario 2 | Conservar el registro en el dispositivo durante la intermitencia de conexión | Un registro guardado sin conexión permanece disponible al recuperarla | Futuro |
| RF-04 | Escenario 2 | Enviar/sincronizar el registro cuando se restablece la conexión | El registro guardado se sincroniza sin pérdida al reconectar | Futuro |

Nota sobre RF-02: los campos propuestos para la inspección (laboratorio, fecha y
hallazgo) son una propuesta del equipo derivada del escenario 2 y de los campos de los
datos sintéticos existentes (`location`, `date`, `findings`, `inspector`, `status` en
src/lib/data/inspections.ts). La actividad no impone textualmente esos campos ni su
cantidad; el equipo los propone como cobertura de sus escenarios. "Registrar" en RF-02 no
se implementa esta semana; se describe para documentar el escenario definido, sin afirmar
que ya está programado.

## 4. Requisitos no funcionales

Para cada requisito se indica la condición medible, el método de comprobación y el
momento de validación. Se distinguen tres estados:

- **Ahora:** la condición existe y puede comprobarse esta semana.
- **Futuro:** se documenta para semanas posteriores, cuando la capacidad exista.
- **Meta propuesta:** un umbral que el equipo propone y que todavía no ha medido.

| ID | Condición medible | Método de comprobación | Momento de validación | Estado |
|----|-------------------|------------------------|-----------------------|--------|
| RNF-01 (Reproducibilidad) | Con las versiones declaradas de Node y npm, `npm ci` y `npm run verify` terminan con código 0 | Ejecutar ambos comandos desde una copia limpia | Semana 1 | Ahora |
| RNF-02 (Accesibilidad) | La página principal es navegable y legible por teclado y lectores de pantalla | Revisión manual de encabezados, orden tabular y contraste, o herramienta de accesibilidad | Por definir/medir en semanas siguientes | Futuro |
| RNF-03 (Seguridad/Privacidad) | La aplicación no expone datos personales reales ni credenciales; se usan solo datos sintéticos | Revisión de los datos del producto y de ausencia de archivos `.env`/secretos (el reporte de verify no lo certifica) | Semana 1 y luego cada semana | Ahora |
| RNF-04 (Rendimiento) | Con 100 registros sintéticos en un dispositivo declarado, el listado aparece en menos de 2 segundos | Cinco ejecuciones cronometradas bajo la conexión definida | Futuro; umbral propuesto, todavía no medido | Meta propuesta |
| RNF-05 (Operación offline futura) | El registro funciona sin conexión tras la primera carga | Probar la aplicación en modo sin conexión | Cuando exista la capacidad offline | Futuro |

Los umbrales y metas (p. ej. el de RNF-04) son propuestas del equipo, no resultados ya
medidos. Ninguna condición "Futuro" o "Meta propuesta" se presenta aquí como ya validada.

## 5. Datos sintéticos y límites

La aplicación usa datos sintéticos de demostración definidos en
src/lib/data/inspections.ts: tres inspecciones con campos `id`, `location`, `date`,
`inspector`, `status`, `statusLabel`, `findings` y `summary`. La propia interfaz los
declara como "datos de demostración" y "sintéticos" (src/app/page.tsx).

Quedan excluidos:
- datos personales reales de estudiantes o del personal;
- credenciales, archivos `.env` o secretos;
- dependencias reales de la conectividad de la institución (el contexto de la UTT es un
  caso académico, no un diagnóstico real).

## 6. Criterios de aceptación de la Semana 1

- Instalación y ejecución del starter: `npm ci` y `npm run dev` permiten abrir la
  pantalla con las tres inspecciones sintéticas (comprobación técnica de
  instalación/ejecución).
- Verificación: `npm run verify` comprueba estructura (archivos requeridos), ejecuta la
  prueba proporcionada (`tests/starter.spec.mjs`) y compila (`next build`), generando
  `reports/verification.json` (comprobación técnica de estructura, prueba y build).
- Requisitos del producto: revisión del contenido de este documento (juicio del equipo y
  del docente; un build verde no valida la calidad del análisis).
- Comparación de alternativas: revisión del contenido de `docs/decision-record.md`
  (juicio, no automatizable).

Distinción: lo que `npm run verify` comprueba es técnico (estructura, prueba y build); no
valida la calidad de los requisitos ni la ausencia de secretos (ACTIVIDAD-01.md,
scripts/verify.mjs).