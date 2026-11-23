import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { TOTAL_LESSONS } from "../site/library/lessons.js";

const url = process.argv[2] ?? "http://127.0.0.1:8080/learn-esp32/";
const directory = process.argv[3];
if (directory) await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const failures = [];
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000], ["mobile", 390, 844],
    ["small-mobile", 320, 740], ["landscape-mobile", 844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", error => failures.push(`${name}: ${error.message}`));
    page.on("console", message => {
      if (message.type() === "error") failures.push(`${name}: ${message.text()}`);
    });
    page.on("response", response => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(url);
    await page.waitForFunction(() => window.__app && !document.querySelector("#app").inert);
    assert.equal(await page.locator("#lesson-list .lesson").count(), TOTAL_LESSONS);
    await page.evaluate(() => {
      const previous = [...document.querySelectorAll("#lesson-list .lesson")]
        .slice(0, 24).map(element => element.dataset.id);
      localStorage.setItem("learn-esp32:done", JSON.stringify(previous));
    });
    await page.reload();
    await page.waitForFunction(() => window.__app && !document.querySelector("#app").inert);
    assert.equal(await page.locator("#progress-count").innerText(), `24/${TOTAL_LESSONS}`);
    const select = async id => {
      await page.locator(`#lesson-list [data-id="${id}"]`).click();
      await page.waitForFunction(id => window.__app.state.lesson.id === id &&
        document.querySelector("#app").dataset.library === id &&
        window.__app.stage.controls.settled, id);
      await page.waitForTimeout(500);
      assert.equal(await page.locator(".library-panel").isVisible(), true);
      assert.equal(await page.locator(`#lesson-list [data-id="${id}"]`).getAttribute("data-category"),
        "Home automation");
      assert(await page.locator(`#lesson-list [data-id="${id}"] img`)
        .evaluate(image => image.complete && image.naturalWidth > 20));
      const layout = await page.evaluate(() => {
        const rect = document.querySelector(".library-panel").getBoundingClientRect();
        const code = document.querySelector(".code-card").getBoundingClientRect();
        const jump = document.querySelector(".home-library-jump").getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth - innerWidth,
          left: rect.left, right: rect.right, top: rect.top, codeBottom: code.bottom,
          compact: document.documentElement.classList.contains("compact"),
          jump: { left: jump.left, right: jump.right, width: jump.width, height: jump.height },
          controls: [...document.querySelectorAll(".library-panel button,.library-panel summary")]
            .map(element => {
              const rect = element.getBoundingClientRect();
              return { width: rect.width, height: rect.height };
            }),
          invalid: [...document.querySelectorAll("path[d]")]
            .some(element => /NaN|Infinity/.test(element.getAttribute("d"))) };
      });
      assert.equal(layout.overflow, 0, `${name}/${id}: overflow`);
      assert(layout.left >= 0 && layout.right <= width + 1, `${name}/${id}: clipped panel`);
      assert(layout.compact || layout.top >= layout.codeBottom - 1, `${name}/${id}: overlap`);
      assert(layout.jump.left >= 0 && layout.jump.right <= width + 1, `${name}: clipped home shortcut`);
      if (layout.compact) {
        assert(layout.controls.every(control => control.width >= 44 && control.height >= 44));
        assert(layout.jump.width >= 44 && layout.jump.height >= 44);
      }
      assert.equal(layout.invalid, false, `${name}/${id}: invalid callout`);
      assert(!(await page.locator(".library-panel").innerText()).includes("undefined"));
    };
    const change = async (key, value) => {
      await page.locator(".library-panel summary").click();
      await page.locator(`.library-panel [data-param="${key}"]`).evaluate((element, value) => {
        if (element.type === "checkbox") element.checked = value;
        else element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }, value);
      await page.locator(".library-panel summary").click();
    };
    const run = async () => {
      await page.locator(".btn-run").click();
      await page.waitForFunction(() => window.__app.stage.sim?.state?.simulated);
    };
    const stop = async () => {
      await page.locator(".btn-run").click();
      await page.waitForFunction(() => !window.__app.stage.sim);
    };
    const capture = async id => {
      if (directory && ["desktop", "mobile"].includes(name)) {
        await page.locator(".library-panel").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, `home-${id}-${name}.png`), fullPage: true });
      }
    };
    const inspect = async (id, name) => {
      await page.evaluate(id => window.__app.stage.select(id), id);
      await page.locator(".inspector").getByText(name, { exact: true }).waitFor();
      await page.evaluate(() => window.__app.stage.select(null));
    };
    await page.getByRole("button", { name: "Open home automation lessons", exact: true }).click();
    await select("hallway");
    await inspect("hallway-pir", "Hallway PIR sensor");
    await change("offDelay", 2); await change("lightLevel", 80); await run();
    await page.getByRole("button", { name: "Motion pulse", exact: true }).click();
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.lightOn), false);
    await change("lightLevel", 20);
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.lightOn), false);
    await page.getByRole("button", { name: "Motion pulse", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.lightOn);
    assert(await page.evaluate(() => window.__app.stage.parts.get("hallway-light").group.userData.on));
    await page.waitForTimeout(950);
    await page.getByRole("button", { name: "Motion pulse", exact: true }).click();
    await page.locator(".code-card").getByText("SIM: MOTION retrigger: full 2 s off-delay", { exact: true }).waitFor();
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.lightOn), true);
    await page.waitForFunction(() => !window.__app.stage.sim.state.lightOn);
    await change("offDelay", 8);
    await page.getByRole("button", { name: "Motion pulse", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.lightOn);
    await capture("hallway");
    await change("lightLevel", 80);
    await page.waitForFunction(() => !window.__app.stage.sim.state.lightOn);
    await change("lightLevel", 20);
    await page.getByRole("button", { name: "Motion pulse", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.lightOn);
    await stop();
    assert.equal(await page.evaluate(() => window.__app.stage.parts.get("hallway-light").group.userData.on), false);

    await select("ventilation");
    await inspect("vent-driver", "Tabletop MOSFET driver");
    await inspect("vent-supply", "Regulated 5 V model supply");
    await run();
    await change("humidity", 60); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.fanOn), false);
    await change("humidity", 70);
    await page.waitForFunction(() => window.__app.stage.sim.state.fanOn);
    for (const humidity of [69, 51, 60]) {
      await change("humidity", humidity);
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.__app.stage.sim.state.fanOn), true);
    }
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.switches), 1);
    await change("humidity", 50);
    await page.waitForFunction(() => !window.__app.stage.sim.state.fanOn);
    await change("humidity", 60); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.switches), 2);
    await change("onThreshold", 90); await change("offThreshold", 59);
    await page.getByRole("button", { name: "Add humidity", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.fanOn);
    await page.getByRole("button", { name: "Dry air", exact: true }).click();
    await page.waitForFunction(() => !window.__app.stage.sim.state.fanOn);
    await change("onThreshold", 70); await change("offThreshold", 50);
    await page.getByRole("button", { name: "Add humidity", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.fanOn);
    const angle = await page.evaluate(() => window.__app.stage.parts.get("vent-fan").group.userData.rotor.rotation.y);
    await page.waitForTimeout(250);
    assert.notEqual(await page.evaluate(() => window.__app.stage.parts.get("vent-fan").group.userData.rotor.rotation.y), angle);
    const frozen = await page.evaluate(() => {
      document.documentElement.classList.add("reduce-motion");
      return window.__app.stage.parts.get("vent-fan").group.userData.rotor.rotation.y;
    });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__app.stage.parts.get("vent-fan").group.userData.rotor.rotation.y), frozen);
    await page.evaluate(() => document.documentElement.classList.remove("reduce-motion"));
    await capture("ventilation"); await stop();
    assert.equal(await page.evaluate(() => window.__app.stage.parts.get("vent-fan").group.userData.on), false);

    await select("leak");
    await inspect("leak-probe", "Under-sink probe");
    await page.getByRole("button", { name: "Dry probe", exact: true }).click();
    await run();
    await page.getByRole("button", { name: "Wet probe", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.latched);
    assert(await page.evaluate(() => window.__app.stage.parts.get("leak-probe").group.userData.water.visible));
    await page.getByRole("button", { name: "Reset alert", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.rejectedResets === 1);
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.latched), true);
    await page.getByRole("button", { name: "Dry probe", exact: true }).click();
    await page.waitForFunction(() => !window.__app.stage.sim.state.wet);
    assert.equal(await page.evaluate(() => window.__app.stage.sim.state.latched), true);
    await page.getByRole("button", { name: "Reset alert", exact: true }).click();
    await page.waitForFunction(() => !window.__app.stage.sim.state.latched);
    await page.getByRole("button", { name: "Wet probe", exact: true }).click();
    await page.waitForFunction(() => window.__app.stage.sim.state.latched);
    await capture("leak"); await stop();
    assert.equal(await page.evaluate(() => window.__app.stage.parts.get("leak-alert").group.userData.on), true);
    assert.equal(await page.locator("#progress-count").innerText(), `${TOTAL_LESSONS}/${TOTAL_LESSONS}`);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("learn-esp32:values"))?.leak?.wet === true);
    await page.reload();
    await page.waitForFunction(() => window.__app && !document.querySelector("#app").inert);
    assert.equal(await page.locator("#progress-count").innerText(), `${TOTAL_LESSONS}/${TOTAL_LESSONS}`);
    await select("hallway");
    assert.equal(await page.evaluate(() => window.__app.state.values.offDelay), 8);
    await select("leak");
    assert.equal(await page.evaluate(() => window.__app.state.values.wet), true);
    await run();
    await page.waitForFunction(() => window.__app.stage.sim.state.latched);
    await stop();
    console.log(`${name}: three home lessons, outputs, retrigger, hysteresis, wet reset and progress migration verified`);
    await page.close();
  }
  assert.deepEqual(failures, []);
} finally { await browser.close(); }
