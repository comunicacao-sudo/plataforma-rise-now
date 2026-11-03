import assert from "node:assert/strict";
import test from "node:test";

import { resolveAppRole } from "./access";
import {
  filterDirectoryAccess,
  matchesAccessArchiveConfirmation,
  type RiseDirectory,
} from "./admin.functions";

test("mentora e administradora usam a mesma área administrativa", () => {
  assert.equal(resolveAppRole(["mentor"]), "admin");
  assert.equal(resolveAppRole(["admin"]), "admin");
});

test("papel administrativo tem prioridade quando há mais de um papel", () => {
  assert.equal(resolveAppRole(["mentee", "mentor"]), "admin");
  assert.equal(resolveAppRole(["mentee", "admin"]), "admin");
});

test("acesso sem papel reconhecido é recusado", () => {
  assert.equal(resolveAppRole(["mentee"]), "mentee");
  assert.equal(resolveAppRole([]), null);
  assert.equal(resolveAppRole(["guest"]), null);
});

const accessFixture = [
  {
    id: "active",
    userId: "user-active",
    name: "Pessoa ativa",
    email: "active@example.com",
    role: "mentee",
    status: "ativo",
    createdAt: "2026-11-03T00:00:00.000Z",
    archivedAt: null,
  },
  {
    id: "archived",
    userId: "user-archived",
    name: "Pessoa excluída",
    email: "archived@example.com",
    role: "mentee",
    status: "revogado",
    createdAt: "2026-11-03T00:00:00.000Z",
    archivedAt: "2026-11-03T12:00:00.000Z",
  },
] satisfies RiseDirectory["access"];

test("gestão separa acessos ativos dos excluídos sem apagar registros", () => {
  assert.deepEqual(
    filterDirectoryAccess(accessFixture, "active").map((entry) => entry.id),
    ["active"],
  );
  assert.deepEqual(
    filterDirectoryAccess(accessFixture, "archived").map((entry) => entry.id),
    ["archived"],
  );
});

test("exclusão exige a confirmação explícita EXCLUIR", () => {
  assert.equal(matchesAccessArchiveConfirmation("EXCLUIR"), true);
  assert.equal(matchesAccessArchiveConfirmation(" excluir "), true);
  assert.equal(matchesAccessArchiveConfirmation("confirmar"), false);
  assert.equal(matchesAccessArchiveConfirmation(""), false);
});

