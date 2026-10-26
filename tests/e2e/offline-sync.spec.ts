import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// -----------------------------------------------------------------------
// Helper: abre /inspecciones con el Service Worker activo como controlador
// -----------------------------------------------------------------------
async function openControlledInspecciones(page: Page): Promise<void> {
  // 1. Ir a / para que el SW se registre
  await page.goto("/");
  // 2. Esperar a que el SW esté listo (promise dentro del browser)
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // 3. Navegar a /inspecciones
  await page.goto("/inspecciones");
  // 4. Esperar a que el SW sea el controlador activo
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  // 5. Verificar encabezados esperados de la página
  await expect(page.getByRole("heading", { name: "Listado de Inspecciones" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Registrar inspección sintética" })
  ).toBeVisible();
}

// -----------------------------------------------------------------------
// Helper: genera un nombre de laboratorio único por ejecución
// -----------------------------------------------------------------------
function labUnique(): string {
  return `Lab E2E Offline ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// -----------------------------------------------------------------------
// Prueba: flujo crítico — crear offline → recargar → reconectar → sincronizar
// -----------------------------------------------------------------------
test("flujo offline: guardar, recargar offline y sincronizar al reconectar", async ({
  page,
  context
}: {
  page: Page;
  context: BrowserContext;
}) => {
  const laboratorio = labUnique();

  // === Fase 1: SW activo, navegación inicial ===
  await openControlledInspecciones(page);

  // === Fase 2: desconectar y guardar la inspección ===
  await context.setOffline(true);

  // Llenar el formulario con datos sintéticos
  await page.getByLabel("Laboratorio").fill(laboratorio);
  await page.getByLabel("Fecha").fill("2026-10-25");
  await page.getByLabel("Responsable sintético").fill("Técnico E2E Sintético");
  await page.getByLabel("Hallazgos").fill("0");
  await page.getByLabel("Resumen sintético").fill(
    "Inspección E2E sintética generada automáticamente para validar el flujo offline."
  );

  // Guardar sin conexión
  await page.getByRole("button", { name: "Guardar sin conexión" }).click();

  // Verificar mensaje de guardado local
  await expect(
    page.getByText(
      "Inspección guardada localmente. Queda pendiente de sincronización."
    )
  ).toBeVisible();

  // Verificar que aparece la tarjeta con estado Pendiente
  const card = page.locator(".inspection-card", { hasText: laboratorio });
  await expect(card).toBeVisible();
  await expect(card.locator(".badge")).toHaveText("Pendiente");

  // === Fase 3: recargar sin conexión ===
  await page.reload();

  // La URL debe seguir siendo /inspecciones
  await expect(page).toHaveURL(/\/inspecciones/);

  // Debe haber exactamente una tarjeta con este laboratorio
  await expect(
    page.locator(".inspection-card", { hasText: laboratorio })
  ).toHaveCount(1);

  // La tarjeta debe seguir en estado Pendiente
  const cardAfterReload = page.locator(".inspection-card", { hasText: laboratorio });
  await expect(cardAfterReload.locator(".badge")).toHaveText("Pendiente");

  // === Fase 4: reconectar y esperar sincronización automática ===
  await context.setOffline(false);

  // El evento `online` debe disparar la sincronización; esperar estado Sincronizada
  await expect(
    page.locator(".inspection-card", { hasText: laboratorio }).locator(".badge")
  ).toHaveText("Sincronizada", { timeout: 30_000 });

  // Solo debe existir una tarjeta (sin duplicados)
  await expect(
    page.locator(".inspection-card", { hasText: laboratorio })
  ).toHaveCount(1);

  // === Fase 5: recargar en línea y verificar persistencia ===
  await page.reload();
  await expect(page).toHaveURL(/\/inspecciones/);
  await expect(
    page.locator(".inspection-card", { hasText: laboratorio })
  ).toHaveCount(1);
  await expect(
    page.locator(".inspection-card", { hasText: laboratorio }).locator(".badge")
  ).toHaveText("Sincronizada");

  // === Opcional: verificar IndexedDB ===
  const idbState = await page.evaluate(async (lab: string) => {
    return new Promise<{ inspStatus: string; opStatus: string } | null>((resolve) => {
      const req = indexedDB.open("pwa-eq11-inspections");
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(["inspections", "outbox"], "readonly");
          const inspStore = tx.objectStore("inspections");
          const outboxStore = tx.objectStore("outbox");

          let inspStatus = "";
          let opStatus = "";
          let found = false;

          inspStore.openCursor().onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const record = cursor.value as any;
              if (record.location === lab) {
                found = true;
                inspStatus = record.sync?.status ?? "";
                const entityId = record.id;
                outboxStore.openCursor().onsuccess = (oe) => {
                  const oc = (oe.target as IDBRequest<IDBCursorWithValue | null>).result;
                  if (oc) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const op = oc.value as any;
                    if (op.entityId === entityId) {
                      opStatus = op.status;
                    }
                    oc.continue();
                  } else {
                    resolve(found ? { inspStatus, opStatus } : null);
                  }
                };
              } else {
                cursor.continue();
              }
            } else if (!found) {
              resolve(null);
            }
          };
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }, laboratorio);

  if (idbState !== null) {
    expect(idbState.inspStatus).toBe("done");
    expect(idbState.opStatus).toBe("done");
  }
});
