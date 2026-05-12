require("dotenv").config();

const fs = require("fs");
const path = require("path");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mqtt = require("mqtt");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());
app.get("/favicon.ico", (req, res) => res.status(204).end());

// =========================
// CONFIG
// =========================
const PORT = process.env.PORT || 3000;

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || "traffic/intersection1";

const ESP32_TIMEOUT_MS = Number(process.env.ESP32_TIMEOUT_MS || 10000);
const AUTO_PHASE_COMMAND_COOLDOWN_MS = Number(process.env.AUTO_PHASE_COMMAND_COOLDOWN_MS || 2000);
const AUTO_TARGET_GREEN_TIME_MS = Number(process.env.AUTO_TARGET_GREEN_TIME_MS || 8000);

// =========================
// MQTT CONNECTION
// =========================
const mqttOptions = {};
if (MQTT_USERNAME) mqttOptions.username = MQTT_USERNAME;
if (MQTT_PASSWORD) mqttOptions.password = MQTT_PASSWORD;

const mqttClient = mqtt.connect(MQTT_URL, mqttOptions);

// =========================
// DASHBOARD STATE
// =========================
let dashboardMode = "normal";
let lastHeartbeatTime = null;
let lastAutomaticTargetPhase = null;
let lastAutomaticCommandTime = 0;

let latestData = {
  esp32_status: "offline",
  mode: dashboardMode,
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
    },
    control_logic: {},
    adas_status: {},
    timestamp: null
  },
  decision: null,
  timestamp: null
};

const SNAPSHOT_TOPIC = "robot/camera/snapshot";

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");

  // Subscribe to normal traffic / YOLO topics
  mqttClient.subscribe(`${MQTT_TOPIC_PREFIX}/#`, { qos: 1 }, (err) => {
    if (err) {
      console.error(`Failed to subscribe to ${MQTT_TOPIC_PREFIX}/#:`, err);
    } else {
      console.log(`Subscribed to: ${MQTT_TOPIC_PREFIX}/#`);
    }
  });
});

let latestSnapshotUrl = null;

function handleCameraSnapshot(imageBuffer) {
  try {
    const uploadsDir = path.join(__dirname, "uploads");

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
      console.log("uploads folder created");
    }

    const filename = `camera_snapshot_${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);

    fs.writeFileSync(filepath, imageBuffer);

    latestSnapshotUrl = `/uploads/${filename}`;

    console.log("Snapshot saved:", latestSnapshotUrl);

    io.emit("cameraSnapshot", {
      imageUrl: latestSnapshotUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to save snapshot:", err);
  }
}

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

function normalizeTargetPhase(targetPhase) {
  if (!targetPhase) return null;

  const phase = String(targetPhase).trim().toUpperCase();

  const aliases = {
    NS: "NS_GREEN",
    NORTH_SOUTH: "NS_GREEN",
    NORTH_SOUTH_GREEN: "NS_GREEN",
    NS_GREEN: "NS_GREEN",

    EW: "EW_GREEN",
    EAST_WEST: "EW_GREEN",
    EAST_WEST_GREEN: "EW_GREEN",
    EW_GREEN: "EW_GREEN",

    N: "N_GREEN",
    NORTH: "N_GREEN",
    N_GREEN: "N_GREEN",
    NORTH_GREEN: "N_GREEN",

    E: "E_GREEN",
    EAST: "E_GREEN",
    E_GREEN: "E_GREEN",
    EAST_GREEN: "E_GREEN",

    S: "S_GREEN",
    SOUTH: "S_GREEN",
    S_GREEN: "S_GREEN",
    SOUTH_GREEN: "S_GREEN",

    W: "W_GREEN",
    WEST: "W_GREEN",
    W_GREEN: "W_GREEN",
    WEST_GREEN: "W_GREEN"
  };

  return aliases[phase] || null;
}

function handleAutomaticCameraTarget(payload) {
  if (dashboardMode !== "automatic") return;

  const rawTargetPhase = payload.control_logic?.target_phase;
  const targetPhase = normalizeTargetPhase(rawTargetPhase);

  if (!targetPhase) {
    console.log("Automatic mode: ignored unknown target_phase:", rawTargetPhase);
    return;
  }

  const now = Date.now();
  const cooldownReady = now - lastAutomaticCommandTime >= AUTO_PHASE_COMMAND_COOLDOWN_MS;

  // Send if target changed, or repeat occasionally so ESP32 keeps holding the target.
  const shouldSend = targetPhase !== lastAutomaticTargetPhase || cooldownReady;
  if (!shouldSend) return;

  const mqttCommand = {
    action: "set_target_phase",
    target_phase: targetPhase,
    hold: true,
    green_time: AUTO_TARGET_GREEN_TIME_MS,
    source: "automatic_camera",
    timestamp: new Date().toISOString()
  };

  mqttClient.publish(`${MQTT_TOPIC_PREFIX}/command`, JSON.stringify(mqttCommand));

  lastAutomaticTargetPhase = targetPhase;
  lastAutomaticCommandTime = now;

  latestData.decision = {
    mode: "automatic",
    target_phase: targetPhase,
    green_time: AUTO_TARGET_GREEN_TIME_MS,
    timestamp: mqttCommand.timestamp
  };

  io.emit("decisionUpdate", latestData.decision);
  console.log("Automatic target-phase command sent:", mqttCommand);
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
  // 1. Intercept Snapshot (Binary JPEG) BEFORE trying to parse JSON
  if (topic === SNAPSHOT_TOPIC) {
    console.log("Snapshot topic received");
    handleCameraSnapshot(message);
    return;
  }

  // 2. Safely parse JSON for all other topics
  const payload = safeJsonParse(topic, message);
  if (!payload) return;

  console.log("MQTT message:", topic, payload);

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

  if (topic === `${MQTT_TOPIC_PREFIX}/camera`) {
    latestData.camera = {
      vehicle_count: payload.vehicle_count || { 1: 0, 2: 0, 3: 0, 4: 0 },
      control_logic: payload.control_logic || {},
      adas_status: payload.adas_status || {},
      timestamp: payload.timestamp || new Date().toISOString()
    };

    if (payload.control_logic?.current_phase) {
      latestData.camera_current_phase = payload.control_logic.current_phase;
    }

    if (payload.control_logic?.target_phase) {
      latestData.camera_target_phase = payload.control_logic.target_phase;
    }

    latestData.timestamp = payload.timestamp || new Date().toISOString();

    handleAutomaticCameraTarget(payload);

    io.emit("cameraUpdate", latestData.camera);
    broadcastUpdate();
    return;
  }

  if (topic === `${MQTT_TOPIC_PREFIX}/decision`) {
    latestData.decision = payload;
    io.emit("decisionUpdate", payload);
    broadcastUpdate();
    return;
  }

  if (topic === `${MQTT_TOPIC_PREFIX}/alert`) {
    io.emit("trafficAlert", payload);
    return;
  }
});

// =========================
// ESP32 OFFLINE CHECK
// =========================
setInterval(() => {
  if (!lastHeartbeatTime) return;

  const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTime;

  if (timeSinceLastHeartbeat > ESP32_TIMEOUT_MS && latestData.esp32_status !== "offline") {
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

  command.action = String(command.action).trim();
  if (command.value) command.value = String(command.value).trim().toLowerCase();

  console.log("Received command:", command);

  const allowedModes = ["normal", "two_way", "all_red", "emergency", "automatic"];

  if (command.action === "set_mode") {
    if (!allowedModes.includes(command.value)) {
      return res.status(400).json({
        success: false,
        error: "Invalid mode. Use normal, two_way, all_red, emergency, or automatic."
      });
    }

    dashboardMode = command.value;
    latestData.mode = dashboardMode;

    if (dashboardMode !== "automatic") {
      lastAutomaticTargetPhase = null;
      lastAutomaticCommandTime = 0;
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

  // Automatic is a server-side mode. ESP32 only receives set_target_phase from camera data.
  const shouldPublishToEsp32 = !(command.action === "set_mode" && command.value === "automatic");

  if (shouldPublishToEsp32) {
    mqttClient.publish(`${MQTT_TOPIC_PREFIX}/command`, JSON.stringify(mqttCommand));
  }

  broadcastUpdate();

  res.json({
    success: true,
    sent: mqttCommand,
    published_to_esp32: shouldPublishToEsp32
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
