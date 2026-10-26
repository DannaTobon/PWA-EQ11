export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;

  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {});
  };

  // En una hidratación normal de Next.js el evento `load` ya ocurrió cuando
  // se ejecuta el efecto del componente. Sin esta rama el registro nunca se
  // solicita y la aplicación no queda disponible sin conexión.
  if (document.readyState === "complete") {
    register();
    return;
  }

  window.addEventListener("load", register, { once: true });
}