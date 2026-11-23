import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.argv[2] ?? "https://nuthanreddy.github.io/learn-esp32/";
const screenshot = process.argv[3];
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
const requests = new Set();
page.on("response", response => {
  requests.add(response.url());
  if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
});
page.on("requestfailed", request =>
  failures.push(`${request.failure().errorText} ${request.url()}`));
page.on("pageerror", error => failures.push(error.message));

try {
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector("#app").inert,
    { timeout: 120000 });
  assert.equal(await page.locator("#lesson-list .lesson").count(), 20);
  assert.match(await page.locator("#board-canvas").getAttribute("data-engine"),
    /^three\.js/);
  await page.getByRole("button", { name: "Run sketch", exact: true }).click();
  await page.locator(".code-card").getByText("Hello from the ESP32!", { exact: true })
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Stop sketch", exact: true }).click();
  await page.getByRole("button", { name: "Turn right", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  const lessons = await page.locator("#lesson-list .lesson")
    .evaluateAll(elements => elements.map(element => ({
      id: element.dataset.id, label: element.getAttribute("aria-label"),
    })));
  for (const lesson of lessons) {
    await page.locator(`#lesson-list [data-id="${lesson.id}"]`).click();
    await page.waitForFunction(id => location.hash === `#${id}` ||
      (id === "board" && location.hash === ""), lesson.id);
    await page.waitForTimeout(350);
    assert.equal(await page.locator("#lesson-list [aria-current=step]")
      .getAttribute("data-id"), lesson.id);
    assert((await page.locator(".info-card").innerText()).length > 80);
    assert((await page.locator(".code-card code").innerText()).length > 80);
  }
  await page.locator('#lesson-list [data-id="board"]').click();
  await page.waitForTimeout(1500);
  if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
  const snapshot = JSON.parse(await readFile("snapshot.json", "utf8"));
  for (const file of snapshot.files) {
    const response = await page.request.get(new URL(file.path, url).href);
    assert.equal(response.status(), 200, file.path);
  }
  assert(![...requests].some(request => request.startsWith(snapshot.source)),
    "Original deployment asset hotlink");
  assert.deepEqual(failures, [], "Browser request or JavaScript errors");
  console.log(JSON.stringify({
    url, lessons, assetsChecked: snapshot.files.length,
    browserRequests: requests.size, failures, screenshot,
  }, null, 2));
} catch (error) {
  console.error("Page state:", (await page.locator("body").innerText()).slice(0, 2000));
  console.error("Browser failures:", failures);
  throw error;
} finally {
  await browser.close();
}
