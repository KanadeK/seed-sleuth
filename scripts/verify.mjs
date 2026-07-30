import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const steps = [
  ["lint", path.join(root, "scripts", "lint.mjs")],
  ["test", "--test"],
  ["demo", path.join(root, "scripts", "demo.mjs")],
  ["build", path.join(root, "scripts", "build.mjs")],
];

for (const [name, ...arguments_] of steps) {
  process.stdout.write(`\n== ${name} ==\n`);
  execFileSync(process.execPath, arguments_, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
}
process.stdout.write("\nPASS verify: lint, tests, real demo, and static build\n");
