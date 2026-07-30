import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAssertions } from "../src/assertions.js";
import { validateWorld } from "../src/world.js";

const world = validateWorld({
  format: "seed-sleuth-world",
  schemaVersion: 1,
  seed: 9,
  width: 7,
  height: 5,
  cells: ["#######", "#S...E#", "###.###", "#..#..#", "#######"],
});
const tiles = { walkable: [".", "S", "E"] };

test("all assertion types return evidence-rich violations", () => {
  const assertions = [
    { id: "count", type: "count", symbol: "S", eq: 2 },
    { id: "reachable", type: "reachable", from: "S", to: "E" },
    { id: "path", type: "pathDistance", from: "S", to: "E", min: 10 },
    { id: "connected", type: "connected", max: 1 },
    {
      id: "metric",
      type: "metric",
      metric: "walkableRatio",
      min: 0.9,
      severity: "warning",
    },
    {
      id: "border",
      type: "border",
      allowedSymbols: ["."],
    },
    {
      id: "separation",
      type: "minimumSeparation",
      symbols: ["S", "E"],
      min: 10,
    },
  ];
  const { metrics, violations } = evaluateAssertions(world, assertions, tiles);
  assert.equal(metrics.componentCount, 3);
  assert.deepEqual(
    violations.map((item) => item.id),
    ["count", "path", "connected", "metric", "border", "separation"],
  );
  assert.equal(
    violations.find((item) => item.id === "metric").severity,
    "warning",
  );
  assert.ok(
    violations.every(
      (item) => item.evidence && typeof item.message === "string",
    ),
  );
});

test("unknown assertions fail closed", () => {
  const { violations } = evaluateAssertions(
    world,
    [{ id: "custom", type: "not-real" }],
    tiles,
  );
  assert.match(violations[0].message, /Unsupported/);
});
