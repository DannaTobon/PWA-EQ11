# Evidencia individual del equipo

> Un solo archivo compartido. Repitan la sección siguiente por cada integrante; cada persona escribe y explica su propia evidencia. Se aceptan evidencias previas equivalentes. El SHA final se entrega en Classroom después del último commit, para evitar modificar el commit que se está identificando.

- **Grupo y equipo:** DMI-EQ11C / PWA-EQ11
- **Repositorio del equipo:** [Enlace al repositorio privado en GitHub]

---

## Integrante: Danna

- **Mi contribución concreta y enlace a archivo, commit anterior o revisión:** 
  *(Ej. Redacción de `docs/requirements.md` definiendo los escenarios y límites del producto)*
- **Decisión que puedo explicar y por qué:** 
  *(Ej. La definición de los requisitos no funcionales)*
- **Comando o prueba proporcionada que ejecuté:** 
  *(Ej. `npm run verify` tras finalizar el análisis)*
- **Resultado real que observé:** 
  *(Ej. Resultado técnico "pass")*
- **Qué verifica esa prueba y qué no verifica:** 
  *(Ej. Verifica la estructura y que el build sea exitoso, pero no verifica la calidad de mis documentos)*
- **Limitación, dificultad o riesgo que identifiqué:** 
  *(Ej. Asegurar que los escenarios descritos no impliquen funcionalidades de sincronización offline)*
- **Uso de IA: herramienta, propósito, partes influenciadas y validación propia (o «no utilicé IA»):** 
  *(Describir el uso, ej. ChatGPT para lluvia de ideas en escenarios, revisado manualmente)*

---

## Integrante: Tonanzin

## Evidencia individual — Tonanzin

- **Mi contribución concreta y enlace a archivo, commit anterior o revisión:**
  Redacción de `docs/decision-record.md` (ADR-001), incluyendo la comparación de las 4 alternativas (PWA, web tradicional, nativa, multiplataforma) y la justificación de la decisión. Commit `04040af12498d83f4def66c439ceeab5b4099c37` en la rama `main`: "docs: agregar ADR-001 sobre estrategia de aplicacion (PWA)".

- **Decisión que puedo explicar y por qué:**
  Elegimos PWA sobre las demás alternativas porque el caso requiere tolerar conectividad intermitente en campo y el equipo debe seguir usando el starter Next.js + React + TypeScript sin duplicar esfuerzo en bases de código nativas. PWA permite mantener un solo código base, distribuirse por URL sin depender de tiendas, y habilita a futuro el registro offline con sincronización posterior — que es justo el escenario descrito en los requisitos del producto. Frente a app nativa, evita el costo de dos bases de código y los tiempos de revisión de tienda, que no encajan con el ritmo semanal del curso.

- **Comando o prueba proporcionada que ejecuté:**
  `npm run verify` sobre mi copia local del proyecto (`PWA-EQ11`).

- **Resultado real que observé:**
  El comando corrió `test` (`starter.spec.mjs: PASS`) y `build` (`next build`, Next.js 14.2.35), compiló correctamente y generó las 4 páginas estáticas sin errores. Salida final: "Verificación técnica: pass. Revisión académica: pendiente." Reporte generado en `reports/verification.json`.

- **Qué verifica esa prueba y qué no verifica:**
  Verifica que el starter compila y pasa sus pruebas técnicas (código de salida correcto, sin errores de build). No verifica la calidad ni la corrección del análisis de alternativas del ADR, ni que la PWA ya funcione offline: eso sigue siendo un juicio de contenido pendiente, distinto de la comprobación técnica.

- **Limitación, dificultad o riesgo que identifiqué:**
  El soporte de PWA es desigual entre navegadores/SO, especialmente en iOS (notificaciones push y persistencia de almacenamiento limitadas). Además, si la estrategia de caché/sincronización no queda bien definida, existe el riesgo de que el usuario crea que su registro se guardó cuando en realidad no se sincronizó — esto todavía no está diseñado ni implementado, es un riesgo a futuro.

- **Uso de IA: herramienta, propósito, partes influenciadas y validación propia (o «no utilicé IA»):**
  Utilicé Claude (Anthropic) como apoyo para estructurar y redactar un primer borrador de `docs/decision-record.md` (la tabla comparativa y la justificación de PWA), a partir de los requisitos y el formato ADR que me proporcionó el equipo. Yo definí el alcance, revisé y ajusté el contenido a las restricciones reales del proyecto (starter Next.js, curso, escenarios), y validé personalmente la parte técnica ejecutando `npm run verify` y haciendo el commit. La decisión y su justificación las puedo explicar y sostener por mi cuenta.

---

## Integrante: Fernando

- **Mi contribución concreta y enlace a archivo, commit anterior o revisión:** 
  Configuración del entorno, actualización de `README.md` y estructura de `evidence/individual.md`. Coordinación técnica y revisión final del equipo.
- **Decisión que puedo explicar y por qué:** 
  La organización del flujo de trabajo y la estructuración para evitar conflictos de integración en Git, separando los archivos que cada integrante editará de forma concurrente.
- **Comando o prueba proporcionada que ejecuté:** 
  `npm ci` y `npm run dev`.
- **Resultado real que observé:** 
  El comando `npm ci` completó la instalación en ~46s generando la carpeta `node_modules` (con advertencias de auditoría esperadas del starter). `npm run dev` arrancó el servidor en `http://localhost:3000` y respondió con HTTP 200 OK.
- **Qué verifica esa prueba y qué no verifica:** 
  `npm ci` asegura una instalación 100% reproducible usando el `package-lock.json`. `npm run dev` prueba que la aplicación arranca y sirve contenido. Estas pruebas **NO** validan que la aplicación sea ya una PWA funcional (falta manifest, service worker), ni valida la calidad de la documentación de mis compañeras.
- **Limitación, dificultad o riesgo que identifiqué:** 
  Existen 2 vulnerabilidades de alta severidad reportadas por npm audit en el starter; decidimos no forzar una actualización (`npm audit fix --force`) para no alterar el starter base ni romper compatibilidad sin previo análisis.
- **Uso de IA: herramienta, propósito, partes influenciadas y validación propia (o «no utilicé IA»):** 
  Utilicé Antigravity (Gemini/Claude) como asistente técnico dentro de mi IDE para leer el entorno, analizar los requisitos de la ACTIVIDAD-01 y generar la plantilla estructural de los documentos. Verifiqué que cada sección cumpla estrictamente con la rúbrica y no implemente funciones futuras no requeridas (como offline o manifiesto).
