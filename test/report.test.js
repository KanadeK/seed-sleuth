import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";
import { renderHtml } from "../src/html.js";
import { renderJunit, renderMarkdown, writeReports } from "../src/report.js";

const report = {
  format: "seed-sleuth-report",
  schemaVersion: 1,
  toolVersion: "0.1.0",
  generatedAt: "2026-01-01T00:00:00.000Z",
  configFingerprint: "abc123",
  config: {
    name: "<script>alert(1)</script>",
    description: "safe",
  },
  summary: {
    total: 1,
    passed: 0,
    failed: 1,
    adapterErrors: 0,
    nondeterministic: 0,
    outlierSeeds: 0,
    violations: { error: 1, warning: 0, info: 0 },
    assertionFailures: { reachable: 1 },
    durationMs: { total: 1, p50: 1, p95: 1, max: 1 },
  },
  outlierBaselines: {},
  results: [
    {
      index: 0,
      seed: 5,
      status: "failed",
      durationMs: 1,
      fingerprint: "abc",
      deterministic: true,
      metrics: {
        walkableRatio: 0.5,
        componentCount: 2,
        deadEnds: 1,
        tileEntropy: 0.8,
      },
      violations: [
        {
          id: "reachable",
          type: "reachable",
          severity: "error",
          message: "No path <exists>.",
          evidence: {},
        },
      ],
      outliers: [],
      world: {
        width: 3,
        height: 3,
        cells: ["###", "#S#", "###"],
      },
    },
  ],
};

test("HTML report escapes embedded JSON and has no remote assets", () => {
  const html = renderHtml(report);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003cscript>/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(html, /Content-Security-Policy/);
});

test("JUnit and Markdown retain actionable findings", () => {
  assert.match(renderJunit(report), /failure type="contract"/);
  assert.match(renderJunit(report), /No path &lt;exists&gt;/);
  assert.match(renderMarkdown(report), /`reachable`/);
});

test("writeReports emits every requested format", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "seed-sleuth-report-"));
  const written = await writeReports(report, directory);
  assert.deepEqual(Object.keys(written), ["json", "html", "junit", "markdown"]);
  assert.match(await readFile(written.json, "utf8"), /seed-sleuth-report/);
});
