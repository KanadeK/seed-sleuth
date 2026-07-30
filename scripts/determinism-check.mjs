import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findNpmCli, npmEnvironment } from "./npm-cli.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCli = await findNpmCli();
const first = await mkdtemp(path.join(os.tmpdir(), "seed-sleuth-pack-a-"));
const second = await mkdtemp(path.join(os.tmpdir(), "seed-sleuth-pack-b-"));

function pack(destination) {
  execFileSync(
    process.execPath,
    [npmCli, "pack", "--silent", "--pack-destination", destination],
    {
      cwd: root,
      env: npmEnvironment(root),
      stdio: "pipe",
      windowsHide: true,
    },
  );
}

try {
  pack(first);
  await new Promise((resolve) => setTimeout(resolve, 2_100));
  pack(second);
  const firstName = (await readdir(first))[0];
  const secondName = (await readdir(second))[0];
  const firstBytes = await readFile(path.join(first, firstName));
  const secondBytes = await readFile(path.join(second, secondName));
  const firstHash = createHash("sha256").update(firstBytes).digest("hex");
  const secondHash = createHash("sha256").update(secondBytes).digest("hex");
  if (!firstBytes.equals(secondBytes)) {
    throw new Error(
      `npm package is nondeterministic: ${firstHash} != ${secondHash}`,
    );
  }
  process.stdout.write(
    `PASS deterministic package: ${firstHash} (${firstBytes.length} bytes)\n`,
  );
} finally {
  await Promise.all([
    rm(first, { recursive: true, force: true }),
    rm(second, { recursive: true, force: true }),
  ]);
}
