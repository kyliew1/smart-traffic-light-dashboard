/*
  MQTT Intersection Traffic Light Controller for ESP32

  Role of this ESP32:
  - Connect to Wi-Fi
  - Connect to private Mosquitto MQTT broker using username/password
  - Receive commands from Python controller on:
      traffic/intersection1/command
  - Control 4-way traffic lights
  - Publish current light status to:
      traffic/intersection1/status
  - Publish heartbeat to:
      traffic/intersection1/heartbeat

  The ESP32 does NOT run YOLO and does NOT receive camera frames.
  YOLO/Python should publish camera counts and decision commands separately.

  Required Arduino libraries:
  - PubSubClient
  - ArduinoJson
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
// =======================================================
// WIFI CONFIG
// =======================================================
const char* WIFI_SSID = "WIFI_NAME";
const char* WIFI_PASSWORD = "WIFI_PASSWORD";

// =======================================================
// MQTT CONFIG
// =======================================================
// Use your computer's IPv4 address here.
// Do NOT use "localhost" on ESP32.
// Example: const char* MQTT_SERVER = "192.168.1.25";
const char* MQTT_SERVER = "xxx";
const int MQTT_PORT = 1883;

const char* MQTT_CLIENT_ID = "ESP32IntersectionController";

const char* MQTT_USERNAME = "MQTT_USERNAME";
const char* MQTT_PASSWORD = "MQTT_PASSWORD";

const char* MQTT_TOPIC_PREFIX = "traffic/intersection1";

// MQTT topics:
// traffic/intersection1/command   <- ESP32 subscribes here
// traffic/intersection1/status    <- ESP32 publishes status here
// traffic/intersection1/heartbeat <- ESP32 publishes heartbeat here

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// =======================================================
// PIN DEFINITIONS
// Common anode LEDs, active LOW
// ledOn(pin)  = LOW
// ledOff(pin) = INPUT/high impedance
// =======================================================

// Intersection 1
const int G1 = 16;
const int Y1 = 17;
const int R1 = 18;

// Intersection 2
const int G2 = 19;
const int Y2 = 21;
const int R2 = 22;

// Intersection 3
const int G3 = 23;
const int Y3 = 25;
const int R3 = 26;

// Intersection 4
const int G4 = 27;
const int Y4 = 32;
const int R4 = 33;

const int ALL_PINS[] = {
  G1, Y1, R1,
  G2, Y2, R2,
  G3, Y3, R3,
  G4, Y4, R4
};

const int NUM_PINS = 12;

// =======================================================
// TIMING CONFIG
// =======================================================
const unsigned long GREEN_TIME = 5000;
const unsigned long YELLOW_TIME = 2000;
const unsigned long TRANSITION_DELAY = 500;
const unsigned long HEARTBEAT_INTERVAL = 5000;

unsigned long lastHeartbeat = 0;

// =======================================================
// TRAFFIC STATE
// =======================================================
String currentMode = "normal";
// Modes:
// normal
// two_way
// all_red
// emergency
// priority

String currentPhase = "startup";

String intersectionState[5] = {
  "",
  "RED",
  "RED",
  "RED",
  "RED"
};

int priorityRoad = 0;
unsigned long customGreenTime = GREEN_TIME;

// =======================================================
// FORWARD DECLARATIONS
// =======================================================
void publishStatus();
void publishHeartbeat();
void maintainMQTT();
void allRed();

// =======================================================
// BASIC LED CONTROL
// =======================================================
void ledOn(int pin) {
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
}

void ledOff(int pin) {
  pinMode(pin, INPUT);
}

void allLightsOff() {
  for (int i = 0; i < NUM_PINS; i++) {
    ledOff(ALL_PINS[i]);
  }
}

void setIntersectionState(int intersection, const char* state) {
  switch (intersection) {
    case 1:
      ledOff(G1); ledOff(Y1); ledOff(R1);
      if (strcmp(state, "GREEN") == 0) ledOn(G1);
      else if (strcmp(state, "YELLOW") == 0) ledOn(Y1);
      else if (strcmp(state, "RED") == 0) ledOn(R1);
      break;

    case 2:
      ledOff(G2); ledOff(Y2); ledOff(R2);
      if (strcmp(state, "GREEN") == 0) ledOn(G2);
      else if (strcmp(state, "YELLOW") == 0) ledOn(Y2);
      else if (strcmp(state, "RED") == 0) ledOn(R2);
      break;

    case 3:
      ledOff(G3); ledOff(Y3); ledOff(R3);
      if (strcmp(state, "GREEN") == 0) ledOn(G3);
      else if (strcmp(state, "YELLOW") == 0) ledOn(Y3);
      else if (strcmp(state, "RED") == 0) ledOn(R3);
      break;

    case 4:
      ledOff(G4); ledOff(Y4); ledOff(R4);
      if (strcmp(state, "GREEN") == 0) ledOn(G4);
      else if (strcmp(state, "YELLOW") == 0) ledOn(Y4);
      else if (strcmp(state, "RED") == 0) ledOn(R4);
      break;

    default:
      return;
  }

  intersectionState[intersection] = String(state);
}

void allRed() {
  setIntersectionState(1, "RED");
  setIntersectionState(2, "RED");
  setIntersectionState(3, "RED");
  setIntersectionState(4, "RED");
}

// =======================================================
// MQTT HELPERS
// =======================================================
String topic(const char* suffix) {
  return String(MQTT_TOPIC_PREFIX) + "/" + suffix;
}

void publishHeartbeat() {
  StaticJsonDocument<128> doc;

  doc["status"] = "online";
  doc["uptime_ms"] = millis();

  char buffer[128];
  serializeJson(doc, buffer);

  mqttClient.publish(topic("heartbeat").c_str(), buffer);
}

void publishStatus() {
  StaticJsonDocument<512> doc;

  doc["mode"] = currentMode;
  doc["phase"] = currentPhase;
  doc["timestamp"] = millis();

  JsonObject intersections = doc.createNestedObject("intersections");
  intersections["1"] = intersectionState[1];
  intersections["2"] = intersectionState[2];
  intersections["3"] = intersectionState[3];
  intersections["4"] = intersectionState[4];

  if (currentMode == "priority") {
    doc["priority_road"] = priorityRoad;
    doc["green_time"] = customGreenTime;
  }

  char buffer[512];
  serializeJson(doc, buffer);

  mqttClient.publish(topic("status").c_str(), buffer);
}

// =======================================================
// MQTT COMMAND HANDLER
// =======================================================
// Expected commands from Python controller:
//
// 1. Set mode:
// {
//   "action": "set_mode",
//   "value": "normal"
// }
//
// Supported values:
// normal, two_way, all_red, emergency
//
// 2. Set priority road:
// {
//   "action": "set_priority",
//   "road": 1,
//   "green_time": 10000
// }
//
// Supported road: 1, 2, 3, 4
//
void handleCommand(char* topicName, byte* payload, unsigned int length) {
  char message[256];

  if (length >= sizeof(message)) {
    length = sizeof(message) - 1;
  }

  memcpy(message, payload, length);
  message[length] = '\0';

  Serial.print("MQTT command received on ");
  Serial.print(topicName);
  Serial.print(": ");
  Serial.println(message);

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print("Invalid command JSON: ");
    Serial.println(error.c_str());
    return;
  }

  const char* action = doc["action"];

  if (!action) {
    Serial.println("Command ignored: missing action");
    return;
  }

  if (strcmp(action, "set_mode") == 0) {
    const char* value = doc["value"];

    if (!value) {
      Serial.println("Command ignored: missing value");
      return;
    }

    if (strcmp(value, "normal") == 0) {
      currentMode = "normal";
      priorityRoad = 0;
      currentPhase = "normal_requested";
    }
    else if (strcmp(value, "two_way") == 0) {
      currentMode = "two_way";
      priorityRoad = 0;
      currentPhase = "two_way_requested";
    }
    else if (strcmp(value, "all_red") == 0) {
      currentMode = "all_red";
      priorityRoad = 0;
      currentPhase = "all_red";
      allRed();
    }
    else if (strcmp(value, "emergency") == 0) {
      currentMode = "emergency";
      priorityRoad = 0;
      currentPhase = "emergency_requested";
    }
    else {
      Serial.println("Command ignored: unknown mode");
      return;
    }

    publishStatus();
    return;
  }

  if (strcmp(action, "set_priority") == 0) {
    int road = doc["road"] | 0;
    unsigned long greenTime = doc["green_time"] | GREEN_TIME;

    if (road < 1 || road > 4) {
      Serial.println("Command ignored: invalid priority road");
      return;
    }

    if (greenTime < 2000) {
      greenTime = 2000;
    }

    if (greenTime > 30000) {
      greenTime = 30000;
    }

    currentMode = "priority";
    currentPhase = "priority_requested";
    priorityRoad = road;
    customGreenTime = greenTime;

    publishStatus();
    return;
  }

  Serial.println("Command ignored: unknown action");
}

// =======================================================
// WIFI + MQTT CONNECTION
// =======================================================
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("WiFi connected. ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT broker at ");
    Serial.print(MQTT_SERVER);
    Serial.print(":");
    Serial.print(MQTT_PORT);
    Serial.print(" ... ");

    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println("connected");

      mqttClient.subscribe(topic("command").c_str());

      Serial.print("Subscribed to: ");
      Serial.println(topic("command"));

      publishHeartbeat();
      publishStatus();
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 2 seconds");

      delay(2000);
    }
  }
}

void maintainMQTT() {
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }

  mqttClient.loop();

  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = millis();
    publishHeartbeat();
  }
}

// Replacement for delay().
// This keeps MQTT alive while the traffic sequence is waiting.
void smartDelay(unsigned long ms) {
  unsigned long start = millis();
  String modeAtStart = currentMode;

  while (millis() - start < ms) {
    maintainMQTT();
    delay(10);

    // If Python sends a new mode while waiting, interrupt this phase.
    if (currentMode != modeAtStart) {
      return;
    }
  }
}

// =======================================================
// TRAFFIC LOGIC
// =======================================================
void trafficSequence() {
  currentMode = "normal";

  currentPhase = "intersection_1_green";
  setIntersectionState(1, "GREEN");
  setIntersectionState(2, "RED");
  setIntersectionState(3, "RED");
  setIntersectionState(4, "RED");
  publishStatus();
  smartDelay(GREEN_TIME);
  if (currentMode != "normal") return;

  currentPhase = "intersection_1_yellow";
  setIntersectionState(1, "YELLOW");
  publishStatus();
  smartDelay(YELLOW_TIME);
  if (currentMode != "normal") return;

  currentPhase = "intersection_2_green";
  setIntersectionState(1, "RED");
  setIntersectionState(2, "GREEN");
  setIntersectionState(3, "RED");
  setIntersectionState(4, "RED");
  publishStatus();
  smartDelay(GREEN_TIME);
  if (currentMode != "normal") return;

  currentPhase = "intersection_2_yellow";
  setIntersectionState(2, "YELLOW");
  publishStatus();
  smartDelay(YELLOW_TIME);
  if (currentMode != "normal") return;

  currentPhase = "intersection_3_green";
  setIntersectionState(2, "RED");
  setIntersectionState(3, "GREEN");
  setIntersectionState(1, "RED");
  setIntersectionState(4, "RED");
  publishStatus();
  smartDelay(GREEN_TIME);
  if (currentMode != "normal") return;

  currentPhase = "intersection_3_yellow";
  setIntersectionState(3, "YELLOW");
  publishStatus();
  smartDelay(YELLOW_TIME);
  if (currentMode != "normal") return;

  currentPhase = "intersection_4_green";
  setIntersectionState(3, "RED");
  setIntersectionState(4, "GREEN");
  setIntersectionState(1, "RED");
  setIntersectionState(2, "RED");
  publishStatus();
  smartDelay(GREEN_TIME);
  if (currentMode != "normal") return;

  currentPhase = "intersection_4_yellow";
  setIntersectionState(4, "YELLOW");
  publishStatus();
  smartDelay(YELLOW_TIME);
  if (currentMode != "normal") return;

  currentPhase = "transition_all_red";
  allRed();
  publishStatus();
  smartDelay(TRANSITION_DELAY);
}

void twoWayTrafficPattern() {
  currentMode = "two_way";

  currentPhase = "intersections_1_3_green";
  setIntersectionState(1, "GREEN");
  setIntersectionState(3, "GREEN");
  setIntersectionState(2, "RED");
  setIntersectionState(4, "RED");
  publishStatus();
  smartDelay(GREEN_TIME);
  if (currentMode != "two_way") return;

  currentPhase = "intersections_1_3_yellow";
  setIntersectionState(1, "YELLOW");
  setIntersectionState(3, "YELLOW");
  publishStatus();
  smartDelay(YELLOW_TIME);
  if (currentMode != "two_way") return;

  currentPhase = "all_red_transition";
  allRed();
  publishStatus();
  smartDelay(TRANSITION_DELAY);
  if (currentMode != "two_way") return;

  currentPhase = "intersections_2_4_green";
  setIntersectionState(1, "RED");
  setIntersectionState(3, "RED");
  setIntersectionState(2, "GREEN");
  setIntersectionState(4, "GREEN");
  publishStatus();
  smartDelay(GREEN_TIME);
  if (currentMode != "two_way") return;

  currentPhase = "intersections_2_4_yellow";
  setIntersectionState(2, "YELLOW");
  setIntersectionState(4, "YELLOW");
  publishStatus();
  smartDelay(YELLOW_TIME);
  if (currentMode != "two_way") return;

  currentPhase = "all_red_transition";
  allRed();
  publishStatus();
  smartDelay(TRANSITION_DELAY);
}

void priorityTrafficPattern() {
  if (priorityRoad < 1 || priorityRoad > 4) {
    currentMode = "normal";
    priorityRoad = 0;
    return;
  }

  currentPhase = "priority_road_" + String(priorityRoad) + "_green";

  for (int i = 1; i <= 4; i++) {
    if (i == priorityRoad) {
      setIntersectionState(i, "GREEN");
    } else {
      setIntersectionState(i, "RED");
    }
  }

  publishStatus();
  smartDelay(customGreenTime);
  if (currentMode != "priority") return;

  currentPhase = "priority_road_" + String(priorityRoad) + "_yellow";
  setIntersectionState(priorityRoad, "YELLOW");
  publishStatus();
  smartDelay(YELLOW_TIME);
  if (currentMode != "priority") return;

  currentPhase = "priority_done_all_red";
  allRed();
  publishStatus();
  smartDelay(TRANSITION_DELAY);

  currentMode = "normal";
  priorityRoad = 0;
  customGreenTime = GREEN_TIME;
}

void emergencyFlash() {
  currentPhase = "emergency_flash_off";

  allLightsOff();
  intersectionState[1] = "OFF";
  intersectionState[2] = "OFF";
  intersectionState[3] = "OFF";
  intersectionState[4] = "OFF";
  publishStatus();
  smartDelay(500);
  if (currentMode != "emergency") return;

  currentPhase = "emergency_flash_red";

  allRed();
  publishStatus();
  smartDelay(500);
}

void holdAllRed() {
  currentPhase = "all_red";
  allRed();
  publishStatus();
  smartDelay(1000);
}

// =======================================================
// SETUP
// =======================================================
void setup() {
  Serial.begin(115200);

  Serial.println();
  Serial.println("==========================================");
  Serial.println(" MQTT INTERSECTION TRAFFIC LIGHT SYSTEM");
  Serial.println("==========================================");

  allLightsOff();
  allRed();

  connectWiFi();

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(handleCommand);

  reconnectMQTT();

  currentMode = "normal";
  currentPhase = "system_ready";
  publishStatus();

  Serial.println("System ready.");
}

// =======================================================
// MAIN LOOP
// =======================================================
void loop() {
  maintainMQTT();

  if (currentMode == "normal") {
    trafficSequence();
  }
  else if (currentMode == "two_way") {
    twoWayTrafficPattern();
  }
  else if (currentMode == "priority") {
    priorityTrafficPattern();
  }
  else if (currentMode == "all_red") {
    holdAllRed();
  }
  else if (currentMode == "emergency") {
    emergencyFlash();
  }
  else {
    currentMode = "normal";
  }
}
