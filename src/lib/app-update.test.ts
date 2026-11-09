import assert from "node:assert/strict";
import test from "node:test";
import { appVersionFromEntries } from "../../scripts/app-version";
import {
  appVersionUrl,
  createUpdateGuards,
  createVersionChecker,
  mountedAppVersion,
  readAppVersion,
} from "./app-update";

const versionA = "/assets/index-versaoA.js";
const versionB = "/assets/index-versaoB.js";

test("versão montada considera somente o módulo da própria origem e preserva o caminho", () => {
  const document = {
    querySelectorAll: () => [
      { src: "https://outro.invalid/assets/index-externo.js" },
      { src: "https://rise.invalid/assets/qualquer.js" },
      { src: "https://rise.invalid" + versionA },
    ],
  } as unknown as Document;
  assert.equal(mountedAppVersion(document, "https://rise.invalid/?view=inicio"), versionA);
  const missing = { querySelectorAll: () => [] } as unknown as Document;
  assert.equal(mountedAppVersion(missing, "https://rise.invalid"), null);
});

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

test("manifesto de versão usa a entrada real do build e recusa entrada ausente ou ambígua", () => {
  assert.equal(
    appVersionFromEntries(["assets/index-versaoA.js", "assets/app-update-outro.js"]),
    versionA,
  );
  assert.notEqual(appVersionFromEntries(["assets/index-versaoB.js"]), versionA);
  assert.throws(() => appVersionFromEntries([]), /entrada da RISE/);
  assert.throws(
    () => appVersionFromEntries(["assets/index-primeiro.js", "assets/index-segundo.js"]),
    /entrada da RISE/,
  );
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
