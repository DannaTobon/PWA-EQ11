# ADR-001 — Decisión sobre la estrategia de aplicación

> ADR significa registro de decisión arquitectónica. Este documento explica la comparación, la elección y sus consecuencias. Es un documento del equipo; adapten los ejemplos al caso.

## Estado

Indiquen fecha y estado de la decisión: propuesta o aceptada por el equipo.

## Contexto y restricciones

Resuman usuarios, conectividad, uso móvil, datos sintéticos y alcance del curso. Enlacen los escenarios o requisitos que influyen en la decisión.

## Alternativas consideradas

Comparen PWA, web tradicional, app nativa y multiplataforma. Pueden usar una tabla con una columna por alternativa y filas de instalación, offline, distribución, costo de desarrollo, mantenimiento, acceso al dispositivo y riesgos.

Expliquen condiciones y límites: por ejemplo, «la operación offline requiere diseñar almacenamiento y sincronización; no aparece por usar React». Eviten puntuaciones sin justificación. No es obligatorio construir prototipos de las cuatro opciones.

## Decisión

Justifiquen la estrategia PWA fijada para el curso con las restricciones del caso. Pueden señalar cuándo otra alternativa sería preferible. Mantengan el starter Next.js para esta entrega; comparar no significa cambiar de stack ni implementar las cuatro opciones.

## Consecuencias y riesgos

Relacionen beneficios, costos, riesgos y mitigaciones con la decisión. Ejemplo de razonamiento: «Conservar datos en el dispositivo permite continuidad sin conexión, pero exige manejar conflictos al reconectar». Desarrollen su propio análisis.

## Validación

Expliquen qué prueba o medición permitiría revisar sus supuestos en semanas posteriores. No afirmen haber validado sincronización, permisos u offline si aún no lo implementaron.
