import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { TOTAL_LESSONS } from "../site/library/lessons.js";

const [url, directory, phase = "after"] = process.argv.slice(2);
assert(url && directory, "Usage: node scripts/verify-layout.mjs URL ARTIFACT_DIRECTORY [before|after]");
assert(["before", "after"].includes(phase));
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000], ["mobile", 390, 844],
    ["small-mobile", 320, 740], ["tablet", 768, 1024],
    ["landscape-mobile", 844, 390],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height }, hasTouch: name !== "desktop",
      isMobile: name.includes("mobile"),
    });
    await page.goto(url);
    await page.waitForFunction(() => window.__app &&
      !document.querySelector("#app").inert &&
      window.__app.stage.controls.settled, { timeout: 120000 });
    await page.waitForTimeout(1800);
    const metrics = await page.evaluate(() => {
      const size = selector => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height,
          fontSize: getComputedStyle(element).fontSize };
      };
      return {
        compact: document.documentElement.classList.contains("compact"),
        overflow: document.documentElement.scrollWidth - innerWidth,
        zoom: window.__app.stage.view.zoom,
        nav: size(".side-nav svg"), brand: size(".brand-logo"),
        feature: size(".feature-icon svg"), thumbnail: size(".lesson-thumb"),
        title: size(".lesson-title"), body: size(".info-content p"),
        targets: [...document.querySelectorAll(
          ".side-nav a,.viewbar button,.lesson-step")].map(element => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height,
            left: rect.left, right: rect.right,
            label: element.getAttribute("aria-label") || element.textContent.trim() };
        }).filter(target => target.width > 0 && target.height > 0),
      };
    });
    assert.equal(metrics.overflow, 0, `${name}: horizontal page overflow`);
    if (phase === "after") {
      const baseline = JSON.parse(await readFile(
        path.join(directory, `esp32-${name}-before.json`), "utf8"));
      assert(Math.abs(metrics.zoom - Math.max(3.2, baseline.zoom * .9)) < .01,
        `${name}: default camera did not zoom out by 10%`);
      for (const key of ["nav", "brand", "feature", "thumbnail"]) {
        assert(metrics[key].width < baseline[key].width * .93,
          `${name}: ${key} remains oversized`);
      }
      for (const key of ["title", "body"]) {
        assert.equal(metrics[key].fontSize, baseline[key].fontSize,
          `${name}: readable text was reduced`);
      }
      if (metrics.compact) {
        assert(metrics.targets.every(target => target.width >= 44 &&
          target.height >= 44), `${name}: small touch target`);
        assert(metrics.targets.every(target => target.left >= 0 &&
          target.right <= width + 1), `${name}: clipped touch target`);
      }
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await page.waitForFunction(zoom => window.__app.stage.view.zoom > zoom,
        metrics.zoom);
      await page.getByRole("button", { name: "Reset view", exact: true }).click();
      await page.waitForFunction(zoom => window.__app.stage.controls.settled &&
        Math.abs(window.__app.stage.view.zoom - zoom) < .02, metrics.zoom);
      const lessons = await page.locator("#lesson-list .lesson")
        .evaluateAll(elements => elements.map(element => element.dataset.id));
      assert.equal(lessons.length, TOTAL_LESSONS);
      for (const id of lessons) {
        await page.locator(`#lesson-list [data-id="${id}"]`).click();
        await page.waitForFunction(expected =>
          window.__app.state.lesson.id === expected, id);
      }
      await page.locator('#lesson-list [data-id="board"]').click();
      await page.waitForFunction(() => window.__app.stage.controls.settled);
      await page.waitForTimeout(1800);
    }
    await writeFile(path.join(directory, `esp32-${name}-${phase}.json`),
      JSON.stringify(metrics, null, 2) + "\n");
    if (["desktop", "mobile"].includes(name)) {
      await page.screenshot({
        path: path.join(directory, `esp32-${name}-${phase}.png`), fullPage: true,
      });
    }
    results.push({ name, width, height, ...metrics });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
