import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { evaluateAssertions } from "./assertions.js";
import { fingerprint } from "./canonical.js";
import {
  EXIT,
  REPORT_FORMAT,
  REPORT_SCHEMA_VERSION,
  SEVERITY_RANK,
  VERSION,
} from "./constants.js";
import { publicConfig } from "./config.js";
import { robustOutliers } from "./outliers.js";
import { validateWorld } from "./world.js";

const workerPath = fileURLToPath(new URL("./adapter-worker.js", import.meta.url));

function serializeError(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    code: error?.code ?? null,
  };
}

class ModuleSlot {
  constructor(generator, limits) {
    this.generator = generator;
    this.limits = limits;
    this.worker = null;
    this.current = null;
  }

  spawnWorker() {
    const worker = new Worker(workerPath, {
      workerData: {
        adapterPath: this.generator.path,
        exportName: this.generator.export,
      },
      resourceLimits: {
        maxOldGenerationSizeMb: 192,
        maxYoungGenerationSizeMb: 32,
        stackSizeMb: 8,
      },
    });
    worker.on("message", (message) => {
      if (!this.current || message.id !== this.current.id) {
        return;
      }
      const current = this.current;
      this.current = null;
      clearTimeout(current.timer);
      if (message.ok) {
        current.resolve(message.worlds);
      } else {
        const error = new Error(message.error?.message ?? "Adapter failed.");
        error.name = message.error?.name ?? "AdapterError";
        error.code = message.error?.code ?? null;
        current.reject(error);
      }
    });
    worker.on("error", (error) => {
      if (this.current) {
        const current = this.current;
        this.current = null;
        clearTimeout(current.timer);
        current.reject(error);
      }
      this.worker = null;
    });
    worker.on("exit", (code) => {
      if (this.current) {
        const current = this.current;
        this.current = null;
        clearTimeout(current.timer);
        current.reject(
          new Error(`Adapter worker exited with code ${code} before replying.`),
        );
      }
      if (this.worker === worker) {
        this.worker = null;
      }
    });
    this.worker = worker;
    return worker;
  }

  run(task) {
    if (this.current) {
      throw new Error("Internal error: worker slot is already busy.");
    }
    const worker = this.worker ?? this.spawnWorker();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.current || this.current.id !== task.id) {
          return;
        }
        this.current = null;
        this.worker = null;
        void worker.terminate();
        const error = new Error(
          `Seed ${task.seed} exceeded the ${this.limits.timeoutMs} ms timeout.`,
        );
        error.name = "AdapterTimeoutError";
        error.code = "ADAPTER_TIMEOUT";
        reject(error);
      }, this.limits.timeoutMs);

      this.current = { id: task.id, resolve, reject, timer };
      worker.postMessage(task);
    });
  }

  async close() {
    if (this.current) {
      clearTimeout(this.current.timer);
      this.current.reject(new Error("Adapter worker closed before completing."));
      this.current = null;
    }
    if (this.worker) {
      const worker = this.worker;
      this.worker = null;
      await worker.terminate();
    }
  }
}

function substitute(value, seed, options) {
  return value
    .replaceAll("{seed}", String(seed))
    .replaceAll("{options}", JSON.stringify(options));
}

function runCommandOnce(generator, seed, limits) {
  return new Promise((resolve, reject) => {
    const args = generator.args.map((argument) =>
      substitute(argument, seed, generator.options),
    );
    const child = spawn(generator.command, args, {
      cwd: generator.cwd,
      env: {
        ...process.env,
        ...generator.environment,
        SEED_SLEUTH_SEED: String(seed),
        SEED_SLEUTH_OPTIONS: JSON.stringify(generator.options),
      },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      const error = new Error(
        `Seed ${seed} exceeded the ${limits.timeoutMs} ms timeout.`,
      );
      error.name = "AdapterTimeoutError";
      error.code = "ADAPTER_TIMEOUT";
      reject(error);
    }, limits.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout = Buffer.concat([stdout, chunk]);
      if (stdout.length > limits.maxWorldBytes * 2 && !settled) {
        settled = true;
        clearTimeout(timer);
        child.kill();
        reject(
          new RangeError(
            `Command adapter stdout exceeded ${limits.maxWorldBytes * 2} bytes.`,
          ),
        );
      }
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 64_000) {
        stderr = Buffer.concat([stderr, chunk]).subarray(0, 64_000);
      }
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        const detail = stderr.toString("utf8").trim();
        reject(
          new Error(
            `Command adapter exited ${code ?? `via ${signal}`}${
              detail ? `: ${detail}` : ""
            }`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout.toString("utf8")));
      } catch (error) {
        reject(
          new SyntaxError(
            `Command adapter did not emit one JSON world on stdout: ${error.message}`,
          ),
        );
      }
    });
  });
}

async function runCommandTask(generator, task, limits) {
  const worlds = [];
  for (let repeat = 0; repeat < task.repeats; repeat += 1) {
    worlds.push(await runCommandOnce(generator, task.seed, limits));
  }
  return worlds;
}

function normalizeGeneratedWorld(raw, seed, limits) {
  const world = validateWorld(raw, limits);
  if (world.seed !== null && world.seed !== seed) {
    throw new TypeError(
      `Adapter returned world.seed ${world.seed} while SeedSleuth requested ${seed}.`,
    );
  }
  return { ...world, seed };
}

function processWorlds(index, seed, rawWorlds, durationMs, config) {
  const worlds = rawWorlds.map((world) =>
    normalizeGeneratedWorld(world, seed, config.limits),
  );
  const fingerprints = worlds.map((world) => fingerprint(world));
  const deterministic = fingerprints.every(
    (candidate) => candidate === fingerprints[0],
  );
  const { metrics, violations } = evaluateAssertions(
    worlds[0],
    config.assertions,
    config.tiles,
  );
  if (!deterministic) {
    violations.unshift({
      id: "deterministic-replay",
      type: "deterministic",
      severity: "error",
      message: `Seed ${seed} produced ${new Set(fingerprints).size} fingerprints across ${fingerprints.length} repeats.`,
      evidence: { fingerprints },
    });
  }

  return {
    index,
    seed,
    status: violations.length > 0 ? "failed" : "passed",
    durationMs: Math.round(durationMs * 100) / 100,
    fingerprint: fingerprints[0],
    deterministic,
    repeatFingerprints: fingerprints.length > 1 ? fingerprints : undefined,
    metrics,
    violations,
    outliers: [],
    _world: worlds[0],
  };
}

function processFailure(index, seed, durationMs, error) {
  return {
    index,
    seed,
    status: "error",
    durationMs: Math.round(durationMs * 100) / 100,
    deterministic: null,
    metrics: null,
    violations: [],
    outliers: [],
    adapterError: serializeError(error),
    _world: null,
  };
}

function percentile(values, quantile) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(quantile * sorted.length) - 1),
  );
  return sorted[index];
}

function generatedAt() {
  const sourceEpoch = process.env.SOURCE_DATE_EPOCH;
  if (sourceEpoch !== undefined && /^\d+$/.test(sourceEpoch)) {
    return new Date(Number(sourceEpoch) * 1_000).toISOString();
  }
  return new Date().toISOString();
}

function summarize(results) {
  const severityCounts = { error: 0, warning: 0, info: 0 };
  const assertionCounts = {};
  for (const result of results) {
    for (const item of result.violations) {
      severityCounts[item.severity] += 1;
      assertionCounts[item.id] = (assertionCounts[item.id] ?? 0) + 1;
    }
  }
  const durations = results.map((result) => result.durationMs);
  return {
    total: results.length,
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    adapterErrors: results.filter((result) => result.status === "error").length,
    nondeterministic: results.filter((result) => result.deterministic === false)
      .length,
    outlierSeeds: results.filter((result) => result.outliers.length > 0).length,
    violations: severityCounts,
    assertionFailures: Object.fromEntries(
      Object.entries(assertionCounts).sort(
        ([left], [right]) => left.localeCompare(right),
      ),
    ),
    durationMs: {
      total: Math.round(durations.reduce((sum, value) => sum + value, 0) * 100) / 100,
      p50: Math.round(percentile(durations, 0.5) * 100) / 100,
      p95: Math.round(percentile(durations, 0.95) * 100) / 100,
      max: Math.round(Math.max(0, ...durations) * 100) / 100,
    },
  };
}

function retainWorld(result, capture, failureIndex, maxFailures) {
  if (!result._world || capture === "none") {
    return false;
  }
  if (capture === "all") {
    return true;
  }
  if (result.status === "failed") {
    return failureIndex < maxFailures;
  }
  return capture === "failures-and-outliers" && result.outliers.length > 0;
}

export async function sweep(config, options = {}) {
  const seeds = config.seeds;
  const results = new Array(seeds.length);
  let cursor = 0;
  let completed = 0;

  const runLoop = async (slot) => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= seeds.length) {
        break;
      }
      const seed = seeds[index];
      const started = performance.now();
      try {
        const task = {
          id: `${index}:${seed}`,
          seed,
          repeats: config.limits.repeats,
          options: config.generator.options,
        };
        const worlds =
          config.generator.kind === "module"
            ? await slot.run(task)
            : await runCommandTask(config.generator, task, config.limits);
        results[index] = processWorlds(
          index,
          seed,
          worlds,
          performance.now() - started,
          config,
        );
      } catch (error) {
        results[index] = processFailure(
          index,
          seed,
          performance.now() - started,
          error,
        );
      }
      completed += 1;
      options.onProgress?.({
        completed,
        total: seeds.length,
        result: results[index],
      });
    }
  };

  const concurrency = Math.min(
    config.limits.concurrency,
    seeds.length,
    Math.max(1, os.availableParallelism?.() ?? os.cpus().length),
  );
  const slots =
    config.generator.kind === "module"
      ? Array.from(
          { length: concurrency },
          () => new ModuleSlot(config.generator, config.limits),
        )
      : Array.from({ length: concurrency }, () => null);

  try {
    await Promise.all(slots.map((slot) => runLoop(slot)));
  } finally {
    await Promise.all(slots.filter(Boolean).map((slot) => slot.close()));
  }

  const analyzable = results.filter((result) => result.metrics);
  const { byResult, baselines } = robustOutliers(
    analyzable,
    config.outliers.metrics,
    config.outliers.threshold,
  );
  for (const result of results) {
    result.outliers = byResult.get(result.index) ?? [];
    if (config.outliers.fail && result.outliers.length > 0) {
      result.violations.push({
        id: "statistical-outlier",
        type: "outlier",
        severity: "warning",
        message: `Seed ${result.seed} is an outlier in ${result.outliers.length} metric(s).`,
        evidence: { outliers: result.outliers },
      });
      if (result.status === "passed") {
        result.status = "failed";
      }
    }
  }

  let failureIndex = 0;
  const publicResults = results.map((result) => {
    const keepWorld = retainWorld(
      result,
      config.capture,
      failureIndex,
      config.limits.maxFailures,
    );
    if (result.status === "failed") {
      failureIndex += 1;
    }
    const { _world, ...publicResult } = result;
    if (keepWorld) {
      publicResult.world = _world;
    }
    return publicResult;
  });

  const exposedConfig = publicConfig(config);
  return {
    format: REPORT_FORMAT,
    schemaVersion: REPORT_SCHEMA_VERSION,
    toolVersion: VERSION,
    generatedAt: generatedAt(),
    configFingerprint: fingerprint(exposedConfig),
    config: exposedConfig,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    summary: summarize(publicResults),
    outlierBaselines: baselines,
    results: publicResults,
  };
}

export async function runOne(config, seed, options = {}) {
  const single = {
    ...config,
    seeds: [seed],
    limits: {
      ...config.limits,
      repeats: options.repeats ?? config.limits.repeats,
    },
    capture: "all",
  };
  const report = await sweep(single, options);
  return report.results[0];
}

export function exitCodeForReport(report, failOn = "error") {
  if (report.summary.adapterErrors > 0) {
    return EXIT.adapterFailure;
  }
  if (failOn === "none") {
    return EXIT.ok;
  }
  const threshold = SEVERITY_RANK[failOn] ?? SEVERITY_RANK.error;
  const hasViolation = report.results.some((result) =>
    result.violations.some(
      (item) => SEVERITY_RANK[item.severity] >= threshold,
    ),
  );
  return hasViolation ? EXIT.contractViolation : EXIT.ok;
}
