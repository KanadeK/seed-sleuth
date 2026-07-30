const seed = Number(process.argv[2]);
const world = {
  format: "seed-sleuth-world",
  schemaVersion: 1,
  seed,
  width: 5,
  height: 5,
  cells: ["#####", "#S..#", "#.#.#", "#..E#", "#####"],
};

process.stdout.write(JSON.stringify(world));
