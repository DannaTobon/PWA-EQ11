/** Origen declarado de un dato opcional; las demostraciones y pruebas usan solo datos sintéticos. */
export type CapabilityDataSource = "synthetic-demo" | "device-api";

export type CapabilityFailure =
  | { readonly status: "unsupported"; readonly message: string }
  | { readonly status: "permission-denied"; readonly message: string }
  | { readonly status: "cancelled"; readonly message: string }
  | { readonly status: "timeout"; readonly message: string }
  | { readonly status: "error"; readonly message: string };

/** Resultado explícito que permite mantener el flujo principal ante una capacidad opcional fallida. */
export type CapabilityResult<T> =
  | { readonly status: "success"; readonly data: T }
  | CapabilityFailure;

/** Imagen mínima para persistencia local; una URL de vista previa nunca se almacena. */
export type EvidenceAttachment<TSource extends CapabilityDataSource = CapabilityDataSource> = Readonly<{
  source: TSource;
  blob: Blob;
  mimeType: string;
  capturedAt: string;
}>;

/** Lectura puntual mínima. No representa seguimiento continuo. */
export type LocationAttachment<TSource extends CapabilityDataSource = CapabilityDataSource> = Readonly<{
  source: TSource;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
}>;

/** Una captura producida por el módulo de cámara no puede declararse sintética. */
export type DeviceEvidenceAttachment = EvidenceAttachment<"device-api">;

/** Una lectura producida por el módulo de geolocalización no puede declararse sintética. */
export type DeviceLocationAttachment = LocationAttachment<"device-api">;

/** Registro auxiliar asociado mediante el identificador estable de la inspección. */
export type InspectionCapabilityRecord = Readonly<{
  inspectionId: string;
  evidence?: EvidenceAttachment;
  location?: LocationAttachment;
  updatedAt: string;
}>;

export type LocalNotificationPermission = "default" | "granted" | "denied";

export type LocalNotificationMessage = Readonly<{
  title: string;
  body: string;
  tag: string;
}>;

export type LocalNotificationDelivery = Readonly<{
  channel: "service-worker";
  shownAt: string;
}>;
