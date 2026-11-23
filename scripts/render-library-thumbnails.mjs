import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { newLessons } from "../site/library/lessons.js";

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(process.argv[2] ?? "http://127.0.0.1:8080/learn-esp32/");
  await page.waitForFunction(() => window.__app && !document.querySelector("#app").inert);
  await mkdir("site/library/thumbnails", { recursive: true });
  for (const lesson of newLessons) {
    const { id } = lesson;
    await page.evaluate(id => window.__app.selectLesson(id), id);
    await page.waitForFunction(() => window.__app.stage.controls.settled);
    await page.waitForTimeout(1800);
    const components = [...new Set([...lesson.params.map(param => param.part),
      ...lesson.callouts.map(callout => callout.anchor.slice("part:".length))])];
    const image = await page.evaluate(({ id, components }) => {
      const stage = window.__app.stage;
      const scene = stage.scene.clone(false);
      scene.background = null;
      for (const child of stage.scene.children) if (child.isLight) scene.add(child.clone());
      for (const [key, part] of stage.parts) {
        if (components.includes(key)) scene.add(part.group.clone(true));
      }
      const camera = stage.camera.clone();
      camera.left = -78; camera.right = 78;
      camera.top = 52; camera.bottom = -52;
      camera.zoom = 1;
      camera.position.set(190, 200, 180);
      camera.lookAt(id === "battery" ? 50 : 85, 0, 0);
      camera.updateProjectionMatrix();
      stage.renderer.setSize(240, 160, false);
      stage.renderer.setPixelRatio(1);
      stage.renderer.setClearColor(0, 0);
      stage.renderer.setRenderTarget(null);
      stage.renderer.clear();
      stage.renderer.render(scene, camera);
      const check = document.createElement("canvas");
      check.width = 240; check.height = 160;
      const context = check.getContext("2d");
      context.drawImage(stage.renderer.domElement, 0, 0, 240, 160);
      const pixels = context.getImageData(0, 0, 240, 160).data;
      let occupied = 0, left = 240, top = 160, right = 0, bottom = 0;
      for (let y = 0; y < 160; y++) for (let x = 0; x < 240; x++) {
        if (pixels[(y * 240 + x) * 4 + 3]) {
          occupied++;
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (occupied < 100) throw new Error(`Empty 3D thumbnail: ${id}`);
      const cropped = document.createElement("canvas");
      cropped.width = right - left + 13;
      cropped.height = bottom - top + 13;
      cropped.getContext("2d").drawImage(check, left, top, right - left + 1,
        bottom - top + 1, 6, 6, right - left + 1, bottom - top + 1);
      return cropped.toDataURL("image/png").split(",")[1];
    }, { id, components });
    await writeFile(`site/library/thumbnails/${id}.png`, Buffer.from(image, "base64"));
  }
} finally { await browser.close(); }
