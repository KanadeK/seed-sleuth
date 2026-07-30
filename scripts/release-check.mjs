import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findNpmCli, npmEnvironment } from "./npm-cli.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const allowUntagged = process.argv.includes("--allow-untagged");
const failures = [];

function fail(message) {
  failures.push(message);
}

function git(arguments_) {
  return execFileSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const version = packageJson.version;
const constants = await readFile(path.join(root, "src", "constants.js"), "utf8");
const changelog = await readFile(path.join(root, "CHANGELOG.md"), "utf8");
const citation = await readFile(path.join(root, "CITATION.cff"), "utf8");
const readme = await readFile(path.join(root, "README.md"), "utf8");

if (!constants.includes(`export const VERSION = "${version}"`)) {
  fail("src/constants.js version does not match package.json");
}
if (!changelog.includes(`## [${version}]`)) {
  fail("CHANGELOG.md has no current version heading");
}
if (!citation.includes(`version: ${version}`)) {
  fail("CITATION.cff version does not match package.json");
}
if (!readme.includes(`/v${version}/seed-sleuth-${version}.tgz`)) {
  fail("README install command does not match current release version");
}

try {
  if (git(["status", "--porcelain", "--untracked-files=all"]) !== "") {
    fail("Git working tree is not clean");
  }
  const tag = `v${version}`;
  const tagsAtHead = git(["tag", "--points-at", "HEAD"])
    .split(/\r?\n/)
    .filter(Boolean);
  if (!allowUntagged && !tagsAtHead.includes(tag)) {
    fail(`HEAD is not tagged ${tag}`);
  }
  const log = git(["log", "--format=%B"]);
  if (/^Co-authored-by:/im.test(log)) {
    fail("Git history contains a Co-authored-by trailer");
  }
  const identity = git([
    "show",
    "-s",
    "--format=%an%x00%ae%x00%cn%x00%ce",
    "HEAD",
  ]).split("\0");
  const expected = [
    "KanadeK",
    "121669563+KanadeK@users.noreply.github.com",
    "KanadeK",
    "121669563+KanadeK@users.noreply.github.com",
  ];
  if (identity.length !== 4 || identity.some((value, index) => value !== expected[index])) {
    fail(`HEAD author/committer identity is unexpected: ${identity.join(" | ")}`);
  }
} catch (error) {
  fail(`Git verification failed: ${error.message}`);
}

const releaseDirectory = path.join(root, "dist-release");
const expectedAssets = [
  "SHA256SUMS.txt",
  `seed-sleuth-${version}.tgz`,
  `seed-sleuth-${version}-demo.html`,
  `seed-sleuth-${version}-demo-report.json`,
];
let releaseFiles = [];
try {
  releaseFiles = await readdir(releaseDirectory);
  for (const expected of expectedAssets) {
    if (!releaseFiles.includes(expected)) {
      fail(`Missing release asset: ${expected}`);
    }
  }
  const checksumText = await readFile(
    path.join(releaseDirectory, "SHA256SUMS.txt"),
    "utf8",
  );
  const checksumLines = checksumText.trim().split(/\r?\n/);
  const checksummedNames = new Set();
  for (const line of checksumLines) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match) {
      fail(`Invalid checksum line: ${line}`);
      continue;
    }
    const [, expectedHash, name] = match;
    checksummedNames.add(name);
    try {
      const actualHash = sha256(await readFile(path.join(releaseDirectory, name)));
      if (actualHash !== expectedHash) {
        fail(`Checksum mismatch for ${name}`);
      }
    } catch (error) {
      fail(`Cannot verify checksummed asset ${name}: ${error.message}`);
    }
  }
  for (const name of releaseFiles.filter((item) => item !== "SHA256SUMS.txt")) {
    if (!checksummedNames.has(name)) {
      fail(`Release asset is absent from SHA256SUMS.txt: ${name}`);
    }
  }
} catch (error) {
  fail(`Release asset verification failed: ${error.message}`);
}

try {
  const npmCli = await findNpmCli();
  const dryRun = JSON.parse(
    execFileSync(
      process.execPath,
      [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: root,
        encoding: "utf8",
        env: npmEnvironment(root),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );
  const packedPaths = new Set(dryRun[0].files.map((file) => file.path));
  const requiredPaths = [
    "action.yml",
    "action/index.js",
    "bin/seed-sleuth.js",
    "examples/dungeon/adapter.js",
    "schemas/config.schema.json",
    "src/runner.js",
    "templates/adapter.js",
  ];
  for (const required of requiredPaths) {
    if (!packedPaths.has(required)) {
      fail(`npm archive would omit required file: ${required}`);
    }
  }
  for (const packedPath of packedPaths) {
    if (
      packedPath.startsWith("test/") ||
      packedPath.startsWith("test-fixtures/") ||
      packedPath.startsWith("scripts/")
    ) {
      fail(`npm archive unexpectedly contains development file: ${packedPath}`);
    }
  }
} catch (error) {
  fail(`npm archive inspection failed: ${error.message}`);
}

try {
  const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  const secretPatterns = [
    new RegExp(["gh", "p_"].join("") + "[A-Za-z0-9]{30,}"),
    new RegExp(["github", "_pat_"].join("") + "[A-Za-z0-9_]{30,}"),
    /AKIA[A-Z0-9]{16}/,
    new RegExp(["BEGIN ", "PRIVATE KEY"].join("")),
  ];
  const textExtensions = new Set([
    "",
    ".cff",
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".svg",
    ".txt",
    ".yaml",
    ".yml",
  ]);
  for (const name of tracked) {
    if (!textExtensions.has(path.extname(name).toLowerCase())) {
      continue;
    }
    const content = await readFile(path.join(root, name), "utf8");
    if (secretPatterns.some((pattern) => pattern.test(content))) {
      fail(`Potential secret material found in ${name}`);
    }
  }
} catch (error) {
  fail(`Tracked-file secret scan failed: ${error.message}`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.map((item) => `FAIL ${item}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  const contributors = git(["shortlog", "-sne", "HEAD"]);
  process.stdout.write(
    `PASS release check: v${version}, clean tree, identities, package contents, ${releaseFiles.length} assets, checksums, and secret scan\n`,
  );
  process.stdout.write(`contributors:\n${contributors}\n`);
}
