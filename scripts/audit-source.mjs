import assert from "node:assert/strict";
import { chromium } from "playwright";

const target = process.argv[2] ?? "http://127.0.0.1:8080/learn-esp32/";
const source = "https://learn-esp32.vercel.app/";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const baseline = [];
  for (const url of [source, target]) {
    await page.goto(url);
    await page.waitForFunction(() => window.__app && !document.querySelector("#app").inert);
    const lessons = await page.locator("#lesson-list .lesson").evaluateAll(elements =>
      elements.map(element => ({ id: element.dataset.id, title: element.querySelector(".lesson-title").textContent })));
    if (url === source) {
      assert.equal(lessons.length, 20);
      baseline.push(...lessons);
    } else assert.deepEqual(lessons.slice(0, 20), baseline);
    for (const lesson of baseline) {
      await page.locator(`#lesson-list [data-id="${lesson.id}"]`).click();
      await page.waitForFunction(id => window.__app.state.lesson.id === id, lesson.id);
      await page.locator(".btn-run").click();
      await page.waitForFunction(() => window.__app.stage.sim);
      await page.locator(".btn-run").click();
      await page.waitForFunction(() => !window.__app.stage.sim);
    }
    await page.getByRole("link", { name: "Language", exact: true }).click();
    await page.locator('[data-lang="fr"]').click();
    await page.waitForFunction(() => document.documentElement.lang === "fr");
    assert((await page.locator('.lesson[data-id="board"]').innerText()).includes("ESP32"));
    await page.locator('[data-lang="en"]').click();
    await page.waitForFunction(() => document.documentElement.lang === "en");
    console.log(`${url}: original 20 lesson titles, selection, run/stop and language flow verified`);
  }
  for (const resource of ["robots.txt", "sitemap.xml"]) {
    assert.equal((await page.request.get(new URL(resource, source).href)).status(), 200);
    const copy = await page.request.get(new URL(resource, target).href);
    assert.equal(copy.status(), 200);
    assert(!(await copy.text()).includes(source));
  }
} finally { await browser.close(); }
