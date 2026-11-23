export const LOG_KEY = "learn-esp32:library:sd-records";
export const MAX_RECORDS = 200;

export function createModel(kind, {
  params, out, storage, epoch = Date.now(), onDisplay = () => {}, inputs = {},
}) {
  const state = { kind, simulated: true, phase: "running" };
  let elapsed = 0;
  let next = 0;
  let stopped = false;
  const emit = message => out(`SIM: ${message}`);
  const display = lines => onDisplay(lines);
  const failure = message => { state.error = message; emit(`ERROR: ${message}`); };
  emit("Educational model only; no firmware, network or physical storage connection.");

  if (kind === "climate") {
    const sample = () => {
      state.temperature = Number(params.temperature) + Number(params.offset);
      state.humidity = Number(params.humidity);
      state.pressure = Number(params.pressure);
      state.address = params.address;
      state.samples = (state.samples ?? 0) + 1;
      display(["BME280 + OLED", `${state.temperature.toFixed(1)} C`,
        `${state.humidity.toFixed(0)} % RH`, `${state.pressure.toFixed(1)} hPa`]);
      emit(`I2C ${state.address} / OLED 0x3C | ${state.temperature.toFixed(1)} C, ${state.humidity.toFixed(0)} % RH, ${state.pressure.toFixed(1)} hPa`);
    };
    sample();
    next = 1000;
    return model(dt => {
      if (elapsed >= next) { next = elapsed + 1000; sample(); return true; }
      return false;
    });
  }

  if (kind === "mqtt") {
    Object.assign(state, { phase: params.online ? "connected" : "offline",
      published: 0, received: 0, lamp: false, temperature: null, topics: [] });
    let reconnectAt = null;
    let command = null;
    const connect = () => {
      state.phase = "connected";
      command = null;
      state.topics = ["esp32/climate/temperature", "esp32/lamp/set", "esp32/status",
        "homeassistant/sensor/learn_esp32/config"];
      emit("CONNECTED: simulated broker; subscribe esp32/lamp/set");
      emit("PUBLISH esp32/status: online (retained)");
      emit("DISCOVERY: homeassistant/sensor/learn_esp32/config");
    };
    if (params.online) connect();
    return model(() => {
      let changed = false;
      if (!params.online) {
        if (state.phase !== "offline") emit("DISCONNECTED: telemetry paused; dashboard retains its command");
        changed = state.phase !== "offline";
        state.phase = "offline";
        reconnectAt = null;
      } else if (state.phase === "offline") {
        state.phase = "reconnecting";
        reconnectAt = elapsed + 2000;
        emit("RECONNECT: waiting 2 seconds");
        changed = true;
      } else if (state.phase === "reconnecting" && elapsed >= reconnectAt) {
        connect();
        changed = true;
      }
      if (state.phase === "connected") {
        if (command !== params.lamp) {
          command = Boolean(params.lamp);
          state.lamp = command;
          state.received++;
          emit(`RECEIVE esp32/lamp/set: ${command ? "ON" : "OFF"} (retained)`);
          changed = true;
        }
        if (elapsed >= next) {
          next = elapsed + 1000;
          state.temperature = Number(params.temperature);
          state.published++;
          emit(`PUBLISH esp32/climate/temperature: ${state.temperature.toFixed(1)}`);
          changed = true;
        }
      }
      display(["MQTT DEMO", state.phase.toUpperCase(),
        `${state.temperature ?? "--"} C`, `Lamp: ${state.lamp ? "ON" : "OFF"}`]);
      return changed;
    });
  }

  if (kind === "battery") {
    Object.assign(state, { phase: "awake", wakeCause: "power-on", cycles: 0 });
    let deadline = 1000;
    const measure = () => {
      if (state.phase === "awake") {
        state.voltage = Number(params.voltage);
        state.adcMv = Math.round(state.voltage * 500);
      }
      state.dividerUa = state.voltage / 94000 * 1e6;
      state.averageMa = (80 + .02 * Number(params.sleepSeconds)) /
        (1 + Number(params.sleepSeconds));
      display(["BATTERY DEMO", `${state.voltage.toFixed(2)} V`,
        `${state.adcMv} mV ADC`, state.phase.toUpperCase()]);
    };
    const wake = cause => {
      state.phase = "awake";
      state.wakeCause = cause;
      state.cycles++;
      deadline = elapsed + 1000;
      emit(`WAKE: ${cause}; setup restarts`);
    };
    measure();
    emit(`ADC ${state.adcMv} mV -> battery ${state.voltage.toFixed(2)} V; USB powers DevKit`);
    return model(() => {
      let changed = false;
      if (inputs.wake) {
        inputs.wake = false;
        if (state.phase === "sleeping") { wake("GPIO 33"); changed = true; }
      }
      if (elapsed >= deadline) {
        if (state.phase === "awake") {
          state.phase = "sleeping";
          deadline = elapsed + Number(params.sleepSeconds) * 1000;
          emit(`DEEP SLEEP: timer ${params.sleepSeconds} s; GPIO 33 can wake early`);
        } else wake("timer");
        changed = true;
      }
      const old = state.voltage;
      measure();
      if (old !== state.voltage && state.phase === "awake") {
        emit(`ADC ${state.adcMv} mV -> battery ${state.voltage.toFixed(2)} V`);
        changed = true;
      }
      return changed;
    });
  }

  if (kind === "sdlogger") {
    Object.assign(state, { records: [], phase: params.inserted ? "mounted" : "card absent",
      storageBlocked: false });
    let inserted = Boolean(params.inserted);
    const valid = records => Array.isArray(records) && records.length <= MAX_RECORDS &&
      records.every(record => record && typeof record.timestamp === "string" &&
        /^\d{4}-\d{2}-\d{2}T/.test(record.timestamp) &&
        Number.isFinite(Date.parse(record.timestamp)) &&
        typeof record.temperature === "number" && Number.isFinite(record.temperature) &&
        record.temperature >= 0 && record.temperature <= 50);
    try {
      const saved = storage.getItem(LOG_KEY);
      if (saved !== null) {
        const records = JSON.parse(saved);
        if (!valid(records)) throw new Error("Virtual file contains invalid records");
        state.records = records;
      }
    } catch (error) {
      state.storageBlocked = true;
      failure(`Cannot load virtual file: ${error.message}. Clear the simulated file to recover.`);
    }
    const persist = records => {
      try { storage.setItem(LOG_KEY, JSON.stringify(records)); return true; }
      catch (error) {
        state.storageBlocked = true;
        failure(`Virtual file not saved: ${error.message}`);
        return false;
      }
    };
    const append = () => {
      if (!params.inserted) { failure("Card absent; no record written"); return; }
      if (state.storageBlocked) { failure("Virtual storage blocked; no record written"); return; }
      if (state.records.length >= MAX_RECORDS) {
        failure(`Virtual file limit ${MAX_RECORDS} reached; export or clear it`);
        return;
      }
      const record = {
        timestamp: new Date(epoch + elapsed).toISOString(),
        temperature: Number(params.temperature),
      };
      const records = [...state.records, record];
      if (!persist(records)) return;
      state.records = records;
      state.error = null;
      emit(`APPEND /readings.csv: ${record.timestamp},${record.temperature.toFixed(1)} (${records.length} records)`);
    };
    emit(`Virtual /readings.csv: ${state.records.length} saved records`);
    return model(() => {
      let changed = false;
      if (inserted !== Boolean(params.inserted)) {
        changed = true;
        inserted = Boolean(params.inserted);
        state.phase = inserted ? "mounted" : "card absent";
        emit(inserted ? "CARD MOUNTED: virtual file ready" : "CARD REMOVED: writes stopped");
      }
      const clearing = Boolean(inputs.format);
      if (clearing) {
        changed = true;
        inputs.format = false;
        inputs.record = false;
        if (!params.inserted) {
          failure("Card absent; virtual file not cleared");
        } else if (persist([])) {
          state.records = [];
          state.storageBlocked = false;
          state.error = null;
          next = elapsed + Number(params.interval) * 1000;
          emit("Virtual file cleared");
        }
      }
      if (!clearing && (inputs.record || elapsed >= next)) {
        inputs.record = false;
        next = elapsed + Number(params.interval) * 1000;
        append();
        changed = true;
      }
      display(["microSD DEMO", state.phase.toUpperCase(),
        `${state.records.length} records`, state.error ? "WRITE ERROR" : "CSV ready"]);
      return changed;
    });
  }
  if (kind === "hallway") {
    Object.assign(state, { lightOn: false, remainingSeconds: 0, activations: 0 });
    let deadline = null, lastMotion = false, lastReading = "";
    const step = () => {
      const pulse = Boolean(inputs.motion);
      inputs.motion = false;
      const motion = Boolean(params.motion) || pulse;
      const dark = Number(params.lightLevel) < Number(params.darkThreshold);
      const previous = JSON.stringify([state.lightOn, state.remainingSeconds, state.phase]);
      if (!dark) {
        deadline = null;
        if (state.lightOn) emit("DAYLIGHT: hallway LED OFF; timer cancelled");
        state.lightOn = false;
        if (pulse || (motion && !lastMotion)) emit("MOTION ignored: hallway is not dark");
      } else if (motion) {
        deadline = elapsed + Number(params.offDelay) * 1000;
        if (!state.lightOn) {
          state.lightOn = true;
          state.activations++;
          emit(`DARK + MOTION: LED ON; off-delay ${params.offDelay} s`);
        } else if (pulse || !lastMotion) emit(`MOTION retrigger: full ${params.offDelay} s off-delay`);
      } else if (state.lightOn && elapsed >= deadline) {
        state.lightOn = false;
        deadline = null;
        emit("OFF-DELAY expired: hallway LED OFF");
      }
      lastMotion = Boolean(params.motion);
      state.dark = dark;
      state.lightLevel = Number(params.lightLevel);
      state.motion = motion;
      state.remainingSeconds = state.lightOn ? Math.max(0, Math.ceil((deadline - elapsed) / 1000)) : 0;
      state.phase = !dark ? "daylight" : state.lightOn ? "light on" : "waiting for motion";
      const reading = `${params.lightLevel}/${params.darkThreshold}`;
      if (reading !== lastReading) {
        emit(`LIGHT ${params.lightLevel}% / dark below ${params.darkThreshold}%: ${dark ? "dark" : "bright"}`);
        lastReading = reading;
      }
      display(["HALLWAY DEMO", state.lightOn ? "LED ON" : "LED OFF",
        dark ? "DARK" : "DAYLIGHT", `${state.remainingSeconds} s left`]);
      return previous !== JSON.stringify([state.lightOn, state.remainingSeconds, state.phase]);
    };
    step();
    return model(step, () => {
      state.lightOn = false;
      state.remainingSeconds = 0;
      display(["HALLWAY DEMO", "STOPPED", "LED OFF"]);
      emit("STOP: tabletop LED OFF; Run starts a fresh demo timer");
    });
  }
  if (kind === "ventilation") {
    Object.assign(state, { fanOn: false, switches: 0 });
    let lastReading = "";
    const step = () => {
      const humidity = Number(params.humidity);
      const on = Number(params.onThreshold), off = Number(params.offThreshold);
      const previous = state.fanOn;
      const reading = `${humidity}/${on}/${off}`;
      state.humidity = humidity;
      state.onThreshold = on;
      state.offThreshold = off;
      if (!Number.isFinite(humidity) || !Number.isFinite(on) || !Number.isFinite(off) || off >= on) {
        const error = "OFF threshold must be below ON, with finite humidity readings";
        if (state.error !== error) failure(error);
        state.fanOn = false;
        state.phase = "invalid thresholds";
      } else {
        state.error = null;
        if (!state.fanOn && humidity >= on) state.fanOn = true;
        else if (state.fanOn && humidity <= off) state.fanOn = false;
        state.phase = state.fanOn ? "fan on" : "fan off";
      }
      if (previous !== state.fanOn) {
        state.switches++;
        emit(`FAN ${state.fanOn ? "ON" : "OFF"}: ${humidity}% RH; ON >= ${on}%, OFF <= ${off}%`);
      }
      if (reading !== lastReading) {
        emit(`HUMIDITY ${humidity}% RH | hysteresis ${off}-${on}% | fan ${state.fanOn ? "ON" : "OFF"}`);
        lastReading = reading;
        display(["VENTILATION DEMO", `${humidity}% RH`, `ON ${on} / OFF ${off}`,
          state.error ? "INPUT ERROR" : state.fanOn ? "FAN ON" : "FAN OFF"]);
        return true;
      }
      return previous !== state.fanOn;
    };
    step();
    return model(step, () => {
      state.fanOn = false;
      display(["VENTILATION DEMO", "STOPPED", "FAN OFF"]);
      emit("STOP: tabletop motor OFF");
    });
  }
  if (kind === "leak") {
    Object.assign(state, { latched: false, wet: false, resets: 0, rejectedResets: 0 });
    const step = () => {
      const previous = JSON.stringify([state.wet, state.latched, state.phase, state.error, state.rejectedResets]);
      state.wet = Boolean(params.wet);
      if (state.wet && !state.latched) {
        state.latched = true;
        emit("WET PROBE: local alert LATCHED (educational model, not a safety system)");
      }
      if (!state.wet) state.error = null;
      if (inputs.reset) {
        inputs.reset = false;
        if (state.wet) {
          state.rejectedResets++;
          failure("Reset refused: probe is still wet; alert remains latched");
        } else if (state.latched) {
          state.latched = false;
          state.resets++;
          emit("DRY RESET accepted: local alert cleared");
        } else emit("RESET: already dry and clear");
      }
      state.phase = state.latched ? (state.wet ? "wet: alert latched" : "dry: reset required") : "dry: clear";
      display(["LEAK DEMO", state.wet ? "WET" : "DRY",
        state.latched ? "ALERT LATCHED" : "CLEAR", "NOT A SAFETY SYSTEM"]);
      return previous !== JSON.stringify([state.wet, state.latched, state.phase, state.error, state.rejectedResets]);
    };
    step();
    return model(step, () => {
      display(["LEAK DEMO", "STOPPED", state.latched ? "ALERT LATCHED" : "CLEAR"]);
      emit("STOP: latch frozen; Run starts a fresh simulated controller");
    });
  }
  throw new Error(`Unsupported library simulation: ${kind}`);

  function model(step, onStop) {
    return {
      state,
      update(dt) {
        if (stopped) return false;
        elapsed += Math.max(0, dt);
        return step(dt);
      },
      stop() { stopped = true; state.phase = "stopped"; onStop?.(); },
    };
  }
}

export function recordsToCSV(records) {
  return "timestamp_utc,temperature_c\n" +
    records.map(record => `${record.timestamp},${record.temperature.toFixed(1)}`).join("\n") +
    (records.length ? "\n" : "");
}

export function createLibrarySimulation(mode, context) {
  const kind = mode.slice("library:".length);
  const screens = { climate: "climate-display", mqtt: "mqtt-dashboard",
    battery: "battery-divider", sdlogger: "sd-display", hallway: "hallway-light",
    ventilation: "vent-fan", leak: "leak-alert" };
  const model = createModel(kind, {
    params: context.params, out: context.out, storage: {
      getItem: key => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    },
    inputs: context.inputs,
    onDisplay: lines => context.parts.get(screens[kind])?.group.userData.display?.(lines),
  });
  return {
    state: model.state,
    update(now, dt) {
      let changed = model.update(dt);
      applyOutputs();
      if (kind === "ventilation" && model.state.fanOn &&
          !document.documentElement.classList.contains("reduce-motion")) {
        context.parts.get("vent-fan").group.userData.rotor.rotation.y += dt * .004;
        changed = true;
      }
      if (kind === "mqtt" && context.leds.LED) {
        const led = context.leds.LED;
        led.userData.baseEmissive ??= led.emissive.clone();
        led.emissive.set(model.state.lamp ? "#4bb7f0" : "#102432");
        led.emissiveIntensity = model.state.lamp ? 1.62 : .12;
        if (led.userData.glow) led.userData.glow.material.opacity = model.state.lamp ? .75 : 0;
      }
      return changed;
    },
    stop() { model.stop(); applyOutputs(); },
  };
  function applyOutputs() {
    if (kind === "hallway") context.parts.get("hallway-light").group.userData.setOn(model.state.lightOn);
    if (kind === "ventilation") context.parts.get("vent-fan").group.userData.setOn(model.state.fanOn);
    if (kind === "leak") context.parts.get("leak-alert").group.userData.setOn(model.state.latched);
  }
}
