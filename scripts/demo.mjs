import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { writeReports } from "../src/report.js";
import { sweep } from "../src/runner.js";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputIndex = process.argv.indexOf("--out");
const outputDirectory = path.resolve(
  outputIndex >= 0 ? process.argv[outputIndex + 1] : path.join(root, "tmp", "demo"),
);

const healthy = await loadConfig(
  path.join(root, "examples", "dungeon", "healthy.config.json"),
);
const faulty = await loadConfig(
  path.join(root, "examples", "dungeon", "faulty.config.json"),
);
const healthyReport = await sweep(healthy);
const faultyReport = await sweep(faulty);
await writeReports(healthyReport, path.join(outputDirectory, "healthy"));
await writeReports(faultyReport, path.join(outputDirectory, "faulty"));

const healthyPasses =
  healthyReport.summary.failed === 0 &&
  healthyReport.summary.adapterErrors === 0 &&
  healthyReport.summary.nondeterministic === 0;
const faultyCaught =
  faultyReport.summary.failed > 0 &&
  faultyReport.summary.adapterErrors === 0 &&
  faultyReport.results.some((result) =>
    result.violations.some(
      (violation) =>
        violation.id === "exit-reachable" ||
        violation.id === "all-floor-connected",
    ),
  );

process.stdout.write(
  `${healthyPasses ? "PASS" : "FAIL"} healthy connector: ${healthyReport.summary.passed}/${healthyReport.summary.total} seeds pass\n`,
);
process.stdout.write(
  `${faultyCaught ? "PASS" : "FAIL"} faulty connector: ${faultyReport.summary.failed} failing seed(s) preserved\n`,
);
process.stdout.write(`reports: ${outputDirectory}\n`);

if (!healthyPasses || !faultyCaught) {
  process.exitCode = 1;
}
