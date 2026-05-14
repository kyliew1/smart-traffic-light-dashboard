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

// =========================
// CONFIG
// =========================
const PORT = process.env.PORT || 3000;

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || "traffic/intersection1";

const SNAPSHOT_TOPIC = process.env.SNAPSHOT_TOPIC || "robot/camera/snapshot";

const ESP32_TIMEOUT_MS = Number(process.env.ESP32_TIMEOUT_MS || 10000);
const AUTO_PHASE_COMMAND_COOLDOWN_MS = Number(process.env.AUTO_PHASE_COMMAND_COOLDOWN_MS || 2000);
const AUTO_TARGET_GREEN_TIME_MS = Number(process.env.AUTO_TARGET_GREEN_TIME_MS || 8000);

// =========================
// EXPRESS SETUP
// =========================
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("uploads folder created");
}

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadsDir));
app.use(express.json({ limit: "10mb" }));

app.get("/favicon.ico", (req, res) => res.status(204).end());

// =========================
// MQTT CONNECTION
// =========================
const mqttOptions = {
  reconnectPeriod: 2000,
};

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
let latestSnapshotUrl = null;

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
  latest_snapshot_url: null,
  timestamp: null
};

// =========================
// SOCKET.IO
// =========================
io.on("connection", (socket) => {
  console.log("Dashboard connected with socket:", socket.id);

  socket.emit("trafficUpdate", latestData);

  if (latestSnapshotUrl) {
    socket.emit("cameraSnapshot", {
      imageUrl: latestSnapshotUrl,
      timestamp: new Date().toISOString(),
    });
  }
});

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

function isAllFlashingRedPhase(value) {
  if (!value) return false;

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");

  return (
    normalized === "all flashing red mode" ||
    normalized === "all flashing red" ||
    normalized === "flashing red" ||
    normalized === "emergency flash"
  );
}

function publishEsp32Command(command) {
  const topic = `${MQTT_TOPIC_PREFIX}/command`;
  mqttClient.publish(topic, JSON.stringify(command), { qos: 1 }, (err) => {
    if (err) {
      console.error("Failed to publish ESP32 command:", err.message);
    } else {
      console.log("Published ESP32 command:", topic, command);
    }
  });
}

function emitAccidentAlert(payload) {
  const controlLogic = payload.control_logic || {};

  io.emit("trafficAlert", {
    type: "danger",
    message: "Accident detected. Switching to all flashing red mode.",
    details: `Current phase: ${controlLogic.current_phase || "-"}`
  });

  io.emit("accidentAlert", {
    type: "ACCIDENT",
    message: "Accident detected. Switching to all flashing red mode.",
    location: payload.alert?.location || "Main intersection",
    timestamp: payload.timestamp || new Date().toISOString(),
    current_phase: controlLogic.current_phase || "all flashing red mode",
    imageUrl: latestSnapshotUrl || "/images/accident-placeholder.svg"
  });
}

function handleCameraSnapshot(imageBuffer) {
  try {
    console.log("handleCameraSnapshot() called. Size:", imageBuffer.length, "bytes");

    if (!imageBuffer || imageBuffer.length === 0) {
      console.warn("Snapshot ignored because image buffer is empty");
      return;
    }

    const filename = `camera_snapshot_${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);

    fs.writeFileSync(filepath, imageBuffer);

    latestSnapshotUrl = `/uploads/${filename}`;
    latestData.latest_snapshot_url = latestSnapshotUrl;

    console.log("Snapshot saved:", latestSnapshotUrl);
    console.log("Emitting cameraSnapshot to dashboard...");

    io.emit("cameraSnapshot", {
      imageUrl: latestSnapshotUrl,
      timestamp: new Date().toISOString(),
    });

    console.log("cameraSnapshot emitted");

    broadcastUpdate();
  } catch (err) {
    console.error("Failed to save or emit snapshot:", err);
  }
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

  publishEsp32Command(mqttCommand);

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

function handleCameraPayload(payload) {
  latestData.camera = {
    vehicle_count: payload.vehicle_count || { 1: 0, 2: 0, 3: 0, 4: 0 },
    control_logic: payload.control_logic || {},
    adas_status: payload.adas_status || {},
    timestamp: payload.timestamp || new Date().toISOString()
  };

  const controlLogic = payload.control_logic || {};
  const adasStatus = payload.adas_status || {};

  if (controlLogic.current_phase) {
    latestData.camera_current_phase = controlLogic.current_phase;
  }

  if (controlLogic.target_phase) {
    latestData.camera_target_phase = controlLogic.target_phase;
  }

  latestData.timestamp = payload.timestamp || new Date().toISOString();

  const accidentDetected =
    adasStatus.accident_detected === true ||
    isAllFlashingRedPhase(controlLogic.current_phase) ||
    isAllFlashingRedPhase(controlLogic.target_phase);

  if (accidentDetected) {
    dashboardMode = "emergency";
    latestData.mode = "emergency";

    const emergencyCommand = {
      action: "set_mode",
      value: "emergency",
      mode: "all flashing red mode",
      current_phase: "all flashing red mode",
      target_phase: "all flashing red mode",
      reason: "accident_detected",
      timestamp: new Date().toISOString()
    };

    publishEsp32Command(emergencyCommand);
    emitAccidentAlert(payload);
  } else {
    handleAutomaticCameraTarget(payload);
  }

  io.emit("cameraUpdate", latestData.camera);
  broadcastUpdate();
}

// =========================
// MQTT EVENTS
// =========================
mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");

  const trafficTopic = `${MQTT_TOPIC_PREFIX}/#`;

  mqttClient.subscribe(trafficTopic, { qos: 1 }, (err) => {
    if (err) {
      console.error(`Failed to subscribe to ${trafficTopic}:`, err);
    } else {
      console.log(`Subscribed to: ${trafficTopic}`);
    }
  });

  mqttClient.subscribe(SNAPSHOT_TOPIC, { qos: 1 }, (err) => {
    if (err) {
      console.error(`Failed to subscribe to ${SNAPSHOT_TOPIC}:`, err);
    } else {
      console.log(`Subscribed to: ${SNAPSHOT_TOPIC}`);
    }
  });
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
  console.log("MQTT message received from:", topic);

  // IMPORTANT:
  // Snapshot is binary JPEG, not JSON. Handle it before JSON.parse().
  if (topic === SNAPSHOT_TOPIC) {
    console.log("Snapshot topic received");
    handleCameraSnapshot(message);
    return;
  }

  const payload = safeJsonParse(topic, message);
  if (!payload) return;

  console.log("MQTT JSON message:", topic, payload);

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
    handleCameraPayload(payload);
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

app.get("/api/latest-snapshot", (req, res) => {
  res.json({
    imageUrl: latestSnapshotUrl,
    timestamp: new Date().toISOString()
  });
});

// Use this to test Socket.IO from the browser:
// http://localhost:3000/test-snapshot-event
app.get("/test-snapshot-event", (req, res) => {
  const imageUrl = latestSnapshotUrl || "/images/accident-placeholder.svg";

  io.emit("cameraSnapshot", {
    imageUrl,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: "cameraSnapshot emitted",
    imageUrl
  });
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

  const shouldPublishToEsp32 = !(command.action === "set_mode" && command.value === "automatic");

  if (shouldPublishToEsp32) {
    publishEsp32Command(mqttCommand);
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
  console.log(`Snapshot topic: ${SNAPSHOT_TOPIC}`);
});
