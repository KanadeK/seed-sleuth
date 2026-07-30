import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "./build.mjs";
import { findNpmCli, npmEnvironment } from "./npm-cli.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = path.join(root, "dist-release");
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);

function ensureInsideRoot(target) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to modify path outside repository: ${target}`);
  }
}

async function checksumFiles(directory) {
  const files = (await readdir(directory))
    .filter((name) => name !== "SHA256SUMS.txt")
    .sort();
  const lines = [];
  for (const name of files) {
    const digest = createHash("sha256")
      .update(await readFile(path.join(directory, name)))
      .digest("hex");
    lines.push(`${digest}  ${name}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function packageRelease() {
  ensureInsideRoot(output);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await buildSite();

  const npmCli = await findNpmCli();
  const packedOutput = execFileSync(
    process.execPath,
    [npmCli, "pack", "--json", "--pack-destination", output],
    {
      cwd: root,
      encoding: "utf8",
      env: npmEnvironment(root),
      windowsHide: true,
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  const packResult = JSON.parse(packedOutput);
  const packageFilename = packResult[0]?.filename;
  if (!packageFilename) {
    throw new Error("npm pack did not report an output filename.");
  }
  const archive = path.join(output, packageFilename);
  await copyFile(
    path.join(root, "site", "index.html"),
    path.join(output, `seed-sleuth-${packageJson.version}-demo.html`),
  );
  await copyFile(
    path.join(root, "site", "report.json"),
    path.join(output, `seed-sleuth-${packageJson.version}-demo-report.json`),
  );
  await writeFile(
    path.join(output, "SHA256SUMS.txt"),
    await checksumFiles(output),
    "utf8",
  );

  const smokeDirectory = await mkdtemp(path.join(os.tmpdir(), "seed-sleuth-package-"));
  try {
    await writeFile(
      path.join(smokeDirectory, "package.json"),
      '{"private":true}\n',
      "utf8",
    );
    execFileSync(
      process.execPath,
      [
        npmCli,
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--no-package-lock",
        archive,
      ],
      {
        cwd: smokeDirectory,
        env: npmEnvironment(root),
        stdio: "pipe",
        windowsHide: true,
      },
    );
    const installedBin = path.join(
      smokeDirectory,
      "node_modules",
      "seed-sleuth",
      "bin",
      "seed-sleuth.js",
    );
    const version = execFileSync(process.execPath, [installedBin, "--version"], {
      cwd: smokeDirectory,
      encoding: "utf8",
      env: npmEnvironment(root),
      windowsHide: true,
    }).trim();
    if (version !== packageJson.version) {
      throw new Error(
        `Installed package reported ${version}; expected ${packageJson.version}.`,
      );
    }
    execFileSync(
      process.execPath,
      [installedBin, "demo", "--out", path.join(smokeDirectory, "demo"), "--quiet"],
      {
        cwd: smokeDirectory,
        env: npmEnvironment(root),
        stdio: "pipe",
        windowsHide: true,
      },
    );
  } finally {
    await rm(smokeDirectory, { recursive: true, force: true });
  }

  process.stdout.write(
    `PASS package: ${packageFilename}, offline demo assets, checksums, clean-install smoke\n`,
  );
  return { output, archive };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await packageRelease();
}
