export { createLibrarySimulation } from "./simulations.js";

export function registerLibraryScenes(registry, views, three) {
  const { Object3D, Vector3, Mesh, BoxGeometry, PlaneGeometry,
    Material, CanvasTexture, sRGB, wire, SphereGeometry, CylinderGeometry } = three;
  const colors = { red: "#d64a3a", ground: "#2f3547",
    blue: "#3d6fc4", purple: "#8a63c9", green: "#2aa38d", orange: "#f0a53a" };
  const point = (at, x = 0, y = 2, z = 0) =>
    new Vector3(at[0] + x, at[1] + y, at[2] + z);
  const box = (group, width, height, depth, color, x = 0, y = 0, z = 0,
    metalness = 0) => {
    const mesh = new Mesh(new BoxGeometry(width, height, depth),
      new Material({ color, roughness: .5, metalness }));
    mesh.position.set(x, y + height / 2, z);
    group.add(mesh);
    return mesh;
  };
  const surface = (group, width, depth, y, z, initial, background, foreground) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 320;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable for library component display");
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = sRGB;
    const plane = new Mesh(new PlaneGeometry(width, depth),
      new Material({ map: texture, color: "#ffffff", roughness: .55 }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, y, z);
    group.add(plane);
    let previous = "";
    const draw = lines => {
      const text = lines.join("\n");
      if (text === previous) return;
      previous = text;
      context.fillStyle = background;
      context.fillRect(0, 0, 512, 320);
      context.fillStyle = foreground;
      context.textAlign = "center";
      context.font = '600 42px "Barlow Semi Condensed", sans-serif';
      lines.slice(0, 4).forEach((line, index) =>
        context.fillText(line, 256, 64 + index * 66, 480));
      texture.needsUpdate = true;
    };
    draw(initial);
    return draw;
  };
  const component = (name, desc, build) => {
    const group = new Object3D();
    group.userData.part = { name, desc };
    const anchor = new Object3D();
    anchor.position.y = 6;
    group.add(anchor);
    group.userData.anchor = anchor;
    build(group);
    return group;
  };
  const screen = (name, desc, lines, width = 38, depth = 30) =>
    component(name, desc, group => {
      box(group, width + 4, 3.5, depth + 4, "#192735");
      box(group, width, .6, depth, "#081b25", 0, 3.5);
      group.userData.display = surface(group, width - 2, depth - 2, 4.2, 0,
        lines, "#071c2a", "#b9e8f3");
    });
  const pins = (group, labels, depth) => labels.forEach((label, index) => {
    const x = (index - (labels.length - 1) / 2) * 4;
    box(group, 1.2, 4, 1.2, "#d5ad52", x, 0, depth / 2 - 2, .7);
  });
  const at = (id, position, build, extra = {}) =>
    ({ id, at: new Vector3(...position), build, ...extra });
  const connections = (prefix, position, signals) => signals.map(
    ([pin, color], index) => wire(`${prefix}-wire-${index}`, pin,
      point(position, (index - (signals.length - 1) / 2) * 4, 3, 10),
      color, { arch: 12 + index * 3 }));
  const sensorAt = [64, -4, 32];
  const displayAt = [108, -4, -20];
  registry.climate = { parts: [
    at("climate-sensor", sensorAt, params => component("BME280 sensor",
      "3.3 V I2C breakout. Click to adjust simulated readings and offset.", group => {
        box(group, 28, 1.5, 23, colors.green);
        box(group, 6, 2, 6, "#bac1c5", 0, 1.5, -4, .65);
        pins(group, ["GND", "VCC", "SDA", "SCL"], 23);
        group.userData.display = surface(group, 24, 8, 1.7, 5,
          ["BME280", params.address], "#2aa38d", "#ffffff");
      }), { apply: (group, params) =>
      group.userData.display(["BME280", params.address]) }),
    at("climate-display", displayAt, () => screen("I2C OLED 0x3C",
      "Shares GPIO 21 SDA and GPIO 22 SCL with the BME280.",
      ["OLED 0x3C", "Run to sample"], 35, 29)),
    ...connections("climate-sensor", sensorAt, [
      ["GND", colors.ground], ["3V3", colors.red],
      ["G21", colors.blue], ["G22", colors.purple],
    ]),
    ...connections("climate-oled", displayAt, [
      ["GND", colors.ground], ["3V3", colors.red],
      ["G21", colors.blue], ["G22", colors.purple],
    ]),
  ] };
  const brokerAt = [71, -4, -34];
  const dashboardAt = [112, -4, 29];
  registry.mqtt = { parts: [
    at("mqtt-device", [36, -4, 26], () => component("Simulated temperature source",
      "A generated value, not a physical temperature measurement.", group => {
        box(group, 21, 2, 17, colors.green);
        surface(group, 18, 13, 2.1, 0, ["SIM", "TEMP"], colors.green, "#ffffff");
      })),
    at("mqtt-broker", brokerAt, () => component("Simulated MQTT broker",
      "Software representation only. No wire, credentials or network connection.", group => {
        box(group, 29, 17, 29, "#29364a");
        box(group, 26, 1, 26, "#53687a", 0, 17);
        group.userData.display = surface(group, 25, 23, 18.1, 0,
          ["SIM BROKER", "MQTT"], "#14263e", "#f0bc74");
      })),
    at("mqtt-dashboard", dashboardAt, () => screen("Home Assistant-style dashboard",
      "Simulated publish/subscribe display; change the retained lamp command.",
      ["MQTT DEMO", "OFFLINE", "Lamp OFF"], 46, 38)),
  ] };
  const batteryAt = [67, -4, -27];
  const dividerAt = [103, -4, 24];
  const wakeAt = [-31, -4, 29];
  registry.battery = { parts: [
    at("battery-cell", batteryAt, () => component("Monitored cell",
      "3.0-4.2 V model. USB powers the DevKit; do not connect the cell to 3V3.", group => {
        box(group, 24, 6, 34, "#bfc6ca", 0, 0, 0, .5);
        box(group, 20, .5, 25, "#417566", 0, 6);
        surface(group, 19, 23, 6.6, 0, ["CELL", "3.0-4.2 V", "MONITOR ONLY"],
          "#417566", "#ffffff");
        box(group, 3, 1, 5, colors.red, -5, 0, 19);
        box(group, 3, 1, 5, colors.ground, 5, 0, 19);
      })),
    at("battery-divider", dividerAt, () => component("47 kOhm + 47 kOhm divider",
      "Two resistors and a 100 nF capacitor. Maximum GPIO 34 voltage is 2.1 V.", group => {
        box(group, 34, 1.5, 30, "#efe3c8");
        for (const z of [-7, 2]) {
          box(group, 22, .6, 1, "#b3a477", 0, 1.5, z, .5);
          box(group, 12, 2.5, 4, "#d3b58a", 0, 2, z);
          for (const [x, color] of [[-4, "#d8b738"], [-1, "#855ab3"],
            [2, "#d68439"], [5, "#ba9746"]]) {
            box(group, .8, 2.6, 4.1, color, x, 2, z);
          }
        }
        box(group, 4, 5, 4, "#bf7842", 11, 1.5, 7);
        group.userData.display = surface(group, 27, 8, 1.7, 10,
          ["SIM ADC", "47k / 47k"], "#efe3c8", "#2f3547");
      })),
    at("battery-wake", wakeAt, () => component("RTC wake button",
      "GPIO 33 to ground, with RTC pull-up. Press while sleeping to wake.", group => {
        box(group, 15, 2, 15, "#294b64");
        group.userData.cap = box(group, 10, 3, 10, colors.orange, 0, 2);
        group.userData.capY = group.userData.cap.position.y;
      }), { interact: { type: "press", input: "wake" } }),
    wire("battery-positive", point(batteryAt, -5, 1, 19),
      point(dividerAt, -6, 2, 10), colors.red, { arch: 12 }),
    wire("battery-negative", point(batteryAt, 5, 1, 19),
      "GND", colors.ground, { arch: 10 }),
    wire("battery-divider-ground", "GND",
      point(dividerAt, 6, 2, 10), colors.ground, { arch: 15 }),
    wire("battery-adc", "G34", point(dividerAt, 0, 2, 10), colors.green, { arch: 18 }),
    wire("battery-wake-input", "G33", point(wakeAt, -4), colors.orange, { arch: 12 }),
    wire("battery-wake-ground", "GND2", point(wakeAt, 4), colors.ground, { arch: 8 }),
  ] };
  const cardAt = [64, -4, 31];
  const monitorAt = [112, -4, -22];
  registry.sdlogger = { parts: [
    at("sd-card", cardAt, () => component("3.3 V microSD breakout",
      "GPIO 18 SCK, 19 MISO, 23 MOSI, 5 CS. Virtual card only.", group => {
        box(group, 31, 1.5, 27, "#315879");
        box(group, 22, 2.5, 21, "#bec4c9", 0, 1.5, -2, .7);
        const card = new Object3D();
        group.add(card);
        group.userData.card = card;
        box(card, 18, .9, 20, "#263241", 0, 4, -3);
        surface(card, 15, 15, 5, -3, ["microSD", "SIM"], "#263241", "#ffffff");
        pins(group, ["VCC", "GND", "CS", "SCK", "MISO", "MOSI"], 27);
      }), { apply: (group, params) => { group.userData.card.visible = params.inserted; } }),
    at("sd-display", monitorAt, () => screen("Virtual file monitor",
      "Software display, not an extra wired OLED. Browser UTC and virtual records.",
      ["VIRTUAL CSV", "Run to log"], 40, 31)),
    ...connections("sd", cardAt, [
      ["3V3", colors.red], ["GND", colors.ground], ["G5", colors.orange],
      ["G18", colors.purple], ["G19", colors.green], ["G23", colors.blue],
    ]),
  ] };
  const cylinder = (group, radius, height, color, x = 0, y = 0, z = 0) => {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, height, 24),
      new Material({ color, roughness: .65 }));
    mesh.position.set(x, y + height / 2, z);
    group.add(mesh);
    return mesh;
  };
  const indicator = (name, desc, hue) => component(name, desc, group => {
    box(group, 34, 2, 42, "#eee1c7");
    const material = new Material({ color: "#d7cfbf", emissive: hue,
      emissiveIntensity: .02, roughness: .4 });
    const bulb = new Mesh(new SphereGeometry(10, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), material);
    bulb.position.set(0, 3, -6);
    group.add(bulb);
    group.userData.bulb = bulb;
    box(group, 10, 2, 3, "#c5a679", -8, 2, 10);
    pins(group, ["IN", "GND"], 42);
    group.userData.display = surface(group, 25, 12, 2.2, 11,
      ["330 OHM", "LED OFF"], "#eee1c7", "#2f3547");
    group.userData.setOn = on => {
      material.emissiveIntensity = on ? 1.5 : .02;
      material.color.set(on ? hue : "#d7cfbf");
      group.userData.on = on;
    };
  });
  const pirAt = [64, -4, -30], ldrAt = [106, -4, 28], hallwayAt = [-32, -4, 28];
  registry.hallway = { parts: [
    at("hallway-pir", pirAt, () => component("Hallway PIR sensor",
      "3.3 V-compatible motion input. Click for a passing-person pulse.", group => {
        box(group, 25, 1.5, 26, colors.green);
        const dome = new Mesh(new SphereGeometry(10, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          new Material({ color: "#f5f0e7", roughness: .85 }));
        dome.position.y = 2;
        group.add(dome);
        pins(group, ["VCC", "OUT", "GND"], 26);
      }), { interact: { type: "press", input: "motion" } }),
    at("hallway-ldr", ldrAt, () => component("Hallway light sensor",
      "LDR + 10k divider. Click to adjust relative ADC light level.", group => {
        box(group, 27, 1.5, 26, "#eee1c7");
        cylinder(group, 7, 2, "#c99860", 0, 2, -4);
        for (const z of [-7, -4, -1]) box(group, 10, .3, .8, "#79573f", 0, 4, z);
        box(group, 12, 2, 3, "#bc976b", 0, 2, 6);
        pins(group, ["3V3", "ADC", "GND"], 26);
      })),
    at("hallway-light", hallwayAt, () => indicator("Tabletop hallway LED",
      "Small white LED through 330 Ohm. No mains lamp or strip.", "#ffd37b")),
    ...connections("hallway-pir", pirAt, [
      ["3V3", colors.red], ["G27", colors.blue], ["GND", colors.ground],
    ]),
    ...connections("hallway-ldr", ldrAt, [
      ["3V3", colors.red], ["G34", colors.green], ["GND", colors.ground],
    ]),
    ...connections("hallway-led", hallwayAt, [["G25", colors.orange], ["GND2", colors.ground]]),
  ] };
  const humidityAt = [58, -4, -33], driverAt = [73, -4, 32];
  const fanAt = [115, -4, -9], supplyAt = [122, -4, 39];
  registry.ventilation = { parts: [
    at("vent-sensor", humidityAt, () => component("Ventilation humidity sensor",
      "Simulated BME280 at 0x76. Click to change humidity.", group => {
        box(group, 27, 1.5, 23, colors.green);
        box(group, 6, 2, 6, "#bdc4ca", 0, 1.5, -4, .7);
        surface(group, 22, 9, 1.7, 5, ["BME280", "HUMIDITY"], colors.green, "#ffffff");
        pins(group, ["VCC", "GND", "SDA", "SCL"], 23);
      })),
    at("vent-driver", driverAt, () => component("Tabletop MOSFET driver",
      "3.3 V-logic MOSFET, 100 Ohm gate resistor, 100k pull-down and flyback diode.", group => {
        box(group, 31, 1.5, 27, "#315879");
        box(group, 11, 8, 5, "#28313f", 0, 1.5, -4);
        box(group, 12, 2, 2, "#c7a478", -6, 1.5, 3);
        box(group, 10, 2, 2, "#28313f", 6, 1.5, 5);
        box(group, 1, 2.1, 2.1, "#bcc4ce", 9, 1.5, 5);
        pins(group, ["GATE", "GND", "DRAIN"], 27);
      })),
    at("vent-fan", fanAt, () => component("5 V tabletop fan",
      "External low-voltage motor supply and driver. Hysteresis prevents chatter.", group => {
        box(group, 43, 3, 48, "#263447");
        cylinder(group, 17, 2, "#101d2a", 0, 3);
        for (const x of [-20, 20]) box(group, 3, 5, 43, "#637182", x, 3, -2);
        for (const z of [-20, 20]) box(group, 43, 5, 3, "#637182", 0, 3, z);
        const rotor = new Object3D();
        rotor.position.y = 6;
        group.add(rotor);
        for (let i = 0; i < 4; i++) {
          const blade = box(rotor, 15, 1, 6, "#b1bec7", 0, 0);
          const angle = i * Math.PI / 2;
          blade.position.x = Math.cos(angle) * 7;
          blade.position.z = Math.sin(angle) * 7;
          blade.rotation.y = -angle;
        }
        const hub = cylinder(rotor, 3, 2, "#6f8495");
        group.userData.rotor = rotor;
        group.userData.display = surface(group, 34, 10, 3.2, 19,
          ["TABLETOP", "5 V FAN"], "#263447", "#d7e7ed");
        group.userData.setOn = on => {
          hub.material.color.set(on ? colors.green : "#6f8495");
          group.userData.on = on;
        };
      })),
    at("vent-supply", supplyAt, () => component("Regulated 5 V model supply",
      "External tabletop motor supply, common GND. Never mains or a GPIO power output.", group => {
        box(group, 24, 9, 18, "#d7caba");
        surface(group, 21, 14, 9.1, 0, ["EXTERNAL", "5 V"], "#d7caba", "#2f3547");
      })),
    ...connections("vent-sensor", humidityAt, [
      ["3V3", colors.red], ["GND", colors.ground],
      ["G21", colors.blue], ["G22", colors.purple],
    ]),
    wire("vent-gate", "G26", point(driverAt, -4, 3, 10), colors.orange, { arch: 13 }),
    wire("vent-driver-ground", "GND", point(driverAt, 0, 3, 10), colors.ground, { arch: 10 }),
    wire("vent-motor-drain", point(driverAt, 4, 3, 10), point(fanAt, 4, 3, 14), colors.blue, { arch: 13 }),
    wire("vent-motor-positive", point(supplyAt, -4, 3, 6), point(fanAt, -4, 3, 14), colors.red, { arch: 13 }),
    wire("vent-supply-ground", point(supplyAt, 4, 3, 6), "GND2", colors.ground, { arch: 12 }),
  ] };
  const probeAt = [68, -4, -24], alertAt = [110, -4, 29], resetAt = [-31, -4, 29];
  registry.leak = { parts: [
    at("leak-probe", probeAt, params => component("Under-sink probe",
      "Simulated conditioned 3.3 V wetness input. This is not a safety system.", group => {
        box(group, 43, 1.5, 27, colors.green);
        box(group, 8, 2, 7, "#bcc6cb", -12, 1.5, -3);
        for (let i = 0; i < 6; i++) box(group, 16, .5, 1.2, "#c8a554",
          8 + (i % 2 ? 1 : -1), 1.5, -7 + i * 3);
        const water = new Mesh(new PlaneGeometry(22, 22),
          new Material({ color: "#53b9db", transparent: true, opacity: .45, depthWrite: false }));
        water.rotation.x = -Math.PI / 2;
        water.position.set(8, 2.3, 0);
        water.visible = params.wet;
        group.add(water);
        group.userData.water = water;
        pins(group, ["VCC", "OUT", "GND"], 27);
      }), { apply: (group, params) => { group.userData.water.visible = params.wet; } }),
    at("leak-alert", alertAt, () => indicator("Local leak indicator",
      "Small red LED through 330 Ohm; latched until a dry reset.", "#eb573f")),
    at("leak-reset", resetAt, () => component("Reset alert button",
      "GPIO 33 to GND. A wet probe blocks reset.", group => {
        box(group, 16, 2, 16, "#315879");
        group.userData.cap = box(group, 11, 3, 11, colors.green, 0, 2);
        group.userData.capY = group.userData.cap.position.y;
      }), { interact: { type: "press", input: "reset" } }),
    ...connections("leak-probe", probeAt, [
      ["3V3", colors.red], ["G27", colors.blue], ["GND", colors.ground],
    ]),
    ...connections("leak-indicator", alertAt, [["G25", colors.orange], ["GND", colors.ground]]),
    wire("leak-reset-input", "G33", point(resetAt, -4), colors.green, { arch: 12 }),
    wire("leak-reset-ground", "GND2", point(resetAt, 4), colors.ground, { arch: 8 }),
  ] };
  for (const id of ["climate", "mqtt", "battery", "sdlogger", "hallway", "ventilation", "leak"]) {
    views[id] = { target: [42, 0, 0], zoom: 5.8, frame: [4, 0, 164, 113] };
  }
  for (const id of ["hallway", "ventilation", "leak"]) {
    views[id] = { target: [46, 0, 4], zoom: 5.6, frame: [4, 0, 186, 127] };
  }
}
