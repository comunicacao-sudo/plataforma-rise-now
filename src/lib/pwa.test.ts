import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { installDevice } from "./pwa";

const manifest = JSON.parse(
  readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8"),
);
const workerSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

function worker(offline = false) {
  const listeners = new Map<string, (event: unknown) => void>();
  const cacheReads: string[] = [];
  const removed: string[] = [];
  runInNewContext(workerSource, {
    self: {
      location: { origin: "https://rise.invalid" },
      addEventListener: (name: string, fn: (event: unknown) => void) => listeners.set(name, fn),
      clients: { claim: async () => {} },
    },
    URL,
    Response,
    fetch: async () => {
      if (offline) throw new Error("Sem rede");
      return new Response("resposta atual da rede");
    },
    caches: {
      match: async (key: string) => {
        cacheReads.push(key);
        return new Response("tela pública sem conexão");
      },
      keys: async () => [
        "rise-public-offline-antigo",
        "rise-public-offline-v1",
        "cache-de-outro-app",
      ],
      delete: async (key: string) => {
        removed.push(key);
        return true;
      },
    },
  });
  return {
    cacheReads,
    removed,
    fetch(url: string, mode = "cors", method = "GET") {
      let response: Promise<Response> | undefined;
      listeners.get("fetch")!({
        request: { url, mode, method },
        respondWith: (value: Promise<Response>) => {
          response = value;
        },
      });
      return response;
    },
    async activate() {
      let pending: Promise<unknown> | undefined;
      listeners.get("activate")!({
        waitUntil: (value: Promise<unknown>) => {
          pending = value;
        },
      });
      await pending;
    },
  };
}

test("manifesto instala na raiz, em janela própria, com ícones válidos", () => {
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "pt-BR");
  assert.equal(manifest.prefer_related_applications, false);
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(
      (entry: { sizes: string; purpose: string }) =>
        entry.sizes === `${size}x${size}` && entry.purpose === "any",
    );
    assert.ok(icon);
    const bytes = readFileSync(new URL(`../../public${icon.src}`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
});

test("service worker não intercepta APIs, autenticação, uploads, vídeos ou capas privadas", () => {
  const app = worker();
  for (const [url, mode, method] of [
    ["https://rise.invalid/api/conta", "cors", "GET"],
    ["https://rise.invalid/api/enviar", "cors", "POST"],
    ["https://projeto.supabase.co/auth/v1/token", "cors", "POST"],
    ["https://projeto.supabase.co/storage/v1/object/sign/capa.webp?token=privado", "cors", "GET"],
    ["https://rise.invalid/video.mp4", "no-cors", "GET"],
    ["https://rise.invalid/assets/versao-atual.js", "cors", "GET"],
    ["https://rise.invalid/app-version.json", "cors", "GET"],
  ])
    assert.equal(app.fetch(url!, mode!, method!), undefined);
  assert.deepEqual(app.cacheReads, []);
});

test("navegação online sempre consulta a rede e não grava HTML no cache", async () => {
  const app = worker();
  assert.equal(
    await (await app.fetch("https://rise.invalid/?view=agenda", "navigate"))?.text(),
    "resposta atual da rede",
  );
  assert.deepEqual(app.cacheReads, []);
});

test("navegação sem rede mostra somente a tela pública de orientação", async () => {
  const app = worker(true);
  assert.equal(
    await (await app.fetch("https://rise.invalid/?view=inicio", "navigate"))?.text(),
    "tela pública sem conexão",
  );
  assert.deepEqual(app.cacheReads, ["/offline.html"]);
});

test("atualização remove apenas caches antigos deste recurso", async () => {
  const app = worker();
  await app.activate();
  assert.deepEqual(app.removed, ["rise-public-offline-antigo"]);
});

test("instruções distinguem iPhone, iPad, Android e computador", () => {
  assert.equal(installDevice("iPhone OS 18"), "ios");
  assert.equal(installDevice("Macintosh Intel Mac OS X", 5), "ios");
  assert.equal(installDevice("Linux Android 15"), "android");
  assert.equal(installDevice("Macintosh Intel Mac OS X", 0), "mac");
  assert.equal(installDevice("Windows NT 10.0"), "desktop");
});
