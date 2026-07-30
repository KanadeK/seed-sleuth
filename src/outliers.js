function median(sorted) {
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function robustOutliers(results, metricNames, threshold = 4.5) {
  const byResult = new Map(results.map((result) => [result.index, []]));
  const baselines = {};

  for (const metric of metricNames) {
    const observations = results
      .filter((result) => typeof result.metrics?.[metric] === "number")
      .map((result) => ({ index: result.index, value: result.metrics[metric] }));
    const values = observations.map((item) => item.value).sort((a, b) => a - b);
    const center = median(values);
    if (center === null) {
      continue;
    }
    const deviations = values
      .map((value) => Math.abs(value - center))
      .sort((a, b) => a - b);
    const mad = median(deviations);
    baselines[metric] = { median: center, mad, threshold };

    if (!mad || mad === 0) {
      continue;
    }

    for (const observation of observations) {
      const robustZ = (0.6745 * (observation.value - center)) / mad;
      if (Math.abs(robustZ) >= threshold) {
        byResult.get(observation.index).push({
          metric,
          value: observation.value,
          median: center,
          mad,
          robustZ,
          direction: robustZ < 0 ? "low" : "high",
        });
      }
    }
  }

  return { byResult, baselines };
}
