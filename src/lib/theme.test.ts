import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRiseTheme } from "./theme";

test("normalizeRiseTheme accepts only the two supported themes", () => {
  assert.equal(normalizeRiseTheme("light"), "light");
  assert.equal(normalizeRiseTheme("dark"), "dark");
  assert.equal(normalizeRiseTheme("system"), "dark");
  assert.equal(normalizeRiseTheme(null), "dark");
});

