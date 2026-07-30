import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { validateConfig } from "../src/config.js";

function config(overrides = {}) {
  return {
    format: "seed-sleuth-config",
    schemaVersion: 1,
    name: "test",
    generator: {
      kind: "module",
      path: "./adapter.js",
    },
    seeds: { start: 4, count: 3, step: 2 },
    assertions: [{ id: "start", type: "count", symbol: "S", eq: 1 }],
    ...overrides,
  };
}

test("validateConfig resolves seeds and module paths", () => {
  const result = validateConfig(config(), { baseDirectory: "C:\\fixture" });
  assert.deepEqual(result.seeds, [4, 6, 8]);
  assert.equal(result.generator.path, path.resolve("C:\\fixture", "adapter.js"));
  assert.equal(result.limits.repeats, 1);
});

test("validateConfig rejects duplicates and invalid seed steps", () => {
  assert.throws(
    () =>
      validateConfig(
        config({
          assertions: [
            { id: "same", type: "count" },
            { id: "same", type: "metric" },
          ],
        }),
      ),
    /Duplicate assertion/,
  );
  assert.throws(
    () => validateConfig(config({ seeds: { start: 1, count: 2, step: 0 } })),
    /non-zero/,
  );
});

test("validateConfig accepts a shell-free command adapter", () => {
  const result = validateConfig(
    config({
      generator: {
        kind: "command",
        command: "node",
        args: ["adapter.js", "{seed}"],
      },
    }),
  );
  assert.equal(result.generator.kind, "command");
  assert.deepEqual(result.generator.args, ["adapter.js", "{seed}"]);
});
