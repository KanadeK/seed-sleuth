import {
  analyzeWorld,
  connectedComponents,
  flood,
  resolveWalkableSet,
  shortestPath,
} from "./metrics.js";
import { keyOf, positionsForSymbols, tileAt } from "./world.js";

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "");
}

function compareBounds(actual, assertion) {
  if (assertion.eq !== undefined && actual !== assertion.eq) {
    return `expected ${formatNumber(assertion.eq)}, got ${formatNumber(actual)}`;
  }
  if (assertion.min !== undefined && actual < assertion.min) {
    return `expected >= ${formatNumber(assertion.min)}, got ${formatNumber(actual)}`;
  }
  if (assertion.max !== undefined && actual > assertion.max) {
    return `expected <= ${formatNumber(assertion.max)}, got ${formatNumber(actual)}`;
  }
  return null;
}

function violation(assertion, message, evidence = {}) {
  return {
    id: assertion.id,
    type: assertion.type,
    severity: assertion.severity ?? "error",
    message,
    evidence,
  };
}

function evaluateCount(world, assertion) {
  const symbols = assertion.symbols ?? [assertion.symbol];
  const positions = positionsForSymbols(world, symbols);
  const mismatch = compareBounds(positions.length, assertion);
  return mismatch
    ? violation(assertion, `Tile count ${mismatch}.`, {
        symbols,
        actual: positions.length,
        sample: positions.slice(0, 8),
      })
    : null;
}

function evaluateReachable(world, assertion, walkableSet) {
  const starts = positionsForSymbols(world, assertion.from);
  const targets = positionsForSymbols(world, assertion.to);
  if (starts.length === 0 || targets.length === 0) {
    return violation(assertion, "Reachability endpoints are missing.", {
      from: assertion.from,
      to: assertion.to,
      startCount: starts.length,
      targetCount: targets.length,
    });
  }

  const { distance } = flood(world, starts, walkableSet);
  const unreachable = targets.filter(
    (target) => !distance.has(keyOf(target.x, target.y)),
  );
  const passes =
    assertion.mode === "any"
      ? unreachable.length < targets.length
      : unreachable.length === 0;
  return passes
    ? null
    : violation(
        assertion,
        assertion.mode === "any"
          ? `No "${assertion.to}" tile is reachable from "${assertion.from}".`
          : `${unreachable.length} of ${targets.length} "${assertion.to}" tile(s) are unreachable from "${assertion.from}".`,
        {
          from: assertion.from,
          to: assertion.to,
          unreachable: unreachable.slice(0, 12),
        },
      );
}

function evaluatePathDistance(world, assertion, walkableSet) {
  const result = shortestPath(world, assertion.from, assertion.to, walkableSet);
  if (result.distance === null) {
    return violation(
      assertion,
      `No path exists from "${assertion.from}" to "${assertion.to}".`,
      result,
    );
  }
  const mismatch = compareBounds(result.distance, assertion);
  return mismatch
    ? violation(assertion, `Shortest path ${mismatch}.`, {
        ...result,
        path: result.path.slice(0, 40),
      })
    : null;
}

function evaluateConnected(world, assertion, walkableSet) {
  const components = connectedComponents(world, walkableSet);
  const expectedMaximum = assertion.max ?? 1;
  if (components.length <= expectedMaximum) {
    return null;
  }
  return violation(
    assertion,
    `Walkable space has ${components.length} components; expected <= ${expectedMaximum}.`,
    { componentSizes: components.slice(0, 12) },
  );
}

function evaluateMetric(metrics, assertion) {
  const actual = metrics[assertion.metric];
  if (typeof actual !== "number") {
    return violation(assertion, `Unknown numeric metric "${assertion.metric}".`, {
      availableMetrics: Object.keys(metrics).filter(
        (key) => typeof metrics[key] === "number",
      ),
    });
  }
  const mismatch = compareBounds(actual, assertion);
  return mismatch
    ? violation(assertion, `Metric "${assertion.metric}" ${mismatch}.`, {
        metric: assertion.metric,
        actual,
      })
    : null;
}

function evaluateBorder(world, assertion) {
  const allowed = new Set(assertion.allowedSymbols ?? ["#"]);
  const breaches = [];
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (x !== 0 && y !== 0 && x !== world.width - 1 && y !== world.height - 1) {
        continue;
      }
      const symbol = tileAt(world, x, y);
      if (!allowed.has(symbol)) {
        breaches.push({ x, y, symbol });
      }
    }
  }
  return breaches.length > 0
    ? violation(
        assertion,
        `${breaches.length} border tile(s) are outside the allowed set.`,
        { allowedSymbols: [...allowed], breaches: breaches.slice(0, 16) },
      )
    : null;
}

function evaluateMinimumSeparation(world, assertion) {
  const positions = positionsForSymbols(world, assertion.symbols ?? assertion.symbol);
  let minimum = Number.POSITIVE_INFINITY;
  let pair = null;
  for (let left = 0; left < positions.length; left += 1) {
    for (let right = left + 1; right < positions.length; right += 1) {
      const distance =
        Math.abs(positions[left].x - positions[right].x) +
        Math.abs(positions[left].y - positions[right].y);
      if (distance < minimum) {
        minimum = distance;
        pair = [positions[left], positions[right]];
      }
    }
  }
  if (positions.length < 2) {
    minimum = Number.POSITIVE_INFINITY;
  }
  if (minimum >= assertion.min) {
    return null;
  }
  return violation(
    assertion,
    `Minimum Manhattan separation is ${minimum}; expected >= ${assertion.min}.`,
    { pair, actual: minimum },
  );
}

const evaluators = {
  border: evaluateBorder,
  connected: evaluateConnected,
  count: evaluateCount,
  metric: evaluateMetric,
  minimumSeparation: evaluateMinimumSeparation,
  pathDistance: evaluatePathDistance,
  reachable: evaluateReachable,
};

export function evaluateAssertions(world, assertions, tiles = {}) {
  const metrics = analyzeWorld(world, tiles);
  const walkableSet = resolveWalkableSet(world, tiles);
  const violations = [];

  for (const assertion of assertions) {
    const evaluator = evaluators[assertion.type];
    if (!evaluator) {
      violations.push(
        violation(assertion, `Unsupported assertion type "${assertion.type}".`),
      );
      continue;
    }

    let result;
    if (assertion.type === "metric") {
      result = evaluator(metrics, assertion);
    } else if (
      assertion.type === "reachable" ||
      assertion.type === "pathDistance" ||
      assertion.type === "connected"
    ) {
      result = evaluator(world, assertion, walkableSet);
    } else {
      result = evaluator(world, assertion);
    }
    if (result) {
      violations.push(result);
    }
  }

  return { metrics, violations };
}
