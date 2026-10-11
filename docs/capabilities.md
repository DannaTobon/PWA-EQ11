# Capacidades opcionales y notificaciones — acuerdo de Semana 06

## 1. Alcance común

La Semana 06 agrega cámara, geolocalización puntual y notificaciones locales sin convertir ninguna capacidad en requisito para registrar una inspección. Todo permiso se solicita como consecuencia directa de una acción explícita. Si una API no existe, se deniega un permiso, la persona cancela, vence un tiempo de espera o sucede un error, el formulario y el guardado principal continúan disponibles.

Las demostraciones y pruebas del curso usan exclusivamente datos sintéticos y mocks. Los módulos no acceden a APIs del navegador al importarse y deben poder cargarse durante build y renderizado en servidor.

El kit exige los archivos de cámara, geolocalización y notificaciones, pero no fija sus exports ni sus firmas. La tabla siguiente es el contrato elegido por el equipo para coordinar las ramas; no se presenta como un requisito oculto del kit.

## 2. Tipos y resultados compartidos

`src/lib/device/types.ts` define `CapabilityResult<T>` como una unión discriminada:

- `success`, con el dato mínimo obtenido;
- `unsupported`, cuando la API necesaria no existe;
- `permission-denied`, cuando el navegador rechaza el permiso;
- `cancelled`, cuando la persona cancela o deja una solicitud en estado predeterminado;
- `timeout`, para operaciones con espera limitada, principalmente ubicación;
- `error`, para fallos no clasificados.

Un resultado no exitoso incluye un mensaje apto para presentar como fallback. No se propagan objetos de error del navegador ni se usa `any`.

`CapabilityDataSource` diferencia `synthetic-demo` de `device-api`. Los fixtures creados directamente para pruebas y demostraciones se etiquetan como `synthetic-demo`. Los módulos de cámara y geolocalización no reciben el origen como argumento: sus resultados exitosos están restringidos a `DeviceEvidenceAttachment` y `DeviceLocationAttachment`, cuyo origen solo puede ser `device-api`. Así, un consumidor no puede pedir que una lectura real se etiquete como sintética. Los mocks siguen usando valores inventados aunque ejerciten el mismo camino de código de las APIs del dispositivo.

## 3. Contratos públicos propuestos

Las opciones específicas y tipos de sesión que solo usa un módulo pueden declararse en ese módulo. Los datos que cruzan cámara, ubicación, controles y almacenamiento usan los tipos compartidos.

| Responsable | Archivo | Función pública acordada | Entradas | Resultado |
|---|---|---|---|---|
| Fernando | `src/lib/device/camera.ts` | `requestCameraStream` | opciones de video mínimas y opcionales | `Promise<CapabilityResult<MediaStream>>` |
| Fernando | `src/lib/device/camera.ts` | `captureEvidence` | `MediaStream` | `Promise<CapabilityResult<DeviceEvidenceAttachment>>` |
| Fernando | `src/lib/device/camera.ts` | `releaseCameraStream` | `MediaStream` | `void`; detiene todos los tracks |
| Fernando | `src/lib/device/capabilities-storage.ts` | `saveInspectionCapabilities` | `InspectionCapabilityRecord` | `Promise<void>` |
| Fernando | `src/lib/device/capabilities-storage.ts` | `getInspectionCapabilities` | `inspectionId` | `Promise<InspectionCapabilityRecord \| undefined>` |
| Fernando | `src/lib/device/capabilities-storage.ts` | `deleteInspectionCapabilities` | `inspectionId` | `Promise<void>` |
| Tonanzin | `src/lib/device/geolocation.ts` | `getCurrentLocation` | opciones puntuales opcionales | `Promise<CapabilityResult<DeviceLocationAttachment>>` |
| Danna | `src/lib/notifications/client.ts` | `enableLocalNotifications` | ninguna; se invoca desde acción explícita | `Promise<CapabilityResult<LocalNotificationPermission>>` |
| Danna | `src/lib/notifications/client.ts` | `showLocalNotification` | `LocalNotificationMessage` | `Promise<CapabilityResult<LocalNotificationDelivery>>` |

Los nombres y firmas podrán cambiar únicamente mediante acuerdo del equipo y actualización simultánea de este documento, consumidores y pruebas. No se crearán funciones vacías para satisfacer nombres de archivo.

## 4. Evidencia y ubicación mínimas

`EvidenceAttachment` conserva solo:

- `source`;
- el `Blob` de imagen;
- MIME;
- fecha y hora ISO de captura.

No guarda una URL de vista previa. El control que llame `URL.createObjectURL` es responsable de ejecutar `URL.revokeObjectURL` al reemplazar la imagen o desmontarse. El módulo de cámara o el control que termine la sesión debe llamar `releaseCameraStream`; la liberación debe ocurrir también al cancelar y ante errores.

`LocationAttachment` conserva solo latitud, longitud, precisión en metros, origen y fecha/hora ISO. Es una lectura puntual; no se acuerda `watchPosition` ni historial. La implementación debe evitar alta precisión por defecto y documentar el redondeo aplicado a resultados de dispositivo. Las coordenadas de pruebas y demostración son sintéticas.

## 5. Asociación y almacenamiento auxiliar

El registro auxiliar usa `InspectionCapabilityRecord.inspectionId`, igual al `id` generado antes de llamar `saveInspectionWithOperation`. Ese mismo valor es `OutboxOperation.entityId`; no cambia en reintentos, confirmaciones ni en las decisiones de conflicto `keepLocal` y `acceptServer`. Por ello es la clave estable para asociar evidencia y ubicación.

Fernando implementará un almacenamiento IndexedDB auxiliar separado del esquema actual: base `pwa-eq11-capabilities`, versión `1`, almacén `inspection_capabilities`, un registro por inspección y `inspectionId` como `keyPath`. No se incrementa `STORAGE_DATABASE_VERSION`, no se agregan stores a `pwa-eq11-inspections` y no se modifica `Inspection`, `StoredInspection`, el payload de la outbox ni la API sintética.

Orden acordado para la integración:

1. Guardar primero la inspección y su operación mediante `saveInspectionWithOperation`.
2. Después del éxito principal, intentar guardar evidencia y ubicación auxiliares con el mismo `inspectionId`.
3. Si el guardado auxiliar falla, conservar la inspección y la outbox; mostrar un aviso accesible indicando que los datos opcionales no se conservaron.
4. Los datos auxiliares permanecen locales y no participan en sincronización ni resolución de conflictos.

No existe una transacción atómica entre el guardado principal y el auxiliar. Esto es deliberado: una falla opcional nunca debe revertir ni aparentar que falló el registro principal.

## 6. Evento de notificación y fallback

El evento exacto es el **guardado local exitoso de la inspección**, inmediatamente después de que `saveInspectionWithOperation` se resuelva. El texto debe indicar “guardada localmente” o equivalente y no afirmar que la inspección fue sincronizada.

La habilitación del permiso ocurre antes y por una acción explícita independiente. Guardar una inspección no solicita permiso automáticamente. Si ya existe permiso `granted`, `showLocalNotification` usa el registro activo del service worker y `ServiceWorkerRegistration.showNotification`.

La interfaz siempre muestra una confirmación accesible dentro de la aplicación, incluso cuando la notificación del sistema se muestra. Si no hay soporte, no hay service worker disponible, el permiso no está concedido o mostrar la notificación falla, esa confirmación visible es el fallback y el guardado sigue siendo exitoso.

Esta es una notificación web local iniciada por la página. No equivale a push remoto: no hay `PushManager`, suscripción, backend ni VAPID. El kit menciona “push” como resultado oficial, pero su funcionalidad mínima pide enviar o mostrar una notificación y no define infraestructura remota; el equipo documenta esta ambigüedad y no amplía el alcance.

## 7. Permisos y fallos

| Capacidad | Momento del permiso | Fallback |
|---|---|---|
| Cámara | Botón del control de evidencia | cancelar u omitir evidencia; liberar cualquier stream abierto |
| Ubicación | Botón del control de ubicación | omitir ubicación y conservar el formulario |
| Notificaciones | Botón de habilitación | confirmación accesible dentro de la app |

Los controles deben distinguir permiso denegado, cancelación, timeout cuando corresponda y error. Ninguno debe ejecutar solicitudes durante importación, renderizado, montaje automático o renderizado en servidor.

## 8. Reparto y archivos compartidos

- **Fernando:** `camera.ts`, control de evidencia, `capabilities-storage.ts` y pruebas de cámara/persistencia.
- **Tonanzin:** `geolocation.ts`, control de ubicación, pruebas propias y coordinación de `tests/capabilities.spec.ts`.
- **Danna:** `notifications/client.ts`, habilitación/fallback, pruebas propias e integración final en página, README, verificador y workflow.

Archivos compartidos con integración secuencial:

- `tests/capabilities.spec.ts`: un bloque `describe` por responsabilidad y escenarios integrados coordinados por Tonanzin;
- `src/app/inspecciones/page.tsx`: integración final por Danna después de estabilizar los módulos;
- `README.md`, `scripts/verify.mjs` y workflow de Semana 06: integración final por Danna;
- `evidence/individual.md`: cada integrante redacta su propia evidencia real.

## 9. Estado de implementación

### Cámara — pendiente (Fernando)

Pendientes: módulo, control, persistencia auxiliar y pruebas con `MediaStream`/tracks sintéticos. No se ha solicitado acceso a una cámara real.

### Geolocalización — pendiente (Tonanzin)

Pendientes: módulo, control, política concreta de timeout/redondeo y pruebas con callbacks y coordenadas sintéticas. No se ha solicitado ubicación real.

### Notificaciones — pendiente (Danna)

Pendientes: cliente mediante service worker, control de habilitación, fallback accesible, integración posterior al guardado y pruebas con APIs mockeadas. No se ha implementado push remoto.

La existencia de este acuerdo y de los tipos compartidos no declara terminados los módulos obligatorios ni la Semana 06.
