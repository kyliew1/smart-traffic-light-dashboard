const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mqtt = require("mqtt");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

const mqttClient = mqtt.connect("mqtt://localhost:1883", {
  username: "dashboard_client",
  password: "dashboard_password"
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
  mqttClient.subscribe("traffic/light1/#");
});

mqttClient.on("message", (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());

    if (topic === "traffic/light1/status") {
      latestData = { ...latestData, ...payload, esp32_status: "online" };
      io.emit("trafficUpdate", latestData);
    }

    if (topic === "traffic/light1/heartbeat") {
      latestData.esp32_status = "online";
      io.emit("trafficUpdate", latestData);
    }

    if (topic === "traffic/light1/alert") {
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
  mqttClient.publish("traffic/light1/command", JSON.stringify(command));
  res.json({ success: true, sent: command });
});

server.listen(3000, () => {
  console.log("Web dashboard running at http://localhost:3000");
});