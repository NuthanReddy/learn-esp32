const range = (key, part, label, min, max, step, value, unit) =>
  ({ key, part, label, type: "range", min, max, step, value, unit });
const toggle = (key, part, label, value) =>
  ({ key, part, label, type: "toggle", value });
const callout = (part, icon, title, body, x, y, side = "auto") =>
  ({ anchor: `part:${part}`, icon, title, body, x, y, w: 240,
    side, at: 60, leg: 30, ring: true });

export const newLessons = [
  {
    id: "climate", library: true, title: "Climate station",
    cardTitle: "21. Climate station", cardW: 280, thumb: "oled",
    heading: "BME280 climate station",
    lede: "Put a BME280 and an OLED on the same I2C bus. Adjust the simulated room, apply a temperature offset, and see temperature, humidity and pressure on the display. No physical sensor is connected.",
    features: [
      ["sensor", "Three environmental readings on one shared I2C bus"],
      ["console", "OLED at 0x3C; BME280 at 0x76 or 0x77"],
      ["knob", "Compare a reference thermometer before applying an offset"],
    ],
    pinout: [
      ["GPIO 21", "SDA: sensor + OLED", "Both devices share this data wire. Their addresses must differ.", "#3d6fc4"],
      ["GPIO 22", "SCL: sensor + OLED", "Both devices share the clock wire.", "#8a63c9"],
      ["3V3 / GND", "Power both breakouts", "Use 3.3 V-compatible boards and pull-ups to 3.3 V, never 5 V.", "#d64a3a"],
      ["SDO / CSB", "BME280 address / I2C", "SDO LOW selects 0x76, HIGH selects 0x77; CSB HIGH selects I2C. Follow the breakout's documentation.", "#2aa38d"],
    ],
    example: [
      "The browser generates readings; it does not read a real BME280.",
      "<code>Wire.begin(21, 22)</code> starts one bus. The OLED and sensor respond at different addresses.",
      "The offset corrects only temperature in this demo. It does not calibrate humidity or pressure, and board heat can bias a real sensor.",
      "Click the sensor or open <b>Adjust simulation</b>, then run the sketch and change the environment.",
    ],
    specs: [
      ["Sensor", "BME280: temperature, humidity, pressure"],
      ["Bus", "I2C; BME280 0x76 / 0x77; OLED 0x3C"],
      ["Supply", "3.3 V-compatible breakouts; common ground"],
      ["Libraries", "Adafruit BME280, Adafruit SSD1306 (instructional references)"],
      ["Demonstration", "Simulated values, not measurement or calibration certification"],
    ],
    params: [
      range("temperature", "climate-sensor", "Room temperature", -10, 50, 1, 24, "C"),
      range("humidity", "climate-sensor", "Relative humidity", 0, 100, 1, 45, "%"),
      range("pressure", "climate-sensor", "Air pressure", 950, 1050, 1, 1013, "hPa"),
      range("offset", "climate-sensor", "Temperature offset", -5, 5, .5, 0, "C"),
      {
        key: "address", part: "climate-sensor", label: "BME280 address",
        type: "choice", value: "0x76",
        options: [{ value: "0x76", label: "0x76", code: { literal: "0x76" } },
          { value: "0x77", label: "0x77", code: { literal: "0x77" } }],
      },
    ],
    callouts: [
      callout("climate-sensor", "sensor", "BME280", "Adjust the room and temperature offset.", 280, -240, "bottom"),
      callout("climate-display", "console", "Shared I2C OLED", "0x3C: the same SDA and SCL, a different address.", 280, 210, "top"),
    ],
    sim: "library:climate",
    code: `// Educational simulation; real hardware needs the named libraries.
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <Adafruit_SSD1306.h>

Adafruit_BME280 sensor;
Adafruit_SSD1306 display(128, 64, &Wire, -1);
const float OFFSET_C = {{offset}};

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);  // both devices share these wires
  if (!sensor.begin({{address.literal}}) ||
      !display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("I2C device missing: check power, address and wiring");
    while (true) delay(1000);
  }
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
}

void loop() {
  float c = sensor.readTemperature() + OFFSET_C;
  float rh = sensor.readHumidity();
  float hpa = sensor.readPressure() / 100.0F;
  display.clearDisplay();
  display.setCursor(0, 0);
  display.printf("%.1f C\\n%.0f %% RH\\n%.1f hPa", c, rh, hpa);
  display.display();
  Serial.printf("%.1f C, %.0f %% RH, %.1f hPa\\n", c, rh, hpa);
  delay(1000);
}`,
  },
  {
    id: "mqtt", library: true, title: "MQTT dashboard",
    cardTitle: "22. MQTT dashboard", cardW: 292, thumb: "wifi",
    heading: "MQTT / Home Assistant telemetry",
    lede: "A simulated broker delivers temperature messages to a dashboard and lamp commands back to the ESP32. Break the link and restore it to see reconnect and retained-command behavior. No Wi-Fi, broker, credentials or Home Assistant instance is contacted.",
    features: [
      ["wifi", "Publish readings; subscribe to lamp commands"],
      ["phone", "Home Assistant-style dashboard with simulated topics"],
      ["clock", "Non-blocking reconnect after the network returns"],
    ],
    pinout: [
      ["Wi-Fi", "Simulated broker link", "MQTT is a messaging protocol over a network, not an extra GPIO bus.", "#3d6fc4"],
      ["GPIO 2", "On-board blue LED", "The received ON / OFF command changes the on-board LED.", "#f0a53a"],
      ["USB-C", "Power the DevKit", "The broker and dashboard here are software models, not wired server hardware.", "#2f3547"],
    ],
    example: [
      "Messages use <code>esp32/climate/temperature</code>, <code>esp32/lamp/set</code> and <code>esp32/status</code>.",
      "The simulated Home Assistant discovery message advertises a temperature sensor. Real Home Assistant needs a configured MQTT integration.",
      "Disconnect the link: new telemetry stops. Restore it: the client reconnects after two seconds and receives the retained lamp command.",
      "The example uses <code>broker.invalid</code> deliberately. Real deployments need your own Wi-Fi setup, broker authentication and appropriate TLS certificates.",
    ],
    specs: [
      ["Protocol", "Simulated MQTT publish / subscribe; QoS 0-style telemetry"],
      ["Discovery", "homeassistant/sensor/learn_esp32/config (simulated)"],
      ["Reconnect", "2-second demo backoff; retained command on reconnect"],
      ["Library", "PubSubClient (instructional reference)"],
      ["Boundary", "No network calls, real credentials, broker or device connection"],
    ],
    params: [
      range("temperature", "mqtt-device", "Published temperature", 0, 50, 1, 23, "C"),
      toggle("online", "mqtt-broker", "Network available", true),
      toggle("lamp", "mqtt-dashboard", "Retained dashboard lamp command", false),
    ],
    callouts: [
      callout("mqtt-broker", "wifi", "Simulated broker", "Interrupt the link, then watch reconnect.", 280, -240, "bottom"),
      callout("mqtt-dashboard", "phone", "Dashboard", "Publish a retained ON / OFF command.", 280, 220, "top"),
    ],
    sim: "library:mqtt",
    code: `// Browser demo uses a simulated broker; this code is not uploaded.
#include <WiFi.h>
#include <PubSubClient.h>
WiFiClient transport;
PubSubClient mqtt(transport);
unsigned long lastTry = 0, lastPublish = 0;

void command(char* topic, byte* payload, unsigned int length) {
  bool on = length == 2 && payload[0] == 'O' && payload[1] == 'N';
  digitalWrite(2, on ? HIGH : LOW);
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  // Configure your own Wi-Fi separately. No credentials are supplied.
  mqtt.setServer("broker.invalid", 1883); // replace on real hardware
  mqtt.setCallback(command);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!mqtt.connected()) {
    if (millis() - lastTry < 2000) return;
    lastTry = millis();
    if (!mqtt.connect("learn-esp32-demo")) return;
    mqtt.subscribe("esp32/lamp/set");
    mqtt.publish("esp32/status", "online", true);
    mqtt.publish("homeassistant/sensor/learn_esp32/config",
      "{\\"name\\":\\"ESP32 temperature\\",\\"unique_id\\":\\"learn_esp32_temp\\","
      "\\"state_topic\\":\\"esp32/climate/temperature\\",\\"unit_of_measurement\\":\\"C\\"}", true);
  }
  mqtt.loop();
  if (millis() - lastPublish >= 1000) {
    lastPublish = millis();
    // Demo reading; substitute a real sensor on hardware.
    mqtt.publish("esp32/climate/temperature", "{{temperature}}");
  }
}`,
  },
  {
    id: "battery", library: true, title: "Battery and deep sleep",
    cardTitle: "23. Battery & sleep", cardW: 290, thumb: "board",
    heading: "Battery monitor and deep sleep",
    lede: "Measure a simulated 3.0-4.2 V cell through two equal resistors, then alternate an active period with deep sleep. Wake by timer or GPIO 33. USB still powers this DevKit: the battery is monitored, not wired directly to its power rail.",
    features: [
      ["pins", "ADC1 on input-only GPIO 34, behind a voltage divider"],
      ["clock", "Timer wake and active-low RTC GPIO 33 wake"],
      ["bolt", "Compare active/sleep duty cycle and divider drain"],
    ],
    pinout: [
      ["Battery +", "47 kOhm R1 -> midpoint", "The midpoint goes to GPIO 34. Never connect a 4.2 V cell directly to GPIO or 3V3.", "#d64a3a"],
      ["GPIO 34", "Midpoint -> 47 kOhm R2 -> GND", "Equal resistors halve voltage: at 4.2 V, the ADC sees 2.1 V. Add 100 nF from midpoint to GND.", "#2aa38d"],
      ["GPIO 33", "Wake button -> GND", "RTC-capable input with pull-up; ext0 wakes when LOW.", "#f0a53a"],
      ["USB / GND", "Power / common reference", "USB powers the board. A real battery-powered design needs suitable regulation, charging and cell protection.", "#2f3547"],
    ],
    example: [
      "<code>analogReadMilliVolts(34)</code> gives a calibrated ADC result; multiply by two for this equal-resistor divider.",
      "The simulator halves the chosen battery voltage exactly; real resistors, ADC accuracy and board loading introduce error.",
      "The model uses one second active, then the selected sleep interval. <b>Wake button</b> interrupts sleep with a GPIO 33 cause.",
      "The 80 mA active / 0.02 mA sleep estimate is an ideal module duty-cycle example, not measured DevKit consumption or a battery-life guarantee. USB circuitry and regulators can dominate sleep current.",
    ],
    specs: [
      ["Monitored cell", "Simulated 3.0-4.2 V; not a charging circuit"],
      ["Divider", "R1 = R2 = 47 kOhm; 100 nF at ADC midpoint"],
      ["ADC", "GPIO 34 (ADC1), 11 dB attenuation, calibrated millivolts"],
      ["Wake", "Timer plus RTC GPIO 33 active LOW"],
      ["Power model", "Ideal module duty cycle; divider drain shown separately"],
    ],
    params: [
      range("voltage", "battery-cell", "Monitored battery", 3, 4.2, .1, 3.7, "V"),
      range("sleepSeconds", "battery-wake", "Sleep interval", 5, 60, 1, 10, "s"),
    ],
    callouts: [
      callout("battery-cell", "bolt", "Monitored cell", "USB powers the board; this cell feeds only the divider.", 280, -235, "bottom"),
      callout("battery-divider", "pins", "47k + 47k divider", "GPIO 34 sees at most 2.1 V; capacitor steadies the ADC.", 280, 170, "top"),
      callout("battery-wake", "button", "Wake · GPIO 33", "Press to wake from simulated deep sleep.", -310, 200, "top"),
    ],
    sim: "library:battery",
    code: `// Educational model: USB powers this DevKit; cell is measurement only.
#include <esp_sleep.h>
#include <driver/rtc_io.h>
const int ADC_PIN = 34;
const gpio_num_t WAKE_PIN = GPIO_NUM_33;

void setup() {
  Serial.begin(115200);
  rtc_gpio_deinit(WAKE_PIN);
  analogSetPinAttenuation(ADC_PIN, ADC_11db);
  float batteryV = analogReadMilliVolts(ADC_PIN) * 2.0F / 1000.0F;
  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  Serial.printf("Battery %.2f V; wake cause %d\\n", batteryV, cause);
  delay(1000); // one active second in this demonstration

  rtc_gpio_init(WAKE_PIN);
  rtc_gpio_set_direction(WAKE_PIN, RTC_GPIO_MODE_INPUT_ONLY);
  rtc_gpio_pullup_en(WAKE_PIN);
  rtc_gpio_pulldown_dis(WAKE_PIN);
  esp_sleep_enable_ext0_wakeup(WAKE_PIN, 0);
  esp_sleep_enable_timer_wakeup({{sleepSeconds}}ULL * 1000000ULL);
  Serial.println("Entering deep sleep");
  Serial.flush();
  esp_deep_sleep_start(); // wake restarts setup(), not loop()
}

void loop() {}`,
  },
  {
    id: "sdlogger", library: true, title: "microSD data logger",
    cardTitle: "24. microSD logger", cardW: 286, thumb: "oled",
    heading: "Timestamped microSD data logger",
    lede: "Wire a 3.3 V microSD breakout over SPI, append simulated readings to a virtual CSV file, and remove the card to test errors. The browser stores at most 200 records locally; it never writes to a physical SD card.",
    features: [
      ["pins", "SPI: SCK, MISO, MOSI and a separate chip select"],
      ["console", "Timestamped records, append and CSV export"],
      ["sensor", "Card removal stops writes with an explicit error"],
    ],
    pinout: [
      ["GPIO 18 / 19", "SCK / MISO", "Clock to card; data back from card.", "#8a63c9"],
      ["GPIO 23 / 5", "MOSI / CS", "Data to card; chip select LOW while communicating. GPIO 5 is a strapping pin: avoid pulling it LOW during reset.", "#3d6fc4"],
      ["3V3 / GND", "3.3 V breakout power", "Use a 3.3 V-only compatible breakout and logic. Do not assume a module labelled 5 V supports ESP32 signals.", "#d64a3a"],
      ["Time source", "Browser UTC in simulation", "Real hardware needs an RTC or synchronized NTP for calendar time; the example falls back to labelled uptime.", "#2aa38d"],
    ],
    example: [
      "<code>SPI.begin(18, 19, 23, 5)</code> identifies all four signal pins; <code>SD.begin(5)</code> mounts the card.",
      "Run and append records. <b>Record now</b> adds one immediately; <b>Export CSV</b> downloads only the browser's simulated file.",
      "Remove the card: no successful write is reported. Reinsert it to continue appending; existing virtual records survive reload.",
      "Never remove a real card during a write. Close files, use suitable power decoupling, and back up important data. The 200-record simulator limit prevents unbounded browser storage.",
    ],
    specs: [
      ["Bus", "SPI mode; GPIO 18 SCK, 19 MISO, 23 MOSI, 5 CS"],
      ["Breakout", "3.3 V logic and power; shared ground"],
      ["File", "/readings.csv; timestamp_utc,temperature_c"],
      ["Persistence", "Browser local storage; up to 200 simulated records"],
      ["Boundary", "No physical SD access; hardware libraries are instructional"],
    ],
    params: [
      range("temperature", "sd-card", "Logged temperature", 0, 50, 1, 22, "C"),
      range("interval", "sd-card", "Record interval", 1, 10, 1, 2, "s"),
      toggle("inserted", "sd-card", "Card inserted", true),
    ],
    callouts: [
      callout("sd-card", "console", "3.3 V microSD", "SPI, virtual CSV file and explicit card errors.", 280, -200, "bottom"),
      callout("sd-display", "clock", "Record monitor", "UTC timestamps here come from the browser clock.", 280, 210, "top"),
    ],
    sim: "library:sdlogger",
    code: `// Browser uses a virtual filesystem, not a real microSD card.
#include <SPI.h>
#include <SD.h>
#include <time.h>
const int CS_PIN = 5;
unsigned long lastRecord = 0;

void setup() {
  Serial.begin(115200);
  SPI.begin(18, 19, 23, CS_PIN);
  if (!SD.begin(CS_PIN)) {
    Serial.println("SD mount failed: check card, wiring and 3.3 V power");
    return;
  }
  if (!SD.exists("/readings.csv")) {
    File file = SD.open("/readings.csv", FILE_WRITE);
    if (!file) { Serial.println("Cannot create file"); return; }
    if (!file.println("timestamp,temperature_c")) {
      Serial.println("Header write failed");
    }
    file.close();
  }
  // Real calendar time requires a configured RTC or Wi-Fi + NTP.
}

void loop() {
  if (millis() - lastRecord < {{interval}} * 1000UL) return;
  lastRecord = millis();
  File file = SD.open("/readings.csv", FILE_APPEND);
  if (!file) { Serial.println("SD write failed"); return; }
  struct tm timeInfo;
  char timestamp[32];
  time_t now = time(nullptr);
  if (now >= 1577836800 && gmtime_r(&now, &timeInfo)) {
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", &timeInfo);
  } else {
    snprintf(timestamp, sizeof(timestamp), "uptime:%lu-ms", millis());
  }
  // Demo temperature; substitute a sensor on real hardware.
  char record[96];
  int length = snprintf(record, sizeof(record), "%s,%.1f\\n",
    timestamp, float({{temperature}}));
  bool written = length > 0 && length < sizeof(record) &&
    file.write((const uint8_t*)record, length) == size_t(length);
  file.flush();
  file.close();
  Serial.println(written ? "Record appended" : "Record write failed");
}`,
  },
];
