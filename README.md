# Smart Traffic Light Dashboard

A real-time smart traffic light dashboard for Makerthon 2026.  
The system connects YOLO-based camera detection, an MQTT broker, an ESP32 traffic-light controller, and a browser-based digital twin dashboard.

## Features

- Real-time ESP32 traffic light status
- MQTT communication between ESP32, camera logic, and dashboard
- YOLO vehicle count display
- Automatic traffic phase decision support
- Emergency / accident detection mode
- Live camera snapshot display
- 3D digital twin intersection using Three.js
- Manual control modes:
  - Normal
  - Two-way opposing
  - All-red safety stop
  - Emergency flashing red
  - AI / automatic mode

## Project Structure

```text
smart-traffic-light-dashboard/
├── esp32/                 # ESP32 Arduino code
├── web/                   # Node.js backend and frontend dashboard
│   ├── public/            # HTML, CSS, JS, 3D scene
│   ├── server.js          # Express + Socket.IO + MQTT bridge
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
