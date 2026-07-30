import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderHtml } from "./html.js";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderJunit(report) {
  const cases = report.results
    .map((result) => {
      const time = (result.durationMs / 1_000).toFixed(6);
      const name = `seed ${result.seed}`;
      if (result.status === "error") {
        return `  <testcase classname="SeedSleuth" name="${escapeXml(name)}" time="${time}"><error type="${escapeXml(result.adapterError.name)}" message="${escapeXml(result.adapterError.message)}"/></testcase>`;
      }
      if (result.violations.length > 0) {
        const message = result.violations
          .map((item) => `${item.id}: ${item.message}`)
          .join("\n");
        return `  <testcase classname="SeedSleuth" name="${escapeXml(name)}" time="${time}"><failure type="contract" message="${escapeXml(message)}">${escapeXml(JSON.stringify(result.violations, null, 2))}</failure></testcase>`;
      }
      return `  <testcase classname="SeedSleuth" name="${escapeXml(name)}" time="${time}"/>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${escapeXml(report.config.name)}" tests="${report.summary.total}" failures="${report.summary.failed}" errors="${report.summary.adapterErrors}" time="${(report.summary.durationMs.total / 1_000).toFixed(6)}">
${cases}
</testsuite>
`;
}

export function renderMarkdown(report) {
  const lines = [
    `# ${report.config.name} · SeedSleuth report`,
    "",
    report.config.description || "Procedural world seed sweep.",
    "",
    "| Result | Count |",
    "| --- | ---: |",
    `| Seeds | ${report.summary.total} |`,
    `| Passed | ${report.summary.passed} |`,
    `| Contract violations | ${report.summary.failed} |`,
    `| Adapter errors | ${report.summary.adapterErrors} |`,
    `| Nondeterministic seeds | ${report.summary.nondeterministic} |`,
    `| Statistical outliers | ${report.summary.outlierSeeds} |`,
    `| p95 duration | ${report.summary.durationMs.p95} ms |`,
    "",
  ];

  const findings = report.results.filter(
    (result) =>
      result.status !== "passed" ||
      result.outliers.length > 0 ||
      result.deterministic === false,
  );
  if (findings.length === 0) {
    lines.push("All configured contracts passed.");
  } else {
    lines.push("## Findings", "");
    for (const result of findings.slice(0, 100)) {
      lines.push(`### Seed ${result.seed}`, "");
      if (result.adapterError) {
        lines.push(
          `- Adapter error: \`${result.adapterError.name}\` — ${result.adapterError.message}`,
        );
      }
      for (const item of result.violations) {
        lines.push(`- ${item.severity.toUpperCase()} \`${item.id}\`: ${item.message}`);
      }
      for (const item of result.outliers) {
        lines.push(
          `- OUTLIER \`${item.metric}\`: ${item.value} (${item.direction}, robust z=${item.robustZ.toFixed(2)})`,
        );
      }
      lines.push("");
    }
    if (findings.length > 100) {
      lines.push(`_${findings.length - 100} additional finding seeds omitted._`, "");
    }
  }
  lines.push(
    `Generated with SeedSleuth ${report.toolVersion}; config fingerprint \`${report.configFingerprint}\`.`,
    "",
  );
  return lines.join("\n");
}

export async function writeReports(report, outputDirectory, formats = ["all"]) {
  const out = path.resolve(outputDirectory);
  await mkdir(out, { recursive: true });
  const requested = new Set(
    formats.includes("all")
      ? ["json", "html", "junit", "markdown"]
      : formats,
  );
  const written = {};

  if (requested.has("json")) {
    written.json = path.join(out, "report.json");
    await writeFile(written.json, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (requested.has("html")) {
    written.html = path.join(out, "report.html");
    await writeFile(written.html, renderHtml(report), "utf8");
  }
  if (requested.has("junit")) {
    written.junit = path.join(out, "junit.xml");
    await writeFile(written.junit, renderJunit(report), "utf8");
  }
  if (requested.has("markdown")) {
    written.markdown = path.join(out, "summary.md");
    await writeFile(written.markdown, renderMarkdown(report), "utf8");
  }
  return written;
}
