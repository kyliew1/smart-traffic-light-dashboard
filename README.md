#  Smart Traffic Light Dashboard 
🏆 **Champion Project - Makerthon 2026**

A real-time, digital-twin smart traffic light system. This project integrates a YOLO-based computer vision pipeline, a Mosquitto MQTT broker, an ESP32 hardware controller, and a browser-based 3D digital twin dashboard built with Three.js.

![Dashboard Preview](<img width="1810" height="821" alt="image" src="https://github.com/user-attachments/assets/3561369a-1c54-4769-8baf-a0e2f0db4e81" />
)

##  Key Features
* **Real-Time 3D Digital Twin:** Built with Three.js to mirror physical intersection states.
* **AI Vehicle Detection:** YOLO-driven camera feeds count vehicles and dictate automatic phase changes.
* **Hardware-in-the-Loop:** ESP32 syncs physical LED traffic lights with the virtual dashboard via MQTT.
* **ADAS Emergency Override:** Automatic accident detection forces an all-red safety stop.

##  System Architecture
* **Hardware:** ESP32 (Wi-Fi enabled), custom traffic light LED circuitry.
* **Backend:** Node.js, Express, Socket.IO, MQTT.
* **Frontend:** HTML/CSS/JS, Three.js (3D rendering).
* **AI/Vision:** Python, YOLOv8.

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
```

##  Getting Started

### Prerequisites
* Mosquitto MQTT Broker installed and running.
* Node.js (v16+)
* Arduino IDE (with ESP32 board manager, PubSubClient, and ArduinoJson libraries).

###  MQTT Broker Setup (Mosquitto)

This project relies on Eclipse Mosquitto to route messages between the camera pipeline, the Node.js backend, and the ESP32 hardware. The hardware is configured to require authentication.

**1. Install Mosquitto**
* **Windows:** Download and install from [mosquitto.org/download](https://mosquitto.org/download/).
* **Ubuntu/Debian:** `sudo apt install mosquitto mosquitto-clients`
* **macOS:** `brew install mosquitto`

**2. Configure Authentication**
By default, newer versions of Mosquitto only allow local connections and block anonymous users. You need to create a configuration file and a user.

Create a file named `mosquitto.conf` in your Mosquitto directory with the following lines:
```text
listener 1883 0.0.0.0
allow_anonymous false
password_file passwd.txt
```
**3. Create the MQTT User
Open your terminal (or Command Prompt as Administrator on Windows), navigate to your Mosquitto installation folder, and run the password utility to create the credentials expected by the ESP32 and Node server:
```bash
mosquitto_passwd -c passwd.txt esp32user
```
(When prompted, enter the password: esp32pass)
* **To overwrite a password for an existing user:** Just run the command again without `-c`. (e.g., `mosquitto_passwd passwd.txt esp32user`). It will prompt you for the new password and safely update their entry.
* **To delete a user:** Use the `-D` flag (e.g., `mosquitto_passwd -D passwd.txt esp32user`).


**4. Start the Broker
Run the broker using your new configuration file:
```Bash
mosquitto -c mosquitto.conf -v
```
## Setup Instructions
1. **Clone the repo:** `git clone https://github.com/kyliew1/smart-traffic-light-dashboard.git`
2. **Configure Environment:** Copy `web/.env.example` to `web/.env` and update your MQTT broker IP and credentials.
3. **Start Dashboard:** 
```bash
   cd web
   npm install
   npm start
