# Inventario de datos y privacidad — PWA de inspecciones de laboratorio

**Proyecto:** PWA de inspecciones y mantenimiento de laboratorios  
**Equipo:** DMI-EQ11C / PWA-EQ11 (Danna, Fernando, Tonanzin)  
**Semana:** 09 — Modelo de amenazas y privacidad aplicada  
**Responsable del inventario:** Fernando (Bloque 5.2)  

---

## 1. Principios de privacidad y minimización de datos

La aplicación sigue el principio de **privacidad por diseño y por defecto** (*Privacy by Design and by Default*) y el principio de **minimización de datos** (art. 5.1.c RGPD / buenas prácticas de ingeniería de software seguro):

1. **Datos estrictamente sintéticos:** Todas las demostraciones, pruebas automatizadas y datos iniciales son sintéticos. No se recopilan ni almacenan credenciales, contraseñas, tokens de producción ni datos personales reales (PII).
2. **Capacidades sensibles bajo acción explícita:** Las capacidades de dispositivo (cámara y geolocalización) son estrictamente optativas y requieren una acción deliberada del usuario (pulsación de botón). Nunca se solicitan permisos al cargar, montar o renderizar vistas.
3. **Aislamiento de datos auxiliares:** La evidencia fotográfica y las coordenadas geográficas se almacenan en una base IndexedDB auxiliar independiente (`pwa-eq11-capabilities`). **Nunca entran a la outbox ni se transmiten en la sincronización remota hacia la API.**
4. **Mecanismo de eliminación local comprobable:** La aplicación dispone de la función `clearLocalApplicationData()` para purgar completamente bases de datos locales, colas de sincronización, metadatos, cachés de Service Worker y almacenamiento web.

---

## 2. Matriz del inventario de datos

| Categoría | Finalidad | Origen | Almacenamiento | Transmisión | Retención | Eliminación | Riesgo principal | Control de minimización |
|---|---|---|---|---|---|---|---|---|
| **1. Inspecciones** | Registrar el estado operativo, hallazgos y resumen de los laboratorios inspeccionados. | Entrada manual del usuario en formulario web o datos sintéticos iniciales. | IndexedDB (`pwa-eq11-inspections`, almacén `inspections`) y memoria del cliente. | Se transmite a `/api/inspecciones` vía HTTP POST (JSON) al sincronizar. | Persiste localmente hasta que se sobrescribe por actualización remota o purga manual. | Operación `clearLocalApplicationData()` o borrado del sitio en navegador. | Modificación indebida de hallazgos o inyección de datos maliciosos. | Validación estricta con lista permitida (`validateInspection`), rechazo de campos desconocidos y límite de tamaño por payload (8 KB). |
| **2. Metadatos de sincronización** | Llevar control de versiones base, fechas de sincronización y estado de conciliación. | Generados internamente por el motor de sincronización (`use-inspection-sync`). | IndexedDB (`pwa-eq11-inspections`, almacén `sync_meta`). | No se transmiten directamente; se usan para encabezados de idempotencia y control de concurrencia. | Persiste mientras la aplicación esté instalada o se resetee el estado de sincronización. | Purgado atómico en `clearLocalApplicationData()`. | Corrupción de estado de replicación que cause desincronización o pérdida de cambios. | Tipado estricto (`SyncMetaRecord`), valores escalares normalizados y aislamiento en almacén propio. |
| **3. Outbox (cola de operaciones)** | Garantizar tolerancia a desconexión y entrega eventual idempotente de mutaciones locales. | Generado por `saveInspectionWithOperation` tras validación exitosa. | IndexedDB (`pwa-eq11-inspections`, almacén `outbox`). | El payload de la operación se envía como cuerpo POST a `/api/inspecciones`. | Hasta que la sincronización recibe confirmación HTTP 200/201 del servidor o se resuelve un conflicto. | Al completar exitosamente la sincronización o mediante `clearLocalApplicationData()`. | Manipulación de la cola outbox por scripts locales maliciosos (XSS) o repetición de transacciones (replay). | Esquema restringido a tipos reconocidos (`assertOutboxOperation`), validación previa y uso de claves de idempotencia (`operationId`). |
| **4. Conflictos local/remoto** | Permitir al inspector comparar versiones divergentes y decidir conservar versión local o aceptar remota. | Comparación entre versión devuelta por el servidor (409 Conflict) y estado local en outbox. | Memoria reactiva en cliente (`useInspectionSync`) y registro en `outbox` con estado `conflict`. | Solo se transmite la decisión resultante (`keepLocal` reenvía, `acceptServer` descarta local). | Transitorio; dura hasta que el usuario resuelve el conflicto en la interfaz. | Al seleccionar resolución o invocar purga de datos. | Sobrescritura inadvertida de datos críticos o confusión operativa. | No se fusionan campos a ciegas; el conflicto requiere intervención consciente y explícita del inspector. |
| **5. Foto opcional (Evidencia)** | Adjuntar evidencia visual puntual del estado físico del equipo o laboratorio. | Cámara del dispositivo activada por botón interactivo explícito. | IndexedDB auxiliar (`pwa-eq11-capabilities`, almacén `inspection_capabilities`). | **Ninguna.** Permanece estrictamente confinada al almacenamiento local del dispositivo. | Persiste asociada al `inspectionId` local hasta que se elimine la inspección o se purgue la base. | Función `deleteInspectionCapabilities()`, `removeEvidence()` o `clearLocalApplicationData()`. | Captura involuntaria de personas o información confidencial visible en el laboratorio. | Permiso opcional bajo demanda; liberación inmediata de `MediaStream` (`releaseCameraStream`); no se almacena URL de vista previa; excluida de la sincronización. |
| **6. Coordenadas y precisión (Ubicación)** | Registrar la posición geográfica puntual donde se llevó a cabo la inspección para trazabilidad local. | Geolocation API del navegador (`getCurrentPosition`) tras clic en botón de ubicación. | IndexedDB auxiliar (`pwa-eq11-capabilities`, almacén `inspection_capabilities`). | **Ninguna.** No forma parte del payload de sincronización ni se envía a servidores externos. | Persiste en el registro auxiliar local de la inspección. | Función `removeLocation()`, `deleteInspectionCapabilities()` o `clearLocalApplicationData()`. | Rastreo no consentido del desplazamiento o ubicación del personal de inspección. | Lectura puntual (sin `watchPosition` ni histórico); precisión limitada; solicitud únicamente interactiva; excluida de la outbox. |
| **7. Estado de permisos** | Gestionar la disponibilidad y respuesta de los permisos del navegador (cámara, ubicación, notificaciones). | Consulta puntual a `navigator.permissions` o resultado de la llamada a la API correspondiente. | Memoria volátil del componente durante la sesión activa (no se persiste en disco). | Ninguna transmisión. | Se pierde al cerrar la pestaña o recargar la página. | Recarga de página o revocación manual de permisos en los ajustes del navegador. | Bloqueo del flujo de captura si el usuario rechaza un permiso del sistema. | La denegación de permisos nunca bloquea el formulario ni el guardado principal; manejo determinista de fallback (`permission-denied`, `unsupported`). |
| **8. Cachés del Service Worker** | Permitir navegación sin conexión (*app shell*, rutas estáticas, fallback offline). | Peticiones HTTP interceptadas por `public/sw.js` (archivos estáticos, chunks JS/CSS, HTML base). | CacheStorage (`pwa-eq11-v1-core`, `pwa-eq11-v1-static`, `pwa-eq11-v1-pages`). | Ninguna transmisión externa; sirve solicitudes locales cuando no hay red. | Mientras la versión del Service Worker (`v1`) esté activa; se invalida en el evento `activate` de versiones nuevas. | Purgado en `clearLocalApplicationData()` (`caches.delete()`) o desinstalación del Service Worker. | Persistencia de datos sensibles o versiones desactualizadas en cachés no cifradas. | Exclusión estricta de rutas de API mutables, omisión de peticiones con encabezados sensibles, y respuesta 503 conservadora para RSC sin red. |
| **9. Reportes de pruebas y CI** | Evidencia de calidad y verificación académica de pruebas automatizadas y compilación. | Generados localmente y en GitHub Actions por scripts de prueba (`verify.mjs`, Vitest, Next build). | Archivos JSON en disco local y artefactos efímeros de GitHub Actions (`reports/`, `vitest-report.json`). | Subidos a GitHub Actions como artefactos de workflow (visibles solo para miembros del repositorio). | Retención estándar de artefactos en GitHub Actions (hasta 90 días o según política del repositorio). | Eliminación manual de carpetas locales `reports/` o expiración automática en CI. | Exposición de secretos o variables de entorno en logs públicos. | Prohibición absoluta de credenciales reales; uso de fixtures sintéticos estandarizados; redacción de excepciones en pruebas. |

---

## 3. Decisión técnica defendible

> **Decisión:**  
> Las capacidades de hardware sensibles (cámara y geolocalización) son estrictamente optativas, requieren una acción explícita del usuario y sus datos auxiliares se almacenan en una base IndexedDB independiente (`pwa-eq11-capabilities`), quedando **excluidas de forma permanente del payload de la outbox y de la sincronización hacia la API.**

**Justificación:**
1. **Minimización de superficie de ataque:** Si la API o la comunicación de red sufriera una interceptación o vulnerabilidad, no se filtrarán fotografías ni coordenadas del personal.
2. **Resiliencia operativa:** El fallo o rechazo de una capacidad de hardware (falta de cámara, permiso denegado, timeout de GPS) jamás impide ni degrada el guardado de la inspección básica de laboratorio.
3. **Control del usuario:** El usuario retiene el control total sobre si desea adjuntar evidencia física y puede revocar o eliminar los datos locales en cualquier momento.

---

## 4. Limitaciones y riesgos residuales

1. **Almacenamiento no cifrado en reposo en el cliente:**  
   IndexedDB y CacheStorage son gestionados por el navegador y se almacenan en texto claro en el perfil de usuario del sistema operativo. Por tanto, no protegen contra atacantes con acceso físico al dispositivo o acceso al perfil local del navegador.
2. **Dependencia de la sandbox del navegador:**  
   La separación entre orígenes y la política de permisos dependen de la implementación del motor del navegador del cliente.
3. **Ausencia temporal de cifrado extremo a extremo:**  
   Dado que el backend del curso utiliza datos sintéticos y la autenticación se abordará en semanas posteriores, la transmisión se basa en la seguridad del transporte (HTTPS en despliegues reales).
