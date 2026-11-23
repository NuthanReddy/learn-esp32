const escape = value => String(value).replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function renderLibrarySchematic(lesson, values, requestedWidth = 420) {
  const width = Math.min(460, Math.max(320, requestedWidth));
  const text = (x, y, value, size = 12, color = "#2f3547") =>
    `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="Barlow Semi Condensed, sans-serif">${escape(value)}</text>`;
  const line = (x1, y1, x2, y2, color = "#2f3547", dashed = false) =>
    `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="1.6"${dashed ? ' stroke-dasharray="5 4"' : ""}/>`;
  const rectangle = (x, y, w, h, label, fill = "#fffaf3") =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="#2f3547" stroke-width="1.5"/>${text(x + 8, y + 20, label, 14)}`;
  let content = rectangle(12, 35, 95, 196, "ESP32");
  let viewHeight = 260;
  let notes;
  if (lesson.id === "climate") {
    content += rectangle(235, 35, 172, 79, `BME280 ${values.address}`) +
      rectangle(235, 143, 172, 79, "OLED 0x3C");
    for (const [index, label, color] of [
      [0, "GPIO 21 SDA", "#3d6fc4"], [1, "GPIO 22 SCL", "#8a63c9"],
      [2, "3V3", "#d64a3a"], [3, "GND", "#2f3547"],
    ]) {
      const y = 78 + index * 32;
      const trunk = 148 + index * 19;
      content += text(19, y - 5, label, 11) + line(107, y, trunk, y, color) +
        line(trunk, 65 + index * 11, trunk, 174 + index * 11, color);
      for (const moduleY of [65, 174]) {
        content += line(trunk, moduleY + index * 11, 235,
          moduleY + index * 11, color);
      }
    }
    notes = ["Shared SDA/SCL; addresses 0x3C and 0x76/0x77 do not conflict.",
      "Use 3.3 V power and 3.3 V pull-ups. BME280 CSB HIGH selects I2C; strap SDO for its address."];
  } else if (lesson.id === "battery") {
    content += rectangle(216, 12, 104, 46, "CELL 3.0-4.2 V") +
      text(19, 65, "USB powers board", 10) + text(19, 139, "GPIO 34 ADC", 11) +
      line(260, 58, 260, 78, "#d64a3a") +
      rectangle(243, 78, 34, 35, "R1") + text(285, 98, "47k") +
      line(260, 113, 260, 139, "#2aa38d") +
      line(107, 139, 260, 139, "#2aa38d") +
      '<circle cx="260" cy="139" r="3" fill="#2aa38d"/>' +
      line(260, 139, 260, 162) + rectangle(243, 162, 34, 35, "R2") +
      text(285, 182, "47k") + line(260, 197, 260, 222) +
      text(273, 225, "GND", 11) +
      line(260, 139, 351, 139, "#2aa38d") + line(351, 139, 351, 173) +
      line(340, 173, 362, 173) + line(340, 181, 362, 181) +
      line(351, 181, 351, 222) + line(260, 222, 382, 222) +
      line(310, 58, 382, 58) + line(382, 58, 382, 222) +
      text(323, 198, "100 nF", 10) +
      text(19, 198, "GPIO 33", 11) + line(107, 195, 160, 195, "#f0a53a") +
      line(160, 195, 180, 182) + line(184, 195, 203, 195) +
      line(203, 195, 203, 222) + line(203, 222, 260, 222) +
      text(120, 246, "Wake button: LOW; RTC pull-up", 11);
    notes = ["Equal 47k resistors: ADC voltage = cell voltage / 2 (2.1 V maximum).",
      "Battery is measurement-only. Never feed a 4.2 V cell into GPIO or 3V3; real battery power needs regulation/protection."];
  } else if (lesson.id === "mqtt") {
    content += text(20, 91, "Wi-Fi model", 11) + text(20, 194, "GPIO 2 LED", 11) +
      rectangle(158, 70, 105, 100, "SIM BROKER", "#f6f0e5") +
      text(166, 111, values.online ? "Link available" : "Disconnected", 11) +
      rectangle(314, 70, 94, 100, "DASHBOARD", "#f6f0e5") +
      text(323, 112, "temperature", 11) + text(323, 136, "lamp ON/OFF", 11) +
      line(107, 123, 158, 123, values.online ? "#2aa38d" : "#89939a", true) +
      line(263, 123, 314, 123, "#3d6fc4", true) +
      text(124, 221, "Publish -> broker -> subscribe", 13);
    notes = ["Dashed lines represent simulated network messages, not physical GPIO wires.",
      "No broker, credentials or Home Assistant connection. Lamp commands are retained in this model."];
  } else if (lesson.id === "sdlogger") {
    content += rectangle(229, 35, 176, 196, "3.3 V microSD");
    const pins = [["3V3", "VCC", "#d64a3a"], ["GND", "GND", "#2f3547"],
      ["GPIO 18", "SCK", "#8a63c9"], ["GPIO 19", "MISO", "#2aa38d"],
      ["GPIO 23", "MOSI", "#3d6fc4"], ["GPIO 5", "CS", "#f0a53a"]];
    pins.forEach(([pin, signal, color], index) => {
      const y = 79 + index * 26;
      content += text(19, y - 5, pin, 11) + line(107, y, 229, y, color) +
        text(241, y + 4, signal, 12);
    });
    notes = ["GPIO 18 SCK / 19 MISO / 23 MOSI / 5 CS. Avoid pulling GPIO 5 LOW during reset.",
      "Use 3.3 V-compatible breakout/logic. Records are in a browser virtual file, not a physical card."];
  } else if (lesson.id === "hallway") {
    content += rectangle(235, 35, 172, 65, "3.3 V PIR") +
      text(241, 73, "HIGH = motion", 11) +
      rectangle(235, 117, 172, 74, "LDR + 10k") +
      text(241, 153, "3V3 -> LDR -> ADC", 11) +
      text(241, 174, "ADC -> 10k -> GND", 11) +
      text(19, 81, "GPIO 27", 11) + line(107, 81, 235, 81, "#3d6fc4") +
      text(19, 155, "GPIO 34", 11) + line(107, 155, 235, 155, "#2aa38d") +
      text(19, 216, "GPIO 25", 11) + line(107, 216, 249, 216, "#f0a53a") +
      rectangle(249, 201, 42, 29, "330") + line(291, 216, 326, 216, "#f0a53a") +
      '<circle cx="334" cy="216" r="8" fill="#ffe7b5" stroke="#2f3547"/>' +
      line(342, 216, 382, 216) + text(367, 236, "GND", 11) +
      text(143, 246, "Small tabletop LED only", 11);
    notes = ["Power the PIR and LDR divider at 3.3 V; common GND. Relative ADC light level is not calibrated lux.",
      "GPIO 25 -> 330 Ohm -> LED -> GND. No mains lamp or strip; motion retriggers the off-delay only in darkness."];
  } else if (lesson.id === "ventilation") {
    viewHeight = 280;
    content = rectangle(12, 35, 95, 230, "ESP32") +
      rectangle(156, 30, 111, 145, "BME280") +
      text(164, 66, "0x76 / 3.3 V", 11) +
      text(19, 78, "GPIO 21 SDA", 10) + line(107, 81, 156, 81, "#3d6fc4") +
      text(19, 101, "GPIO 22 SCL", 10) + line(107, 104, 156, 104, "#8a63c9") +
      text(19, 138, "3V3", 11) + line(107, 138, 156, 138, "#d64a3a") + text(164, 138, "VCC", 11) +
      text(19, 161, "GND", 11) + line(107, 161, 156, 161) + text(164, 161, "GND", 11) +
      text(305, 20, "Regulated +5V", 12) +
      line(345, 30, 345, 88, "#d64a3a") +
      rectangle(322, 88, 81, 49, "5 V DC fan") +
      line(345, 137, 345, 175) + line(345, 175, 306, 175) +
      line(306, 175, 306, 210) + line(294, 181, 294, 207) +
      text(312, 212, "MOSFET", 10) + line(306, 210, 306, 254) +
      text(19, 195, "GPIO 26", 11) + line(107, 191, 210, 191, "#f0a53a") +
      rectangle(210, 176, 45, 29, "100R") +
      line(255, 191, 294, 191, "#f0a53a") +
      line(277, 191, 277, 216) + rectangle(255, 216, 43, 29, "100k") +
      line(277, 245, 277, 254) +
      line(345, 73, 288, 73, "#d64a3a") + line(288, 73, 288, 107, "#d64a3a") +
      line(280, 107, 296, 107, "#d64a3a") +
      '<path d="M288 111 L280 127 L296 127 Z" fill="#fffaf3" stroke="#d64a3a" stroke-width="1.5"/>' +
      line(288, 127, 288, 145) + line(288, 145, 345, 145) +
      text(273, 161, "diode", 10) +
      text(19, 238, "GND", 11) + line(107, 240, 130, 240) +
      line(130, 240, 130, 254) + line(130, 254, 397, 254) +
      text(333, 272, "Common GND", 11);
    notes = ["BME280 and its SDA/SCL pull-ups use 3.3 V. GPIO 26 controls a logic-rated gate through 100 Ohm; 100k pulls gate to source/GND.",
      "External regulated 5 V powers the tabletop motor, not a GPIO. Diode cathode to +5V, anode to drain; common GND. Never mains."];
  } else if (lesson.id === "leak") {
    content += rectangle(235, 35, 172, 100, "3.3 V probe interface") +
      text(243, 76, "Conditioned OUT: HIGH wet", 11) +
      text(19, 84, "GPIO 27", 11) + line(107, 84, 235, 84, "#3d6fc4") +
      text(19, 101, "3V3", 11) + line(107, 101, 235, 101, "#d64a3a") + text(243, 102, "VCC", 11) +
      text(19, 121, "GND", 11) + line(107, 121, 235, 121) + text(243, 122, "GND", 11) +
      text(19, 150, "GPIO 25", 11) + line(107, 148, 249, 148, "#f0a53a") +
      rectangle(249, 133, 42, 29, "330") + line(291, 148, 326, 148, "#f0a53a") +
      '<circle cx="334" cy="148" r="8" fill="#f6c7bd" stroke="#2f3547"/>' +
      line(342, 148, 387, 148) + text(360, 172, "GND", 11) +
      text(19, 208, "GPIO 33", 11) + line(107, 205, 266, 205, "#2aa38d") +
      line(266, 205, 287, 192) + line(291, 205, 387, 205) +
      text(228, 231, "Reset to GND / internal pull-up", 11) +
      text(121, 250, "Wetness has priority over reset", 11);
    notes = ["Use a conditioned 3.3 V digital probe interface and common GND, never a higher-voltage or mains input.",
      "GPIO 25 -> 330 Ohm -> red LED -> GND; GPIO 33 reset to GND. Reset is refused while wet. Not a safety system."];
  } else throw new Error(`No library schematic for ${lesson.id}`);
  return {
    svg: `<svg viewBox="0 0 420 ${viewHeight}" width="${width}" height="${width * viewHeight / 420}" role="img" aria-label="${escape(lesson.title)} schematic">${content}</svg>`,
    notes, w: width, h: width * viewHeight / 420,
  };
}
