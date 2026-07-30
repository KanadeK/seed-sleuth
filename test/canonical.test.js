import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, fingerprint } from "../src/canonical.js";

test("canonicalize sorts object keys without reordering arrays", () => {
  assert.equal(
    canonicalize({ z: 1, a: { c: 2, b: [3, 1] } }),
    '{"a":{"b":[3,1],"c":2},"z":1}',
  );
});

test("fingerprint is stable across object insertion order", () => {
  assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 }));
});

test("canonicalize rejects non-finite and circular values", () => {
  assert.throws(() => canonicalize({ value: Number.NaN }), /non-finite/);
  const circular = {};
  circular.self = circular;
  assert.throws(() => canonicalize(circular), /circular/);
});
