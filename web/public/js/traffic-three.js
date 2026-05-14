import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===============================
// Basic setup
// ===============================
const container = document.getElementById("three-scene");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe5e7eb);

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);

camera.position.set(8, 7, 9);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

container.appendChild(renderer.domElement);

// ===============================
// Controls
// ===============================
const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.05;

controls.autoRotate = false;
controls.autoRotateSpeed = 0.25;

controls.enablePan = true;
controls.panSpeed = 0.9;
controls.screenSpacePanning = true;

controls.enableZoom = true;
controls.zoomSpeed = 0.35;

controls.minDistance = 5;
controls.maxDistance = 22;

// Explicit mouse controls:
// Left mouse = rotate, mouse wheel = zoom, right mouse = pan.
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN
};

controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};

// Prevent browser right-click menu from blocking right-click pan.
container.addEventListener("contextmenu", (event) => event.preventDefault());

controls.target.set(0, 0, 0);
controls.update();

// ===============================
// Lighting
// ===============================
const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
sunLight.position.set(6, 12, 8);
sunLight.castShadow = true;
scene.add(sunLight);

// ===============================
// Materials
// ===============================
const roadMaterial = new THREE.MeshStandardMaterial({
  color: 0x30343b,
  roughness: 0.8
});

const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x4ade80,
  roughness: 0.9
});

const lineMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff
});

const yellowLineMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd000
});

const poleMaterial = new THREE.MeshStandardMaterial({
  color: 0x222222
});

const boxMaterial = new THREE.MeshStandardMaterial({
  color: 0x111111
});

// ===============================
// Helpers
// ===============================
function createBox(width, height, depth, x, y, z, material) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  scene.add(mesh);
  return mesh;
}

// ===============================
// Ground
// ===============================
createBox(18, 0.1, 18, 0, -0.08, 0, groundMaterial);

// ===============================
// Roads
// ===============================
// Horizontal road
createBox(18, 0.08, 4, 0, 0, 0, roadMaterial);

// Vertical road
createBox(4, 0.09, 18, 0, 0.01, 0, roadMaterial);

// Intersection box
createBox(4.2, 0.1, 4.2, 0, 0.03, 0, roadMaterial);

// ===============================
// Road markings
// ===============================
// Yellow center lines
createBox(0.08, 0.04, 18, -0.35, 0.09, 0, yellowLineMaterial);
createBox(0.08, 0.04, 18, 0.35, 0.09, 0, yellowLineMaterial);

createBox(18, 0.04, 0.08, 0, 0.1, -0.35, yellowLineMaterial);
createBox(18, 0.04, 0.08, 0, 0.1, 0.35, yellowLineMaterial);

// Stop lines
createBox(3.5, 0.05, 0.12, 0, 0.13, -2.4, lineMaterial);
createBox(3.5, 0.05, 0.12, 0, 0.13, 2.4, lineMaterial);
createBox(0.12, 0.05, 3.5, -2.4, 0.13, 0, lineMaterial);
createBox(0.12, 0.05, 3.5, 2.4, 0.13, 0, lineMaterial);

// Lane side markings
createBox(18, 0.04, 0.06, 0, 0.12, -2, lineMaterial);
createBox(18, 0.04, 0.06, 0, 0.12, 2, lineMaterial);
createBox(0.06, 0.04, 18, -2, 0.12, 0, lineMaterial);
createBox(0.06, 0.04, 18, 2, 0.12, 0, lineMaterial);

// ===============================
// 3D traffic lights
// ===============================
const trafficLights3D = {};

function createTrafficLight3D(id, x, z, rotationY) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;

  // Pole
  const poleGeometry = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 20);
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.y = 1.1;
  pole.castShadow = true;
  pole.receiveShadow = true;
  group.add(pole);

  // Base
  const baseGeometry = new THREE.CylinderGeometry(0.22, 0.28, 0.15, 24);
  const base = new THREE.Mesh(baseGeometry, poleMaterial);
  base.position.y = 0.075;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Traffic light box
  const boxGeometry = new THREE.BoxGeometry(0.45, 1.05, 0.28);
  const box = new THREE.Mesh(boxGeometry, boxMaterial);
  box.position.set(0, 2.25, 0);
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  // Bulbs
  const bulbGeometry = new THREE.SphereGeometry(0.12, 32, 32);

  const redMaterial = new THREE.MeshStandardMaterial({
    color: 0x330000,
    emissive: 0x000000,
    emissiveIntensity: 0
  });

  const yellowMaterial = new THREE.MeshStandardMaterial({
    color: 0x332200,
    emissive: 0x000000,
    emissiveIntensity: 0
  });

  const greenMaterial = new THREE.MeshStandardMaterial({
    color: 0x003300,
    emissive: 0x000000,
    emissiveIntensity: 0
  });

  const redBulb = new THREE.Mesh(bulbGeometry, redMaterial);
  redBulb.position.set(0, 2.55, -0.16);
  group.add(redBulb);

  const yellowBulb = new THREE.Mesh(bulbGeometry, yellowMaterial);
  yellowBulb.position.set(0, 2.25, -0.16);
  group.add(yellowBulb);

  const greenBulb = new THREE.Mesh(bulbGeometry, greenMaterial);
  greenBulb.position.set(0, 1.95, -0.16);
  group.add(greenBulb);

  // Small glow lights
  const redPointLight = new THREE.PointLight(0xff0000, 0, 2);
  redPointLight.position.copy(redBulb.position);
  group.add(redPointLight);

  const yellowPointLight = new THREE.PointLight(0xffcc00, 0, 2);
  yellowPointLight.position.copy(yellowBulb.position);
  group.add(yellowPointLight);

  const greenPointLight = new THREE.PointLight(0x00ff00, 0, 2);
  greenPointLight.position.copy(greenBulb.position);
  group.add(greenPointLight);

  scene.add(group);

  trafficLights3D[id] = {
    group,
    red: redBulb,
    yellow: yellowBulb,
    green: greenBulb,
    redLight: redPointLight,
    yellowLight: yellowPointLight,
    greenLight: greenPointLight
  };
}

function createLabel(text, x, y, z) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;

  const context = canvas.getContext("2d");

  context.fillStyle = "rgba(0, 0, 0, 0.75)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "white";
  context.font = "bold 42px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(1.4, 0.7, 1);

  scene.add(sprite);
  return sprite;
}

function setTrafficLight3D(id, state) {
  const light = trafficLights3D[id];
  if (!light) return;

  const normalized = String(state || "RED").toUpperCase();

  // Reset red
  light.red.material.color.set(0x330000);
  light.red.material.emissive.set(0x000000);
  light.red.material.emissiveIntensity = 0;
  light.redLight.intensity = 0;

  // Reset yellow
  light.yellow.material.color.set(0x332200);
  light.yellow.material.emissive.set(0x000000);
  light.yellow.material.emissiveIntensity = 0;
  light.yellowLight.intensity = 0;

  // Reset green
  light.green.material.color.set(0x003300);
  light.green.material.emissive.set(0x000000);
  light.green.material.emissiveIntensity = 0;
  light.greenLight.intensity = 0;

  if (normalized === "RED") {
    light.red.material.color.set(0xff0000);
    light.red.material.emissive.set(0xff0000);
    light.red.material.emissiveIntensity = 1.8;
    light.redLight.intensity = 1.2;
  }

  if (normalized === "YELLOW") {
    light.yellow.material.color.set(0xffcc00);
    light.yellow.material.emissive.set(0xffcc00);
    light.yellow.material.emissiveIntensity = 1.8;
    light.yellowLight.intensity = 1.2;
  }

  if (normalized === "GREEN") {
    light.green.material.color.set(0x00ff00);
    light.green.material.emissive.set(0x00ff00);
    light.green.material.emissiveIntensity = 1.8;
    light.greenLight.intensity = 1.2;
  }
}

// ===============================
// Place traffic lights
// ===============================
// 1 = north side
// 2 = east side
// 3 = south side
// 4 = west side

createTrafficLight3D(1, -2.8 , -1.4, Math.PI /2);
createTrafficLight3D(2, 1.4, -2.8, 0);
createTrafficLight3D(3, 2.8, 1.4, -Math.PI/2);
createTrafficLight3D(4, -1.4, 2.8, Math.PI);

createLabel("Light 1 North", -2.8, 3.4, -1.4);
createLabel("Light 2 East", 1.4, 3.4, -2.8);
createLabel("Light 4 West", -1.4, 3.4, 2.8);
createLabel("Light 3 South", 2.8, 3.4, 1.4);

// Default states
setTrafficLight3D(1, "RED");
setTrafficLight3D(2, "RED");
setTrafficLight3D(3, "RED");
setTrafficLight3D(4, "RED");

// ===============================
// Camera payload cars
// ===============================
// The camera payload vehicle_count is expected to look like:
// {
//   "1": northCount,
//   "2": eastCount,
//   "3": southCount,
//   "4": westCount
// }

const vehicleGroups = new THREE.Group();
scene.add(vehicleGroups);

const MAX_CARS_PER_DIRECTION = 10;

const carColors = [
  0x2563eb,
  0xef4444,
  0xfacc15,
  0x22c55e,
  0xa855f7,
  0xf97316,
  0x06b6d4,
  0xe5e7eb
];

function createCarMesh(color = 0x2563eb) {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.08
  });

  const cabinMaterial = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.2,
    metalness: 0.05
  });

  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.8
  });

  // Body length is along local X.
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.32, 0.55),
    bodyMaterial
  );
  body.position.y = 0.28;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.25, 0.42),
    cabinMaterial
  );
  cabin.position.set(0.06, 0.56, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
  const wheelPositions = [
    [-0.32, 0.16, -0.31],
    [0.32, 0.16, -0.31],
    [-0.32, 0.16, 0.31],
    [0.32, 0.16, 0.31]
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(x, y, z);
    wheel.rotation.x = Math.PI / 2;
    wheel.castShadow = true;
    group.add(wheel);
  });

  return group;
}

function createVehicleCountLabel(directionId, count, x, z) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;

  const context = canvas.getContext("2d");

  context.fillStyle = "rgba(15, 23, 42, 0.78)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#ffffff";
  context.font = "bold 34px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`Road ${directionId}: ${count}`, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, 0.9, z);
  sprite.scale.set(1.25, 0.55, 1);

  vehicleGroups.add(sprite);
}

function clearTrafficCars() {
  while (vehicleGroups.children.length > 0) {
    const child = vehicleGroups.children.pop();

    child.traverse((object) => {
      if (object.geometry) object.geometry.dispose();

      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
        }
      }
    });
  }
}

function getVehicleCount(vehicleCount, key) {
  return Number(vehicleCount?.[String(key)] ?? vehicleCount?.[key] ?? 0) || 0;
}

function addQueuedCars(directionId, count) {
  const visibleCount = Math.min(Math.max(Number(count) || 0, 0), MAX_CARS_PER_DIRECTION);

  // Road mapping:
  // 1 = North, 2 = East, 3 = South, 4 = West.
  // Cars are placed before each stop line and stacked away from the intersection.
  const configs = {
    1: {
      // North road, cars queue above the intersection.
      start: new THREE.Vector3(-1.15, 0, -3.25),
      step: new THREE.Vector3(0, 0, -0.72),
      rotationY: Math.PI / 2,
      label: new THREE.Vector3(-1.2, 0, -6.7)
    },
    2: {
      // East road, cars queue on the right side.
      start: new THREE.Vector3(3.25, 0, -1.15),
      step: new THREE.Vector3(0.72, 0, 0),
      rotationY: Math.PI,
      label: new THREE.Vector3(6.7, 0, -1.2)
    },
    3: {
      // South road, cars queue below the intersection.
      start: new THREE.Vector3(1.15, 0, 3.25),
      step: new THREE.Vector3(0, 0, 0.72),
      rotationY: -Math.PI / 2,
      label: new THREE.Vector3(1.2, 0, 6.7)
    },
    4: {
      // West road, cars queue on the left side.
      start: new THREE.Vector3(-3.25, 0, 1.15),
      step: new THREE.Vector3(-0.72, 0, 0),
      rotationY: 0,
      label: new THREE.Vector3(-6.7, 0, 1.2)
    }
  };

  const config = configs[directionId];
  if (!config) return;

  for (let i = 0; i < visibleCount; i++) {
    const color = carColors[(directionId + i) % carColors.length];
    const car = createCarMesh(color);

    car.position.copy(config.start).add(config.step.clone().multiplyScalar(i));
    car.position.y = 0.12;
    car.rotation.y = config.rotationY;

    // Tiny offset to make queues look less robotic.
    if (directionId === 1 || directionId === 3) {
      car.position.x += i % 2 === 0 ? 0.08 : -0.08;
    } else {
      car.position.z += i % 2 === 0 ? 0.08 : -0.08;
    }

    vehicleGroups.add(car);
  }

  createVehicleCountLabel(directionId, count, config.label.x, config.label.z);
}

function updateTrafficCarsFromVehicleCount(vehicleCount) {
  clearTrafficCars();

  addQueuedCars(1, getVehicleCount(vehicleCount, 1));
  addQueuedCars(2, getVehicleCount(vehicleCount, 2));
  addQueuedCars(3, getVehicleCount(vehicleCount, 3));
  addQueuedCars(4, getVehicleCount(vehicleCount, 4));
}

window.updateTrafficCars = function (cameraPayloadOrVehicleCount) {
  if (!cameraPayloadOrVehicleCount) return;

  const vehicleCount =
    cameraPayloadOrVehicleCount.vehicle_count || cameraPayloadOrVehicleCount;

  console.log("3D cars update received:", vehicleCount);
  updateTrafficCarsFromVehicleCount(vehicleCount);

  if (isAccidentCameraPayload(cameraPayloadOrVehicleCount)) {
    showCrashScene();
  } else if (cameraPayloadOrVehicleCount.vehicle_count) {
    hideCrashScene();
  }
};

window.clearTrafficCars = clearTrafficCars;

// Manual test from browser console:
// window.testTrafficCars()
window.testTrafficCars = function () {
  window.updateTrafficCars({
    1: 3,
    2: 7,
    3: 2,
    4: 5
  });
};


// ===============================
// Accident / crash model
// ===============================
const crashGroup = new THREE.Group();
crashGroup.visible = false;
scene.add(crashGroup);

const crashAnimatedParts = [];

function createCrashSmokeSprite(x, y, z, scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 58);

  gradient.addColorStop(0, "rgba(255, 255, 255, 0.7)");
  gradient.addColorStop(0.45, "rgba(180, 180, 180, 0.35)");
  gradient.addColorStop(1, "rgba(80, 80, 80, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.75,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(scale, scale, scale);

  crashGroup.add(sprite);
  crashAnimatedParts.push(sprite);

  return sprite;
}

function createCrashWarningLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;

  const context = canvas.getContext("2d");

  context.fillStyle = "rgba(127, 29, 29, 0.88)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 6;
  context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  context.fillStyle = "#ffffff";
  context.font = "bold 42px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("ACCIDENT DETECTED", canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, 1.85, 0);
  sprite.scale.set(2.7, 0.7, 1);

  crashGroup.add(sprite);
}

function createCrashDebris(x, z, color = 0xffcc00) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8
  });

  const debris = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.06, 0.14),
    material
  );

  debris.position.set(x, 0.12, z);
  debris.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );

  debris.castShadow = true;
  crashGroup.add(debris);
}

function buildCrashScene() {
  crashGroup.clear();
  crashAnimatedParts.length = 0;

  // Two cars in the middle of the intersection, angled as if they collided.
  const crashedCarA = createCarMesh(0xef4444);
  crashedCarA.position.set(-0.32, 0.14, 0.0);
  crashedCarA.rotation.y = Math.PI / 5;
  crashedCarA.rotation.z = -0.08;
  crashGroup.add(crashedCarA);

  const crashedCarB = createCarMesh(0xfacc15);
  crashedCarB.position.set(0.42, 0.14, 0.16);
  crashedCarB.rotation.y = -Math.PI / 2.6;
  crashedCarB.rotation.z = 0.12;
  crashGroup.add(crashedCarB);

  // Impact marker on the ground.
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1.08, 64),
    ringMaterial
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0.05, 0.035, 0.08);
  crashGroup.add(ring);
  crashAnimatedParts.push(ring);

  // Small debris around collision.
  createCrashDebris(-0.9, 0.45, 0xffffff);
  createCrashDebris(-0.55, -0.55, 0xffcc00);
  createCrashDebris(0.7, 0.58, 0xffffff);
  createCrashDebris(0.95, -0.25, 0xffcc00);
  createCrashDebris(0.15, -0.75, 0xef4444);

  // Smoke/cloud visual.
  createCrashSmokeSprite(0.1, 1.0, 0.08, 0.75);
  createCrashSmokeSprite(0.36, 1.25, 0.25, 0.55);
  createCrashSmokeSprite(-0.25, 1.18, -0.05, 0.6);

  createCrashWarningLabel();

  crashGroup.visible = false;
}

function isAccidentCameraPayload(cameraPayload) {
  if (!cameraPayload) return false;

  const adas = cameraPayload.adas_status || {};
  const logic = cameraPayload.control_logic || {};

  const currentPhase = String(logic.current_phase || "").toLowerCase();
  const targetPhase = String(logic.target_phase || "").toLowerCase();

  return (
    adas.accident_detected === true ||
    currentPhase.includes("all flashing red") ||
    targetPhase.includes("all flashing red")
  );
}

function showCrashScene() {
  crashGroup.visible = true;
}

function hideCrashScene() {
  crashGroup.visible = false;
}

window.showCrashScene = showCrashScene;
window.hideCrashScene = hideCrashScene;
window.testCrashScene = function () {
  showCrashScene();

  // Also force red lights to match emergency/accident mode.
  setTrafficLight3D(1, "RED");
  setTrafficLight3D(2, "RED");
  setTrafficLight3D(3, "RED");
  setTrafficLight3D(4, "RED");
};

buildCrashScene();

// ===============================
// Expose function for index.html
// ===============================
window.updateTraffic3D = function (intersections, cameraPayload) {
  if (intersections) {
    setTrafficLight3D(1, intersections["1"] || intersections[1] || "RED");
    setTrafficLight3D(2, intersections["2"] || intersections[2] || "RED");
    setTrafficLight3D(3, intersections["3"] || intersections[3] || "RED");
    setTrafficLight3D(4, intersections["4"] || intersections[4] || "RED");
  }

  if (cameraPayload && window.updateTrafficCars) {
    window.updateTrafficCars(cameraPayload);
  }

  if (isAccidentCameraPayload(cameraPayload)) {
    showCrashScene();
  } else {
    hideCrashScene();
  }
};

// Manual test from browser console
window.testTraffic3D = function () {
  setTrafficLight3D(1, "GREEN");
  setTrafficLight3D(2, "RED");
  setTrafficLight3D(3, "GREEN");
  setTrafficLight3D(4, "RED");
};

// Demo cycle from browser console
window.demoTraffic3D = function () {
  let step = 0;

  setInterval(() => {
    if (step === 0) {
      setTrafficLight3D(1, "GREEN");
      setTrafficLight3D(2, "RED");
      setTrafficLight3D(3, "GREEN");
      setTrafficLight3D(4, "RED");
    } else if (step === 1) {
      setTrafficLight3D(1, "YELLOW");
      setTrafficLight3D(2, "RED");
      setTrafficLight3D(3, "YELLOW");
      setTrafficLight3D(4, "RED");
    } else if (step === 2) {
      setTrafficLight3D(1, "RED");
      setTrafficLight3D(2, "GREEN");
      setTrafficLight3D(3, "RED");
      setTrafficLight3D(4, "GREEN");
    } else {
      setTrafficLight3D(1, "RED");
      setTrafficLight3D(2, "YELLOW");
      setTrafficLight3D(3, "RED");
      setTrafficLight3D(4, "YELLOW");
    }

    step = (step + 1) % 4;
  }, 2500);
};

// ===============================
// Animation loop
// ===============================
function animate() {
  requestAnimationFrame(animate);

  const t = performance.now() * 0.001;

  if (crashGroup.visible) {
    crashAnimatedParts.forEach((part, index) => {
      if (part.isSprite) {
        part.position.y += Math.sin(t * 1.8 + index) * 0.0009;
        part.material.opacity = 0.55 + Math.sin(t * 2.2 + index) * 0.18;
      } else {
        part.rotation.z = Math.sin(t * 3.0) * 0.08;
      }
    });
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

console.log("traffic-three.js loaded. Try window.testTrafficCars() or window.testCrashScene() in the browser console.");

// ===============================
// Resize handling
// ===============================
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(container.clientWidth, container.clientHeight);
});