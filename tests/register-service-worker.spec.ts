import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { registerServiceWorker } from "@/lib/pwa/register-service-worker";

const LIB_PATH = resolve(process.cwd(), "src/lib/pwa/register-service-worker.ts");
const COMPONENT_PATH = resolve(process.cwd(), "src/components/service-worker-register.tsx");
const LAYOUT_PATH = resolve(process.cwd(), "src/app/layout.tsx");

afterEach(() => {
  vi.restoreAllMocks();
});

const read = (path: string): string => readFileSync(path, "utf8");

describe("register-service-worker", () => {
  it("existe src/lib/pwa/register-service-worker.ts", () => {
    expect(existsSync(LIB_PATH)).toBe(true);
  });

  it("existe src/components/service-worker-register.tsx", () => {
    expect(existsSync(COMPONENT_PATH)).toBe(true);
  });

  it("layout.tsx referencia ServiceWorkerRegister", () => {
    const source = existsSync(LAYOUT_PATH) ? read(LAYOUT_PATH) : "";
    expect(source).toContain("service-worker-register");
    expect(source).toContain("<ServiceWorkerRegister ");
  });

  const source = existsSync(LIB_PATH) ? read(LIB_PATH) : "";

  it("register-service-worker.ts exporta registerServiceWorker", () => {
    expect(source).toContain("export function registerServiceWorker");
  });

  it("registra /sw.js", () => {
    expect(source).toContain('register("/sw.js"');
  });

  it("usa scope raíz (scope: '/')", () => {
    expect(source).toContain('scope: "/"');
  });

  it("incluye el guard typeof window", () => {
    expect(source).toContain('typeof window === "undefined"');
  });

  it("incluye el guard de soporte serviceWorker in navigator", () => {
    expect(source).toContain('!(\"serviceWorker\" in navigator)');
  });

  it("captura el rechazo con catch", () => {
    expect(source).toContain(".catch(");
  });

  it("no usa skipWaiting", () => {
    expect(source).not.toContain("skipWaiting");
  });

  it("no usa clients.claim", () => {
    expect(source).not.toContain("clients.claim");
  });

  it("no usa registration.update", () => {
    expect(source).not.toContain("registration.update");
    expect(source).not.toContain(".update(");
  });
});

describe("register-service-worker runtime", () => {
  it("llama navigator.serviceWorker.register('/sw.js', { scope: '/' }) tras el evento load", () => {
    const register = vi.fn().mockResolvedValue({});
    const loadCallbacks: Array<() => void> = [];

    const addListenerSpy = vi
      .spyOn(window, "addEventListener")
      .mockImplementation(((type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "load") {
          loadCallbacks.push(listener as () => void);
        }
      }) as typeof window.addEventListener);

    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
    try {
      Object.defineProperty(navigator, "serviceWorker", {
        value: { register },
        configurable: true
      });

      registerServiceWorker();

      expect(register).not.toHaveBeenCalled();

      for (const cb of loadCallbacks) cb();

      expect(register).toHaveBeenCalledTimes(1);
      expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(navigator, "serviceWorker", originalDescriptor);
      } else {
        delete (navigator as { serviceWorker?: unknown }).serviceWorker;
      }
      addListenerSpy.mockRestore();
    }
  });
});