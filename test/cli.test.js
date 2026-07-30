import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { main } from "../src/cli.js";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function capture() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: { write: (value) => (stdout += value) },
      stderr: { write: (value) => (stderr += value) },
    },
    output: () => ({ stdout, stderr }),
  };
}

test("CLI exposes version and validates a real world", async () => {
  const version = capture();
  assert.equal(await main(["--version"], version.io), 0);
  assert.equal(version.output().stdout.trim(), "0.1.0");

  const validation = capture();
  const code = await main(
    [
      "validate",
      path.join(root, "test-fixtures", "disconnected-world.json"),
      path.join(root, "examples", "dungeon", "healthy.config.json"),
    ],
    validation.io,
  );
  assert.equal(code, 2);
  assert.match(validation.output().stdout, /all-floor-connected/);
});

test("CLI init is safe by default and force is explicit", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "seed-sleuth-init-"));
  const first = capture();
  assert.equal(await main(["init", directory], first.io), 0);
  assert.match(first.output().stdout, /seed-sleuth.config.json/);

  const second = capture();
  assert.equal(await main(["init", directory], second.io), 1);
  assert.match(second.output().stderr, /already exists/);

  const forced = capture();
  assert.equal(await main(["init", directory, "--force"], forced.io), 0);
});
