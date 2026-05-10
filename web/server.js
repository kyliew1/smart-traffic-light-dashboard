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

const PORT = process.env.PORT || 3000;
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "dashboard_client";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "dashboard_password";
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || "traffic/light1";

const mqttClient = mqtt.connect(MQTT_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD
});

let latestData = {
  mode: "unknown",
  light: "unknown",
  vehicle_count: 0,
  pedestrian_waiting: false,
  emergency: false,
  timestamp: null,
  esp32_status: "offline"
};

mqttClient.on("connect", () => {
  console.log("Connected to Mosquitto");
  mqttClient.subscribe(`${MQTT_TOPIC_PREFIX}/#`);
});

mqttClient.on("message", (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());

    if (topic === `${MQTT_TOPIC_PREFIX}/status`) {
      latestData = { ...latestData, ...payload, esp32_status: "online" };
      io.emit("trafficUpdate", latestData);
    }

    if (topic === `${MQTT_TOPIC_PREFIX}/heartbeat`) {
      latestData.esp32_status = "online";
      io.emit("trafficUpdate", latestData);
    }

    if (topic === `${MQTT_TOPIC_PREFIX}/alert`) {
      io.emit("trafficAlert", payload);
    }
  } catch (err) {
    console.error("Invalid JSON:", err.message);
  }
});

app.get("/api/status", (req, res) => {
  res.json(latestData);
});

app.post("/api/command", (req, res) => {
  const command = req.body;
  mqttClient.publish(`${MQTT_TOPIC_PREFIX}/command`, JSON.stringify(command));
  res.json({ success: true, sent: command });
});

server.listen(PORT, () => {
  console.log(`Web dashboard running at http://localhost:${PORT}`);
});