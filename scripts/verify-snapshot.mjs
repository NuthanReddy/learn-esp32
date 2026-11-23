import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { newLessons } from "../site/library/lessons.js";
import { customize } from "./apply-customizations.mjs";

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
assert(html.includes('href="./customizations.css"'), "Layout stylesheet missing");
assert(html.includes('href="./library/styles.css"'), "Library stylesheet missing");
assert(!html.includes("20 free beginner lessons."), "Stale lesson metadata");
const metadata = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
assert.equal(metadata.teaches.length, 24);
assert.equal([...html.matchAll(/<li><b>\d+\./g)].length, 24, "Noscript lessons");
assert((await readFile("site/customizations.css", "utf8")).length > 100);
const entry = snapshot.files.find(file => /^assets\/index-.*\.js$/.test(file.path));
const js = await readFile(path.join("site", ...entry.path.split("/")), "utf8");
assert.equal([...js.matchAll(/cardTitle:`/g)].length, 20, "Expected 20 lessons");
assert.equal(newLessons.length, 4);
for (const lesson of newLessons) {
  assert((await readFile(`site/library/thumbnails/${lesson.id}.png`)).length > 1024,
    `Missing/empty ${lesson.id} 3D thumbnail`);
}
assert(js.includes("u.push(...newLessons)"), "Additional lessons not registered");
assert(js.includes("installAccessibility()"), "Skip navigation missing");
assert(js.includes("window.confirm(x(`Reset progress`)+`?`)"), "Unsafe progress reset");
assert.equal(customize(entry.path, js), js, "Main adapter is not idempotent");
assert(js.includes("document.baseURI).href"),
  "Vite preloads must resolve against the document, not the module directory");
const stage = snapshot.files.find(file => /^assets\/stage-.*\.js$/.test(file.path));
const stageJS = await readFile(path.join("site", ...stage.path.split("/")), "utf8");
assert(stageJS.includes("zoom:Math.max(3.2,t.zoom*.9)") &&
  stageJS.includes("zoom:Math.max(3.2,c*.9)"), "Reduced home camera framing missing");
assert(stageJS.includes("registerLibraryScenes(ru,iu,"), "Library scenes missing");
assert(stageJS.includes("return createLibrarySimulation(l,u)"), "Simulation dispatcher missing");
assert.equal(customize(stage.path, stageJS), stageJS, "Stage adapter is not idempotent");
assert.equal(customize("index.html", html), html, "HTML adapter is not idempotent");
for (const file of ["index.js", "lessons.js", "scenes.js", "schematics.js",
  "simulations.js", "styles.css"]) assert((await readFile(`site/library/${file}`, "utf8")).length > 100);
const robots = await readFile("site/robots.txt", "utf8");
assert(robots.includes(`Sitemap: ${snapshot.destination}sitemap.xml`));
assert(robots.includes("Allow: /learn-esp32/"));
const sitemap = await readFile("site/sitemap.xml", "utf8");
assert(sitemap.includes(`<loc>${snapshot.destination}</loc>`));
assert(!sitemap.includes(snapshot.source));
const refresh = await readFile("scripts/snapshot.mjs", "utf8");
assert(refresh.includes('new URL("robots.txt", source)') &&
  refresh.includes('new URL("sitemap.xml", source)'), "Discovery files not refreshed");
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
console.log(`Verified ${snapshot.files.length} snapshot assets, 24 lessons, guarded adapters, discovery URLs and credits.`);
