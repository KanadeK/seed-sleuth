import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve("site");
const portFlag = process.argv.indexOf("--port");
const port = portFlag === -1 ? 4173 : Number(process.argv[portFlag + 1]);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error("Usage: node scripts/serve-site.mjs [--port 1-65535]");
  process.exit(2);
}

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
    const filePath = path.resolve(root, relativePath);

    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    if (!(await stat(filePath)).isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(body);
  } catch (error) {
    const status = error?.code === "ENOENT" ? 404 : 500;
    response.writeHead(status).end(status === 404 ? "Not found" : "Server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SeedSleuth report: http://127.0.0.1:${port}`);
});
