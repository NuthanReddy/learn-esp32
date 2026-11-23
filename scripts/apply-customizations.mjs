import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function customize(name, text) {
  if (name === "index.html" && !text.includes('href="./customizations.css"')) {
    assert(text.includes("</head>"), "Snapshot HTML has no head");
    return text.replace("</head>",
      '    <link rel="stylesheet" href="./customizations.css" />\n  </head>');
  }
  if (!/^assets\/stage-.*\.js$/.test(name)) return text;
  const methods = [...text.matchAll(/lessonView\(e\)\{[\s\S]*?\}isHome\(\)/g)];
  assert.equal(methods.length, 1, "Upstream camera method changed; review required");
  const method = methods[0][0];
  if (method.includes("zoom:Math.max(3.2,t.zoom*.9)") &&
      method.includes("zoom:Math.max(3.2,c*.9)")) return text;
  assert.equal([...method.matchAll(/zoom:t\.zoom,/g)].length, 1);
  assert.equal([...method.matchAll(/zoom:c\}/g)].length, 1);
  // Change the home baseline, not saved per-lesson zoom or user controls.
  const updated = method.replace("zoom:t.zoom,", "zoom:Math.max(3.2,t.zoom*.9),")
    .replace("zoom:c}", "zoom:Math.max(3.2,c*.9)}");
  return text.replace(method, updated);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const snapshot = JSON.parse(await readFile("snapshot.json", "utf8"));
  for (const file of snapshot.files) {
    if (!/\.(html|js)$/.test(file.path)) continue;
    const target = path.join("site", ...file.path.split("/"));
    const text = await readFile(target, "utf8");
    const updated = customize(file.path, text);
    if (updated === text) continue;
    await writeFile(target, updated);
    file.publishedSha256 = createHash("sha256").update(updated).digest("hex");
    console.log(`Customized ${file.path}`);
  }
  await writeFile("snapshot.json", JSON.stringify(snapshot, null, 2) + "\n");
}
