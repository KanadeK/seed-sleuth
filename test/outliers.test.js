import assert from "node:assert/strict";
import test from "node:test";
import { robustOutliers } from "../src/outliers.js";

test("robustOutliers flags a distant metric without failing a flat metric", () => {
  const results = [10, 11, 10, 9, 10, 11, 100].map((value, index) => ({
    index,
    metrics: { value, flat: 1 },
  }));
  const { byResult, baselines } = robustOutliers(results, ["value", "flat"], 4);
  assert.equal(byResult.get(6)[0].metric, "value");
  assert.equal(byResult.get(0).length, 0);
  assert.equal(baselines.flat.mad, 0);
});
