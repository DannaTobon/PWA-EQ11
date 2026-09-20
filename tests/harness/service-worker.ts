import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";

export const TEST_ORIGIN = "http://localhost";
const BASE_URL = `${TEST_ORIGIN}/`;
const SW_PATH = resolve(process.cwd(), "public/sw.js");

export type FetchLike = (input: string | { url: string }) => Promise<Response>;

export class FakeCache {
  private readonly entries = new Map<string, Response>();

  constructor(
    private readonly base: string,
    private readonly fetchFn: FetchLike
  ) {}

  private toKey(input: string | { url: string }): string {
    if (typeof input === "string") return new URL(input, this.base).href;
    return input.url;
  }

  async addAll(urls: string[]): Promise<void> {
    for (const url of urls) {
      const response = await this.fetchFn(url);
      if (!response.ok) throw new TypeError(`addAll: ${url} no devolvió una respuesta ok`);
      this.entries.set(this.toKey(url), response);
    }
  }

  async put(input: string | { url: string }, response: Response): Promise<void> {
    this.entries.set(this.toKey(input), response);
  }

  async match(input: string | { url: string }): Promise<Response | undefined> {
    return this.entries.get(this.toKey(input));
  }

  seed(url: string, body = "", options: { status?: number; contentType?: string } = {}): void {
    const response = new Response(body, {
      status: options.status ?? 200,
      headers: { "Content-Type": options.contentType ?? "text/html; charset=UTF-8" }
    });
    this.entries.set(this.toKey(url), response);
  }

  has(url: string): boolean {
    return this.entries.has(this.toKey(url));
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }

  size(): number {
    return this.entries.size;
  }
}

export class FakeCacheStorage {
  private readonly stores = new Map<string, FakeCache>();

  constructor(
    private readonly base: string,
    private readonly fetchFn: FetchLike
  ) {}

  getOrCreate(name: string): FakeCache {
    let cache = this.stores.get(name);
    if (!cache) {
      cache = new FakeCache(this.base, this.fetchFn);
      this.stores.set(name, cache);
    }
    return cache;
  }

  async open(name: string): Promise<FakeCache> {
    return this.getOrCreate(name);
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }
}

export interface SWRequestLike {
  url: string;
  method: string;
  mode: string;
  headers: Headers;
}

export function swRequest(
  url: string,
  options: { method?: string; mode?: string; headers?: Record<string, string> } = {}
): SWRequestLike {
  const headers = new Headers();
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    headers.set(name, value);
  }
  return {
    url: new URL(url, BASE_URL).href,
    method: options.method ?? "GET",
    mode: options.mode ?? "cors",
    headers
  };
}

export interface SWFetchResult {
  intercepted: boolean;
  response: Response | undefined;
}

export interface SWHarness {
  source: string;
  listeners: Record<string, Function[]>;
  caches: FakeCacheStorage;
  cache(name: string): FakeCache;
  fetchMock: ReturnType<typeof vi.fn>;
  triggerInstall(): Promise<void>;
  triggerActivate(): Promise<void>;
  handleFetch(request: SWRequestLike): Promise<SWFetchResult>;
  flush(): Promise<void>;
}

export function loadServiceWorker(options: { fetchImpl?: FetchLike } = {}): SWHarness {
  const source = readFileSync(SW_PATH, "utf8");
  const listeners: Record<string, Function[]> = {};
  const fetchMock = options.fetchImpl ? vi.fn(options.fetchImpl) : vi.fn();

  const self = {
    location: {
      origin: TEST_ORIGIN,
      href: BASE_URL
    },
    addEventListener(type: string, listener: Function) {
      (listeners[type] ??= []).push(listener);
    },
    skipWaiting() {},
    clients: { claim() {} }
  };

  const caches = new FakeCacheStorage(BASE_URL, fetchMock as unknown as FetchLike);

  const evaluate = new Function(
    "self",
    "caches",
    "fetch",
    "Response",
    "Request",
    "URL",
    "Headers",
    "console",
    source
  );
  evaluate(self, caches, fetchMock, Response, Request, URL, Headers, console);

  async function triggerInstall(): Promise<void> {
    const listener = listeners.install?.[0];
    if (!listener) return;
    await new Promise<void>((resolve) => {
      listener({
        waitUntil: (pending: Promise<void>) => void pending.then(() => resolve())
      });
    });
  }

  async function triggerActivate(): Promise<void> {
    const listener = listeners.activate?.[0];
    if (!listener) return;
    await new Promise<void>((resolve) => {
      listener({
        waitUntil: (pending: Promise<void>) => void pending.then(() => resolve())
      });
    });
  }

  function handleFetch(request: SWRequestLike): Promise<SWFetchResult> {
    const listener = listeners.fetch?.[0];
    if (!listener) throw new Error("No se registró ningún listener fetch");
    return new Promise<SWFetchResult>((resolve) => {
      let intercepted = false;
      listener({
        request,
        respondWith(pending: Promise<Response>) {
          intercepted = true;
          pending.then(
            (response) => resolve({ intercepted: true, response }),
            () => resolve({ intercepted: true, response: undefined })
          );
        }
      });
      if (!intercepted) resolve({ intercepted: false, response: undefined });
    });
  }

  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return {
    source,
    listeners,
    caches,
    cache: (name: string) => caches.getOrCreate(name),
    fetchMock,
    triggerInstall,
    triggerActivate,
    handleFetch,
    flush
  };
}