export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {});
  });
}