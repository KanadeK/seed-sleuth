import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CONFIG_FORMAT,
  CONFIG_SCHEMA_VERSION,
  DEFAULT_LIMITS,
  SEVERITY_RANK,
} from "./constants.js";

function expectObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function expectPositiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new TypeError(`${label} must be an integer from 1 to ${maximum}.`);
  }
}

function normalizeSeeds(seeds) {
  expectObject(seeds, "seeds");
  if (Array.isArray(seeds.values)) {
    if (seeds.values.length === 0) {
      throw new TypeError("seeds.values must not be empty.");
    }
    const unique = new Set();
    for (const seed of seeds.values) {
      if (!Number.isSafeInteger(seed)) {
        throw new TypeError("Every seeds.values entry must be a safe integer.");
      }
      unique.add(seed);
    }
    return [...unique];
  }

  const start = seeds.start ?? 1;
  const count = seeds.count ?? 100;
  const step = seeds.step ?? 1;
  if (!Number.isSafeInteger(start)) {
    throw new TypeError("seeds.start must be a safe integer.");
  }
  expectPositiveInteger(count, "seeds.count", 100_000);
  if (!Number.isSafeInteger(step) || step === 0) {
    throw new TypeError("seeds.step must be a non-zero safe integer.");
  }

  const values = [];
  for (let index = 0; index < count; index += 1) {
    const seed = start + index * step;
    if (!Number.isSafeInteger(seed)) {
      throw new RangeError("Generated seed exceeds JavaScript's safe integer range.");
    }
    values.push(seed);
  }
  return values;
}

function normalizeGenerator(generator, baseDirectory) {
  expectObject(generator, "generator");
  if (generator.kind === "module") {
    if (typeof generator.path !== "string" || generator.path.length === 0) {
      throw new TypeError("generator.path must be a non-empty string.");
    }
    return {
      kind: "module",
      path: path.resolve(baseDirectory, generator.path),
      displayPath: generator.path,
      export: generator.export ?? "generate",
      options: structuredClone(generator.options ?? {}),
    };
  }

  if (generator.kind === "command") {
    if (typeof generator.command !== "string" || generator.command.length === 0) {
      throw new TypeError("generator.command must be a non-empty string.");
    }
    if (!Array.isArray(generator.args) || !generator.args.every((arg) => typeof arg === "string")) {
      throw new TypeError("generator.args must be an array of strings.");
    }
    return {
      kind: "command",
      command: generator.command,
      args: [...generator.args],
      cwd: path.resolve(baseDirectory, generator.cwd ?? "."),
      displayCwd: generator.cwd ?? ".",
      options: structuredClone(generator.options ?? {}),
      environment: structuredClone(generator.environment ?? {}),
    };
  }

  throw new TypeError('generator.kind must be either "module" or "command".');
}

function normalizeAssertion(assertion, index) {
  expectObject(assertion, `assertions[${index}]`);
  if (typeof assertion.id !== "string" || assertion.id.length === 0) {
    throw new TypeError(`assertions[${index}].id must be a non-empty string.`);
  }
  if (typeof assertion.type !== "string" || assertion.type.length === 0) {
    throw new TypeError(`assertions[${index}].type must be a non-empty string.`);
  }
  const severity = assertion.severity ?? "error";
  if (!(severity in SEVERITY_RANK)) {
    throw new TypeError(
      `assertions[${index}].severity must be info, warning, or error.`,
    );
  }
  return { ...structuredClone(assertion), severity };
}

function normalizeLimits(limits = {}) {
  expectObject(limits, "limits");
  const normalized = { ...DEFAULT_LIMITS, ...limits };
  expectPositiveInteger(normalized.concurrency, "limits.concurrency", 32);
  expectPositiveInteger(normalized.timeoutMs, "limits.timeoutMs", 300_000);
  expectPositiveInteger(
    normalized.maxWorldBytes,
    "limits.maxWorldBytes",
    100_000_000,
  );
  expectPositiveInteger(normalized.maxCells, "limits.maxCells", 10_000_000);
  expectPositiveInteger(normalized.repeats, "limits.repeats", 5);
  expectPositiveInteger(normalized.maxFailures, "limits.maxFailures", 100_000);
  return normalized;
}

export function validateConfig(input, options = {}) {
  expectObject(input, "Config");
  const baseDirectory = options.baseDirectory ?? process.cwd();
  if (input.format !== CONFIG_FORMAT) {
    throw new TypeError(`format must be "${CONFIG_FORMAT}".`);
  }
  if (input.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    throw new TypeError(`schemaVersion must be ${CONFIG_SCHEMA_VERSION}.`);
  }
  if (typeof input.name !== "string" || input.name.length === 0) {
    throw new TypeError("name must be a non-empty string.");
  }

  const assertions = (input.assertions ?? []).map(normalizeAssertion);
  const ids = new Set();
  for (const assertion of assertions) {
    if (ids.has(assertion.id)) {
      throw new TypeError(`Duplicate assertion id "${assertion.id}".`);
    }
    ids.add(assertion.id);
  }

  const tiles = structuredClone(input.tiles ?? {});
  expectObject(tiles, "tiles");
  for (const property of ["walkable", "blocked"]) {
    if (
      tiles[property] !== undefined &&
      (!Array.isArray(tiles[property]) ||
        !tiles[property].every(
          (symbol) => typeof symbol === "string" && Array.from(symbol).length === 1,
        ))
    ) {
      throw new TypeError(`tiles.${property} must be an array of one-symbol strings.`);
    }
  }

  const outliers = {
    metrics: input.outliers?.metrics ?? [
      "walkableRatio",
      "componentCount",
      "deadEndRatio",
      "tileEntropy",
    ],
    threshold: input.outliers?.threshold ?? 4.5,
    fail: input.outliers?.fail ?? false,
  };
  if (
    !Array.isArray(outliers.metrics) ||
    !outliers.metrics.every((metric) => typeof metric === "string")
  ) {
    throw new TypeError("outliers.metrics must be an array of strings.");
  }
  if (
    typeof outliers.threshold !== "number" ||
    !Number.isFinite(outliers.threshold) ||
    outliers.threshold <= 0
  ) {
    throw new TypeError("outliers.threshold must be a positive number.");
  }

  const capture = input.capture ?? "failures-and-outliers";
  if (!["all", "failures", "failures-and-outliers", "none"].includes(capture)) {
    throw new TypeError(
      "capture must be all, failures, failures-and-outliers, or none.",
    );
  }

  return {
    format: CONFIG_FORMAT,
    schemaVersion: CONFIG_SCHEMA_VERSION,
    name: input.name,
    description: input.description ?? "",
    configPath: options.configPath ?? null,
    baseDirectory,
    generator: normalizeGenerator(input.generator, baseDirectory),
    seeds: normalizeSeeds(input.seeds ?? { start: 1, count: 100 }),
    limits: normalizeLimits(input.limits ?? {}),
    tiles,
    assertions,
    outliers,
    capture,
  };
}

export async function loadConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  let parsed;
  try {
    parsed = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new SyntaxError(`Invalid JSON in ${absolutePath}: ${error.message}`);
    }
    throw error;
  }
  return validateConfig(parsed, {
    baseDirectory: path.dirname(absolutePath),
    configPath: absolutePath,
  });
}

export function publicConfig(config) {
  return {
    format: config.format,
    schemaVersion: config.schemaVersion,
    name: config.name,
    description: config.description,
    generator:
      config.generator.kind === "module"
        ? {
            kind: "module",
            path: config.generator.displayPath,
            export: config.generator.export,
            options: config.generator.options,
          }
        : {
            kind: "command",
            command: config.generator.command,
            args: config.generator.args,
            cwd: config.generator.displayCwd,
            options: config.generator.options,
          },
    seeds: config.seeds,
    limits: config.limits,
    tiles: config.tiles,
    assertions: config.assertions,
    outliers: config.outliers,
    capture: config.capture,
  };
}
