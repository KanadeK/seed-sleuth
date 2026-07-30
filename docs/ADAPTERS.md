# Adapter guide

SeedSleuth supports trusted JavaScript modules and external commands. Both must
return the same versioned world protocol.

## World protocol

```json
{
  "format": "seed-sleuth-world",
  "schemaVersion": 1,
  "seed": 42,
  "width": 5,
  "height": 5,
  "cells": ["#####", "#S..#", "#.#.#", "#..E#", "#####"],
  "metadata": {
    "generatorVersion": "2026.07",
    "biome": "crypt"
  }
}
```

Rules:

- `width` and `height` are positive safe integers.
- `cells` contains exactly `height` strings.
- each row contains exactly `width` Unicode symbols;
- `seed` is the requested safe integer, or `null` when validating a standalone
  world file;
- `metadata` is optional JSON data;
- the canonical world must fit `maxWorldBytes` and `maxCells`.

The machine-readable schema is
[`schemas/world.schema.json`](../schemas/world.schema.json). Runtime validation
also checks row width, byte limits, and requested seed identity, which JSON
Schema alone cannot express.

## Module adapter

```js
export async function generate(seed, options) {
  const level = await makeLevel({ seed, ...options });
  return {
    format: "seed-sleuth-world",
    schemaVersion: 1,
    seed,
    width: level.width,
    height: level.height,
    cells: level.rows,
    metadata: { revision: level.revision }
  };
}
```

```json
{
  "kind": "module",
  "path": "./adapter.js",
  "export": "generate",
  "options": {
    "difficulty": "release"
  }
}
```

The path is resolved relative to the config file, not the terminal's current
directory. The module is cached inside each worker. Avoid mutable module-level
state; repeated-seed checks intentionally expose it when it changes output.

### Module failure behavior

- rejected promises and thrown exceptions become adapter errors;
- an infinite promise or long synchronous loop is terminated by the parent
  timeout;
- a worker crash affects only its current seed;
- the next pending seed receives a fresh worker;
- imports and generator code are trusted with the current user's filesystem
  privileges.

## Command adapter

```json
{
  "kind": "command",
  "command": "python",
  "args": [
    "tools/export_world.py",
    "--seed",
    "{seed}",
    "--options",
    "{options}"
  ],
  "cwd": ".",
  "environment": {
    "WORLD_EXPORT_MODE": "ci"
  },
  "options": {
    "difficulty": "release"
  }
}
```

The child also receives:

- `SEED_SLEUTH_SEED`;
- `SEED_SLEUTH_OPTIONS`.

Use either argument placeholders or environment variables. Write diagnostics
to stderr and one JSON world to stdout. Do not print a banner, progress bar, or
second JSON object to stdout.

SeedSleuth never enables a shell, so shell built-ins, pipes, redirects, globs,
and environment expansion do not work. Wrap those behaviors in a checked-in
script and call that script explicitly.

### Engine pattern

For an engine-specific exporter:

1. start the engine or tool in its headless mode;
2. read the seed from an explicit argument or `SEED_SLEUTH_SEED`;
3. invoke the real generation entrypoint;
4. map the generated navigation or tile layer to stable one-symbol rows;
5. write only the protocol object to stdout;
6. exit nonzero if generation cannot complete.

Keep rendering out of the adapter. A headless export should be faster and less
flaky than screenshot-driven testing. If an engine can only export a file,
write a small wrapper that emits that file's JSON contents to stdout.

## Tile semantics

```json
{
  "tiles": {
    "walkable": [".", "S", "E", "K", "D"],
    "blocked": ["#", "~"]
  }
}
```

When `walkable` is present, only those symbols enter the graph. Otherwise,
every symbol outside `blocked` is walkable. Prefer the explicit allowlist so a
new hazard symbol cannot silently become traversable.

Markers such as `S`, `E`, `K`, and `D` have no built-in meaning. Assertions
assign their meaning.

## Limits

Start with:

```json
{
  "limits": {
    "concurrency": 4,
    "timeoutMs": 2000,
    "maxWorldBytes": 1000000,
    "maxCells": 1000000,
    "repeats": 2,
    "maxFailures": 100
  }
}
```

Raise one limit only after measuring a valid slow or large seed. A timeout
increase can hide a generator performance regression; a byte increase can
make CI artifacts unexpectedly contain large proprietary worlds.

## Debug an adapter

Module:

```bash
node -e "import('./adapter.js').then(async m => console.log(JSON.stringify(await m.generate(42, {}), null, 2)))"
```

Command:

```bash
python tools/export_world.py --seed 42 --options "{}"
```

Then validate the captured object:

```bash
seed-sleuth validate world-42.json seed-sleuth.config.json
seed-sleuth replay seed-sleuth.config.json --seed 42
```

See [Troubleshooting](TROUBLESHOOTING.md) for exit-specific repair procedures.
