#include <WiFi.h>
#include <PubSubClient.h>

// =======================
// WiFi settings
// =======================
const char* ssid = "WIFI_NAME";
const char* password = "WIFI_PASSWORD";

// =======================
// MQTT broker settings
// =======================
const char* mqtt_server = "xxx";  
const int mqtt_port = 1883;

// =======================
// LED pins
// =======================
const int redLED = 4;
const int yellowLED = 7;
const int greenLED = 16;

// =======================
// MQTT topics
// =======================
const char* controlTopic = "esp32/trafficlight/control";
const char* statusTopic  = "esp32/trafficlight/status";

WiFiClient espClient;
PubSubClient client(espClient);

// =======================
// Connect to WiFi
// =======================
void setup_wifi() {
  delay(100);
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("ESP32 IP address: ");
  Serial.println(WiFi.localIP());
}

// =======================
// Set LED states
// =======================
void setLEDs(bool redState, bool yellowState, bool greenState) {
  digitalWrite(redLED, redState);
  digitalWrite(yellowLED, yellowState);
  digitalWrite(greenLED, greenState);

  String message = "RED=" + String(redState ? "ON" : "OFF") +
                   ", YELLOW=" + String(yellowState ? "ON" : "OFF") +
                   ", GREEN=" + String(greenState ? "ON" : "OFF");

  client.publish(statusTopic, message.c_str());
  Serial.println("Published status: " + message);
}

// =======================
// MQTT callback
// =======================
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";

  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("Message arrived on topic: ");
  Serial.println(topic);
  Serial.print("Message: ");
  Serial.println(message);

  // Control LEDs based on message
  if (message == "RED") {
    setLEDs(true, false, false);
  }
  else if (message == "YELLOW") {
    setLEDs(false, true, false);
  }
  else if (message == "GREEN") {
    setLEDs(false, false, true);
  }
  else if (message == "ALL_OFF") {
    setLEDs(false, false, false);
  }
}

// =======================
// Reconnect MQTT
// =======================
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");

    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);

    if (client.connect(clientId.c_str(), "esp32user", "esp32pass")) {
      Serial.println("connected");
      client.subscribe(controlTopic);
      Serial.print("Subscribed to: ");
      Serial.println(controlTopic);

      client.publish(statusTopic, "ESP32 is online");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds");
      delay(5000);
    }
  }
}

// =======================
// Setup
// =======================
void setup() {
  Serial.begin(115200);
  Serial.print("debug");
  pinMode(redLED, OUTPUT);
  pinMode(yellowLED, OUTPUT);
  pinMode(greenLED, OUTPUT);

  setLEDs(false, false, false);

  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// =======================
// Loop
// =======================
void loop() {
if (!client.connected()) {
    reconnect();
  }

  client.loop();
}
