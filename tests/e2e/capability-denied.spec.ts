import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// -----------------------------------------------------------------------
// Helper: genera un nombre de laboratorio único para aislar cada ejecución
// -----------------------------------------------------------------------
function labUnique(): string {
  return `Lab E2E CapDenied ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// -----------------------------------------------------------------------
// Prueba: permiso de notificaciones denegado no bloquea la captura
// -----------------------------------------------------------------------
test(
  "capacidad denegada: el permiso de notificaciones denegado no bloquea guardar una inspección",
  async ({ page, context }: { page: Page; context: BrowserContext }) => {
    const laboratorio = labUnique();

    // Forzar que las notificaciones queden denegadas antes de abrir la página
    await context.clearPermissions();

    // Abrir /inspecciones (no requiere SW para esta prueba)
    await page.goto("/inspecciones");
    await expect(page.getByRole("heading", { name: "Listado de Inspecciones" })).toBeVisible();

    // Verificar el texto informativo inicial sobre notificaciones opcionales
    await expect(
      page.getByText("Las notificaciones son opcionales y requieren una acción explícita.")
    ).toBeVisible();

    // Pulsar "Habilitar notificaciones"
    // Playwright no concede el permiso: el diálogo se descarta o queda en 'default'/'denied'
    const notifBtn = page.getByRole("button", { name: "Habilitar notificaciones" });
    if (await notifBtn.isVisible()) {
      await notifBtn.click();

      // Aceptar cualquiera de las dos ramas de mensaje de fallo
      const deniedMsg = page.getByText(/El permiso de notificaciones está denegado/);
      const notGrantedMsg = page.getByText(/No se concedió el permiso/);
      await expect(deniedMsg.or(notGrantedMsg)).toBeVisible({ timeout: 5_000 });
    }

    // ------------------------------------------------------------------
    // La capacidad denegada NO debe impedir guardar la inspección
    // ------------------------------------------------------------------
    await page.getByLabel("Laboratorio").fill(laboratorio);
    await page.getByLabel("Fecha").fill("2026-10-25");
    await page.getByLabel("Responsable sintético").fill("Técnico Capacidad Denegada");
    await page.getByLabel("Hallazgos").fill("2");
    await page.getByLabel("Resumen sintético").fill(
      "Inspección sintética para validar que la captura funciona sin permiso de notificaciones."
    );

    // Guardar (puede ser en línea o sin conexión, según el estado de red)
    const saveOnlineBtn = page.getByRole("button", { name: "Guardar" });
    const saveOfflineBtn = page.getByRole("button", { name: "Guardar sin conexión" });

    if (await saveOnlineBtn.isVisible()) {
      await saveOnlineBtn.click();
    } else {
      await saveOfflineBtn.click();
    }

    // El guardado debe completarse y mostrarse la tarjeta
    const successMsg = page.getByText(/guardad/i);
    await expect(successMsg).toBeVisible({ timeout: 10_000 });

    const card = page.locator(".inspection-card", { hasText: laboratorio });
    await expect(card).toBeVisible();
  }
);
