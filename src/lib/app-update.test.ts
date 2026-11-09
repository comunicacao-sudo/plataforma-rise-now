import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { appSourceVersion } from "../../scripts/app-version";
import {
  appVersionUrl,
  createUpdateGuards,
  createVersionChecker,
  readAppVersion,
} from "./app-update";

const versionA = "a".repeat(64);
const versionB = "b".repeat(64);

test("versão pública aceita somente o identificador do build, sem dados ou URLs arbitrárias", () => {
  assert.match(appVersionUrl(123), /^\/app-version\.json\?check=[a-z0-9]+$/);
  assert.notEqual(appVersionUrl(123), appVersionUrl(124));
  assert.equal(readAppVersion({ version: versionA }), versionA);
  for (const value of [
    null,
    "",
    {},
    { version: "" },
    { version: 123 },
    { version: "https://outro.invalid" },
    { version: "a".repeat(63) },
  ])
    assert.equal(readAppVersion(value), null);
});

test("identificador é reproduzível entre Windows e deploy e muda com código ou imagens", () => {
  const root = mkdtempSync(join(tmpdir(), "rise-version-"));
  try {
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "public"));
    writeFileSync(join(root, "src", "app.ts"), "const title = 'RISE';\r\n");
    writeFileSync(join(root, "src", "README.md"), "RISE\r\n");
    writeFileSync(join(root, "public", "robots.txt"), "User-agent: *\r\n");
    writeFileSync(join(root, "public", "logo.png"), Buffer.from([0, 255, 1]));
    const first = appSourceVersion(root);
    writeFileSync(join(root, "src", "app.ts"), "const title = 'RISE';\n");
    writeFileSync(join(root, "src", "README.md"), "RISE\n");
    writeFileSync(join(root, "public", "robots.txt"), "User-agent: *\n");
    writeFileSync(join(root, ".env"), "SEGREDO=nao-incluir");
    writeFileSync(join(root, "src", "routeTree.gen.ts"), "gerado durante o build");
    assert.equal(appSourceVersion(root), first);
    writeFileSync(join(root, "src", "app.ts"), "const title = 'RISE NOW';\n");
    assert.notEqual(appSourceVersion(root), first);
    const codeVersion = appSourceVersion(root);
    writeFileSync(join(root, "public", "logo.png"), Buffer.from([0, 255, 2]));
    assert.notEqual(appSourceVersion(root), codeVersion);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("versão atual não abre aviso; versão nova abre, e rollback retira o aviso", async () => {
  let remote = versionA;
  let time = 0;
  const seen: Array<string | null> = [];
  const monitor = createVersionChecker({
    currentVersion: versionA,
    fetchVersion: async () => ({ version: remote }),
    onVersion: (v) => seen.push(v),
    canCheck: () => true,
    now: () => time,
  });
  await monitor.check();
  time += 30_000;
  remote = versionB;
  await monitor.check();
  time += 30_000;
  remote = versionA;
  await monitor.check();
  assert.deepEqual(seen, [null, versionB, null]);
  monitor.stop();
});

test("foco repetido e pedidos simultâneos não criam uma fila de consultas", async () => {
  let calls = 0;
  let resolve!: (value: unknown) => void;
  const pending = new Promise<unknown>((done) => {
    resolve = done;
  });
  const seen: Array<string | null> = [];
  const monitor = createVersionChecker({
    currentVersion: versionA,
    fetchVersion: () => {
      calls++;
      return pending;
    },
    onVersion: (v) => seen.push(v),
    canCheck: () => true,
    now: () => 0,
  });
  const first = monitor.check();
  await monitor.check();
  assert.equal(calls, 1);
  resolve({ version: versionB });
  await first;
  await monitor.check();
  assert.equal(calls, 1);
  assert.deepEqual(seen, [versionB]);
  monitor.stop();
});

test("sem internet ou com tela oculta não consulta; ao voltar tenta novamente", async () => {
  let allowed = false;
  let calls = 0;
  const monitor = createVersionChecker({
    currentVersion: versionA,
    fetchVersion: async () => {
      calls++;
      return { version: versionA };
    },
    onVersion: () => {},
    canCheck: () => allowed,
  });
  await monitor.check();
  assert.equal(calls, 0);
  allowed = true;
  await monitor.check();
  assert.equal(calls, 1);
  monitor.stop();
});

test("erro de rede ou JSON inválido não dispara aviso falso nem impede nova tentativa", async () => {
  let calls = 0;
  const seen: Array<string | null> = [];
  const monitor = createVersionChecker({
    currentVersion: versionA,
    fetchVersion: async () => {
      calls++;
      if (calls === 1) throw new Error("Sem rede");
      return calls === 2 ? { error: "publicando" } : { version: versionB };
    },
    onVersion: (v) => seen.push(v),
    canCheck: () => true,
    now: () => 0,
  });
  await monitor.check();
  await monitor.check();
  await monitor.check();
  assert.equal(calls, 3);
  assert.deepEqual(seen, [versionB]);
  monitor.stop();
});

test("desmontar o monitor cancela a requisição e ignora resposta atrasada", async () => {
  let signal: AbortSignal | undefined;
  let resolve!: (value: unknown) => void;
  const pending = new Promise<unknown>((done) => {
    resolve = done;
  });
  const seen: Array<string | null> = [];
  const monitor = createVersionChecker({
    currentVersion: versionA,
    fetchVersion: (s) => {
      signal = s;
      return pending;
    },
    onVersion: (v) => seen.push(v),
    canCheck: () => true,
  });
  const first = monitor.check();
  monitor.stop();
  assert.equal(signal?.aborted, true);
  resolve({ version: versionB });
  await first;
  await monitor.check();
  assert.deepEqual(seen, []);
});

test("envio em andamento ou estado inseguro impede recarga, e concluir libera a atualização", () => {
  const guards = createUpdateGuards();
  let reloads = 0;
  const reload = () => {
    reloads++;
    return true;
  };
  const release = guards.register(() => false);
  assert.equal(guards.runIfSafe(reload), false);
  assert.equal(reloads, 0);
  release();
  assert.equal(guards.runIfSafe(reload), true);
  assert.equal(reloads, 1);
  const stop = guards.register(() => {
    throw new Error("estado indisponível");
  });
  assert.equal(guards.runIfSafe(reload), false);
  assert.equal(reloads, 1);
  stop();
  let safe = false;
  guards.register(() => safe);
  assert.equal(guards.runIfSafe(reload), false);
  safe = true;
  assert.equal(guards.runIfSafe(reload), true);
});
