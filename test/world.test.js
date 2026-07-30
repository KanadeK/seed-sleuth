import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeWorld,
  connectedComponents,
  resolveWalkableSet,
  shortestPath,
} from "../src/metrics.js";
import { validateWorld } from "../src/world.js";

const connected = {
  format: "seed-sleuth-world",
  schemaVersion: 1,
  seed: 1,
  width: 7,
  height: 5,
  cells: ["#######", "#S....#", "###.#.#", "#...#E#", "#######"],
};

test("validateWorld normalizes a valid grid", () => {
  const world = validateWorld(connected);
  assert.equal(world.width, 7);
  assert.equal(world.cells.length, 5);
  assert.equal(world.seed, 1);
});

test("validateWorld rejects malformed dimensions and oversized worlds", () => {
  assert.throws(
    () => validateWorld({ ...connected, width: 8 }),
    /expected width 8/,
  );
  assert.throws(
    () => validateWorld(connected, { maxCells: 10 }),
    /exceeding limits.maxCells/,
  );
});

test("metrics expose connectivity, path distance, and density", () => {
  const world = validateWorld(connected);
  const walkable = resolveWalkableSet(world, {
    walkable: [".", "S", "E"],
  });
  assert.deepEqual(connectedComponents(world, walkable), [11]);
  const path = shortestPath(world, "S", "E", walkable);
  assert.equal(path.distance, 6);
  assert.equal(path.path[0].x, 1);
  assert.equal(path.path.at(-1).x, 5);
  const metrics = analyzeWorld(world, { walkable: [".", "S", "E"] });
  assert.equal(metrics.componentCount, 1);
  assert.equal(metrics.walkableCells, 11);
  assert.ok(metrics.tileEntropy > 0);
});
