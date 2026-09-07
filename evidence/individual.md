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

## Integrante: Tonanzi

- **Mi contribución concreta y enlace a archivo, commit anterior o revisión:** 
  *(Ej. Redacción de `docs/decision-record.md` evaluando las 4 alternativas)*
- **Decisión que puedo explicar y por qué:** 
  *(Ej. Por qué elegimos PWA sobre App Nativa dado el contexto)*
- **Comando o prueba proporcionada que ejecuté:** 
  *(Ej. Revisión cruzada de documentos)*
- **Resultado real que observé:** 
  *(Ej. El análisis cumple con las condiciones del starter)*
- **Qué verifica esa prueba y qué no verifica:** 
  *(Ej. Verifica la coherencia con los requisitos, pero no si la PWA ya funciona offline)*
- **Limitación, dificultad o riesgo que identifiqué:** 
  *(Ej. Riesgo futuro de pérdida de datos por sincronización)*
- **Uso de IA: herramienta, propósito, partes influenciadas y validación propia (o «no utilicé IA»):** 
  *(Describir el uso)*

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
