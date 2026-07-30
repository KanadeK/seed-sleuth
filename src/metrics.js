import {
  cardinalNeighbors,
  keyOf,
  parseKey,
  positionsForSymbols,
  tileAt,
} from "./world.js";

export function resolveWalkableSet(world, tiles = {}) {
  if (Array.isArray(tiles.walkable) && tiles.walkable.length > 0) {
    return new Set(tiles.walkable);
  }
  const blocked = new Set(tiles.blocked ?? ["#"]);
  const walkable = new Set();
  for (const row of world.cells) {
    for (const symbol of Array.from(row)) {
      if (!blocked.has(symbol)) {
        walkable.add(symbol);
      }
    }
  }
  return walkable;
}

export function tileCounts(world) {
  const counts = {};
  for (const row of world.cells) {
    for (const symbol of Array.from(row)) {
      counts[symbol] = (counts[symbol] ?? 0) + 1;
    }
  }
  return counts;
}

export function flood(world, starts, walkableSet) {
  const queue = [];
  const distance = new Map();
  const previous = new Map();

  for (const start of starts) {
    if (!walkableSet.has(tileAt(world, start.x, start.y))) {
      continue;
    }
    const key = keyOf(start.x, start.y);
    if (!distance.has(key)) {
      distance.set(key, 0);
      queue.push(start);
    }
  }

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const currentKey = keyOf(current.x, current.y);
    for (const neighbor of cardinalNeighbors(world, current.x, current.y)) {
      if (!walkableSet.has(tileAt(world, neighbor.x, neighbor.y))) {
        continue;
      }
      const neighborKey = keyOf(neighbor.x, neighbor.y);
      if (distance.has(neighborKey)) {
        continue;
      }
      distance.set(neighborKey, distance.get(currentKey) + 1);
      previous.set(neighborKey, currentKey);
      queue.push(neighbor);
    }
  }

  return { distance, previous };
}

export function shortestPath(world, fromSymbols, toSymbols, walkableSet) {
  const starts = positionsForSymbols(world, fromSymbols);
  const targets = positionsForSymbols(world, toSymbols);
  const targetKeys = new Set(targets.map((position) => keyOf(position.x, position.y)));
  const { distance, previous } = flood(world, starts, walkableSet);

  let bestKey = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const targetKey of targetKeys) {
    const candidate = distance.get(targetKey);
    if (candidate !== undefined && candidate < bestDistance) {
      bestKey = targetKey;
      bestDistance = candidate;
    }
  }

  if (bestKey === null) {
    return {
      distance: null,
      path: [],
      reachableTargets: targets.filter((target) =>
        distance.has(keyOf(target.x, target.y)),
      ).length,
      targetCount: targets.length,
      startCount: starts.length,
    };
  }

  const path = [];
  let cursor = bestKey;
  while (cursor) {
    path.push(parseKey(cursor));
    cursor = previous.get(cursor);
  }
  path.reverse();

  return {
    distance: bestDistance,
    path,
    reachableTargets: targets.filter((target) =>
      distance.has(keyOf(target.x, target.y)),
    ).length,
    targetCount: targets.length,
    startCount: starts.length,
  };
}

export function connectedComponents(world, walkableSet) {
  const unvisited = new Set();
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (walkableSet.has(tileAt(world, x, y))) {
        unvisited.add(keyOf(x, y));
      }
    }
  }

  const sizes = [];
  while (unvisited.size > 0) {
    const first = unvisited.values().next().value;
    const queue = [parseKey(first)];
    unvisited.delete(first);
    let size = 0;

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      size += 1;
      for (const neighbor of cardinalNeighbors(world, current.x, current.y)) {
        const neighborKey = keyOf(neighbor.x, neighbor.y);
        if (
          unvisited.has(neighborKey) &&
          walkableSet.has(tileAt(world, neighbor.x, neighbor.y))
        ) {
          unvisited.delete(neighborKey);
          queue.push(neighbor);
        }
      }
    }
    sizes.push(size);
  }

  sizes.sort((left, right) => right - left);
  return sizes;
}

function entropyFromCounts(counts, total) {
  if (total === 0) {
    return 0;
  }
  let entropy = 0;
  for (const count of Object.values(counts)) {
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

export function analyzeWorld(world, tiles = {}) {
  const walkableSet = resolveWalkableSet(world, tiles);
  const counts = tileCounts(world);
  const totalCells = world.width * world.height;
  const walkableCells = [...walkableSet].reduce(
    (sum, symbol) => sum + (counts[symbol] ?? 0),
    0,
  );
  const components = connectedComponents(world, walkableSet);
  let deadEnds = 0;
  let borderWalkable = 0;

  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (!walkableSet.has(tileAt(world, x, y))) {
        continue;
      }
      const walkableNeighbors = cardinalNeighbors(world, x, y).filter((neighbor) =>
        walkableSet.has(tileAt(world, neighbor.x, neighbor.y)),
      ).length;
      if (walkableNeighbors <= 1) {
        deadEnds += 1;
      }
      if (x === 0 || y === 0 || x === world.width - 1 || y === world.height - 1) {
        borderWalkable += 1;
      }
    }
  }

  return {
    width: world.width,
    height: world.height,
    totalCells,
    walkableCells,
    walkableRatio: totalCells === 0 ? 0 : walkableCells / totalCells,
    componentCount: components.length,
    largestComponent: components[0] ?? 0,
    largestComponentRatio:
      walkableCells === 0 ? 0 : (components[0] ?? 0) / walkableCells,
    deadEnds,
    deadEndRatio: walkableCells === 0 ? 0 : deadEnds / walkableCells,
    borderWalkable,
    tileEntropy: entropyFromCounts(counts, totalCells),
    tileCounts: counts,
  };
}
