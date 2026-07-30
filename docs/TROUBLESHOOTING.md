# Troubleshooting and repair

This guide treats a green local UI as insufficient. Repair ends when the same
acceptance command passes, the failure path remains tested, and the packaged
artifact repeats the result.

## First response by exit code

| Exit | First command | Goal |
| ---: | --- | --- |
| `1` | `node bin/seed-sleuth.js sweep CONFIG --out tmp/repair --format json` | Expose path, JSON, config, or write error. |
| `2` | `node bin/seed-sleuth.js replay CONFIG --seed N` | Reproduce one contract failure twice. |
| `3` | Run the adapter directly for seed `N`. | Separate generator/runtime failure from SeedSleuth analysis. |

Do not replace `--fail-on error` with `--fail-on none` as a repair. That changes
the release policy while leaving the world or adapter broken.

## Exit 1: usage, config, or filesystem

### Symptoms

- `Invalid JSON`;
- missing config or output path;
- duplicate assertion id;
- unknown option;
- generator path resolves somewhere unexpected.

### Procedure

```bash
node bin/seed-sleuth.js --help
node -e "JSON.parse(require('node:fs').readFileSync('seed-sleuth.config.json','utf8')); console.log('JSON OK')"
node bin/seed-sleuth.js sweep seed-sleuth.config.json --out tmp/repair --format json
```

Paths inside the config are relative to the config file. Move the adapter and
config together or update the path. On a read-only CI runner, choose an output
directory inside the workspace.

### Regression

```bash
node bin/seed-sleuth.js sweep seed-sleuth.config.json --out tmp/repair
```

Expected: exit `0` or `2`, never `1`.

## Exit 2: world contract violation

### Procedure

1. Read the failing seed and assertion id from `summary.md` or `report.html`.
2. Replay the seed:

   ```bash
   node bin/seed-sleuth.js replay seed-sleuth.config.json --seed 1017
   ```

3. Inspect `evidence` in `report.json`. For graph failures, compare component
   sizes and unreachable coordinates. For a metric, compare actual/min/max.
4. Run the generator directly with the same seed and preserve its raw world.
5. Decide between two explicit repairs:
   - fix the generator because the guarantee is intentional;
   - revise the contract because the old guarantee was wrong.
6. Add the seed to a committed `seeds.values` regression fixture or a focused
   test before broad sweeping again.

### Common repairs

| Finding | Generator repair |
| --- | --- |
| `exit-reachable` | Ensure every room-connection algorithm carves both segments; run a final graph repair pass only if it is a designed guarantee. |
| `all-floor-connected` | Connect or intentionally remove orphan floor islands; do not merely change `S` placement. |
| `one-start` / `one-exit` | Centralize marker placement after terrain generation and clear prior markers. |
| `sealed-border` | Reserve the outer ring before carving and clip every brush. |
| `pathDistance` too short | Choose endpoints after generation using graph distance, or modify layout pacing. |
| density/entropy warning | Tune generation parameters and sweep a wide seed range before narrowing the threshold. |

### Regression

```bash
node bin/seed-sleuth.js replay seed-sleuth.config.json --seed 1017
node bin/seed-sleuth.js sweep seed-sleuth.config.json --out tmp/regression
```

The replay must be deterministic and pass. The broad sweep must not replace
the focused replay.

## Exit 3: adapter or protocol failure

### Timeout

Run the exact seed outside SeedSleuth and measure it:

```bash
node tools/export-world.js 1017
```

If it hangs, fix the generator's termination or isolate the expensive phase.
If it completes slightly above the configured limit and the duration is
legitimate, raise `timeoutMs` narrowly and document the measured p95. Rerun at
least one deliberately non-terminating adapter test to prove the timeout still
works.

### Invalid stdout

A command adapter must write one JSON object to stdout. Move progress and logs
to stderr. Validate captured output:

```bash
node tools/export-world.js 1017 > world.json
node bin/seed-sleuth.js validate world.json seed-sleuth.config.json
```

### Wrong dimensions

`height` must equal the row count and every row must contain exactly `width`
Unicode symbols. Do not use JavaScript byte length for non-ASCII tile symbols;
count code points consistently.

### Seed mismatch or nondeterminism

```bash
node bin/seed-sleuth.js replay seed-sleuth.config.json --seed 1017
```

Remove wall-clock reads, ambient random calls, unstable map/set iteration, and
mutable module-global state from generation. Seed every random source, not only
the main layout RNG. Metadata participates in fingerprints; remove volatile
timestamps and absolute temporary paths.

## Outlier without a contract failure

An outlier is a triage lead. Open the world, compare it with the baseline
median, and add a declarative assertion only when the team agrees on the
design guarantee. Lowering the MAD threshold until CI turns red is not a
substitute for a game-design requirement.

## Package or release failure

Run in this order:

```bash
npm run verify
npm run package
npm run determinism-check
npm run release-check -- --allow-untagged
```

- If clean-install smoke fails, inspect the `.tgz` content with
  `npm pack --dry-run --json`; required `src`, `bin`, `examples`, schemas, and
  templates must be present.
- If checksum verification fails, delete only `dist-release`, rerun
  `npm run package`, and never edit `SHA256SUMS.txt` by hand.
- If deterministic packaging fails, inspect generated timestamps, file order,
  and archive metadata. The gate intentionally waits more than two seconds.
- If the Git tree is dirty, commit intended source changes and keep generated
  `site`, `tmp`, and `dist-release` ignored.
- If tag/version fails, update `package.json`, `src/constants.js`,
  `CHANGELOG.md`, and `CITATION.cff` together before creating the tag.

## The local report shows another project

A browser Service Worker is scoped to an origin, not to a repository. If a
different local app previously used the same port, its cached worker can
intercept `http://127.0.0.1:PORT` and serve the wrong page.

1. Stop the preview and choose an unused port:

   ```bash
   npm run serve -- --port 49173
   ```

2. Open the exact URL printed by the server.
3. If the page is still wrong, unregister the old Service Worker and clear site
   data for that local origin in browser developer tools, then reload.
4. Confirm the title ends in `SeedSleuth report` before treating the page as
   release evidence.

After a GitHub release, download its assets into a fresh directory, verify
`SHA256SUMS.txt`, install the downloaded `.tgz`, run `seed-sleuth demo`, and
check the public Actions, Pages, tag, contributor, and Release views. A local
package is not a public release.
