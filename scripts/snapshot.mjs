import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { customize } from "./apply-customizations.mjs";

const source = "https://learn-esp32.vercel.app/";
const destination = "https://nuthanreddy.github.io/learn-esp32/";
const queue = [new URL(source), new URL("robots.txt", source), new URL("sitemap.xml", source)];
const seen = new Set();
const files = [];
const resource = /\.(?:js|css|json|webmanifest|woff2?|ttf|ico|svg|png|jpe?g|webp|gif|glb|gltf|bin|hdr|exr|mp3|wav)(?:[?#].*)?$/i;

while (queue.length) {
  const url = queue.shift();
  if (seen.has(url.href)) continue;
  seen.add(url.href);
  if (url.origin !== new URL(source).origin) {
    throw new Error(`External application asset requires review: ${url.href}`);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${url.href}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  if (name.includes("..")) throw new Error(`Invalid resource path: ${name}`);
  let output = bytes;
  if (/\.(html|js|css|json|webmanifest|xml|txt)$/.test(name)) {
    let text = bytes.toString("utf8");
    const references = [
      ...text.matchAll(/(?:src|href)=["']([^"']+)["']/g),
      ...text.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g),
      ...text.matchAll(/["'`]([^"'`\s<>]+)["'`]/g),
    ];
    for (const match of references) {
      const value = match[1];
      if (!resource.test(value) || value.startsWith("data:") ||
          /^\.[a-z0-9]+$/i.test(value)) continue;
      // Vite's dependency table is relative to the deployment root.
      const base = value.startsWith("assets/") ? source : url;
      queue.push(new URL(value, base));
    }
    if (name === "robots.txt") {
      text = `# Project-scoped discovery file; only /robots.txt at the host root controls crawling.\nUser-agent: *\nAllow: /learn-esp32/\nSitemap: ${destination}sitemap.xml\n`;
    } else if (name === "sitemap.xml") {
      // The application uses fragment lesson routes: only its canonical page
      // is a distinct crawlable URL, including the local additions.
      text = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${destination}</loc></url>\n</urlset>\n`;
    } else if (name === "index.html") {
      text = text.replaceAll(source, destination)
        .replaceAll('href="/', 'href="./').replaceAll('src="/', 'src="./');
    } else if (name.endsWith(".css")) {
      text = text.replaceAll("/assets/", "./");
    } else if (name.endsWith(".js")) {
      // Vite preloads must resolve under the project Pages path, not the host root.
      text = text.replace(/([`"'])\/assets\//g, "$1./assets/");
      text = text.replace(/return([`"'])\/\1\s*\+\s*([a-zA-Z_$][\w$]*)/g,
        "return new URL($2,document.baseURI).href");
    } else if (name.endsWith(".webmanifest")) {
      const manifest = JSON.parse(text);
      for (const icon of manifest.icons ?? []) {
        if (icon.src.startsWith("/")) icon.src = `.${icon.src}`;
      }
      manifest.start_url = "./";
      manifest.scope = "./";
      text = JSON.stringify(manifest, null, 2) + "\n";
    }
    output = Buffer.from(customize(name, text));
  }
  const target = path.join("site", ...name.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, output);
  files.push({
    path: name,
    source: url.href,
    originalSha256: createHash("sha256").update(bytes).digest("hex"),
    publishedSha256: createHash("sha256").update(output).digest("hex"),
  });
  console.log(`${name}: ${output.length} bytes`);
}
await writeFile("site/.nojekyll", "");
await writeFile("snapshot.json", JSON.stringify({
  source, destination, capturedAt: new Date().toISOString(), files,
}, null, 2) + "\n");
