import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const snapshot = JSON.parse(await readFile("snapshot.json", "utf8"));
for (const file of snapshot.files) {
  const bytes = await readFile(path.join("site", ...file.path.split("/")));
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    file.publishedSha256, `Snapshot mismatch: ${file.path}`);
}
const html = await readFile("site/index.html", "utf8");
assert(!/(?:src|href)=["']\/(?!\/)/.test(html), "Host-root HTML asset");
assert(!html.includes(snapshot.source), "Original deployment metadata remains");
assert(html.includes("https://x.com/DilumSanjaya"), "Original author credit missing");
const entry = snapshot.files.find(file => /^assets\/index-.*\.js$/.test(file.path));
const js = await readFile(path.join("site", ...entry.path.split("/")), "utf8");
assert.equal([...js.matchAll(/cardTitle:`/g)].length, 20, "Expected 20 lessons");
assert(js.includes("document.baseURI).href"),
  "Vite preloads must resolve against the document, not the module directory");
const css = snapshot.files.find(file => /^assets\/index-.*\.css$/.test(file.path));
assert(!(await readFile(path.join("site", ...css.path.split("/")), "utf8"))
  .includes("/assets/"), "Host-root font URL");
const manifest = JSON.parse(await readFile("site/site.webmanifest", "utf8"));
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert(manifest.icons.every(icon => icon.src.startsWith("./")));
for (const name of ["three-LICENSE.txt", "barlow-OFL.txt",
  "barlow-semi-condensed-OFL.txt", "jetbrains-mono-OFL.txt"]) {
  assert((await readFile(`site/notices/${name}`, "utf8")).length > 100);
}
console.log(`Verified ${snapshot.files.length} snapshot assets, 20 lessons, Pages URLs and credits.`);
