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
  } else throw new Error(`No library schematic for ${lesson.id}`);
  return {
    svg: `<svg viewBox="0 0 420 260" width="${width}" height="${width * 260 / 420}" role="img" aria-label="${escape(lesson.title)} schematic">${content}</svg>`,
    notes, w: width, h: width * 260 / 420,
  };
}
