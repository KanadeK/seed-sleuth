import { access } from "node:fs/promises";
import path from "node:path";

export async function findNpmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    path.resolve(
      path.dirname(process.execPath),
      "..",
      "lib",
      "node_modules",
      "npm",
      "bin",
      "npm-cli.js",
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next standard npm installation layout.
    }
  }
  throw new Error(
    "Could not locate npm-cli.js. Run this command through `npm run ...` or install npm.",
  );
}

export function npmEnvironment(root) {
  return {
    ...process.env,
    npm_config_audit: "false",
    npm_config_cache: path.join(root, "tmp", "npm-cache"),
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
  };
}
