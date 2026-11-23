import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("site");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".xml": "application/xml", ".txt": "text/plain", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const server = createServer(async (request, response) => {
  let relative;
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (!pathname.startsWith("/learn-esp32/")) {
      response.writeHead(404); response.end("Use /learn-esp32/"); return;
    }
    relative = pathname.slice("/learn-esp32/".length) || "index.html";
  } catch {
    response.writeHead(400); response.end("Invalid URL"); return;
  }
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) {
    response.writeHead(403); response.end("Outside site"); return;
  }
  try {
    const bytes = await readFile(target);
    response.writeHead(200, { "Content-Type": types[path.extname(target)] ?? "application/octet-stream",
      "Cache-Control": "no-store" });
    response.end(bytes);
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    response.writeHead(error.code === "ENOENT" ? 404 : 500);
    response.end("Cannot read site resource");
  }
});
server.listen(Number(process.env.PORT ?? 8080), "127.0.0.1", () =>
  console.log(`Serving http://127.0.0.1:${server.address().port}/learn-esp32/`));
