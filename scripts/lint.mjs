import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const ignoredDirectories = new Set([
  ".git",
  "coverage",
  "dist",
  "dist-release",
  "node_modules",
  "site",
  "tmp",
]);
const textExtensions = new Set([
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
const checkedNames = new Set([
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  "LICENSE",
  "Makefile",
]);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await walk(path.join(directory, entry.name))));
      }
    } else if (entry.isFile()) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

const failures = [];
const files = await walk(root);
let checked = 0;
for (const file of files) {
  const extension = path.extname(file).toLowerCase();
  if (!textExtensions.has(extension) && !checkedNames.has(path.basename(file))) {
    continue;
  }
  checked += 1;
  const relative = path.relative(root, file);
  const content = await readFile(file, "utf8");
  if (content.charCodeAt(0) === 0xfeff) {
    failures.push(`${relative}: UTF-8 BOM is not allowed`);
  }
  if (content.includes("\r")) {
    failures.push(`${relative}: CRLF found; repository text must use LF`);
  }
  if (!content.endsWith("\n")) {
    failures.push(`${relative}: missing final newline`);
  }
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (/[ \t]+$/.test(lines[index])) {
      failures.push(`${relative}:${index + 1}: trailing whitespace`);
    }
  }
  if ([".js", ".mjs", ".json", ".yml", ".yaml"].includes(extension)) {
    const tabLine = lines.findIndex((line) => line.includes("\t"));
    if (tabLine >= 0) {
      failures.push(`${relative}:${tabLine + 1}: tab indentation is not allowed`);
    }
  }
  if (extension === ".json") {
    try {
      JSON.parse(content);
    } catch (error) {
      failures.push(`${relative}: invalid JSON: ${error.message}`);
    }
  }
  if (extension === ".js" || extension === ".mjs") {
    try {
      execFileSync(process.execPath, ["--check", file], {
        cwd: root,
        stdio: "pipe",
        windowsHide: true,
      });
    } catch (error) {
      failures.push(
        `${relative}: syntax check failed: ${error.stderr?.toString().trim() ?? error.message}`,
      );
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`PASS lint: ${checked} text files and JavaScript syntax checked\n`);
}
