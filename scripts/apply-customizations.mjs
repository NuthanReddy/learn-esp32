import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { newLessons, TOTAL_LESSONS } from "../site/library/lessons.js";

export function customize(name, text) {
  const replaceOnce = (before, after) => {
    if (text.includes(after)) return;
    assert.equal(text.split(before).length - 1, 1,
      `Upstream ${name} adapter changed: ${before.slice(0, 60)}`);
    text = text.replace(before, after);
  };
  if (name === "index.html") {
    assert(text.includes("</head>"), "Snapshot HTML has no head");
    text = text.replace(/\b\d+ free beginner lessons\./g, `${TOTAL_LESSONS} free beginner lessons.`);
    text = text.replace(/(<script type="application\/ld\+json">)(.*?)(<\/script>)/,
      (_, open, json, close) => {
        const metadata = JSON.parse(json);
        for (const lesson of newLessons) {
          if (!metadata.teaches.includes(lesson.heading)) metadata.teaches.push(lesson.heading);
        }
        return open + JSON.stringify(metadata) + close;
      });
    for (const lesson of newLessons) {
      if (!text.includes(`<b>${lesson.cardTitle}</b>`)) {
        assert(text.includes("</ol>"), "Snapshot has no non-JavaScript lesson list");
        text = text.replace("</ol>", `<li><b>${lesson.cardTitle}</b> — ${lesson.lede}</li></ol>`);
      }
    }
    if (!text.includes('href="./customizations.css"')) text = text.replace("</head>",
      '    <link rel="stylesheet" href="./customizations.css" />\n  </head>');
    if (!text.includes('href="./library/styles.css"')) text = text.replace("</head>",
      '    <link rel="stylesheet" href="./library/styles.css" />\n  </head>');
    return text;
  }
  if (/^assets\/index-.*\.js$/.test(name)) {
    if (!text.includes('from"../library/index.js"')) text =
      'import{newLessons,renderLibrarySchematic,installLibraryUI,installLibraryThumbnails}from"../library/index.js";' +
      'import{installAccessibility}from"../accessibility.js";\n' + text;
    // Upgrade the already-applied adapter without changing the snapshot body.
    replaceOnce('installLibraryUI}from"../library/index.js"',
      'installLibraryUI,installLibraryThumbnails}from"../library/index.js"');
    replaceOnce('sim:`stepper`}];function d(e)',
      'sim:`stepper`}];u.push(...newLessons);function d(e)');
    replaceOnce('function ht(e,t,n=420){',
      'function ht(e,t,n=420){if(e.library)return renderLibrarySchematic(e,t,n);');
    replaceOnce('mt=e=>typeof $e[e.id]==`function`',
      'mt=e=>e.library||typeof $e[e.id]==`function`');
    replaceOnce('state:U,setParam:On,inspector:J};let n=()=>',
      'state:U,setParam:On,inspector:J};installLibraryUI({app:window.__app,code:K});installAccessibility();let n=()=>');
    replaceOnce('.6+.38*e/t)})}catch(e)',
      '.6+.38*e/t)});installLibraryThumbnails()}catch(e)');
    replaceOnce('resetProgress:()=>{G.done.clear();try{localStorage.removeItem(`learn-esp32:done`)}catch{}G.paintDone(),Cn()}',
      'resetProgress:()=>{if(!window.confirm(x(`Reset progress`)+`?`))return;try{localStorage.removeItem(`learn-esp32:done`)}catch(e){K.log(x(`Error`)+`: `+e.message);return}G.done.clear();G.paintDone(),Cn()}');
    return text;
  }
  if (!/^assets\/stage-.*\.js$/.test(name)) return text;
  if (!text.includes('from"../library/scenes.js"')) text =
    'import{registerLibraryScenes,createLibrarySimulation}from"../library/scenes.js";\n' + text;
  assert(text.includes("Ji as ve") && text.includes("rr as cr"),
    "Upstream sphere/cylinder aliases changed; review required");
  if (text.includes("registerLibraryScenes(ru,iu,")) {
    replaceOnce('CanvasTexture:ye,sRGB:le,wire:Q});',
      'CanvasTexture:ye,sRGB:le,wire:Q,SphereGeometry:ve,CylinderGeometry:cr});');
  }
  replaceOnce(',au=e=>ru[e]?.boardButtons??null;',
    ';registerLibraryScenes(ru,iu,{Object3D:pt,Vector3:G,Mesh:Dn,BoxGeometry:_t,PlaneGeometry:R,Material:he,CanvasTexture:ye,sRGB:le,wire:Q,SphereGeometry:ve,CylinderGeometry:cr});var au=e=>ru[e]?.boardButtons??null;');
  replaceOnce('function xu(l,u){',
    'function xu(l,u){if(l.startsWith(`library:`))return createLibrarySimulation(l,u);');
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
