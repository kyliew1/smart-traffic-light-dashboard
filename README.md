# 🚦 Smart Traffic Light Dashboard 
🏆 **Champion Project - Makerthon 2026**

A real-time, digital-twin smart traffic light system. This project integrates a YOLO-based computer vision pipeline, a Mosquitto MQTT broker, an ESP32 hardware controller, and a browser-based 3D digital twin dashboard built with Three.js.

![Dashboard Preview](<img width="1837" height="1107" alt="Screenshot 2026-05-14 at 23-38-03 Intersection Traffic Light Dashboard" src="https://github.com/user-attachments/assets/7e9b7067-85e2-489a-9aa6-e1438d7fbeaa" />
)

## 🌟 Key Features
* **Real-Time 3D Digital Twin:** Built with Three.js to mirror physical intersection states.
* **AI Vehicle Detection:** YOLO-driven camera feeds count vehicles and dictate automatic phase changes.
* **Hardware-in-the-Loop:** ESP32 syncs physical LED traffic lights with the virtual dashboard via MQTT.
* **ADAS Emergency Override:** Automatic accident detection forces an all-red safety stop.

## 🛠️ System Architecture
* **Hardware:** ESP32 (Wi-Fi enabled), custom traffic light LED circuitry.
* **Backend:** Node.js, Express, Socket.IO, MQTT.
* **Frontend:** HTML/CSS/JS, Three.js (3D rendering).
* **AI/Vision:** Python, YOLOv8.

## 🚀 Getting Started

### Prerequisites
* Mosquitto MQTT Broker installed and running.
* Node.js (v16+)
* Arduino IDE (with ESP32 board manager, PubSubClient, and ArduinoJson libraries).

### Setup Instructions
1. **Clone the repo:** `git clone https://github.com/kyliew1/smart-traffic-light-dashboard.git`
2. **Configure Environment:** Copy `web/.env.example` to `web/.env` and update your MQTT broker IP and credentials.
3. **Start Dashboard:** ```bash
   cd web
   npm install
   npm start
