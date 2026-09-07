# ADR-001 — Decisión sobre la estrategia de aplicación

## Estado

**Propuesta** — pendiente de aceptación formal por el equipo. Fecha: `<fecha en que el equipo la acepte>`.

## Contexto y restricciones

El producto está pensado para personas que realizan inspecciones o registros en campo (uso principalmente móvil), donde la conectividad puede ser intermitente. Los datos manejados en esta etapa son sintéticos, sin información real de estudiantes ni credenciales. El proyecto se desarrolla dentro del alcance de un curso con entregas semanales, sobre un starter ya definido en **Next.js + React + TypeScript**, sin margen de tiempo ni de equipo para mantener bases de código nativas separadas.

Esta decisión está influida por:
- El escenario de conectividad intermitente descrito en los requisitos del producto (registrar un hallazgo sin conexión y conservarlo para enviarlo después).
- El requisito no funcional de operación offline futura.
- La restricción explícita de conservar el starter Next.js para esta entrega.

## Alternativas consideradas

Se compararon cuatro alternativas: PWA, aplicación web tradicional, aplicación nativa y aplicación multiplataforma (nativa compilada).

| Criterio | PWA | Web tradicional | Nativa | Multiplataforma |
|---|---|---|---|---|
| **Instalación** | Opcional, desde el navegador ("Añadir a inicio"), sin tienda ni revisión previa | No hay instalación; siempre se abre por URL/navegador | Requiere tienda oficial (App Store/Play Store), con proceso de revisión y publicación | Requiere tienda oficial igual que nativa; el build es multiplataforma pero la distribución sigue las reglas de cada tienda |
| **Offline** | Puede cachear assets y datos con service worker + almacenamiento local; permite lectura/registro básico offline y sincronizar después. Esta capacidad **no aparece por usar React**: requiere diseñar explícitamente el almacenamiento y la estrategia de sincronización | Sin conexión, la app deja de responder; no hay caché de datos ni de la interfaz | Puede implementar almacenamiento local nativo (SQLite, Core Data, etc.) con control fino sobre sincronización | Similar a nativa: puede usar almacenamiento local del dispositivo, pero depende de librerías del framework multiplataforma |
| **Distribución** | Por URL; no depende de aprobación de tienda; actualizaciones inmediatas al desplegar | Igual que PWA: por URL, sin fricción de tienda | Depende de aprobación de tienda, tiempos de revisión y cuentas de desarrollador (con costo) | Igual que nativa: depende de tiendas, cuentas y tiempos de revisión, aunque el código se comparta entre plataformas |
| **Costo de desarrollo** | Un solo código base web; reutiliza el stack actual (Next.js + React + TypeScript) sin herramientas adicionales, más el esfuerzo de configurar manifest/service worker | Un solo código base web, el más simple de los cuatro, pero sin capacidades de instalación/offline | Requiere lenguajes/herramientas distintos por plataforma (Swift/Kotlin), duplicando esfuerzo si se cubre iOS y Android | Un código base compartido, pero exige aprender un framework adicional (ej. React Native) y su tooling de compilación nativa |
| **Mantenimiento** | Un solo repositorio y un solo pipeline de despliegue web | Un solo repositorio, mantenimiento mínimo | Dos bases de código (iOS/Android), o el doble de esfuerzo de mantenimiento y pruebas | Un código base, pero el mantenimiento del puente nativo (dependencias nativas, actualizaciones del framework) puede ser más complejo que el de una web pura |
| **Acceso al dispositivo** | Acceso parcial vía APIs web (cámara, geolocalización, notificaciones push en algunos navegadores/plataformas); limitado frente a nativo, especialmente en iOS | Igual o menor acceso que PWA, sin service worker ni manifest | Acceso completo y directo a todas las APIs del sistema operativo | Acceso amplio mediante módulos nativos del framework; APIs muy específicas pueden requerir código nativo adicional |
| **Riesgos** | Soporte inconsistente entre navegadores/SO (especialmente iOS con push y almacenamiento persistente); límites de cuota de almacenamiento del navegador | Ningún soporte offline; cualquier corte de conexión interrumpe el registro de información | Costo y tiempo de desarrollo mayor; curva de aprendizaje; tiempos de revisión de tienda pueden retrasar entregas | Dependencia de un framework de terceros y su ciclo de actualizaciones; posibles incompatibilidades al integrar módulos nativos |

No se construyeron prototipos de las cuatro opciones; la comparación se basa en las características documentadas de cada enfoque y en las restricciones propias del curso y del caso.

## Decisión

Se fija **PWA** como estrategia para este curso, manteniendo el starter **Next.js + React + TypeScript** sin cambios de stack. Esta decisión no implica implementar las cuatro alternativas ni reemplazar el starter; solo define la dirección hacia la que evolucionará el producto.

PWA encaja con este caso porque:
- Reutiliza el stack y el conocimiento del equipo sin introducir un lenguaje o framework nuevo.
- Habilita, a futuro, el registro de hallazgos bajo conectividad intermitente mediante caché local y sincronización posterior — el escenario central del producto.
- Mantiene un único código base y un único pipeline de despliegue, reduciendo el mantenimiento frente a nativa o multiplataforma.
- Se distribuye por URL, sin depender de tiempos de revisión de tienda, lo cual encaja con el ritmo de entregas semanales del curso.

**Cuándo otra alternativa sería preferible:**
- Si el producto necesitara acceso profundo y constante a hardware específico (sensores avanzados, integraciones de bajo nivel) que las APIs web no cubren, una app nativa o multiplataforma sería más adecuada.
- Si la conectividad intermitente no fuera un requisito real del caso, una aplicación web tradicional sería suficiente, sin el costo adicional de configurar service worker y manifest.

## Consecuencias y riesgos

- Conservar datos en el dispositivo permitiría continuidad sin conexión, pero exige manejar conflictos y duplicados al reconectar; esto todavía no está diseñado ni implementado.
- Se acepta el costo adicional de configurar manifest y service worker, y de definir una estrategia de caché/sincronización, a cambio de reducir el costo de mantener múltiples bases de código.
- Riesgo: soporte desigual de PWA en iOS frente a Android/desktop, en particular para notificaciones push y persistencia de almacenamiento.
  - Mitigación: tratar el registro offline como una función futura, documentada y probada de forma incremental antes de anunciarla como disponible.
- Riesgo: si la estrategia de caché no está bien definida, el usuario puede creer que su registro se guardó cuando en realidad no se sincronizó.
  - Mitigación: mostrar en la interfaz un estado explícito de "pendiente de sincronizar".

## Validación

Estas validaciones son para semanas posteriores; a la fecha de este documento no se ha implementado ni probado sincronización, permisos ni operación offline.

- Verificar que la app se puede "instalar" desde el navegador en los dispositivos/navegadores declarados como objetivo por el equipo.
- Simular una pérdida de conexión, registrar un hallazgo, y comprobar que se sincroniza correctamente al recuperar la conexión.
- Medir qué datos se conservan y cuáles se pierden bajo condiciones de conexión intermitente definidas por el equipo.

---

## Evidencia de Tonanzin

- **Commit:** `<hash del commit>` — mensaje: `<mensaje del commit>` en la rama `<rama>`. *(pendiente de completar con el commit que incluya los cambios de este documento)*
- **Qué se hizo:** redacción de este ADR (`docs/decision-record.md`): comparación de alternativas y justificación de la decisión PWA.
- **Qué se verificó (comprobación técnica del starter, no del análisis):** ejecuté `npm run verify` sobre una copia local del proyecto (`PWA-EQ11`). El comando corrió `test` (`starter.spec.mjs: PASS`) y `build` (`next build` con Next.js 14.2.35, compiló correctamente y generó 4 páginas estáticas sin errores). Resultado final del comando: "Verificación técnica: pass. Revisión académica: pendiente." Reporte generado en `reports/verification.json`.
- **Nota importante:** este comando valida que el starter compila y pasa sus pruebas técnicas; **no** valida la calidad ni la corrección del análisis de este ADR. La revisión de contenido es un juicio aparte, aún pendiente.
- **Revisión documentada:** `<enlace al PR/commit o comentario de revisión, si aplica>`.