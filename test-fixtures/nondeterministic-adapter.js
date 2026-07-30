let callCount = 0;

export function generate(seed) {
  callCount += 1;
  const middle = callCount % 2 === 0 ? "#...#" : "#.#.#";
  return {
    format: "seed-sleuth-world",
    schemaVersion: 1,
    seed,
    width: 5,
    height: 5,
    cells: ["#####", "#S..#", middle, "#..E#", "#####"],
  };
}
