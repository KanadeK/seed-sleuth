import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { writeReports } from "../src/report.js";
import { sweep } from "../src/runner.js";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const site = path.join(root, "site");

function ensureInsideRoot(target) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to modify path outside repository: ${target}`);
  }
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile() && entry.name !== "manifest.json") {
      files.push(fullPath);
    }
  }
  return files;
}

export async function buildSite() {
  ensureInsideRoot(site);
  await rm(site, { recursive: true, force: true });
  await mkdir(site, { recursive: true });

  const priorEpoch = process.env.SOURCE_DATE_EPOCH;
  process.env.SOURCE_DATE_EPOCH = "1785369600";
  try {
    const faulty = await loadConfig(
      path.join(root, "examples", "dungeon", "faulty.config.json"),
    );
    const healthy = await loadConfig(
      path.join(root, "examples", "dungeon", "healthy.config.json"),
    );
    const [faultyReport, healthyReport] = await Promise.all([
      sweep(faulty),
      sweep(healthy),
    ]);
    if (faultyReport.summary.failed === 0 || faultyReport.summary.adapterErrors > 0) {
      throw new Error("Faulty demo did not produce the expected contract evidence.");
    }
    if (healthyReport.summary.failed > 0 || healthyReport.summary.adapterErrors > 0) {
      throw new Error("Healthy demo failed its contract.");
    }

    const faultyFiles = await writeReports(faultyReport, site);
    await copyFile(faultyFiles.html, path.join(site, "index.html"));
    const healthyFiles = await writeReports(
      healthyReport,
      path.join(site, "healthy"),
    );
    await copyFile(healthyFiles.html, path.join(site, "healthy.html"));
  } finally {
    if (priorEpoch === undefined) {
      delete process.env.SOURCE_DATE_EPOCH;
    } else {
      process.env.SOURCE_DATE_EPOCH = priorEpoch;
    }
  }

  const files = (await listFiles(site)).sort();
  const manifest = {};
  for (const file of files) {
    manifest[path.relative(site, file).replaceAll("\\", "/")] = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
  }
  await writeFile(
    path.join(site, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`PASS build: ${files.length} static site files in ${site}\n`);
  return { site, manifest };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await buildSite();
}
