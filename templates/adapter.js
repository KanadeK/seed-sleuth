export function generate(seed, options = {}) {
  const width = options.width ?? 9;
  const height = options.height ?? 7;
  const cells = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "#" : ".",
    ),
  );
  cells[1][1] = "S";
  cells[height - 2][width - 2] = "E";
  return {
    format: "seed-sleuth-world",
    schemaVersion: 1,
    seed,
    width,
    height,
    cells: cells.map((row) => row.join("")),
    metadata: { template: true },
  };
}
