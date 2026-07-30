import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateAssertions } from "./assertions.js";
import { EXIT, TOOL_NAME, VERSION } from "./constants.js";
import { loadConfig } from "./config.js";
import { writeReports } from "./report.js";
import { exitCodeForReport, runOne, sweep } from "./runner.js";
import { validateWorld } from "./world.js";

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function write(stream, message) {
  stream.write(`${message}\n`);
}

function parseArguments(arguments_) {
  const operands = [];
  const options = {};
  const valueOptions = new Set(["out", "format", "fail-on", "seed"]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const item = arguments_[index];
    if (item === "--") {
      operands.push(...arguments_.slice(index + 1));
      break;
    }
    if (!item.startsWith("--")) {
      operands.push(item);
      continue;
    }
    const [rawKey, inlineValue] = item.slice(2).split("=", 2);
    if (valueOptions.has(rawKey)) {
      const value = inlineValue ?? arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new TypeError(`--${rawKey} requires a value.`);
      }
      options[rawKey] = value;
      if (inlineValue === undefined) {
        index += 1;
      }
    } else if (["quiet", "force", "help"].includes(rawKey)) {
      options[rawKey] = true;
    } else {
      throw new TypeError(`Unknown option --${rawKey}.`);
    }
  }
  return { operands, options };
}

function helpText() {
  return `${TOOL_NAME} ${VERSION}

Sweep procedural game worlds, prove playability contracts, and preserve visual counterexamples.

Usage:
  seed-sleuth sweep <config.json> [--out report-dir] [--format all|json,html,junit,markdown] [--fail-on error|warning|none]
  seed-sleuth replay <config.json> --seed <integer>
  seed-sleuth validate <world.json> <config.json> [--fail-on error|warning|none]
  seed-sleuth init [directory] [--force]
  seed-sleuth demo [--out directory]
  seed-sleuth --version

Exit codes:
  0  requested checks passed
  1  usage, configuration, or file error
  2  a configured contract failed
  3  adapter timeout, crash, or protocol failure
`;
}

function progressWriter(stream, quiet) {
  let previousBucket = -1;
  return ({ completed, total, result }) => {
    if (quiet) {
      return;
    }
    const bucket = Math.floor((completed / total) * 10);
    if (bucket === previousBucket && completed !== total) {
      return;
    }
    previousBucket = bucket;
    write(
      stream,
      `[${completed}/${total}] seed ${result.seed}: ${result.status}`,
    );
  };
}

function formatsFrom(value) {
  if (!value || value === "all") {
    return ["all"];
  }
  const formats = value.split(",").map((item) => item.trim());
  const allowed = new Set(["json", "html", "junit", "markdown"]);
  if (formats.length === 0 || formats.some((format) => !allowed.has(format))) {
    throw new TypeError(
      "--format must be all or a comma-separated subset of json, html, junit, markdown.",
    );
  }
  return [...new Set(formats)];
}

function failOnFrom(value) {
  const failOn = value ?? "error";
  if (!["error", "warning", "none"].includes(failOn)) {
    throw new TypeError("--fail-on must be error, warning, or none.");
  }
  return failOn;
}

async function sweepCommand(arguments_, io) {
  const { operands, options } = parseArguments(arguments_);
  if (operands.length !== 1) {
    throw new TypeError("sweep requires exactly one config path.");
  }
  const config = await loadConfig(operands[0]);
  const report = await sweep(config, {
    onProgress: progressWriter(io.stderr, options.quiet),
  });
  const outputDirectory = options.out ?? "seed-sleuth-report";
  const written = await writeReports(
    report,
    outputDirectory,
    formatsFrom(options.format),
  );
  write(
    io.stdout,
    `Seeds ${report.summary.total} · passed ${report.summary.passed} · violations ${report.summary.failed} · adapter errors ${report.summary.adapterErrors} · outliers ${report.summary.outlierSeeds}`,
  );
  for (const [format, file] of Object.entries(written)) {
    write(io.stdout, `${format}: ${file}`);
  }
  return exitCodeForReport(report, failOnFrom(options["fail-on"]));
}

async function replayCommand(arguments_, io) {
  const { operands, options } = parseArguments(arguments_);
  if (operands.length !== 1 || options.seed === undefined) {
    throw new TypeError("replay requires one config path and --seed <integer>.");
  }
  const seed = Number(options.seed);
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError("--seed must be a safe integer.");
  }
  const config = await loadConfig(operands[0]);
  const result = await runOne(config, seed, {
    repeats: Math.max(2, config.limits.repeats),
  });
  write(io.stdout, `seed: ${seed}`);
  write(io.stdout, `status: ${result.status}`);
  write(io.stdout, `deterministic: ${result.deterministic}`);
  if (result.fingerprint) {
    write(io.stdout, `fingerprint: ${result.fingerprint}`);
  }
  for (const item of result.violations) {
    write(io.stdout, `${item.severity.toUpperCase()} ${item.id}: ${item.message}`);
  }
  if (result.adapterError) {
    write(
      io.stderr,
      `${result.adapterError.name}: ${result.adapterError.message}`,
    );
    return EXIT.adapterFailure;
  }
  return result.violations.length > 0 ? EXIT.contractViolation : EXIT.ok;
}

async function validateCommand(arguments_, io) {
  const { operands, options } = parseArguments(arguments_);
  if (operands.length !== 2) {
    throw new TypeError("validate requires <world.json> and <config.json>.");
  }
  const config = await loadConfig(operands[1]);
  const rawWorld = JSON.parse(await readFile(path.resolve(operands[0]), "utf8"));
  const world = validateWorld(rawWorld, config.limits);
  const { metrics, violations } = evaluateAssertions(
    world,
    config.assertions,
    config.tiles,
  );
  write(io.stdout, `world: ${world.width}x${world.height}`);
  write(io.stdout, `walkable ratio: ${metrics.walkableRatio.toFixed(4)}`);
  write(io.stdout, `components: ${metrics.componentCount}`);
  for (const item of violations) {
    write(io.stdout, `${item.severity.toUpperCase()} ${item.id}: ${item.message}`);
  }
  const failOn = failOnFrom(options["fail-on"]);
  if (failOn === "none") {
    return EXIT.ok;
  }
  const threshold = failOn === "warning" ? 1 : 2;
  return violations.some((item) => {
    const rank =
      item.severity === "error" ? 2 : item.severity === "warning" ? 1 : 0;
    return rank >= threshold;
  })
    ? EXIT.contractViolation
    : EXIT.ok;
}

async function initCommand(arguments_, io) {
  const { operands, options } = parseArguments(arguments_);
  if (operands.length > 1) {
    throw new TypeError("init accepts at most one target directory.");
  }
  const target = path.resolve(operands[0] ?? ".");
  await mkdir(target, { recursive: true });
  const files = ["adapter.js", "seed-sleuth.config.json"];
  for (const file of files) {
    const destination = path.join(target, file);
    try {
      await copyFile(
        path.join(packageRoot, "templates", file),
        destination,
        options.force ? 0 : 1,
      );
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new Error(
          `${destination} already exists; use --force to replace it.`,
        );
      }
      throw error;
    }
    write(io.stdout, `created: ${destination}`);
  }
  write(
    io.stdout,
    `next: seed-sleuth sweep "${path.join(target, "seed-sleuth.config.json")}"`,
  );
  return EXIT.ok;
}

async function demoCommand(arguments_, io) {
  const { operands, options } = parseArguments(arguments_);
  if (operands.length !== 0) {
    throw new TypeError("demo does not accept positional arguments.");
  }
  const outputRoot = path.resolve(options.out ?? "seed-sleuth-demo");
  const healthy = await loadConfig(
    path.join(packageRoot, "examples", "dungeon", "healthy.config.json"),
  );
  const faulty = await loadConfig(
    path.join(packageRoot, "examples", "dungeon", "faulty.config.json"),
  );
  const healthyReport = await sweep(healthy, {
    onProgress: progressWriter(io.stderr, options.quiet),
  });
  const faultyReport = await sweep(faulty, {
    onProgress: progressWriter(io.stderr, options.quiet),
  });
  await writeReports(healthyReport, path.join(outputRoot, "healthy"));
  await writeReports(faultyReport, path.join(outputRoot, "faulty"));

  const healthyPasses =
    healthyReport.summary.failed === 0 &&
    healthyReport.summary.adapterErrors === 0;
  const faultyCaught =
    faultyReport.summary.failed > 0 &&
    faultyReport.summary.adapterErrors === 0;
  write(
    io.stdout,
    `${healthyPasses ? "PASS" : "FAIL"} healthy connector: ${healthyReport.summary.passed}/${healthyReport.summary.total} seeds pass`,
  );
  write(
    io.stdout,
    `${faultyCaught ? "PASS" : "FAIL"} faulty connector: ${faultyReport.summary.failed} failing seed(s) preserved`,
  );
  write(io.stdout, `reports: ${outputRoot}`);
  return healthyPasses && faultyCaught ? EXIT.ok : EXIT.contractViolation;
}

export async function main(arguments_, io = process) {
  const [command, ...rest] = arguments_;
  if (
    !command ||
    command === "--help" ||
    command === "-h" ||
    command === "help"
  ) {
    write(io.stdout, helpText().trimEnd());
    return EXIT.ok;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    write(io.stdout, VERSION);
    return EXIT.ok;
  }

  try {
    if (command === "sweep") {
      return await sweepCommand(rest, io);
    }
    if (command === "replay") {
      return await replayCommand(rest, io);
    }
    if (command === "validate") {
      return await validateCommand(rest, io);
    }
    if (command === "init") {
      return await initCommand(rest, io);
    }
    if (command === "demo") {
      return await demoCommand(rest, io);
    }
    throw new TypeError(`Unknown command "${command}".`);
  } catch (error) {
    write(io.stderr, `${error.name}: ${error.message}`);
    return EXIT.usageOrIo;
  }
}
