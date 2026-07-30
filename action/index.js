import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { renderMarkdown, writeReports } from "../src/report.js";
import { exitCodeForReport, sweep } from "../src/runner.js";

async function appendOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8");
  }
}

async function run() {
  const configPath = process.env.INPUT_CONFIG || "seed-sleuth.config.json";
  const outputDirectory = path.resolve(
    process.env.INPUT_OUTPUT || "artifacts/seed-sleuth",
  );
  const failOn = process.env["INPUT_FAIL-ON"] || "error";
  if (!["error", "warning", "none"].includes(failOn)) {
    throw new TypeError("fail-on must be error, warning, or none.");
  }

  const config = await loadConfig(configPath);
  const report = await sweep(config, {
    onProgress: ({ completed, total, result }) => {
      if (completed === total || completed % Math.max(1, Math.floor(total / 10)) === 0) {
        process.stdout.write(
          `[${completed}/${total}] seed ${result.seed}: ${result.status}\n`,
        );
      }
    },
  });
  await mkdir(outputDirectory, { recursive: true });
  const files = await writeReports(report, outputDirectory);
  await appendOutput("report", files.json);
  await appendOutput("passed", report.summary.passed);
  await appendOutput("failed", report.summary.failed);
  await appendOutput("adapter-errors", report.summary.adapterErrors);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `${renderMarkdown(report)}\n`,
      "utf8",
    );
  }
  process.stdout.write(
    `SeedSleuth: ${report.summary.passed} passed, ${report.summary.failed} violations, ${report.summary.adapterErrors} adapter errors\n`,
  );
  process.stdout.write(`Report: ${files.json}\n`);
  process.exitCode = exitCodeForReport(report, failOn);
}

try {
  await run();
} catch (error) {
  process.stderr.write(`SeedSleuth Action failed: ${error.stack ?? error.message}\n`);
  process.exitCode = 1;
}
