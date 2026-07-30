# Contract reference

Every assertion has a unique `id`, a `type`, and an optional `severity`.
Severity defaults to `error`.

```json
{
  "id": "exit-reachable",
  "type": "reachable",
  "from": "S",
  "to": "E",
  "severity": "error"
}
```

Supported severities are `info`, `warning`, and `error`. An assertion always
appears in the report when it fails. `--fail-on` controls which severities
change the process exit.

## Count

Require the number of one symbol or a symbol set:

```json
{ "id": "one-start", "type": "count", "symbol": "S", "eq": 1 }
```

```json
{
  "id": "two-or-more-loot-spawns",
  "type": "count",
  "symbols": ["L", "R"],
  "min": 2,
  "max": 12
}
```

Evidence contains the actual count and up to eight positions.

## Reachable

Flood from every `from` tile through configured walkable symbols:

```json
{
  "id": "all-exits-reachable",
  "type": "reachable",
  "from": "S",
  "to": "E"
}
```

The default requires every target to be reachable. Add `"mode": "any"` when at
least one target is sufficient. Missing source or target markers fail closed.

## Path distance

Bound the shortest walkable path between marker sets:

```json
{
  "id": "boss-not-on-spawn",
  "type": "pathDistance",
  "from": "S",
  "to": "B",
  "min": 18,
  "max": 160,
  "severity": "warning"
}
```

No path is always a failure. Evidence includes distance, endpoint counts, and
a bounded representative path.

## Connected

Bound the number of connected walkable components:

```json
{
  "id": "all-floor-connected",
  "type": "connected",
  "max": 1
}
```

Evidence contains descending component sizes. This assertion includes every
configured walkable tile, not only tiles reachable from `S`.

## Metric

Bound a numeric metric:

```json
{
  "id": "density-window",
  "type": "metric",
  "metric": "walkableRatio",
  "min": 0.18,
  "max": 0.55,
  "severity": "warning"
}
```

Available numeric metrics:

| Metric | Definition |
| --- | --- |
| `width`, `height`, `totalCells` | Grid dimensions and area. |
| `walkableCells`, `walkableRatio` | Walkable count and share of all cells. |
| `componentCount` | Number of four-neighbor walkable components. |
| `largestComponent`, `largestComponentRatio` | Largest component count and share of walkable cells. |
| `deadEnds`, `deadEndRatio` | Walkable cells with at most one walkable neighbor. |
| `borderWalkable` | Walkable cells on the outer edge. |
| `tileEntropy` | Shannon entropy of the complete tile-symbol distribution. |

An unknown metric fails closed and lists available numeric metrics.

## Border

Allow only specific symbols on the outer grid edge:

```json
{
  "id": "sealed-border",
  "type": "border",
  "allowedSymbols": ["#", "~"]
}
```

Evidence includes up to 16 breaches with symbol and coordinates.

## Minimum separation

Require a Manhattan distance between every pair in a marker set:

```json
{
  "id": "spawn-spacing",
  "type": "minimumSeparation",
  "symbols": ["S", "E"],
  "min": 12,
  "severity": "warning"
}
```

This ignores walls. Use `pathDistance` when traversal distance matters.

## Statistical outliers

Outliers are configured outside `assertions`:

```json
{
  "outliers": {
    "metrics": ["walkableRatio", "deadEndRatio", "tileEntropy"],
    "threshold": 4.5,
    "fail": false
  }
}
```

They identify unusual but not necessarily invalid seeds. With `fail: true`,
each outlier seed receives a `statistical-outlier` warning. Combine this with
`--fail-on warning` only after the baseline is stable enough for CI.
