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
controls.panSpeed = 0.5;

controls.enableZoom = true;
controls.zoomSpeed = 0.1;

controls.minDistance = 7;
controls.maxDistance = 16;

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
// Optional cars
// ===============================
/*function createCar(x, z, color, rotationY = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0.18, z);
  group.rotation.y = rotationY;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.25, 0.45),
    bodyMaterial
  );
  body.position.y = 0.15;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.22, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee })
  );
  cabin.position.y = 0.38;
  cabin.castShadow = true;
  group.add(cabin);

  scene.add(group);
  return group;
}

createCar(-5, -1.2, 0x2563eb, Math.PI / 2);
createCar(5, 1.2, 0xef4444, -Math.PI / 2);
createCar(1.2, -5, 0xfacc15, 0);
createCar(-1.2, 5, 0x22c55e, Math.PI);
*/
// ===============================
// Expose function for index.html
// ===============================
window.updateTraffic3D = function (intersections) {
  if (!intersections) return;

  setTrafficLight3D(1, intersections["1"] || intersections[1] || "RED");
  setTrafficLight3D(2, intersections["2"] || intersections[2] || "RED");
  setTrafficLight3D(3, intersections["3"] || intersections[3] || "RED");
  setTrafficLight3D(4, intersections["4"] || intersections[4] || "RED");
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

  controls.update();
  renderer.render(scene, camera);
}

animate();

// ===============================
// Resize handling
// ===============================
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(container.clientWidth, container.clientHeight);
});