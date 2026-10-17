import assert from "node:assert/strict";
import test from "node:test";

import { resolveAppRole } from "./access";

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
