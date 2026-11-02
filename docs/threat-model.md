# Modelo de amenazas — PWA de inspecciones de laboratorio

**Proyecto:** PWA de inspecciones y mantenimiento de laboratorios (DMI-EQ11C / PWA-EQ11)  
**Semana:** 09 — Modelo de amenazas y privacidad aplicada  
**Responsable del documento:** Tonanzin (bloque 5.3)  
**Metodología:** STRIDE aplicada a los flujos de datos y a las fronteras de confianza, con priorización por impacto × probabilidad  
**Datos:** exclusivamente sintéticos. Este documento no contiene credenciales, tokens ni datos personales.

Este modelo describe el estado **real** del repositorio. Cuando un control no existe, la fila lo dice y el riesgo queda como aceptado; no se afirma una protección que el código no implementa.

---

## 1. Alcance y exclusiones

**Dentro del alcance**

- Cliente PWA (Next.js 14, React 18): formulario de inspecciones, IndexedDB, cola de sincronización (outbox), resolución de conflictos, cámara y geolocalización opcionales.
- Service Worker y cachés (`public/sw.js`).
- API `POST/GET /api/inspecciones` y su receptor en memoria (`src/lib/sync/api-store.ts`).
- Encabezados, permisos y `robots.txt` (`next.config.mjs`, `public/robots.txt`).
- Cadena de construcción: dependencias, `npm ci`, GitHub Actions y reportes de verificación.

**Fuera del alcance (riesgo aceptado y documentado)**

- Autenticación, autorización y rate limiting (decisión de alcance de la Semana 09).
- Cifrado en reposo del almacenamiento del navegador.
- Infraestructura de despliegue (proxy, WAF, TLS, HSTS): no existe una URL HTTPS oficial confirmada.
- Un servidor persistente y multinstancia: el receptor actual es académico y en memoria.
- Seguridad física del dispositivo y del perfil del navegador del usuario.

## 2. Activos protegidos

| Activo | Por qué importa | Dónde vive |
|---|---|---|
| Inspecciones (estado, hallazgos, resumen) | Integridad de la información operativa del laboratorio | IndexedDB `pwa-eq11-inspections`; receptor en memoria |
| Outbox y metadatos de sincronización | Una alteración cambia lo que se envía al servidor | IndexedDB `pwa-eq11-inspections` |
| Foto opcional y coordenadas con precisión | Datos potencialmente personales y de ubicación | IndexedDB `pwa-eq11-capabilities` (nunca en la outbox) |
| Cachés del Service Worker | Pueden conservar páginas y recursos más allá de la sesión | CacheStorage `pwa-eq11-v1-*` |
| Código fuente, dependencias y workflow | Una alteración compromete a todos los usuarios | Repositorio y GitHub Actions |
| Reportes de CI | Pueden filtrar información si registran payloads o credenciales | `reports/`, artefactos de Actions |

## 3. Actores

| Actor | Descripción | Confianza |
|---|---|---|
| Inspector legítimo | Captura y sincroniza inspecciones | Confiable dentro de su sesión |
| Persona con acceso al dispositivo | Puede abrir el navegador o leer el perfil local | No confiable respecto a datos locales |
| Atacante remoto | Envía solicitudes directamente a la API o intenta inyectar contenido | No confiable |
| Script malicioso en el origen | XSS o dependencia comprometida que ejecuta código en la página | No confiable; hereda los permisos del origen |
| Integrante del equipo | Contribuye código mediante PR revisados | Confiable con revisión cruzada |
| Servicio externo (GitHub, registro npm) | Aloja código, CI y dependencias | Confianza limitada |

## 4. Flujos de datos y fronteras de confianza

```text
[Inspector]
    │  (1) formulario / cámara / ubicación — acción explícita
    ▼
[Interfaz React] ──(2) validateInspection──► [IndexedDB: inspecciones + outbox]
    │                                              │
    │ (3) capacidades opcionales                   │ (4) processQueue
    ▼                                              ▼
[IndexedDB: capacidades]  (no sale del dispositivo)   [fetch POST + Idempotency-Key]
                                                       │   ═══ FRONTERA DE RED ═══
                                                       ▼
                                          [API /api/inspecciones]
                                           (5) límite de tamaño, Content-Type,
                                               validateInspectionMutation
                                                       ▼
                                          [Receptor en memoria: idempotencia + revisión]

[Service Worker] ◄── (6) solo GET same-origin sin Authorization ──► [CacheStorage]
[GitHub Actions] ──(7) npm ci --ignore-scripts, verify, escáner──► [reports/verification.json]
```

**Fronteras de confianza**

| Frontera | Qué cruza | Control principal |
|---|---|---|
| F1: persona/dispositivo → aplicación | Entrada de formulario, cámara, ubicación | Validación con lista permitida; permisos solo por acción explícita |
| F2: página → almacenamiento del navegador | Inspecciones, outbox, capacidades | Esquemas estrictos; capacidades fuera de la outbox |
| F3: navegador → red → API | Mutaciones de inspección | El servidor revalida; el cliente no es autoridad |
| F4: red → Service Worker → caché | Respuestas HTTP | Solo GET same-origin sin Authorization; no se cachean respuestas no exitosas |
| F5: repositorio → CI → artefactos | Código, dependencias, reportes | Instalación limpia, escáner de credenciales, reportes sin payloads |

## 5. Metodología y escala

Se aplicó **STRIDE** a cada flujo y frontera: *Spoofing* (suplantación), *Tampering* (alteración), *Repudiation* (repudio), *Information disclosure* (divulgación), *Denial of service* (denegación de servicio) y *Elevation of privilege* (elevación de privilegios).

- **Impacto (I):** Alto = compromete integridad o confidencialidad de datos de inspección o de ubicación; Medio = degrada el servicio o expone datos de bajo valor; Bajo = molestia local.
- **Probabilidad (P):** Alta = explotable hoy sin condiciones especiales; Media = requiere una condición plausible (acceso local, error de despliegue); Baja = requiere una cadena de fallos o un atacante avanzado.
- **Prioridad:** Alto×Alta = *Crítica*; Alto×Media = *Alta*; Alto×Baja o Medio×Media = *Media*; Medio×Baja = *Baja*.

## 6. Amenazas priorizadas

Formato de las referencias: en **Control**, las rutas entre comillas invertidas son archivos reales del repositorio; en **Prueba asociada**, cada referencia es `archivo › título exacto de la prueba`. La prueba `cada control del modelo de amenazas referencia pruebas y archivos que existen` (en `tests/security.spec.ts`) comprueba automáticamente que esas rutas y títulos existan.

| ID | Amenaza (STRIDE) | I | P | Prioridad | Control implementado | Prueba asociada | Riesgo residual |
|---|---|---|---|---|---|---|---|
| T-09 | **API sin autenticación** (Spoofing, Elevation of privilege): cualquiera que llegue a la API puede leer o enviar mutaciones. | Alto | Alta | **Crítica** | Ninguno en esta semana: la autenticación está fuera de alcance. Mitigación parcial: la validación de T-01 limita qué puede enviarse. | Ninguna (control no implementado) | **Alto, aceptado.** Debe resolverse antes de cualquier uso con datos reales. |
| T-01 | **Entrada maliciosa o malformada** (Tampering): campos inesperados, tipos incorrectos, textos enormes o JSON inválido. | Alto | Media | **Alta** | Lista permitida y límites en `src/lib/security/validation.ts`; la API `src/app/api/inspecciones/route.ts` responde 415, 413 y 400 con mensajes genéricos. El servidor es la autoridad final. | `tests/security.spec.ts › rechaza propiedades inesperadas`<br>`tests/security.spec.ts › rechaza JSON malformado con un error seguro`<br>`tests/security.spec.ts › rechaza un cuerpo de 16 KiB más un byte`<br>`tests/security.spec.ts › no expone detalles internos cuando falla la lectura` | Medio. Una entrada válida enviada en volumen no se limita (sin rate limiting). |
| T-03 | **Manipulación de IndexedDB u outbox** (Tampering): un script o una persona local altera inspecciones u operaciones pendientes. | Alto | Media | **Alta** | Esquemas estrictos en `src/lib/storage/schema.ts`; el receptor `src/lib/sync/api-store.ts` vuelve a validar todo lo recibido. | `tests/security.spec.ts › rechaza sync heredado en un StoredInspection`<br>`tests/security.spec.ts › rechaza campos inesperados en el sobre HTTP`<br>`tests/security.spec.ts › rechaza datos auxiliares de capacidades dentro del payload de sincronización de la outbox` | Medio. Datos válidos pero falsos no se detectan: no hay firma ni integridad de extremo a extremo. |
| T-05 | **Exposición de foto o ubicación** (Information disclosure): evidencia o coordenadas salen del dispositivo o aparecen en registros. | Alto | Media | **Alta** | Capacidades en una base separada (`src/lib/device/capabilities-storage.ts`), excluidas de la outbox; redacción de fotos en base64 y coordenadas en `src/lib/security/redaction.ts`. | `tests/security.spec.ts › rechaza datos auxiliares de capacidades dentro del payload de sincronización de la outbox`<br>`tests/security.spec.ts › redacta fotos en base64, coordenadas y correos` | Medio. Los datos locales no están cifrados y una foto puede mostrar personas o información confidencial. |
| T-12 | **Despliegue sin HTTPS** (Information disclosure, Tampering): tráfico y Service Worker expuestos en un despliegue inseguro. | Alto | Media | **Alta** | HSTS no se activa hasta confirmar un despliegue exclusivamente HTTPS (decisión de alcance). Los navegadores solo registran Service Workers en contextos seguros. | Ninguna automatizable: depende del entorno de despliegue | Alto hasta confirmar una URL HTTPS oficial (pregunta 5 de la sección 9). |
| T-13 | **Acceso físico al dispositivo** (Information disclosure): una persona con acceso al perfil lee IndexedDB y cachés. | Alto | Media | **Alta** | Operación de borrado `clearLocalApplicationData` en `src/lib/security/privacy.ts`. | `tests/security.spec.ts › elimina de forma verificable todos los datos locales administrados por la aplicación` | Alto. IndexedDB y CacheStorage no cifran en reposo ni protegen frente a quien controle el perfil. |
| T-02 | **XSS** (Tampering, Elevation of privilege): HTML o script en campos de texto que se ejecuta al mostrarse. | Alto | Baja | **Media** | React escapa el texto; el código no usa sinks HTML crudos; la CSP de `next.config.mjs` restringe orígenes; la validación conserva el contenido como texto literal. | `tests/security.spec.ts › el código fuente no usa sinks HTML crudos (dangerouslySetInnerHTML, innerHTML, eval)`<br>`tests/security.spec.ts › conserva marcado HTML como texto literal sin interpretarlo`<br>`tests/security.spec.ts › configura encabezados defensivos indispensables en next.config.mjs` | Medio. La CSP conserva `'unsafe-inline'` y `'unsafe-eval'` en `script-src` por compatibilidad con Next.js 14, lo que debilita la mitigación. |
| T-10 | **Dependencia comprometida** (Tampering): un paquete alterado ejecuta código en la compilación o en el navegador. | Alto | Baja | **Media** | `package-lock.json`, instalación con `npm ci --ignore-scripts` en `.github/workflows/academic-evaluation.yml`, Next.js fijado y sin dependencias nuevas. | `tests/security.spec.ts › el workflow de CI fija Node 20.19.6 e instala con npm ci --ignore-scripts` | Medio. No se ejecuta auditoría de vulnerabilidades y las dependencias de desarrollo usan rangos con `^`, acotados solo por el lockfile. |
| T-11 | **Credencial versionada** (Information disclosure): una clave o token llega al repositorio. | Alto | Baja | **Media** | Escáner de alta confianza `scripts/scan-secrets.mjs`, ejecutado por `scripts/verify.mjs` y por CI; `.gitignore` excluye los archivos de entorno. | `tests/security.spec.ts › el escáner detecta fixtures sintéticos de alta confianza y no imprime el valor`<br>`tests/security.spec.ts › el escáner no genera falsos positivos con palabras genéricas ni nombres de paquetes`<br>`tests/security.spec.ts › el escáner no marca el contenido normal del lockfile ni del repositorio`<br>`tests/security.spec.ts › scripts/verify.mjs ejecuta el escáner como check obligatorio` | Medio. Los patrones no cubren todos los formatos y no se analiza el historial de Git; requiere revisión humana. |
| T-07 | **Replay de operaciones** (Spoofing, Tampering): reenviar una mutación capturada o duplicada por un reintento. | Medio | Media | **Media** | Idempotencia por `operationId` y `Idempotency-Key` en `src/lib/sync/api-store.ts`. | `tests/integration/duplicate-sync.spec.ts › la misma clave de idempotencia devuelve exactamente la misma respuesta sin avanzar la revisión`<br>`tests/integration/duplicate-sync.spec.ts › reintenta tras perder la respuesta con el mismo operationId y no duplica el registro` | Medio. El registro de operaciones procesadas vive en memoria, sin expiración ni vínculo con una identidad. |
| T-08 | **Conflictos de sincronización** (Tampering de integridad): dos versiones divergentes y pérdida silenciosa de cambios. | Medio | Media | **Media** | Revisión por entidad y política en `src/lib/sync/conflict-policy.ts`; el conflicto exige decisión explícita y no se fusiona a ciegas. | `tests/sync.spec.ts › 3. conflicto entre dos revisiones conserva ambas versiones y detiene los reintentos`<br>`tests/sync.spec.ts › 6. una respuesta antigua recibida después de una nueva no reemplaza la revisión actual` | Bajo a medio. La resolución es manual y el receptor es de una sola instancia. |
| T-14 | **Borrado incompleto** (Information disclosure): quedan datos tras pedir su eliminación. | Medio | Media | **Media** | `clearLocalApplicationData` elimina ambas bases IndexedDB, las cachés y el almacenamiento web, y devuelve un informe por almacén. | `tests/security.spec.ts › elimina de forma verificable todos los datos locales administrados por la aplicación` | Medio. No elimina copias ya sincronizadas en el servidor ni reportes de CI, y no hay expiración automática de datos locales. |
| T-15 | **Fuga por mensajes de error y registros** (Information disclosure): un error o log incluye una credencial, una foto o coordenadas. | Medio | Media | **Media** | `src/lib/security/redaction.ts`: `safeErrorMessage` se usa al guardar `lastError` en la outbox (`src/lib/sync/queue.ts`, `src/lib/sync/client.ts`), al mostrar errores y al registrar en `src/components/ui/error-state.tsx`. | `tests/security.spec.ts › redacta credenciales con formato real de forma que el valor no aparece en la salida`<br>`tests/security.spec.ts › conserva mensajes seguros y útiles`<br>`tests/security.spec.ts › el valor sensible no llega a lastError de la outbox cuando el envío falla` | Medio. La redacción es por patrones y nombres de campo; un secreto con formato desconocido no se reconoce. |
| T-16 | **Denegación de servicio por cuerpos grandes o volumen** (Denial of service). | Medio | Media | **Media** | Límite de 16 KiB por solicitud, medido en bytes UTF-8, y límites por campo en `src/lib/security/validation.ts`. | `tests/security.spec.ts › rechaza un cuerpo de 16 KiB más un byte`<br>`tests/security.spec.ts › mide caracteres multibyte por sus bytes UTF-8 reales` | Medio. No hay rate limiting ni límites de proxy documentados. |
| T-17 | **Repudio** (Repudiation): sin identidad ni bitácora no se puede atribuir una mutación. | Medio | Media | **Media** | Ninguno: depende de la autenticación (T-09). | Ninguna (control no implementado) | Medio, aceptado hasta contar con identidades. |
| T-04 | **Fuga por caché del Service Worker** (Information disclosure): respuestas con datos o credenciales persisten en CacheStorage. | Medio | Baja | **Baja** | `public/sw.js` intercepta solo GET same-origin sin `Authorization`, no persiste las respuestas RSC y no cachea respuestas no exitosas. | `tests/offline.spec.ts › métodos no GET no se interceptan`<br>`tests/offline.spec.ts › requests con Authorization no se interceptan`<br>`tests/offline.spec.ts › RSC online con payload Flight → 200 text/x-component y NO se persiste`<br>`tests/offline.spec.ts › nunca cachea respuestas !ok`<br>`tests/offline.spec.ts › recursos no clasificados pasan directo (passthrough sin respondWith)` | Bajo. Las páginas HTML visitadas quedan en caché sin cifrar mientras la versión del Service Worker esté activa. |
| T-06 | **Permisos excesivos** (Elevation of privilege): la aplicación pide o conserva más capacidades de las necesarias. | Medio | Baja | **Baja** | `Permissions-Policy` en `next.config.mjs`: micrófono y capacidades no usadas deshabilitadas, cámara y geolocalización solo para el propio origen; los permisos se piden solo tras una acción explícita. | `tests/security.spec.ts › establece una política de permisos coherente con las capacidades del proyecto`<br>`tests/security.spec.ts › no solicita permisos de cámara ni geolocalización automáticamente`<br>`tests/security.spec.ts › permite el guardado principal de la inspección incluso si se deniegan permisos de capacidades` | Bajo. Si un script se ejecutara en el origen (T-02), podría solicitar cámara o ubicación. |

## 7. Resumen de riesgos residuales

1. **Sin autenticación ni autorización (T-09, T-17):** es el mayor riesgo del sistema y está aceptado solo porque el proyecto usa datos sintéticos. No debe usarse con datos reales sin resolverlo.
2. **Datos locales sin cifrar (T-13, T-14):** el borrado existe, pero nada protege frente a quien controle el perfil del navegador.
3. **CSP con `'unsafe-inline'` y `'unsafe-eval'` (T-02):** necesaria para la hidratación de Next.js 14 en esta configuración; se debe sustituir por nonces o hashes cuando sea viable.
4. **Despliegue y HTTPS (T-12):** no se afirma ninguna garantía de transporte hasta confirmar la URL oficial.
5. **Detección de credenciales y redacción por patrones (T-11, T-15):** reducen el riesgo pero no lo eliminan; complementan la revisión humana de cada PR.

## 8. Cómo se mantiene la correspondencia entre documento y comportamiento

- Cada fila apunta a pruebas con título exacto; la prueba `cada control del modelo de amenazas referencia pruebas y archivos que existen` falla si se renombra o elimina una prueba, o si un archivo citado deja de existir.
- La prueba `el modelo de amenazas cubre las amenazas mínimas exigidas y la metodología STRIDE` falla si se retira una de las amenazas obligatorias de la Semana 09.
- Las filas sin prueba (T-09, T-12, T-17) lo declaran de forma explícita en lugar de citar una prueba que no existe.

## 9. Preguntas pendientes para confirmación docente

1. ¿La prohibición de datos personales cubre solo los datos funcionales o también los nombres y enlaces requeridos por la evidencia académica?
2. ¿El check público `public-tests/check.sh` se ejecutará literalmente? Busca palabras genéricas (`secret`, `password`, `token`) y puede marcar documentación y el lockfile legítimos; no se modificó.
3. ¿Se requiere `evaluation-result.json` además de `reports/verification.json`?
4. ¿Existe una política institucional de retención o base jurídica que deba reflejarse en el inventario?
5. ¿Existe una URL HTTPS oficial sobre la que comprobar los encabezados?
