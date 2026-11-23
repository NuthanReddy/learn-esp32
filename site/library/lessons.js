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
  {
    id: "hallway", library: true, category: "Home automation",
    title: "Home: hallway light", cardTitle: "25. Home: hallway light",
    cardW: 310, thumb: "tablelamp", heading: "Home automation: hallway light",
    lede: "Turn on a tabletop LED only when the hallway is dark and motion is detected. More motion restarts the off-delay. Make it bright to switch the light off immediately. This is a browser model, not a mains lighting controller.",
    features: [
      ["sensor", "Darkness AND motion: two conditions before switching on"],
      ["clock", "Retriggerable off-delay; no blocking delay()"],
      ["bolt", "One small, current-limited LED, never a mains lamp"],
    ],
    pinout: [
      ["GPIO 27", "PIR digital output", "Use a 3.3 V-compatible PIR breakout with HIGH = motion; common ground.", "#3d6fc4"],
      ["GPIO 34", "LDR divider midpoint", "3V3 -> LDR -> midpoint -> 10k -> GND. Bright light raises the ADC reading; GPIO 34 is input-only.", "#2aa38d"],
      ["GPIO 25", "330 Ohm -> LED -> GND", "A small indicator LED only. The resistor limits current; never connect a lamp or LED strip directly.", "#f0a53a"],
      ["3V3 / GND", "Low-voltage reference", "No mains, relay contacts or physical appliance connection in this model.", "#2f3547"],
    ],
    example: [
      "Use <b>Motion pulse</b> or click the PIR to simulate a passing person. <b>Adjust simulation</b> can also hold motion HIGH.",
      "Motion in daylight does nothing. In darkness it lights the LED and starts a timer; another detection gives a full new off-delay.",
      "The light turns off when the timer expires or daylight returns. Sustained motion keeps extending the timer.",
      "Light level is a relative ADC percentage, not calibrated lux. Run starts a fresh simulated controller; Stop switches the demo output off.",
    ],
    specs: [
      ["Category", "Home automation / low-voltage tabletop"],
      ["Inputs", "3.3 V PIR, LDR + 10k divider on ADC1 GPIO 34"],
      ["Output", "Small LED through 330 Ohm on GPIO 25"],
      ["Timing", "2-15 second retriggerable off-delay"],
      ["Boundary", "Simulated only; no mains lamp, account or device connection"],
    ],
    params: [
      range("lightLevel", "hallway-ldr", "Relative light level", 0, 100, 1, 20, "%"),
      range("darkThreshold", "hallway-ldr", "Dark below", 10, 80, 1, 35, "%"),
      range("offDelay", "hallway-light", "Off-delay", 2, 15, 1, 5, "s"),
      toggle("motion", "hallway-pir", "Hold motion detected", false),
    ],
    callouts: [
      callout("hallway-pir", "sensor", "Motion · GPIO 27", "Click for a passing-person pulse; motion must coincide with darkness.", 280, -240, "bottom"),
      callout("hallway-ldr", "knob", "Darkness · GPIO 34", "Adjust relative light level and the dark threshold.", 280, 170, "top"),
      callout("hallway-light", "bolt", "Tabletop LED", "Motion retriggers its off-delay. No mains lamp is connected.", -310, 200, "top"),
    ],
    sim: "library:hallway",
    code: `// Tabletop teaching model: small LED only, no mains appliance.
const int PIR_PIN = 27, LIGHT_ADC = 34, LED_PIN = 25;
const int DARK_BELOW = {{darkThreshold}};
const unsigned long OFF_DELAY = {{offDelay}} * 1000UL;
unsigned long lastMotion = 0;
bool lightOn = false;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // LED has a 330 Ohm series resistor
}

void loop() {
  unsigned long now = millis();
  int level = analogRead(LIGHT_ADC) * 100L / 4095;
  bool dark = level < DARK_BELOW;
  bool motion = digitalRead(PIR_PIN) == HIGH;
  bool previous = lightOn;
  if (!dark) lightOn = false;
  else {
    if (motion) { lightOn = true; lastMotion = now; }
    if (lightOn && now - lastMotion >= OFF_DELAY) lightOn = false;
  }
  digitalWrite(LED_PIN, lightOn ? HIGH : LOW);
  if (previous != lightOn)
    Serial.println(lightOn ? "Hallway LED ON" : "Hallway LED OFF");
  delay(20); // short input polling, not the off-delay
}`,
  },
  {
    id: "ventilation", library: true, category: "Home automation",
    title: "Home: humidity fan", cardTitle: "26. Home: humidity fan",
    cardW: 306, thumb: "wheel", heading: "Home automation: humidity fan",
    lede: "Raise the simulated bathroom humidity to start a low-voltage tabletop fan. A lower switch-off threshold keeps it running through the middle band instead of chattering. A driver handles the motor current, not an ESP32 GPIO.",
    features: [
      ["sensor", "Humidity from a simulated 3.3 V I2C sensor"],
      ["knob", "Separate ON and OFF thresholds demonstrate hysteresis"],
      ["motor", "5 V tabletop motor through a MOSFET and flyback diode"],
    ],
    pinout: [
      ["GPIO 21 / 22", "BME280 SDA / SCL", "Sensor powered at 3.3 V; pull-ups must also be 3.3 V.", "#3d6fc4"],
      ["GPIO 26", "100 Ohm -> MOSFET gate", "Use a 3.3 V-logic-rated N-MOSFET, 100k gate-source pull-down, source to common ground.", "#f0a53a"],
      ["External +5V", "Tabletop fan positive", "Regulated low-voltage motor supply, not GPIO or the board's 3V3 regulator. Fan negative goes to MOSFET drain.", "#d64a3a"],
      ["Flyback / GND", "Diode across DC motor", "Diode cathode stripe to +5V, anode to drain; join supply negative and ESP32 GND. No mains appliance wiring.", "#2f3547"],
    ],
    example: [
      "Start below the OFF threshold, then raise humidity to the ON threshold. Watch the rotor and serial feedback.",
      "Once ON, values between the thresholds keep the fan ON. Once OFF, the same middle-band values keep it OFF.",
      "Adjust the two thresholds separately. Their slider ranges keep the OFF threshold below ON.",
      "The motor/driver is a low-voltage teaching model, not an installation guide for a real bathroom fan. Stop switches the simulated motor off; reduced-motion mode suppresses rotor animation.",
    ],
    specs: [
      ["Category", "Home automation / humidity hysteresis"],
      ["Sensor", "Simulated BME280, I2C 0x76, 3.3 V logic"],
      ["Thresholds", "ON 60-90%; OFF 30-59%; default 70 / 50% RH"],
      ["Load", "Low-current 5 V tabletop DC motor/fan and rated driver"],
      ["Boundary", "No real appliance, mains, Wi-Fi account or safety guarantee"],
    ],
    params: [
      range("humidity", "vent-sensor", "Relative humidity", 20, 95, 1, 45, "%"),
      range("onThreshold", "vent-driver", "Fan ON at or above", 60, 90, 1, 70, "%"),
      range("offThreshold", "vent-driver", "Fan OFF at or below", 30, 59, 1, 50, "%"),
    ],
    callouts: [
      callout("vent-sensor", "sensor", "Humidity · I2C", "Change the simulated humidity and watch both thresholds.", 280, -240, "bottom"),
      callout("vent-driver", "pins", "MOSFET driver", "GPIO controls a gate, never the motor current.", 280, 180, "top"),
      callout("vent-fan", "motor", "5 V tabletop fan", "Its previous state is retained inside the humidity band.", -310, 200, "top"),
    ],
    sim: "library:ventilation",
    code: `// Low-voltage tabletop DC motor with MOSFET and flyback diode.
#include <Wire.h>
#include <Adafruit_BME280.h>
Adafruit_BME280 sensor;
const int GATE_PIN = 26;
const float ON_RH = {{onThreshold}}, OFF_RH = {{offThreshold}};
bool fanOn = false;
unsigned long lastSample = 0;

void setup() {
  Serial.begin(115200);
  pinMode(GATE_PIN, OUTPUT);
  digitalWrite(GATE_PIN, LOW);
  Wire.begin(21, 22);
  if (!sensor.begin(0x76)) {
    Serial.println("Humidity sensor missing; fan stays OFF");
    while (true) delay(1000);
  }
}

void loop() {
  if (millis() - lastSample < 500) return;
  lastSample = millis();
  float rh = sensor.readHumidity();
  if (!isfinite(rh)) {
    fanOn = false;
    digitalWrite(GATE_PIN, LOW);
    Serial.println("Invalid reading; tabletop motor OFF");
    return;
  }
  if (!fanOn && rh >= ON_RH) fanOn = true;
  else if (fanOn && rh <= OFF_RH) fanOn = false;
  digitalWrite(GATE_PIN, fanOn ? HIGH : LOW);
  Serial.printf("Humidity %.0f %% RH; fan %s\\n", rh, fanOn ? "ON" : "OFF");
}`,
  },
  {
    id: "leak", library: true, category: "Home automation",
    title: "Home: leak indicator", cardTitle: "27. Home: leak indicator",
    cardW: 316, thumb: "tank", heading: "Home automation: leak indicator",
    lede: "Wet the simulated under-sink probe to latch a local red LED alert. Drying the probe does not clear it: a separate reset is required, and reset is refused while wet. This teaching model is not a flood alarm or safety system.",
    features: [
      ["sensor", "Wetness latches a local alert, even after the probe dries"],
      ["button", "Reset is accepted only when the probe is dry"],
      ["bolt", "Low-voltage indicator only; no valve, mains or cloud service"],
    ],
    pinout: [
      ["GPIO 27", "Conditioned wetness input", "Assumes a 3.3 V-compatible digital interface with HIGH = wet. Check real module voltage and polarity.", "#3d6fc4"],
      ["GPIO 25", "330 Ohm -> red LED -> GND", "A small current-limited local indicator, not a siren or an actuator.", "#f0a53a"],
      ["GPIO 33", "Reset button -> GND", "INPUT_PULLUP; a new LOW press requests reset. Wetness takes priority.", "#2aa38d"],
      ["3V3 / GND", "Probe interface power", "Never expose a GPIO to mains or an unconditioned higher-voltage probe. Resistive probes can corrode under continuous bias.", "#2f3547"],
    ],
    example: [
      "Run, then choose <b>Wet probe</b>. The red LED and serial log show the latched alert.",
      "<b>Reset alert</b> while wet is rejected. Choose <b>Dry probe</b>: the alert stays latched until you reset.",
      "Click the probe to inspect its wetness control or the 3D reset button to request a reset.",
      "Run starts a fresh simulated controller. The alert is not persisted across reloads, and Stop pauses the demo. Do not rely on it to protect people or property.",
    ],
    specs: [
      ["Category", "Home automation / latch and reset priority"],
      ["Probe", "Simulated 3.3 V conditioned digital wetness input"],
      ["Alert", "Small red LED via 330 Ohm on GPIO 25"],
      ["Reset", "GPIO 33 active LOW; accepted only when dry"],
      ["Boundary", "Educational model only, not a leak-protection or safety system"],
    ],
    params: [toggle("wet", "leak-probe", "Probe wet", false)],
    callouts: [
      callout("leak-probe", "sensor", "Under-sink probe", "Wet it, then dry it: the alert remains latched.", 280, -240, "bottom"),
      callout("leak-alert", "bolt", "Local red indicator", "A small LED, not a real flood alarm.", 280, 170, "top"),
      callout("leak-reset", "button", "Reset · GPIO 33", "A wet probe blocks reset; dry it first.", -310, 200, "top"),
    ],
    sim: "library:leak",
    code: `// Educational low-voltage indicator; not a safety system.
const int WET_PIN = 27, ALERT_PIN = 25, RESET_PIN = 33;
bool latched = false, previousReset = false;

void setup() {
  Serial.begin(115200);
  pinMode(WET_PIN, INPUT_PULLDOWN); // conditioned 3.3 V HIGH = wet
  pinMode(RESET_PIN, INPUT_PULLUP);
  pinMode(ALERT_PIN, OUTPUT);
  digitalWrite(ALERT_PIN, LOW); // red LED through 330 Ohm
}

void loop() {
  bool wet = digitalRead(WET_PIN) == HIGH;
  bool resetPressed = digitalRead(RESET_PIN) == LOW;
  if (wet && !latched) {
    latched = true;
    Serial.println("Wet probe: alert LATCHED");
  }
  if (resetPressed && !previousReset) {
    if (wet) Serial.println("Reset REFUSED: probe is still wet");
    else { latched = false; Serial.println("Dry reset: alert cleared"); }
  }
  previousReset = resetPressed;
  digitalWrite(ALERT_PIN, latched ? HIGH : LOW);
  delay(25); // simple press polling; real buttons need suitable debounce
}`,
  },
];

export const TOTAL_LESSONS = 20 + newLessons.length;
