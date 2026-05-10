require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mqtt = require("mqtt");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

// =========================
// CONFIG
// =========================
const PORT = process.env.PORT || 3000;

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || "traffic/intersection1";

const ESP32_TIMEOUT_MS = Number(process.env.ESP32_TIMEOUT_MS || 10000);

// =========================
// MQTT CONNECTION
// =========================
const mqttOptions = {};

if (MQTT_USERNAME) {
  mqttOptions.username = MQTT_USERNAME;
}

if (MQTT_PASSWORD) {
  mqttOptions.password = MQTT_PASSWORD;
}

const mqttClient = mqtt.connect(MQTT_URL, mqttOptions);

// =========================
// DASHBOARD STATE
// =========================
let latestData = {
  esp32_status: "offline",
  mode: "unknown",
  phase: "unknown",
  intersections: {
    1: "RED",
    2: "RED",
    3: "RED",
    4: "RED"
  },
  camera: {
    vehicle_count: {
      1: 0,
      2: 0,
      3: 0,
      4: 0
    }
  },
  decision: null,
  timestamp: null
};

let lastHeartbeatTime = null;

// =========================
// HELPER FUNCTIONS
// =========================
function markEsp32Online() {
  lastHeartbeatTime = Date.now();
  latestData.esp32_status = "online";
}

function broadcastUpdate() {
  io.emit("trafficUpdate", latestData);
}

function safeJsonParse(topic, message) {
  try {
    return JSON.parse(message.toString());
  } catch (err) {
    console.error("Invalid JSON from topic:", topic);
    console.error("Message:", message.toString());
    return null;
  }
}

// =========================
// MQTT EVENTS
// =========================
mqttClient.on("connect", () => {
  console.log("Connected to Mosquitto");

  const topic = `${MQTT_TOPIC_PREFIX}/#`;
  mqttClient.subscribe(topic);

  console.log("Subscribed to:", topic);
});

mqttClient.on("error", (err) => {
  console.error("MQTT error:", err.message);
});

mqttClient.on("offline", () => {
  console.log("MQTT client is offline");
});

mqttClient.on("reconnect", () => {
  console.log("Reconnecting to MQTT broker...");
});

mqttClient.on("message", (topic, message) => {
  const payload = safeJsonParse(topic, message);

  if (!payload) {
    return;
  }

  console.log("MQTT message:", topic, payload);

  // ESP32 publishes current traffic light status here
  if (topic === `${MQTT_TOPIC_PREFIX}/status`) {
    markEsp32Online();

    latestData = {
      ...latestData,
      ...payload,
      esp32_status: "online",
      timestamp: payload.timestamp || new Date().toISOString()
    };

    broadcastUpdate();
    return;
  }

  // ESP32 publishes heartbeat here
  if (topic === `${MQTT_TOPIC_PREFIX}/heartbeat`) {
    markEsp32Online();

    latestData = {
      ...latestData,
      esp32_status: "online",
      timestamp: new Date().toISOString()
    };

    broadcastUpdate();
    return;
  }

  // Python YOLO/camera script publishes vehicle count here
  if (topic === `${MQTT_TOPIC_PREFIX}/camera`) {
    latestData.camera = payload;

    io.emit("cameraUpdate", payload);
    broadcastUpdate();
    return;
  }

  // Python controller can publish its decision reason here
  if (topic === `${MQTT_TOPIC_PREFIX}/decision`) {
    latestData.decision = payload;

    io.emit("decisionUpdate", payload);
    broadcastUpdate();
    return;
  }

  // Optional alert topic
  if (topic === `${MQTT_TOPIC_PREFIX}/alert`) {
    io.emit("trafficAlert", payload);
    return;
  }
});

// =========================
// ESP32 OFFLINE CHECK
// =========================
setInterval(() => {
  if (!lastHeartbeatTime) {
    return;
  }

  const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTime;

  if (
    timeSinceLastHeartbeat > ESP32_TIMEOUT_MS &&
    latestData.esp32_status !== "offline"
  ) {
    latestData.esp32_status = "offline";
    broadcastUpdate();
    console.log("ESP32 is offline");
  }
}, 1000);

// =========================
// API ROUTES
// =========================
app.get("/api/status", (req, res) => {
  res.json(latestData);
});

app.post("/api/command", (req, res) => {
  const command = req.body;

  if (!command || !command.action) {
    return res.status(400).json({
      success: false,
      error: "Missing command action"
    });
  }

  const allowedModes = ["normal", "two_way", "all_red", "emergency"];

  if (command.action === "set_mode") {
    if (!allowedModes.includes(command.value)) {
      return res.status(400).json({
        success: false,
        error: "Invalid mode. Use normal, two_way, all_red, or emergency."
      });
    }
  } else if (command.action === "set_priority") {
    const road = Number(command.road);
    const greenTime = Number(command.green_time);

    if (![1, 2, 3, 4].includes(road)) {
      return res.status(400).json({
        success: false,
        error: "Invalid road. Use road 1, 2, 3, or 4."
      });
    }

    if (greenTime < 2000 || greenTime > 30000) {
      return res.status(400).json({
        success: false,
        error: "Invalid green_time. Use 2000 to 30000 milliseconds."
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      error: "Invalid action. Use set_mode or set_priority."
    });
  }

  const mqttCommand = {
    ...command,
    timestamp: new Date().toISOString()
  };

  mqttClient.publish(
    `${MQTT_TOPIC_PREFIX}/command`,
    JSON.stringify(mqttCommand)
  );

  res.json({
    success: true,
    sent: mqttCommand
  });
});

// =========================
// START SERVER
// =========================
server.listen(PORT, () => {
  console.log(`Web dashboard running at http://localhost:${PORT}`);
  console.log(`MQTT URL: ${MQTT_URL}`);
  console.log(`MQTT topic prefix: ${MQTT_TOPIC_PREFIX}`);
});