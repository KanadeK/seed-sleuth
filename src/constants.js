export const TOOL_NAME = "SeedSleuth";
export const PACKAGE_NAME = "seed-sleuth";
export const VERSION = "0.1.0";
export const CONFIG_FORMAT = "seed-sleuth-config";
export const CONFIG_SCHEMA_VERSION = 1;
export const WORLD_FORMAT = "seed-sleuth-world";
export const WORLD_SCHEMA_VERSION = 1;
export const REPORT_FORMAT = "seed-sleuth-report";
export const REPORT_SCHEMA_VERSION = 1;

export const EXIT = Object.freeze({
  ok: 0,
  usageOrIo: 1,
  contractViolation: 2,
  adapterFailure: 3,
});

export const DEFAULT_LIMITS = Object.freeze({
  concurrency: 4,
  timeoutMs: 2_000,
  maxWorldBytes: 1_000_000,
  maxCells: 1_000_000,
  repeats: 1,
  maxFailures: 100,
});

export const SEVERITY_RANK = Object.freeze({
  info: 0,
  warning: 1,
  error: 2,
});
