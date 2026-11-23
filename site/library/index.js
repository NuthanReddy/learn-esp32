import { newLessons } from "./lessons.js";
import { recordsToCSV } from "./simulations.js";
export { newLessons } from "./lessons.js";
export { renderLibrarySchematic } from "./schematics.js";

const escape = value => String(value).replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const controls = params => params.map(param => {
  const id = `library-${param.key}`;
  const label = `<label for="${id}">${escape(param.label)}</label>`;
  if (param.type === "range") return `<div class="library-control">${label}
    <input id="${id}" data-param="${param.key}" type="range" min="${param.min}" max="${param.max}" step="${param.step}"/>
    <output for="${id}" data-value="${param.key}"></output></div>`;
  if (param.type === "toggle") return `<div class="library-control">${label}
    <input id="${id}" data-param="${param.key}" type="checkbox"/></div>`;
  return `<div class="library-control">${label}<select id="${id}" data-param="${param.key}">
    ${param.options.map(option => `<option value="${escape(option.value)}">${escape(option.label)}</option>`).join("")}
    </select></div>`;
}).join("");

export function installLibraryUI({ app, code }) {
  const root = document.querySelector("#app");
  const panel = document.createElement("section");
  panel.className = "library-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Simulated lesson controls and results");
  root.append(panel);
  const latest = new Map();
  let lessonId = null;
  let lastStatus = "";
  let lastTable = "";
  const frame = app.stage.hooks.onFrame;
  const actions = {
    climate: "",
    mqtt: '<button data-action="network">Toggle network</button><button data-action="lamp">Toggle lamp command</button>',
    battery: '<button data-action="wake">Wake button</button>',
    sdlogger: '<button data-action="record">Record now</button><button data-action="export">Export CSV</button><button data-action="format">Clear virtual file</button>',
  };
  const requireRunning = () => {
    if (!app.stage.sim || !app.state.lesson.library) {
      code.log("SIM: Run this lesson before using its demonstration actions.");
      return false;
    }
    return true;
  };
  panel.addEventListener("input", event => {
    const input = event.target.closest("[data-param]");
    if (!input) return;
    const param = app.state.lesson.params.find(param => param.key === input.dataset.param);
    app.setParam(param.key, param.type === "toggle" ? input.checked :
      param.type === "range" ? Number(input.value) : input.value);
    syncControls();
  });
  panel.addEventListener("click", event => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "network") app.setParam("online", !app.state.values.online);
    else if (action === "lamp") app.setParam("lamp", !app.state.values.lamp);
    else if (action === "export") {
      const state = app.stage.sim?.state ?? latest.get("sdlogger");
      if (!state?.records?.length) {
        code.log("SIM: No virtual records to export; run the logger first.");
        return;
      }
      const url = URL.createObjectURL(new Blob([recordsToCSV(state.records)], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "simulated-readings.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (requireRunning()) {
      if (action === "format" && !window.confirm("Clear the browser's simulated CSV file? This does not affect a physical SD card.")) return;
      app.stage.inputs[action] = true;
      app.stage.dirty = true;
    }
    syncControls();
  });
  function syncControls() {
    for (const param of app.state.lesson.params ?? []) {
      const input = panel.querySelector(`[data-param="${param.key}"]`);
      if (!input) continue;
      const value = app.state.values[param.key];
      if (param.type === "toggle") input.checked = value;
      else input.value = value;
      const output = panel.querySelector(`[data-value="${param.key}"]`);
      const text = `${value} ${param.unit ?? ""}`;
      if (output && output.textContent !== text) output.textContent = text;
    }
  }
  function paint() {
    const lesson = app.state.lesson;
    if (lessonId !== lesson.id) {
      lessonId = lesson.id;
      panel.hidden = !lesson.library;
      if (!lesson.library) { delete root.dataset.library; return; }
      root.dataset.library = lesson.id;
      panel.innerHTML = `<h2>Simulation lab <span>not connected to hardware</span></h2>
        <p class="library-status" aria-live="polite">Run the sketch to begin.</p>
        <div class="library-actions">${actions[lesson.id]}</div>
        <details><summary>Adjust simulation</summary>${controls(lesson.params)}</details>
        <div class="library-records"></div>`;
      lastStatus = "";
      lastTable = "";
    }
    if (!lesson.library) return;
    syncControls();
    const state = app.stage.sim?.state;
    if (state?.kind === lesson.id) latest.set(lesson.id, state);
    const result = state ?? latest.get(lesson.id);
    let status = "Run the sketch to begin.";
    if (result) {
      if (lesson.id === "climate") status =
        `${result.temperature.toFixed(1)} C | ${result.humidity}% RH | ${result.pressure.toFixed(1)} hPa | BME ${result.address}, OLED 0x3C`;
      if (lesson.id === "mqtt") status =
        `${result.phase} | ${result.published} published | ${result.received} received | lamp ${result.lamp ? "ON" : "OFF"}`;
      if (lesson.id === "battery") status =
        `${result.phase}, wake: ${result.wakeCause} | ${result.adcMv} mV ADC -> ${result.voltage.toFixed(2)} V | ideal module avg ${result.averageMa.toFixed(2)} mA; divider ${result.dividerUa.toFixed(1)} uA`;
      if (lesson.id === "sdlogger") status =
        `${result.phase} | ${result.records.length}/200 records | ${result.error ?? "Virtual /readings.csv"}`;
    }
    if (status !== lastStatus) {
      panel.querySelector(".library-status").textContent = status;
      lastStatus = status;
    }
    if (lesson.id === "sdlogger" && result) {
      const records = result.records.slice(-3);
      const table = records.length ? `<table><caption>Last simulated records (UTC)</caption><thead>
        <tr><th scope="col">Time</th><th scope="col">C</th></tr></thead><tbody>
        ${records.map(record => `<tr><td>${escape(record.timestamp)}</td><td>${record.temperature.toFixed(1)}</td></tr>`).join("")}
        </tbody></table>` : "";
      if (table !== lastTable) {
        panel.querySelector(".library-records").innerHTML = table;
        lastTable = table;
      }
    }
  }
  app.stage.hooks.onFrame = stage => {
    frame?.(stage);
    paint();
  };
  paint();
  for (const lesson of newLessons) {
    const item = document.querySelector(`#lesson-list [data-id="${lesson.id}"]`);
    item?.setAttribute("data-library-lesson", "");
  }
}

export function installLibraryThumbnails() {
  for (const lesson of newLessons) {
    const image = document.querySelector(`#lesson-list [data-id="${lesson.id}"] .lesson-thumb`);
    image.src = new URL(`./thumbnails/${lesson.id}.png`, import.meta.url).href;
  }
}
