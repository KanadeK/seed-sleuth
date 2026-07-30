import { byteLength } from "./canonical.js";
import { DEFAULT_LIMITS, WORLD_FORMAT, WORLD_SCHEMA_VERSION } from "./constants.js";

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${label} must be a safe integer >= ${minimum}.`);
  }
}

export function validateWorld(input, limits = {}) {
  assertPlainObject(input, "World");
  const maxCells = limits.maxCells ?? DEFAULT_LIMITS.maxCells;
  const maxWorldBytes = limits.maxWorldBytes ?? DEFAULT_LIMITS.maxWorldBytes;

  const width = input.width;
  const height = input.height;
  assertInteger(width, "world.width", 1);
  assertInteger(height, "world.height", 1);

  if (width * height > maxCells) {
    throw new RangeError(
      `World has ${width * height} cells, exceeding limits.maxCells (${maxCells}).`,
    );
  }

  if (!Array.isArray(input.cells) || input.cells.length !== height) {
    throw new TypeError(`world.cells must contain exactly ${height} row strings.`);
  }

  const cells = input.cells.map((row, y) => {
    if (typeof row !== "string") {
      throw new TypeError(`world.cells[${y}] must be a string.`);
    }
    const symbols = Array.from(row);
    if (symbols.length !== width) {
      throw new TypeError(
        `world.cells[${y}] has ${symbols.length} symbols; expected width ${width}.`,
      );
    }
    return symbols.join("");
  });

  const normalized = {
    format: input.format ?? WORLD_FORMAT,
    schemaVersion: input.schemaVersion ?? WORLD_SCHEMA_VERSION,
    seed: input.seed ?? null,
    width,
    height,
    cells,
  };

  if (normalized.format !== WORLD_FORMAT) {
    throw new TypeError(`world.format must be "${WORLD_FORMAT}".`);
  }
  if (normalized.schemaVersion !== WORLD_SCHEMA_VERSION) {
    throw new TypeError(`world.schemaVersion must be ${WORLD_SCHEMA_VERSION}.`);
  }
  if (
    normalized.seed !== null &&
    normalized.seed !== undefined &&
    !Number.isSafeInteger(normalized.seed)
  ) {
    throw new TypeError("world.seed must be a safe integer or null.");
  }

  if (input.metadata !== undefined) {
    assertPlainObject(input.metadata, "world.metadata");
    normalized.metadata = structuredClone(input.metadata);
  }

  const size = byteLength(normalized);
  if (size > maxWorldBytes) {
    throw new RangeError(
      `World serializes to ${size} bytes, exceeding limits.maxWorldBytes (${maxWorldBytes}).`,
    );
  }

  return normalized;
}

export function worldRows(world) {
  return world.cells.map((row) => Array.from(row));
}

export function tileAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) {
    return undefined;
  }
  return Array.from(world.cells[y])[x];
}

export function keyOf(x, y) {
  return `${x},${y}`;
}

export function parseKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function cardinalNeighbors(world, x, y) {
  const candidates = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  return candidates.filter(
    (position) =>
      position.x >= 0 &&
      position.y >= 0 &&
      position.x < world.width &&
      position.y < world.height,
  );
}

export function positionsForSymbols(world, symbols) {
  const wanted = new Set(Array.isArray(symbols) ? symbols : [symbols]);
  const positions = [];
  for (let y = 0; y < world.height; y += 1) {
    const row = Array.from(world.cells[y]);
    for (let x = 0; x < world.width; x += 1) {
      if (wanted.has(row[x])) {
        positions.push({ x, y, symbol: row[x] });
      }
    }
  }
  return positions;
}
