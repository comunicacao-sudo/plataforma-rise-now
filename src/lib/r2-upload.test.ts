import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { r2ConnectionError } from "./r2-errors";

const primary = "https://board.mentoriarisenow.com.br";
const alias = "https://plataforma-rise-now.lovable.app";
const userId = "00000000-0000-4000-8000-000000000001";
const key = "lessons/" + userId + "/aula.mp4";
const token = "credencial-ficticia-de-teste";

function fixture({ staff = true, failure = "" } = {}) {
  const touched: string[] = [];
  const logs: string[] = [];
  const source = readFileSync(new URL("../../infra/r2-worker.js", import.meta.url), "utf8")
    .replace(
      'import { handleR2TrashRoute } from "./r2-trash-route.ts";',
      "const handleR2TrashRoute = async () => null;",
    )
    .replace("export default {", "globalThis.worker = {");
  const context: Record<string, unknown> = {
    Request,
    Response,
    Headers,
    URL,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Error,
    crypto,
    btoa,
    atob,
    console: { error: (line: string) => logs.push(line) },
    fetch: async (url: string) => {
      if (failure === "network") throw new Error("upstream indisponível");
      if (url.endsWith("/auth/v1/user")) return Response.json({ id: userId });
      if (url.endsWith("/rest/v1/rpc/is_staff")) {
        if (failure === "rpc") return new Response("falha interna do banco", { status: 503 });
        return Response.json(staff);
      }
      return Response.json(null);
    },
  };
  runInNewContext(source, context);
  const handler = context["worker"] as {
    fetch(request: Request, env: Record<string, unknown>): Promise<Response>;
  };
  const env = {
    APP_ORIGIN: primary,
    SUPABASE_URL: "https://supabase.example.invalid",
    SUPABASE_KEY: "chave-publica-ficticia",
    TICKET_SECRET: "segredo-apenas-local",
    LESSONS: {
      async createMultipartUpload(path: string) {
        touched.push("start:" + path);
        if (failure === "r2") throw new Error("bucket temporariamente indisponível");
        return { uploadId: "upload-local" };
      },
      resumeMultipartUpload(path: string, uploadId: string) {
        assert.equal(path, key);
        assert.equal(uploadId, "upload-local");
        return {
          async uploadPart(partNumber: number, data: ArrayBuffer) {
            touched.push("part:" + partNumber);
            assert.equal(data.byteLength, 3);
            return { partNumber, etag: "etag-local" };
          },
          async complete(parts: Array<{ partNumber: number; etag: string }>) {
            touched.push("complete");
            assert.equal(
              JSON.stringify(parts),
              JSON.stringify([{ partNumber: 1, etag: "etag-local" }]),
            );
          },
          async abort() {
            touched.push("abort");
          },
        };
      },
    },
  };
  return {
    touched,
    logs,
    request(
      path: string,
      {
        origin = primary,
        auth = true,
        method = "POST",
        body = {},
      }: {
        origin?: string;
        auth?: boolean;
        method?: string;
        body?: unknown;
      } = {},
    ) {
      const headers = new Headers({ Origin: origin });
      if (auth) headers.set("Authorization", "Bearer " + token);
      const options: RequestInit = { method, headers };
      if (method === "OPTIONS") {
        headers.set("Access-Control-Request-Method", "POST");
        headers.set("Access-Control-Request-Headers", "authorization,content-type");
      } else if (body instanceof Uint8Array) options.body = new Uint8Array(body).buffer;
      else options.body = JSON.stringify(body);
      return handler.fetch(new Request("https://worker.example.invalid" + path, options), env);
    },
  };
}

test("upload aceita os dois endereços oficiais com CORS exato e bloqueia outras origens", async () => {
  const app = fixture();
  for (const origin of [primary, alias]) {
    const response = await app.request("/upload/start", { origin, method: "OPTIONS", auth: false });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.match(response.headers.get("Access-Control-Allow-Methods") ?? "", /PUT/);
  }
  for (const origin of [
    "https://outro.invalid",
    "https://plataforma-rise-now.lovable.app.outro.invalid",
    "https://id-preview--outro.lovable.app",
    "null",
  ]) {
    const response = await app.request("/upload/start", { origin, method: "OPTIONS" });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  }
  assert.deepEqual(app.touched, []);
});

test("permitir o endereço oficial alternativo não dispensa login nem papel de mentora", async () => {
  for (const origin of [primary, alias]) {
    const app = fixture();
    const anonymous = await app.request("/upload/start", { origin, auth: false });
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.headers.get("Access-Control-Allow-Origin"), origin);
    assert.deepEqual(app.touched, []);
    const mentee = fixture({ staff: false });
    assert.equal((await mentee.request("/upload/start", { origin })).status, 403);
    assert.deepEqual(mentee.touched, []);
  }
});

test("mentora inicia upload multipart pelo endereço alternativo e recebe caminho privado", async () => {
  const app = fixture();
  const response = await app.request("/upload/start", {
    origin: alias,
    body: { fileName: "aula.mp4", contentType: "video/mp4", size: 3 },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), alias);
  const data = await response.json();
  assert.equal(data.uploadId, "upload-local");
  assert.match(data.mediaPath, new RegExp("^r2:lessons/" + userId + "/"));
  assert.equal(data.partSize, 16 * 1024 * 1024);
});

test("partes e conclusão mantêm identidade do upload e CORS do aplicativo", async () => {
  const app = fixture();
  const part = await app.request(
    "/upload/part?key=" + encodeURIComponent(key) + "&uploadId=upload-local&partNumber=1",
    { origin: alias, method: "PUT", body: new Uint8Array([1, 2, 3]) },
  );
  assert.equal(part.status, 200);
  assert.equal(part.headers.get("Access-Control-Allow-Origin"), alias);
  assert.deepEqual(await part.json(), { partNumber: 1, etag: "etag-local" });
  const completed = await app.request("/upload/complete", {
    origin: alias,
    body: { key, uploadId: "upload-local", parts: [{ partNumber: 1, etag: "etag-local" }] },
  });
  assert.equal(completed.status, 200);
  assert.equal((await completed.json()).mediaPath, "r2:" + key);
  assert.deepEqual(app.touched, ["part:1", "complete"]);
});

test("falhas assíncronas de autenticação retornam JSON com CORS em vez de erro opaco", async () => {
  for (const path of [
    "/upload/start",
    "/upload/part",
    "/upload/complete",
    "/upload/abort",
    "/ticket",
  ]) {
    const app = fixture({ failure: "network" });
    const response = await app.request(path, {
      origin: alias,
      method: path === "/upload/part" ? "PUT" : "POST",
    });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), alias);
    assert.match((await response.json()).error, /Não foi possível/);
    assert.equal(app.logs.length, 1);
    assert.equal(app.logs[0]?.includes(token), false);
    assert.equal(JSON.parse(app.logs[0]!).path, path);
  }
});

test("falha no banco ou R2 também mantém resposta legível e não expõe erro interno", async () => {
  for (const failure of ["rpc", "r2"]) {
    const app = fixture({ failure });
    const response = await app.request("/upload/start", {
      body: { fileName: "aula.mp4", contentType: "video/mp4", size: 3 },
    });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), primary);
    const data = await response.json();
    assert.match(data.error, /Não foi possível/);
    assert.doesNotMatch(data.error, /bucket|banco|RPC/);
  }
});

test("limites e formatos de vídeo continuam validados antes de abrir armazenamento", async () => {
  const app = fixture();
  for (const body of [
    { contentType: "image/png", size: 3 },
    { contentType: "video/mp4", size: 0 },
    { contentType: "video/mp4", size: 6 * 1024 ** 3 },
  ]) {
    assert.equal((await app.request("/upload/start", { body })).status, 400);
  }
  assert.deepEqual(app.touched, []);
});

test("falha de conexão no cliente recebe orientação em português para cada fase", () => {
  assert.match(r2ConnectionError("/upload/start", true).message, /iniciar o envio/);
  assert.match(r2ConnectionError("/upload/part?partNumber=1", true).message, /enviar uma parte/);
  assert.match(r2ConnectionError("/upload/complete", true).message, /concluir o envio/);
  assert.match(r2ConnectionError("/ticket", true).message, /serviço de vídeos/);
  assert.match(r2ConnectionError("/upload/start", false).message, /sem conexão com a internet/);
  assert.doesNotMatch(r2ConnectionError("/upload/start", true).message, /Failed to fetch/);
});
