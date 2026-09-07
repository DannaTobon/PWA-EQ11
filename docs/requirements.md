# Requisitos del producto — documento del equipo

> Sustituyan las orientaciones por su análisis. Los ejemplos muestran el formato; pueden usar otros equivalentes. Los requisitos del producto futuro se documentan ahora y se implementarán en las semanas correspondientes. No hay una cantidad nueva obligatoria de requisitos.

## 1. Problema y contexto

Expliquen qué dificultad de inspección o mantenimiento resolverán, por qué importa la conectividad y qué queda fuera. Debe entenderse el problema sin conocer su equipo.

Ejemplo de inicio: «Un registro interrumpido por la falta de conexión dificulta dar seguimiento a un hallazgo». Adapten y completen: no lo presenten como un diagnóstico real de la UTT sin evidencia.

## 2. Usuarios y escenarios

Identifiquen a los usuarios y escriban al menos dos escenarios, uno con conectividad intermitente. En cada escenario indiquen situación inicial, acción y resultado esperado.

Ejemplo de formato: «Una persona encargada de inspección detecta un hallazgo sin conexión; registra el hallazgo y espera conservarlo para enviarlo después». Es una capacidad futura, no una función exigida en Semana 1.

## 3. Requisitos funcionales

Describan acciones del producto vinculadas a sus escenarios. Cada requisito lleva identificador, acción, condición de aceptación y alcance temporal.

| ID | Acción del producto | Condición observable de aceptación | Ahora o futuro |
|---|---|---|---|
| RF-01 (ejemplo, adaptar) | Mostrar los registros sintéticos del starter | Al abrir la página se ven las tres inspecciones proporcionadas | Semana 1 |

Un requisito como «gestionar inspecciones» necesita precisar qué acción y qué resultado se observarán. Agreguen los requisitos que cubran sus escenarios sin inventar que ya están implementados.

## 4. Requisitos no funcionales

Describan reproducibilidad, accesibilidad, seguridad, privacidad, rendimiento y operación offline futura. Para cada uno indiquen condición, método de comprobación y momento de validación. Declaren los supuestos de cualquier umbral propuesto.

Ejemplo: «En una copia limpia, con las versiones declaradas de Node y npm, `npm ci` y `npm run verify` terminan con código 0» (reproducibilidad actual).

Ejemplo de meta futura: «Con 100 registros sintéticos en el dispositivo de prueba declarado, el listado aparece en menos de 2 segundos; se medirá en cinco ejecuciones bajo la conexión definida». Esa cifra es ilustrativa, no un umbral impuesto ni un resultado ya medido.

## 5. Datos sintéticos y límites

Indiquen qué campos ficticios usa la aplicación y qué información real excluyen. No incluyan datos reales de estudiantes ni credenciales. La identificación académica de los integrantes se registra solo en la evidencia del repositorio privado y Classroom.

## 6. Criterios de aceptación de la Semana 1

Relacionen cada entrega actual con una inspección o comando. Distingan la comprobación técnica del juicio sobre contenido.

Ejemplos: prueba del starter → `npm test`; build → `npm run build`; requisitos verificables → revisión del documento; comparación de alternativas → revisión de `docs/decision-record.md`. No afirmen que `npm run verify` valida la calidad del análisis.
