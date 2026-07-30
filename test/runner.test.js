import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig, validateConfig } from "../src/config.js";
import { exitCodeForReport, sweep } from "../src/runner.js";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixture = (name) => path.join(root, "test-fixtures", name);

test("module sweep passes healthy worlds and catches a real connector defect", async () => {
  const healthy = await loadConfig(
    path.join(root, "examples", "dungeon", "healthy.config.json"),
  );
  healthy.seeds = [1000, 1017, 1034];
  const healthyReport = await sweep(healthy);
  assert.equal(healthyReport.summary.passed, 3);
  assert.equal(healthyReport.summary.failed, 0);
  assert.equal(exitCodeForReport(healthyReport), 0);

  const faulty = await loadConfig(
    path.join(root, "examples", "dungeon", "faulty.config.json"),
  );
  faulty.seeds = [1017];
  const faultyReport = await sweep(faulty);
  assert.equal(faultyReport.summary.failed, 1);
  assert.ok(
    faultyReport.results[0].violations.some(
      (item) => item.id === "exit-reachable" || item.id === "all-floor-connected",
    ),
  );
  assert.equal(exitCodeForReport(faultyReport), 2);
});

test("repeated generation detects nondeterminism", async () => {
  const config = validateConfig({
    format: "seed-sleuth-config",
    schemaVersion: 1,
    name: "nondeterministic",
    generator: { kind: "module", path: fixture("nondeterministic-adapter.js") },
    seeds: { values: [1] },
    limits: { repeats: 2, concurrency: 1, timeoutMs: 500 },
    assertions: [],
    capture: "all",
  });
  const report = await sweep(config);
  assert.equal(report.summary.nondeterministic, 1);
  assert.equal(report.results[0].violations[0].id, "deterministic-replay");
});

test("module timeout becomes an adapter failure with exit code 3", async () => {
  const config = validateConfig({
    format: "seed-sleuth-config",
    schemaVersion: 1,
    name: "timeout",
    generator: { kind: "module", path: fixture("timeout-adapter.js") },
    seeds: { values: [2] },
    limits: { concurrency: 1, timeoutMs: 40 },
    assertions: [],
  });
  const report = await sweep(config);
  assert.equal(report.summary.adapterErrors, 1);
  assert.equal(report.results[0].adapterError.code, "ADAPTER_TIMEOUT");
  assert.equal(exitCodeForReport(report), 3);
});

test("invalid world protocol becomes an adapter failure", async () => {
  const config = validateConfig({
    format: "seed-sleuth-config",
    schemaVersion: 1,
    name: "invalid",
    generator: { kind: "module", path: fixture("invalid-adapter.js") },
    seeds: { values: [3] },
    assertions: [],
  });
  const report = await sweep(config);
  assert.equal(report.summary.adapterErrors, 1);
  assert.match(report.results[0].adapterError.message, /expected width/);
});

test("command adapter runs shell-free and parses one JSON world", async () => {
  const config = validateConfig({
    format: "seed-sleuth-config",
    schemaVersion: 1,
    name: "command",
    generator: {
      kind: "command",
      command: process.execPath,
      args: [fixture("command-adapter.js"), "{seed}"],
      cwd: root,
    },
    seeds: { values: [42] },
    limits: { repeats: 2, concurrency: 1, timeoutMs: 1000 },
    tiles: { walkable: [".", "S", "E"] },
    assertions: [
      { id: "reachable", type: "reachable", from: "S", to: "E" },
    ],
    capture: "all",
  });
  const report = await sweep(config);
  assert.equal(report.summary.passed, 1);
  assert.equal(report.results[0].world.seed, 42);
  assert.equal(report.results[0].deterministic, true);
});
