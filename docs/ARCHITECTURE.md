# Architecture

SeedSleuth has one execution and analysis core shared by the CLI, library,
GitHub Action, demo, and tests. The browser report contains no second
implementation of world validation.

## Data flow

```text
JSON config
  ├─ seed expansion
  ├─ limits and capture policy
  ├─ tile semantics
  └─ assertions
        │
        ▼
adapter scheduler
  ├─ persistent module-worker slots
  └─ shell-free command processes
        │
        ▼
world protocol gate
  ├─ format/schema version
  ├─ dimensions and row width
  ├─ seed identity
  ├─ maximum cells
  └─ maximum canonical JSON bytes
        │
        ├─ canonical SHA-256 fingerprints
        ├─ graph and tile metrics
        └─ declarative assertions
                │
                ▼
     robust outliers and capture policy
                │
                ▼
 JSON · offline HTML · JUnit · Markdown
```

## Adapter scheduling

### Module adapters

`src/runner.js` creates a bounded number of persistent Node workers. Each slot
imports the adapter once and handles one seed at a time. Repeated calls for the
same seed happen in the same worker, but each receives a fresh structured clone
of the options object.

The parent owns the timeout. When a seed exceeds it, the parent terminates only
that worker, records an `ADAPTER_TIMEOUT` error for the seed, and creates a new
worker if more tasks remain. Workers have explicit young-generation,
old-generation, and stack memory limits.

This is process hygiene, not a security sandbox. A module can still use Node
APIs available to trusted code.

### Command adapters

Command adapters use `child_process.spawn()` with `shell: false`,
`windowsHide: true`, an explicit executable, and a separate argument array.
`{seed}` and `{options}` replacement occurs inside each argument; it never
constructs a command line for a shell.

stdout must contain exactly one JSON world. stderr is retained only up to a
bounded diagnostic size. The parent terminates the child on timeout or
oversized stdout.

## World and graph model

A v1 world is a rectangular array of Unicode-symbol rows. The configured
walkable symbols form an unweighted four-neighbor graph. The graph layer
provides:

- multi-source flood fill;
- shortest path and a representative path;
- connected-component sizes;
- counts and ratios derived from the same walkable definition.

Assertions consume these shared results. A browser cannot mark a world as
passing when the CLI marked it as failing because the report viewer only
renders the already-evaluated result.

## Reproducibility

`canonicalize()` sorts object keys recursively, preserves array order, rejects
circular and non-finite values, and normalizes negative zero. Each normalized
world receives a SHA-256 fingerprint. With `limits.repeats > 1`, all
fingerprints must match.

Results are returned in requested seed order even when workers finish out of
order. The build sets `SOURCE_DATE_EPOCH`, so committed/static demo timestamps
do not depend on the machine clock. The release gate creates npm archives more
than two seconds apart and requires byte equality.

Runtime durations are evidence, not part of a world's fingerprint. They can
vary across machines.

## Outliers

After every analyzable seed finishes, numeric metrics use a robust baseline:

1. compute the median;
2. compute the median absolute deviation (MAD);
3. calculate `0.6745 × (value - median) / MAD`;
4. mark values whose absolute robust z-score reaches the configured threshold.

A zero-MAD metric is not declared anomalous because there is no stable scale.
Outliers are annotations by default. Set `outliers.fail: true` to add a warning
contract that can fail CI under `--fail-on warning`.

## Capture and privacy

Metric and violation records are always retained. Grid capture is controlled
separately:

- `all`: keep every world;
- `failures`: keep failing worlds up to `limits.maxFailures`;
- `failures-and-outliers`: also keep statistical outliers;
- `none`: retain no grids.

This separation lets a proprietary project keep CI evidence without attaching
all generated content. Config reports use the original relative module path,
not the resolved absolute module path.

## Error taxonomy

| Layer | Result status | CLI exit |
| --- | --- | ---: |
| Valid world with no threshold violation | `passed` | `0` |
| Valid world with a configured contract violation | `failed` | `2` |
| Nondeterministic repeat | `failed` | `2` |
| Timeout, crash, invalid JSON, malformed world, or seed mismatch | `error` | `3` |
| Bad CLI/config/file input before a sweep | no report | `1` |

Adapter failures take precedence over contract failures because a partial test
population must not look like a complete quality result.
