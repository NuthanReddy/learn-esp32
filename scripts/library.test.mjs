import test from "node:test";
import assert from "node:assert/strict";
import { createModel, recordsToCSV, LOG_KEY, MAX_RECORDS } from "../site/library/simulations.js";
import { newLessons } from "../site/library/lessons.js";
import { renderLibrarySchematic } from "../site/library/schematics.js";

function fixture(kind, overrides = {}, storage) {
  const lesson = newLessons.find(lesson => lesson.id === kind);
  const params = { ...Object.fromEntries(lesson.params.map(param => [param.key, param.value])), ...overrides };
  const messages = [], inputs = {}, saved = new Map();
  storage ??= { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const model = createModel(kind, { params, inputs, storage,
    epoch: Date.UTC(2026, 0, 1), out: message => messages.push(message) });
  return { model, params, inputs, messages, storage };
}

test("climate calibration, shared addresses and stop", () => {
  const { model, params } = fixture("climate", { temperature: 20, offset: -1.5 });
  assert.equal(model.state.temperature, 18.5);
  params.address = "0x77"; params.humidity = 60;
  model.update(1000);
  assert.equal(model.state.address, "0x77");
  assert.equal(model.state.humidity, 60);
  assert.equal(model.state.samples, 2);
  model.stop(); model.update(1000);
  assert.equal(model.state.samples, 2);
});
test("MQTT pauses telemetry and applies retained commands only after reconnect", () => {
  const { model, params } = fixture("mqtt");
  model.update(10);
  assert.equal(model.state.published, 1);
  params.online = false; model.update(1000);
  params.lamp = true; model.update(1000);
  assert.equal(model.state.lamp, false);
  assert.equal(model.state.published, 1);
  params.online = true; model.update(1);
  assert.equal(model.state.phase, "reconnecting");
  model.update(1999); assert.equal(model.state.phase, "reconnecting");
  model.update(1);
  assert.equal(model.state.phase, "connected");
  assert.equal(model.state.lamp, true);
  assert.equal(model.state.received, 2);
});
test("ADC stays within 2.1 V, freezes during sleep and resamples on GPIO/timer wake", () => {
  const { model, params, inputs } = fixture("battery", { voltage: 4.2, sleepSeconds: 5 });
  assert.equal(model.state.adcMv, 2100);
  model.update(1000); assert.equal(model.state.phase, "sleeping");
  params.voltage = 3; model.update(100);
  assert.equal(model.state.adcMv, 2100);
  inputs.wake = true; model.update(1);
  assert.equal(model.state.wakeCause, "GPIO 33");
  assert.equal(model.state.adcMv, 1500);
  model.update(1000); model.update(5000);
  assert.equal(model.state.wakeCause, "timer");
  assert.equal(model.state.cycles, 2);
  assert(Math.abs(model.state.averageMa - 80.1 / 6) < .001);
});
test("virtual CSV persists, exports UTC records and rejects absent-card writes", () => {
  const { model, params, inputs, storage } = fixture("sdlogger");
  model.update(10);
  assert.equal(model.state.records.length, 1);
  assert.match(recordsToCSV(model.state.records), /^timestamp_utc,temperature_c\n2026-01-01T00:00:00.010Z,22.0\n$/);
  params.inserted = false; inputs.record = true; model.update(10);
  assert.equal(model.state.records.length, 1);
  assert.match(model.state.error, /Card absent/);
  params.inserted = true; inputs.record = true; model.update(10);
  assert.equal(model.state.records.length, 2);
  assert.equal(fixture("sdlogger", {}, storage).model.state.records.length, 2);
});
test("quota failures and corrupted files never claim successful writes", () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error("Quota exceeded"); } };
  const { model, messages } = fixture("sdlogger", {}, storage);
  model.update(1);
  assert.equal(model.state.records.length, 0);
  assert.equal(model.state.storageBlocked, true);
  assert(!messages.some(message => message.includes("APPEND")));
  const bad = fixture("sdlogger", {}, { getItem: () => "invalid json", setItem: () => {} });
  assert(bad.model.state.storageBlocked);
  bad.inputs.format = true; bad.model.update(1);
  assert.equal(bad.model.state.storageBlocked, false);
  assert.equal(bad.model.state.records.length, 0);
  bad.model.update(2000);
  assert.equal(bad.model.state.records.length, 1);
});
test("unmounted clear preserves records; mounted clear at a due tick delays the next sample", () => {
  const { model, params, inputs, storage } = fixture("sdlogger");
  model.update(1);
  const saved = storage.getItem(LOG_KEY);
  params.inserted = false; inputs.format = true; model.update(2000);
  assert.equal(model.state.records.length, 1);
  assert.equal(storage.getItem(LOG_KEY), saved);
  assert.match(model.state.error, /not cleared/);
  params.inserted = true; inputs.format = true; model.update(2000);
  assert.equal(model.state.records.length, 0);
  assert.equal(storage.getItem(LOG_KEY), "[]");
  model.update(1999); assert.equal(model.state.records.length, 0);
  model.update(1); assert.equal(model.state.records.length, 1);
});
test("200-record limit is bounded and explicit", () => {
  const records = Array.from({ length: MAX_RECORDS }, () =>
    ({ timestamp: "2026-01-01T00:00:00.000Z", temperature: 22 }));
  const { model, messages } = fixture("sdlogger", {}, {
    getItem: key => key === LOG_KEY ? JSON.stringify(records) : null,
    setItem: () => { throw new Error("Must not append"); },
  });
  model.update(1);
  assert.equal(model.state.records.length, 200);
  assert.match(model.state.error, /limit 200/);
  assert(!messages.some(message => message.includes("APPEND")));
});
test("hallway requires darkness and motion; pulses retrigger a full off-delay", () => {
  const { model, params, inputs, messages } = fixture("hallway", { offDelay: 2, lightLevel: 80 });
  inputs.motion = true; model.update(1);
  assert.equal(model.state.lightOn, false);
  params.lightLevel = 20; model.update(1);
  assert.equal(model.state.lightOn, false, "Darkness alone must not trigger");
  inputs.motion = true; model.update(1);
  assert.equal(model.state.lightOn, true);
  model.update(1500);
  inputs.motion = true; model.update(1);
  assert.equal(model.state.remainingSeconds, 2);
  model.update(1999); assert.equal(model.state.lightOn, true);
  model.update(1); assert.equal(model.state.lightOn, false);
  assert(messages.some(message => message.includes("retrigger")));
  params.motion = true; model.update(1); model.update(4000);
  assert.equal(model.state.lightOn, true, "Held motion keeps the timer alive");
  params.motion = false; model.update(1999); assert.equal(model.state.lightOn, true);
  model.update(1); assert.equal(model.state.lightOn, false);
  inputs.motion = true; model.update(1);
  params.lightLevel = params.darkThreshold; model.update(1);
  assert.equal(model.state.lightOn, false, "Threshold is not darkness; daylight cancels the timer");
  params.lightLevel = 20; inputs.motion = true; model.update(1);
  model.stop(); model.update(1);
  assert.equal(model.state.lightOn, false);
});
test("fan uses inclusive hysteresis boundaries and does not chatter inside the band", () => {
  const { model, params, messages } = fixture("ventilation");
  for (const humidity of [51, 69, 60, 69]) {
    params.humidity = humidity; model.update(1);
    assert.equal(model.state.fanOn, false);
  }
  params.humidity = 70; model.update(1);
  assert.equal(model.state.fanOn, true);
  for (const humidity of [69, 51, 60, 51]) {
    params.humidity = humidity; model.update(1);
    assert.equal(model.state.fanOn, true);
  }
  params.humidity = 50; model.update(1);
  assert.equal(model.state.fanOn, false);
  assert.equal(model.state.switches, 2);
  params.humidity = 90; params.onThreshold = 80; params.offThreshold = 40; model.update(1);
  assert.equal(model.state.fanOn, true);
  params.offThreshold = 80; model.update(1);
  assert.equal(model.state.fanOn, false);
  assert.match(model.state.error, /OFF threshold/);
  assert(messages.some(message => message.includes("ERROR")));
  params.offThreshold = 40; model.update(1);
  assert.equal(model.state.error, null);
  assert.equal(model.state.fanOn, true);
  model.stop(); model.update(1);
  assert.equal(model.state.fanOn, false);
});
test("wetness latches; dry alone cannot clear, and active wet resets are refused", () => {
  const { model, params, inputs, messages } = fixture("leak");
  params.wet = true; inputs.reset = true; model.update(1);
  assert.equal(model.state.latched, true);
  assert.equal(model.state.rejectedResets, 1);
  assert.match(model.state.error, /still wet/);
  inputs.reset = true; assert.equal(model.update(1), true, "Rejected reset must refresh visible feedback");
  assert.equal(model.state.rejectedResets, 2);
  params.wet = false; model.update(1);
  assert.equal(model.state.latched, true);
  assert.equal(model.state.error, null);
  inputs.reset = true; model.update(1);
  assert.equal(model.state.latched, false);
  assert.equal(model.state.resets, 1);
  params.wet = true; model.update(1);
  assert.equal(model.state.latched, true);
  model.stop(); params.wet = false; inputs.reset = true; model.update(1);
  assert.equal(model.state.latched, true, "Stopped controller freezes the latch");
  assert.equal(fixture("leak", { wet: true }).model.state.latched, true);
  assert.equal(fixture("leak", { wet: false }).model.state.latched, false);
  assert(messages.some(message => message.includes("DRY RESET accepted")));
});
test("all supported lesson schematics have safe wiring notes", () => {
  for (const lesson of newLessons) {
    assert(lesson.callouts.every(callout => Number.isFinite(callout.at) &&
      Number.isFinite(callout.leg)), "Native callout routes require explicit attachment and leg");
    const { params } = fixture(lesson.id);
    const schematic = renderLibrarySchematic(lesson, params);
    assert(schematic.svg.includes('role="img"'));
    assert.equal(schematic.notes.length, 2);
    assert(!lesson.code.includes("getLocalTime("), "Local time must not be labelled UTC");
  }
});
