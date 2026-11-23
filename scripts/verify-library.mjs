import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { LOG_KEY } from "../site/library/simulations.js";
import { TOTAL_LESSONS } from "../site/library/lessons.js";

const url = process.argv[2] ?? "http://127.0.0.1:8080/learn-esp32/";
const directory = process.argv[3];
if (directory) await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const failures = [];
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000], ["mobile", 390, 844], ["small-mobile", 320, 740],
    ["tablet", 768, 1024], ["landscape-mobile", 844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", error => failures.push(`${name}: ${error.message}`));
    page.on("console", message => { if (message.type() === "error") failures.push(`${name}: ${message.text()}`); });
    page.on("response", response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    await page.goto(url);
    await page.waitForFunction(() => window.__app && !document.querySelector("#app").inert);
    assert.equal(await page.locator("#lesson-list .lesson").count(), TOTAL_LESSONS);
    assert.equal(await page.locator(".progress-track").getAttribute("aria-valuemax"), String(TOTAL_LESSONS));
    async function select(id) {
      await page.locator(`#lesson-list [data-id="${id}"]`).click();
      await page.waitForFunction(id => document.querySelector("#app").dataset.library === id &&
        window.__app.stage.controls.settled, id);
      await page.waitForTimeout(400);
      assert.equal(await page.locator(".library-panel").isVisible(), true);
      const layout = await page.evaluate(() => {
        const panel = document.querySelector(".library-panel");
        const rect = panel.getBoundingClientRect();
        const code = document.querySelector(".code-card").getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth - innerWidth,
          left: rect.left, right: rect.right, codeBottom: code.bottom, panelTop: rect.top,
          brokenPaths: [...document.querySelectorAll("path[d]")].filter(path => /NaN|Infinity/.test(path.getAttribute("d"))).length,
          controls: [...panel.querySelectorAll("button,summary")].map(element => {
            const rect = element.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          }) };
      });
      assert.equal(layout.overflow, 0, `${name}/${id}: horizontal overflow`);
      assert(layout.left >= -1 && layout.right <= width + 1, `${name}/${id}: clipped panel`);
      assert(layout.panelTop >= layout.codeBottom - 1 ||
        await page.evaluate(() => document.documentElement.classList.contains("compact")),
        `${name}/${id}: panel overlaps code`);
      assert.equal(layout.brokenPaths, 0, `${name}/${id}: invalid callout path`);
      if (name !== "desktop") assert(layout.controls.every(control =>
        control.width >= 44 && control.height >= 44), `${name}/${id}: small hit target`);
    }
    const run = async () => {
      await page.locator(".btn-run").click();
      await page.waitForFunction(() => window.__app.stage.sim?.state?.simulated);
    };
    const change = async (key, value) => {
      await page.locator(".library-panel summary").click();
      const control = page.locator(`.library-panel [data-param="${key}"]`);
      await control.evaluate((element, value) => {
        if (element.type === "checkbox") element.checked = value;
        else element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }, value);
      await page.locator(".library-panel summary").click();
    };
    const capture = async id => {
      if (directory && ["desktop", "mobile"].includes(name)) {
        await page.locator(".library-panel").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, `library-${id}-${name}.png`), fullPage: true });
      }
    };
    await select("climate"); await run();
    await page.evaluate(() => window.__app.stage.select("climate-sensor"));
    await page.locator(".inspector").getByText("BME280 sensor", { exact: true }).waitFor();
    await page.evaluate(() => {
      window.__app.stage.select(null);
      window.__app.stage.resetView();
    });
    await page.waitForFunction(() => window.__app.stage.controls.settled);
    await change("temperature", 30); await change("offset", -2);
    await change("address", "0x77");
    await page.waitForFunction(() => window.__app.stage.sim.state.temperature === 28 &&
      window.__app.stage.sim.state.address === "0x77");
    assert((await page.locator(".code-card").innerText()).includes("0x77"));
    assert((await page.locator(".library-status").innerText()).includes("28.0 C"));
    await capture("climate");
    await select("mqtt"); await run();
    await page.getByRole("button", { name: "Toggle lamp command", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.lamp);
    assert(await page.evaluate(() => window.__app.stage.leds.LED.emissiveIntensity > 1));
    await page.getByRole("button", { name: "Toggle network", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.phase === "offline");
    const count = await page.evaluate(() => window.__app.stage.sim.state.published);
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.published), count);
    await page.getByRole("button", { name: "Toggle lamp command", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.lamp), true);
    await page.getByRole("button", { name: "Toggle network", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.phase === "reconnecting");
    await page.waitForFunction(() => window.__app.stage.sim.state.phase === "connected" &&
      !window.__app.stage.sim.state.lamp);
    await capture("mqtt");
    await select("battery"); await change("sleepSeconds", 5); await run();
    await page.waitForFunction(() => window.__app.stage.sim.state.phase === "sleeping");
    await change("voltage", 4.2);
    await page.getByRole("button", { name: "Wake button", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.wakeCause === "GPIO 33" &&
      window.__app.stage.sim.state.adcMv === 2100);
    await capture("battery");
    await page.waitForFunction(() => window.__app.stage.sim.state.wakeCause === "timer",
      { timeout: 15000 });
    await select("sdlogger"); await run();
    await page.waitForFunction(() => window.__app.stage.sim.state.records.length > 0);
    await change("inserted", false);
    const saved = await page.evaluate(() => window.__app.stage.sim.state.records.length);
    await page.getByRole("button", { name: "Record now", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.error?.includes("Card absent"));
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.records.length), saved);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Clear virtual file", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.error?.includes("not cleared"));
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.records.length), saved);
    assert.equal(await page.evaluate(() => window.__app.stage.parts.get("sd-card").group.userData.card.visible), false);
    await change("inserted", true);
    await page.getByRole("button", { name: "Record now", exact: true }).click();
    await page.waitForFunction(saved => window.__app.stage.sim.state.records.length > saved, saved);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV", exact: true }).click();
    const file = await download;
    assert.equal(file.suggestedFilename(), "simulated-readings.csv");
    const stream = await file.createReadStream();
    let csv = "";
    for await (const chunk of stream) csv += chunk.toString();
    assert.match(csv, /^timestamp_utc,temperature_c\n\d{4}-\d{2}-\d{2}T/);
    await capture("sdlogger");
    await page.locator(".btn-run").click();
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, LOG_KEY);
    assert.equal(await page.locator("#progress-count").innerText(), `4/${TOTAL_LESSONS}`);
    await page.reload();
    await page.waitForFunction(() => window.__app && !document.querySelector("#app").inert);
    assert.equal(await page.locator("#progress-count").innerText(), `4/${TOTAL_LESSONS}`);
    await select("climate");
    assert.equal(await page.evaluate(() => window.__app.state.values.temperature), 30);
    assert.equal(await page.evaluate(() => window.__app.state.values.address), "0x77");
    await select("sdlogger"); await run();
    assert((await page.evaluate(() => window.__app.stage.sim.state.records.length)) >= stored);
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", { name: "Clear virtual file", exact: true }).click();
    assert((await page.evaluate(() => window.__app.stage.sim.state.records.length)) >= stored);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Clear virtual file", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.records.length === 0);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.records.length), 0);
    console.log(`${name}: four scenes, controls, simulation results, export and persistence verified`);
    await page.close();
  }
  assert.deepEqual(failures, []);
} finally { await browser.close(); }
