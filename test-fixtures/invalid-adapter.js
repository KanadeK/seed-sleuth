export function generate(seed) {
  return {
    format: "seed-sleuth-world",
    schemaVersion: 1,
    seed,
    width: 5,
    height: 3,
    cells: ["#####", "#S.E#", "####"],
  };
}
