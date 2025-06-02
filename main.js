import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import Stats from "three/addons/libs/stats.module.js";
import GUI from "three/addons/libs/lil-gui.module.min.js";

let W, H;
let camera, scena, renderer, statistici, gui;
let cameraHolder; // Camera container that follows the car

// Camera settings for racing-style camera
const cameraSettings = {
  distance: 10,       // Distance behind the car
  height: 3,          // Height above the car
  rotationLag: 0.1,   // How quickly the camera rotates to follow the car (lower = more lag)
  positionLag: 0.2,   // How quickly the camera moves to follow the car (lower = more lag)
  lookAhead: 5,       // How far ahead of the car to look

  // Orbit control parameters
  orbitEnabled: true, // Whether manual camera control is enabled
  orbitSpeed: 0.5,    // Sensitivity of orbit rotation
  minDistance: 5,     // Minimum zoom distance
  maxDistance: 20,    // Maximum zoom distance
  zoomSpeed: 0.5,     // Sensitivity of zoom
  initialOrbitAngleX: 0,  // Horizontal orbit angle (around Y axis)
  initialOrbitAngleY: 0   // Vertical orbit angle (around X axis)
};

// Mouse control state
const mouseControl = {
  isDown: false,
  lastX: 0,
  lastY: 0,
  orbitAngleX: 0,  // Horizontal orbit angle (around Y axis)
  orbitAngleY: 0   // Vertical orbit angle (around X axis)
};

let taste_apasate = {
  inainte: false,
  inapoi: false,
  stanga: false,
  dreapta: false,
};

let cronometru = new THREE.Clock();

let sasiu, masina, roti;
let rain, rainGeometry, rainMaterial;
let rainProperties = {
  speed: 5,     // Units per second
  size: 0.1,    // Point size
  opacity: 0.6, // Material opacity
};

let rings = [];
let score = 0;
let infoDiv;
let cladiri = [];
let strazi = []; // Added to store road objects

initializare();


//Initialize scene, terrain, vehicle, and rain (no physics)
async function initializare() {
  initializare_scena();
  initializare_teren();
  await initializare_vehicul();
  initializare_ploaie();
  createRings();
  await initializare_cladiri();
  await initializare_strazi(); // Added to load roads

  window.addEventListener("resize", modificaMarimeaFerestrei);
  window.addEventListener("keyup", modificaStareTasteKeyup);
  window.addEventListener("keydown", modificaStareTasteKeydown);

  deseneaza();
}

function createRings() {
  const LATURA = 8
  const ringGeo = new THREE.TorusGeometry(1, 0.25, 16, 100);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x333300 });

  // Example positions for rings (you can change these as you like):
  // 15 rings placed at various positions in the scene
  const positions = [
    new THREE.Vector3(4 * LATURA, 1, 4 * LATURA),
    new THREE.Vector3(LATURA, 1, 4 * LATURA),
    new THREE.Vector3(-2 * LATURA, 1, 4 * LATURA),
    new THREE.Vector3(-4 * LATURA, 1, 4 * LATURA),

    new THREE.Vector3(4 * LATURA, 1, 2 * LATURA),
    new THREE.Vector3(2 * LATURA, 1, 2 * LATURA),
    new THREE.Vector3(0, 1, 2 * LATURA),
    new THREE.Vector3(-2 * LATURA, 1, 2 * LATURA),

    new THREE.Vector3(-4 * LATURA, 1, 0),

    new THREE.Vector3(4 * LATURA, 1, -2 * LATURA),
    new THREE.Vector3(2 * LATURA, 1, -2 * LATURA),
    new THREE.Vector3(-2 * LATURA, 1, -2 * LATURA),

    new THREE.Vector3(4 * LATURA, 1, -4 * LATURA),
    new THREE.Vector3(0, 1, -4 * LATURA),
    new THREE.Vector3(-4 * LATURA, 1, -4 * LATURA),
  ];

  positions.forEach((pos) => {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.castShadow = true;
    ring.receiveShadow = false;

    scena.add(ring);
    rings.push(ring);
  });
}

function updateRings(delta) {
  if (!masina || !sasiu) { // Ensure car and chassis are loaded
    return;
  }

  const carBox = new THREE.Box3();
  const ringBox = new THREE.Box3();

  // Calculate the car's bounding box once per frame, as it moves
  carBox.setFromObject(sasiu);

  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    ring.rotation.y += delta * 2; // Spin the ring

    // Calculate the ring's bounding box
    ringBox.setFromObject(ring);

    // Check for collision using AABB intersection
    if (carBox.intersectsBox(ringBox)) {
      scena.remove(ring); // Remove ring from scene
      rings.splice(i, 1); // Remove ring from array

      // increment score & update DOM
      score++;
      infoDiv.innerHTML = score === 15 ? 'AI CASTIGAT!' : `Score: ${score}`;
    }
  }
}

function initializare_scena() {
  W = window.innerWidth;
  H = window.innerHeight;

  scena = new THREE.Scene();
  scena.background = new THREE.Color("skyblue");
  scena.add(new THREE.AxesHelper(5));

  camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 1000);

  // Create camera holder for our racing-style camera
  cameraHolder = new THREE.Object3D();
  scena.add(cameraHolder);

  // Add camera to scene directly - we'll position it in the render loop
  scena.add(camera);

  // Set up mouse event listeners for camera control
  const canvas = document.createElement('canvas'); // Placeholder until we get the real canvas

  // Mouse event handlers for camera orbit control
  const onMouseDown = (event) => {
    mouseControl.isDown = true;
    mouseControl.lastX = event.clientX;
    mouseControl.lastY = event.clientY;
  };

  const onMouseUp = () => {
    mouseControl.isDown = false;
  };

  const onMouseMove = (event) => {
    if (!mouseControl.isDown || !cameraSettings.orbitEnabled) return;

    const deltaX = event.clientX - mouseControl.lastX;
    const deltaY = event.clientY - mouseControl.lastY;

    mouseControl.orbitAngleX += deltaX * cameraSettings.orbitSpeed * 0.01;
    mouseControl.orbitAngleY += deltaY * cameraSettings.orbitSpeed * 0.01;

    // Limit vertical rotation to avoid flipping the camera
    mouseControl.orbitAngleY = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, mouseControl.orbitAngleY));

    mouseControl.lastX = event.clientX;
    mouseControl.lastY = event.clientY;
  };

  // Wheel event handler for zoom
  const onWheel = (event) => {
    if (!cameraSettings.orbitEnabled) return;

    // Adjust distance based on wheel direction
    cameraSettings.distance += event.deltaY * 0.01 * cameraSettings.zoomSpeed;

    // Clamp distance within bounds
    cameraSettings.distance = Math.max(
      cameraSettings.minDistance,
      Math.min(cameraSettings.maxDistance, cameraSettings.distance)
    );

    // Prevent page scrolling
    event.preventDefault();
  };

  const lumina_ambientala = new THREE.HemisphereLight(0x555555, 0xffffff);
  scena.add(lumina_ambientala);

  const lumina_directa = new THREE.DirectionalLight(0xffffff, 4);
  lumina_directa.position.set(5, 25, 10);
  lumina_directa.castShadow = true;
  lumina_directa.shadow.radius = 10;
  lumina_directa.shadow.mapSize.set(1024, 1024);
  lumina_directa.shadow.camera.left = -40;
  lumina_directa.shadow.camera.right = 40;
  lumina_directa.shadow.camera.top = 40;
  lumina_directa.shadow.camera.bottom = -40;
  lumina_directa.shadow.camera.near = 0.1;
  lumina_directa.shadow.camera.far = 100;
  scena.add(lumina_directa);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(W, H);
  renderer.setAnimationLoop(deseneaza);

  infoDiv = document.getElementById("scor");
  infoDiv.innerHTML = `Score: ${score}`;

  document.getElementById("continut").appendChild(renderer.domElement);

  // Add event listeners to the canvas
  const rendererCanvas = renderer.domElement;
  rendererCanvas.addEventListener('mousedown', onMouseDown);
  rendererCanvas.addEventListener('mouseup', onMouseUp);
  rendererCanvas.addEventListener('mousemove', onMouseMove);
  rendererCanvas.addEventListener('wheel', onWheel);
  // Also handle mouse leaving the canvas
  rendererCanvas.addEventListener('mouseleave', onMouseUp);

  statistici = new Stats();
  document.getElementById("continut").appendChild(statistici.domElement);

  gui = new GUI();

  // Add camera settings to GUI
  const cameraFolder = gui.addFolder('Camera Settings');
  cameraFolder.add(cameraSettings, 'distance', 5, 20).name('Distance');
  cameraFolder.add(cameraSettings, 'height', 1, 10).name('Height');
  cameraFolder.add(cameraSettings, 'rotationLag', 0.01, 1).name('Rotation Lag');
  cameraFolder.add(cameraSettings, 'positionLag', 0.01, 1).name('Position Lag');
  cameraFolder.add(cameraSettings, 'lookAhead', 0, 20).name('Look Ahead');
  cameraFolder.add(cameraSettings, 'orbitEnabled').name('Manual Camera Control');
  cameraFolder.add(cameraSettings, 'orbitSpeed', 0.1, 1).name('Orbit Sensitivity');
  cameraFolder.add(cameraSettings, 'zoomSpeed', 0.1, 1).name('Zoom Sensitivity');
  cameraFolder.open();
}

function initializare_teren() {
  const geometrie = new THREE.BoxGeometry(100, 0.5, 100);
  const material = new THREE.MeshStandardMaterial({ color: 0x808080 });

  const teren = new THREE.Mesh(geometrie, material);
  teren.receiveShadow = true;
  teren.position.set(0, -0.25, 0);
  scena.add(teren);

  new THREE.TextureLoader().load("resources/textures/asfalt.jpg", (textura) => {
    textura.wrapS = THREE.RepeatWrapping;
    textura.wrapT = THREE.RepeatWrapping;
    textura.repeat.set(10, 10);
    teren.material.map = textura;
    teren.material.needsUpdate = true;
  });
}

function incarca_model(path) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(path, resolve, undefined, reject);
  });
}

async function initializare_vehicul() {
  const gltf = await incarca_model("models/masina.glb");
  sasiu = gltf.scene;

  let cauciucuri = [];
  let jante = [];

  sasiu.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
    if (child.name.includes("heel_")) {
      cauciucuri.push(child);
    }
    if (child.name.includes("im_") || child.name.includes("im00")) {
      jante.push(child);
    }
  });

  sasiu.castShadow = true;
  sasiu.receiveShadow = true;

  // Remove tyres and rims from the chassis for regrouping
  cauciucuri.forEach((cauciuc) => {
    if (cauciuc.parent) cauciuc.parent.remove(cauciuc);
  });
  jante.forEach((janta) => {
    if (janta.parent) janta.parent.remove(janta);
  });

  // Create each wheel with steer + roll pivots (front wheels are steerable)
  roti = [
        /* FL */ creeaza_roata(cauciucuri[0], jante[0], true),
        /* RL */ creeaza_roata(cauciucuri[1], jante[1], false),
        /* FR */ creeaza_roata(cauciucuri[2], jante[2], true),
        /* RR */ creeaza_roata(cauciucuri[3], jante[3], false),
  ];

  // Create a parent "masina" group for chassis + wheels
  masina = new THREE.Group();
  masina.add(sasiu);
  roti.forEach((pivot) => masina.add(pivot));
  scena.add(masina);
}

/**
 * @param {THREE.Mesh} tyre
 * @param {THREE.Mesh} rim
 * @param {boolean}    steerable – true for front wheels
 * @returns {THREE.Group} steerPivot (contains rollPivot with meshes)
 */
function creeaza_roata(tyre, rim, steerable) {
  // 1 – pivot for steering (rotates around Y)
  const steerPivot = new THREE.Group();

  // 2 – pivot for rolling (rotates around X)
  const rollPivot = new THREE.Group();
  steerPivot.add(rollPivot);

  // 3 – place steerPivot at wheel center
  tyre.getWorldPosition(steerPivot.position);

  // 4 – keep world transforms when reparenting
  rollPivot.attach(tyre);
  rollPivot.attach(rim);

  tyre.position.set(0, 0, 0);
  rim.position.set(0, 0, 0);

  // 5 – store references for animation
  steerPivot.userData = { rollPivot, steerable };

  return steerPivot;
}


//Initialize rain particle system + lil-GUI controls
function initializare_ploaie() {
  const RAIN_COUNT = 10000;
  const AREA_RADIUS = 50;

  rainGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(RAIN_COUNT * 3);

  for (let i = 0; i < RAIN_COUNT; i++) {
    const x = (Math.random() - 0.5) * 2 * AREA_RADIUS;
    const y = Math.random() * AREA_RADIUS;
    const z = (Math.random() - 0.5) * 2 * AREA_RADIUS;
    positions.set([x, y, z], i * 3);
  }

  rainGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  rainMaterial = new THREE.PointsMaterial({
    color: 0xaaaaaa,
    size: rainProperties.size,
    transparent: true,
    opacity: rainProperties.opacity,
    depthWrite: false
  });

  rain = new THREE.Points(rainGeometry, rainMaterial);
  scena.add(rain);

  const folder = gui.addFolder("Parametri ploaie");
  folder.add(rainProperties, "speed", 1, 20).name("Viteză");
  folder.add(rainProperties, "size", 0.01, 0.5)
    .name("Mărime picură")
    .onChange((v) => {
      rainMaterial.size = v;
    });
  folder.add(rainProperties, "opacity", 0, 1)
    .name("Opacitate")
    .onChange((v) => {
      rainMaterial.opacity = v;
    });
  folder.open();
}

async function initializare_cladiri() {
  const cladireModelPaths = [ // Renamed for clarity
    "models/cladire1.glb",
    "models/cladire2.glb",
    "models/cladire3.glb",
  ];

  // Define positions for more buildings
  const cladirePositions = [];
  const LATURA = 8;
  // INEL
  for (let i = -4 * LATURA; i <= 4 * LATURA; i += LATURA) {
    cladirePositions.push(new THREE.Vector3(i, 0, -5 * LATURA));
    cladirePositions.push(new THREE.Vector3(i, 0, 5 * LATURA));
    cladirePositions.push(new THREE.Vector3(-5 * LATURA, 0, i));
    cladirePositions.push(new THREE.Vector3(5 * LATURA, 0, i));
  }

  // STANGA SUS
  cladirePositions.push(new THREE.Vector3(3 * LATURA, 0, 3 * LATURA));
  cladirePositions.push(new THREE.Vector3(3 * LATURA, 0, 2 * LATURA));
  cladirePositions.push(new THREE.Vector3(3 * LATURA, 0, 1 * LATURA));
  cladirePositions.push(new THREE.Vector3(2 * LATURA, 0, 3 * LATURA));
  cladirePositions.push(new THREE.Vector3(LATURA, 0, 3 * LATURA));
  cladirePositions.push(new THREE.Vector3(LATURA, 0, 2 * LATURA));
  cladirePositions.push(new THREE.Vector3(LATURA, 0, 1 * LATURA));

  // DREAPTA SUS
  cladirePositions.push(new THREE.Vector3(-LATURA, 0, 3 * LATURA));
  cladirePositions.push(new THREE.Vector3(-LATURA, 0, 2 * LATURA));
  cladirePositions.push(new THREE.Vector3(-LATURA, 0, 1 * LATURA));
  cladirePositions.push(new THREE.Vector3(LATURA, 0, -2 * LATURA));
  cladirePositions.push(new THREE.Vector3(-3 * LATURA, 0, 3 * LATURA));
  cladirePositions.push(new THREE.Vector3(-3 * LATURA, 0, 2 * LATURA));
  cladirePositions.push(new THREE.Vector3(-3 * LATURA, 0, 1 * LATURA));

  // STANGA JOS
  cladirePositions.push(new THREE.Vector3(LATURA, 0, -LATURA));
  cladirePositions.push(new THREE.Vector3(2 * LATURA, 0, -LATURA));
  cladirePositions.push(new THREE.Vector3(3 * LATURA, 0, -LATURA));
  cladirePositions.push(new THREE.Vector3(LATURA, 0, -3 * LATURA));
  cladirePositions.push(new THREE.Vector3(2 * LATURA, 0, -3 * LATURA));
  cladirePositions.push(new THREE.Vector3(3 * LATURA, 0, -3 * LATURA));

  // DREAPTA JOS
  cladirePositions.push(new THREE.Vector3(-LATURA, 0, -LATURA));
  cladirePositions.push(new THREE.Vector3(-2 * LATURA, 0, -LATURA));
  cladirePositions.push(new THREE.Vector3(-3 * LATURA, 0, -LATURA));
  cladirePositions.push(new THREE.Vector3(-LATURA, 0, -3 * LATURA));
  cladirePositions.push(new THREE.Vector3(-2 * LATURA, 0, -3 * LATURA));
  cladirePositions.push(new THREE.Vector3(-3 * LATURA, 0, -3 * LATURA));
  // Define the scale (4 times bigger)
  const newScale = new THREE.Vector3(4, 4, 4);

  for (let i = 0; i < cladirePositions.length; i++) {
    try {
      // Cycle through the available building models
      const modelPath = cladireModelPaths[i % cladireModelPaths.length];
      const gltf = await incarca_model(modelPath);
      const cladire = gltf.scene;

      cladire.position.copy(cladirePositions[i]);
      cladire.scale.copy(newScale); // Apply the new scale

      cladire.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scena.add(cladire);
      cladiri.push(cladire); // Add to array for collision detection
    } catch (error) {
      console.error(`Failed to load building ${modelPath} at position ${cladirePositions[i]}:`, error);
    }
  }
}

async function initializare_strazi() {
  const stradaModelPaths = {
    dreapta: "models/strada_dreapta.glb",
    intersectie: "models/strada_intersectie.glb",
    t: "models/strada_t.glb",
    viraj: "models/strada_viraj.glb",
  };

  // Example road layout
  const LATURA = 8;
  const ROAD_HEIGHT = 0.01; // Height of the road segments
  const layoutStrazi = [
    { type: "intersectie", position: new THREE.Vector3(0, ROAD_HEIGHT, 0), rotationY: 0 }, // Intersection at origin

    // drum inainte
    { type: "dreapta", position: new THREE.Vector3(0, ROAD_HEIGHT, LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(0, ROAD_HEIGHT, 2 * LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(0, ROAD_HEIGHT, 3 * LATURA), rotationY: 0 },

    // drum stanga
    { type: "dreapta", position: new THREE.Vector3(LATURA, ROAD_HEIGHT, 0), rotationY: Math.PI / 2 },
    { type: "t", position: new THREE.Vector3(2 * LATURA, ROAD_HEIGHT, 0), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(3 * LATURA, ROAD_HEIGHT, 0), rotationY: Math.PI / 2 },

    // drum riveran
    { type: "dreapta", position: new THREE.Vector3(2 * LATURA, ROAD_HEIGHT, LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(2 * LATURA, ROAD_HEIGHT, 2 * LATURA), rotationY: 0 },

    // centura
    { type: "t", position: new THREE.Vector3(4 * LATURA, ROAD_HEIGHT, 0), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(4 * LATURA, ROAD_HEIGHT, LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(4 * LATURA, ROAD_HEIGHT, 2 * LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(4 * LATURA, ROAD_HEIGHT, 3 * LATURA), rotationY: 0 },
    { type: "t", position: new THREE.Vector3(-4 * LATURA, ROAD_HEIGHT, 0), rotationY: Math.PI },
    { type: "dreapta", position: new THREE.Vector3(-4 * LATURA, ROAD_HEIGHT, LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(-4 * LATURA, ROAD_HEIGHT, 2 * LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(-4 * LATURA, ROAD_HEIGHT, 3 * LATURA), rotationY: 0 },
    { type: "viraj", position: new THREE.Vector3(4 * LATURA, ROAD_HEIGHT, 4 * LATURA), rotationY: -Math.PI }, // Turn left
    { type: "dreapta", position: new THREE.Vector3(LATURA, ROAD_HEIGHT, 4 * LATURA), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(2 * LATURA, ROAD_HEIGHT, 4 * LATURA), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(3 * LATURA, ROAD_HEIGHT, 4 * LATURA), rotationY: Math.PI / 2 },
    { type: "t", position: new THREE.Vector3(0, ROAD_HEIGHT, 4 * LATURA), rotationY: -Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(-LATURA, ROAD_HEIGHT, 4 * LATURA), rotationY: Math.PI / 2 },
    { type: "t", position: new THREE.Vector3(-2 * LATURA, ROAD_HEIGHT, 4 * LATURA), rotationY: -Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(-3 * LATURA, ROAD_HEIGHT, 4 * LATURA), rotationY: Math.PI / 2 },
    { type: "viraj", position: new THREE.Vector3(-4 * LATURA, ROAD_HEIGHT, 4 * LATURA), rotationY: Math.PI / 2 }, // Turn left
    { type: "dreapta", position: new THREE.Vector3(-4 * LATURA, ROAD_HEIGHT, -3 * LATURA), rotationY: Math.PI },
    { type: "t", position: new THREE.Vector3(-4 * LATURA, ROAD_HEIGHT, -2 * LATURA), rotationY: Math.PI },
    { type: "dreapta", position: new THREE.Vector3(-4 * LATURA, ROAD_HEIGHT, -LATURA), rotationY: Math.PI },
    { type: "dreapta", position: new THREE.Vector3(4 * LATURA, ROAD_HEIGHT, -3 * LATURA), rotationY: Math.PI },
    { type: "t", position: new THREE.Vector3(4 * LATURA, ROAD_HEIGHT, -2 * LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(4 * LATURA, ROAD_HEIGHT, -LATURA), rotationY: Math.PI },
    { type: "viraj", position: new THREE.Vector3(4 * LATURA, ROAD_HEIGHT, -4 * LATURA), rotationY: -Math.PI / 2 }, // Turn right
    { type: "viraj", position: new THREE.Vector3(-4 * LATURA, ROAD_HEIGHT, -4 * LATURA), rotationY: 0 }, // Turn right
    { type: "dreapta", position: new THREE.Vector3(LATURA, ROAD_HEIGHT, -4 * LATURA), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(2 * LATURA, ROAD_HEIGHT, -4 * LATURA), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(3 * LATURA, ROAD_HEIGHT, -4 * LATURA), rotationY: Math.PI / 2 },
    { type: "t", position: new THREE.Vector3(0, ROAD_HEIGHT, -4 * LATURA), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(-LATURA, ROAD_HEIGHT, -4 * LATURA), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(-2 * LATURA, ROAD_HEIGHT, -4 * LATURA), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(-3 * LATURA, ROAD_HEIGHT, -4 * LATURA), rotationY: Math.PI / 2 },

    // drum express 2
    { type: "dreapta", position: new THREE.Vector3(-LATURA, ROAD_HEIGHT, -2 * LATURA), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(-2 * LATURA, ROAD_HEIGHT, -2 * LATURA), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(-3 * LATURA, ROAD_HEIGHT, -2 * LATURA), rotationY: Math.PI / 2 },

    // drum riveran 2
    { type: "dreapta", position: new THREE.Vector3(2 * LATURA, ROAD_HEIGHT, -2 * LATURA), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(3 * LATURA, ROAD_HEIGHT, -2 * LATURA), rotationY: Math.PI / 2 },

    // drum inapoi
    { type: "dreapta", position: new THREE.Vector3(0, ROAD_HEIGHT, -LATURA), rotationY: 0 },
    { type: "t", position: new THREE.Vector3(0, ROAD_HEIGHT, -2 * LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(0, ROAD_HEIGHT, -3 * LATURA), rotationY: 0 },

    // drum dreapta
    { type: "dreapta", position: new THREE.Vector3(-LATURA, ROAD_HEIGHT, 0), rotationY: Math.PI / 2 },
    { type: "t", position: new THREE.Vector3(-2 * LATURA, ROAD_HEIGHT, 0), rotationY: Math.PI / 2 },
    { type: "dreapta", position: new THREE.Vector3(-3 * LATURA, ROAD_HEIGHT, 0), rotationY: Math.PI / 2 },

    // drum express
    { type: "dreapta", position: new THREE.Vector3(-2 * LATURA, ROAD_HEIGHT, LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(-2 * LATURA, ROAD_HEIGHT, 2 * LATURA), rotationY: 0 },
    { type: "dreapta", position: new THREE.Vector3(-2 * LATURA, ROAD_HEIGHT, 3 * LATURA), rotationY: 0 },

  ];

  const newScale = new THREE.Vector3(1, 1, 1); // Adjust scale if needed, assuming 1:1 for now

  for (const segment of layoutStrazi) {
    try {
      const modelPath = stradaModelPaths[segment.type];
      if (!modelPath) {
        console.warn(`Unknown road type: ${segment.type}`);
        continue;
      }
      const gltf = await incarca_model(modelPath);
      const strada = gltf.scene;

      strada.position.copy(segment.position);
      if (segment.rotationY) {
        strada.rotation.y = segment.rotationY;
      }
      strada.scale.copy(newScale);

      strada.traverse((child) => {
        if (child.isMesh) {
          // Roads typically don't cast shadows but should receive them
          child.castShadow = false;
          child.receiveShadow = true;
        }
      });

      scena.add(strada);
      strazi.push(strada);
    } catch (error) {
      console.error(`Failed to load road segment ${segment.type} at position ${segment.position}:`, error);
    }
  }
}

// input handlers
function modificaStareTasteKeyup(e) {
  switch (e.key) {
    case "w":
    case "W":
    case "ArrowUp":
      taste_apasate.inainte = false;
      break;
    case "s":
    case "S":
    case "ArrowDown":
      taste_apasate.inapoi = false;
      break;
    case "a":
    case "A":
    case "ArrowLeft":
      taste_apasate.stanga = false;
      break;
    case "d":
    case "D":
    case "ArrowRight":
      taste_apasate.dreapta = false;
      break;
  }
}

function modificaStareTasteKeydown(e) {
  switch (e.key) {
    case "w":
    case "W":
    case "ArrowUp":
      taste_apasate.inainte = true;
      break;
    case "s":
    case "S":
    case "ArrowDown":
      taste_apasate.inapoi = true;
      break;
    case "a":
    case "A":
    case "ArrowLeft":
      taste_apasate.stanga = true;
      break;
    case "d":
    case "D":
    case "ArrowRight":
      taste_apasate.dreapta = true;
      break;
  }
}

// functie principala
function deseneaza() {
  const delta = cronometru.getDelta();
  const MOVE_SPEED = 6;            // units per second
  const TURN_SPEED = Math.PI;      // radians per second
  const rollSpeed = delta * Math.PI * 4;

  // 1 – handle steering: rotate front wheel pivots
  const MAX_STEER = Math.PI / 6;
  let targetSteer = 0;
  if (taste_apasate.stanga) targetSteer = +MAX_STEER;
  else if (taste_apasate.dreapta) targetSteer = -MAX_STEER;

  roti?.forEach((pivot) => {
    if (pivot.userData.steerable) pivot.rotation.y = targetSteer;
  });

  // 2 – handle car rotation (yaw) when pressing A/D
  if (taste_apasate.stanga) {
    masina.rotation.y += TURN_SPEED * delta;
  } else if (taste_apasate.dreapta) {
    masina.rotation.y -= TURN_SPEED * delta;
  }

  // 3 – handle forward/backward movement (translate along local Z)
  if (taste_apasate.inainte) {
    masina.translateZ(+MOVE_SPEED * delta);
  } else if (taste_apasate.inapoi) {
    masina.translateZ(-MOVE_SPEED * delta);
  }

  // 4 – rotate the wheels around their local X axes
  roti?.forEach((pivot) => {
    const roll = pivot.userData.rollPivot;
    if (!roll) return;
    if (taste_apasate.inainte) roll.rotation.x += rollSpeed;
    else if (taste_apasate.inapoi) roll.rotation.x -= rollSpeed;
  });

  // 5 – animate rain particles
  const positions = rainGeometry?.attributes.position.array;
  const RAIN_AREA = 50;
  const count = positions?.length / 3;
  for (let i = 0; i < count; i++) {
    let idx = i * 3 + 1; // index of y component
    positions[idx] -= rainProperties.speed * delta;
    if (positions[idx] < 0) {
      positions[idx] = Math.random() * RAIN_AREA + RAIN_AREA;
    }
  }

  if (rainGeometry)
    rainGeometry.attributes.position.needsUpdate = true;

  updateRings(delta);

  // Hybrid Camera System: Racing-style with Orbit Controls
  if (masina) {
    // Get car's current position and direction
    const carPosition = masina.position.clone();
    const carDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(masina.quaternion);

    // Calculate base camera position (behind car)
    const baseOffset = new THREE.Vector3(0, cameraSettings.height, -cameraSettings.distance);

    // Apply orbit rotations if manual camera control is enabled
    if (cameraSettings.orbitEnabled) {
      // Create rotation quaternions for orbit
      const verticalRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        mouseControl.orbitAngleY
      );

      const horizontalRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        mouseControl.orbitAngleX
      );

      // Combine rotations: first vertical, then horizontal
      const combinedRotation = new THREE.Quaternion()
        .copy(verticalRotation)
        .multiply(horizontalRotation);

      // Apply combined rotation to base offset
      baseOffset.applyQuaternion(combinedRotation);
    }

    // Apply car orientation to the already orbit-adjusted offset
    const finalOffset = baseOffset.clone().applyQuaternion(masina.quaternion);
    const idealPosition = carPosition.clone().add(finalOffset);

    // Calculate target look position (the car's position)
    const targetLookAt = carPosition.clone();

    // Add look-ahead if enabled and orbit control is disabled or minimal
    if (!cameraSettings.orbitEnabled ||
      (Math.abs(mouseControl.orbitAngleX) < 0.1 && Math.abs(mouseControl.orbitAngleY) < 0.1)) {
      const lookAheadVector = carDirection.clone().multiplyScalar(cameraSettings.lookAhead);
      targetLookAt.add(lookAheadVector);
    }

    // Smooth camera movement with lag factor
    if (!cameraHolder.position.equals(idealPosition)) {
      cameraHolder.position.lerp(idealPosition, cameraSettings.positionLag);
    }

    // Set camera position
    camera.position.copy(cameraHolder.position);

    // Smoothly rotate camera to look at target
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt).add(camera.position);

    // Smooth target look position
    const smoothLookAt = new THREE.Vector3().lerpVectors(
      currentLookAt,
      targetLookAt,
      cameraSettings.rotationLag
    );

    // Make camera look at the target
    camera.lookAt(smoothLookAt);
  }

  statistici.update();
  renderer.render(scena, camera);
}

function modificaMarimeaFerestrei() {
  W = window.innerWidth;
  H = window.innerHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}
