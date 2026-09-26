const canvas = document.querySelector("#fountain-canvas");
const toggleButton = document.querySelector("#toggle-button");
const status = document.querySelector("#status");
const hint = document.querySelector("#hint");
const fountainSound = new Audio("./sound.mp3");
fountainSound.loop = true;
fountainSound.preload = "auto";

// testing the Three.js setup
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc7dfd3, 9, 22);

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
camera.position.set(5.2, 4.3, 7.2);
camera.lookAt(0, 1.45, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;

scene.add(new THREE.HemisphereLight(0xeaf8ee, 0x697565, 0.95));
const sunlight = new THREE.DirectionalLight(0xfff1d7, 1.35);
sunlight.position.set(-4, 8, 5);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(1024, 1024);
scene.add(sunlight);

const stone = new THREE.MeshStandardMaterial({
  color: 0x9aa597,
  roughness: 0.68,
  metalness: 0.12,
});
const stoneLight = new THREE.MeshStandardMaterial({
  color: 0xb8bca9,
  roughness: 0.55,
  metalness: 0.1,
});
const bronze = new THREE.MeshStandardMaterial({
  color: 0xb98a5c,
  roughness: 0.38,
  metalness: 0.62,
});
const water = new THREE.MeshStandardMaterial({
  color: 0x65bdbb,
  roughness: 0.22,
  metalness: 0.18,
});

function addMesh(geometry, material, x, y, z, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function makeBowl(radius, height) {
  const profile = [
    [0.06, height * 0.08],
    [radius * 0.58, height * 0.08],
    [radius * 0.84, height * 0.2],
    [radius * 0.96, height * 0.65],
    [radius, height * 0.78],
    [radius * 0.94, height * 0.9],
    [radius * 0.83, height * 0.84],
    [radius * 0.72, height * 0.55],
    [radius * 0.54, height * 0.34],
    [0.06, height * 0.3],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(profile, 64);
}

const ground = addMesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0xd4d8bd, roughness: 1 }),
  0,
  -0.04,
  0,
  false,
);
ground.rotation.x = -Math.PI / 2;

addMesh(new THREE.CylinderGeometry(0.46, 0.55, 0.2, 48), stone, 0, 0.1, 0);
addMesh(
  new THREE.CylinderGeometry(0.3, 0.38, 0.16, 48),
  stoneLight,
  0,
  0.28,
  0,
);
addMesh(makeBowl(1.12, 0.82), stone, 0, 0.34, 0);
addMesh(
  new THREE.CylinderGeometry(0.16, 0.25, 1.22, 32),
  stoneLight,
  0,
  1.42,
  0,
);
addMesh(new THREE.CylinderGeometry(0.28, 0.31, 0.12, 40), stone, 0, 0.82, 0);
addMesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 40), bronze, 0, 1.98, 0);
addMesh(makeBowl(0.49, 0.42), stoneLight, 0, 2.01, 0);

const basinWater = addMesh(
  new THREE.CircleGeometry(0.76, 64),
  water,
  0,
  0.34 + 0.82 * 0.34,
  0,
  false,
);
basinWater.rotation.x = -Math.PI / 2;
const upperWater = addMesh(
  new THREE.CircleGeometry(0.32, 48),
  water,
  0,
  2.01 + 0.42 * 0.34,
  0,
  false,
);
upperWater.rotation.x = -Math.PI / 2;

function addTrim(radius, y, tube) {
  const trim = addMesh(
    new THREE.TorusGeometry(radius, tube, 8, 64),
    bronze,
    0,
    y,
    0,
  );
  trim.rotation.x = Math.PI / 2;
}

addTrim(1.105, 0.34 + 0.82 * 0.78, 0.025);
addTrim(0.485, 2.01 + 0.42 * 0.78, 0.018);

const particleCount = 1000;
const gravity = 4.8;
const waterLevel = 0.63;
const nozzle = new THREE.Vector3(0, 2.48, 0);
const positions = new Float32Array(particleCount * 3);
const alphas = new Float32Array(particleCount);
const sizes = new Float32Array(particleCount);
const velocityX = new Float32Array(particleCount);
const velocityY = new Float32Array(particleCount);
const velocityZ = new Float32Array(particleCount);
const ages = new Float32Array(particleCount);
const active = new Uint8Array(particleCount);

for (let index = 0; index < particleCount; index += 1) {
  sizes[index] = 1.6 + Math.random() * 2;
}

const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(positions, 3),
);
particleGeometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
particleGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

const particleMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
  vertexShader: `
    attribute float alpha;
    attribute float size;
    uniform float pixelRatio;
    varying float particleAlpha;
    void main() {
      particleAlpha = alpha;
      vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = size * pixelRatio * (14.0 / -viewPosition.z);
    }
  `,
  fragmentShader: `
    varying float particleAlpha;
    void main() {
      float edge = 1.0 - smoothstep(0.28, 0.5, length(gl_PointCoord - vec2(0.5)));
      gl_FragColor = vec4(0.38, 0.78, 0.82, particleAlpha * edge * 0.45);
    }
  `,
});
const particles = new THREE.Points(particleGeometry, particleMaterial);
particles.frustumCulled = false;
scene.add(particles);

let isRunning = false;
let previousTime = 0;

function spawnParticle(index, initialAge = 0) {
  const angle = Math.random() * Math.PI * 2;
  const horizontalSpeed = 0.3 + Math.random() * 0.55;
  velocityX[index] = Math.cos(angle) * horizontalSpeed;
  velocityY[index] = 3.05 + Math.random() * 1.25;
  velocityZ[index] = Math.sin(angle) * horizontalSpeed;
  ages[index] = initialAge;
  active[index] = 1;
  positions[index * 3] = velocityX[index] * initialAge;
  positions[index * 3 + 1] =
    nozzle.y + velocityY[index] * initialAge - 0.5 * gravity * initialAge ** 2;
  positions[index * 3 + 2] = velocityZ[index] * initialAge;
  alphas[index] = Math.max(0, 0.82 - initialAge * 0.08);
}

function resizeRenderer() {
  const { width, height } = canvas.parentElement.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  particleMaterial.uniforms.pixelRatio.value = renderer.getPixelRatio();
}

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(canvas.parentElement);
resizeRenderer();

const orbitTarget = new THREE.Vector3(0, 1.35, 0);
const cameraOffset = camera.position.clone().sub(orbitTarget);
const orbitRadius = cameraOffset.length();
let orbitTheta = Math.atan2(cameraOffset.x, cameraOffset.z);
let orbitPhi = Math.acos(cameraOffset.y / orbitRadius);
let dragPointerId = null;
let previousPointerX = 0;
let previousPointerY = 0;

function updateOrbitCamera() {
  camera.position.set(
    orbitTarget.x + orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta),
    orbitTarget.y + orbitRadius * Math.cos(orbitPhi),
    orbitTarget.z + orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta),
  );
  camera.lookAt(orbitTarget);
}

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  dragPointerId = event.pointerId;
  previousPointerX = event.clientX;
  previousPointerY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-dragging");
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== dragPointerId) return;
  orbitTheta -= (event.clientX - previousPointerX) * 0.006;
  orbitPhi = THREE.MathUtils.clamp(
    orbitPhi + (event.clientY - previousPointerY) * 0.006,
    0.2,
    1.48,
  );
  previousPointerX = event.clientX;
  previousPointerY = event.clientY;
  updateOrbitCamera();
});

function stopOrbitDrag(event) {
  if (event.pointerId !== dragPointerId) return;
  dragPointerId = null;
  canvas.classList.remove("is-dragging");
}

canvas.addEventListener("pointerup", stopOrbitDrag);
canvas.addEventListener("pointercancel", stopOrbitDrag);

function setFountainRunning(running) {
  isRunning = running;
  toggleButton.setAttribute("aria-pressed", String(running));
  toggleButton.textContent = running ? "Turn Fountain Off" : "Turn Fountain On";
  status.textContent = running ? "ON" : "OFF";
  status.classList.toggle("is-running", running);
  hint.textContent = running
    ? "Water is flowing. Press OFF whenever you'd like the garden to rest."
    : "The garden is quiet. Start the fountain whenever you're ready.";

  if (running) {
    fountainSound.play().catch(() => {});
    for (let index = 0; index < particleCount; index += 1) {
      spawnParticle(index, Math.random() * 1.25);
      if (positions[index * 3 + 1] <= waterLevel) spawnParticle(index);
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.alpha.needsUpdate = true;
  } else {
    fountainSound.pause();
    fountainSound.currentTime = 0;
  }
}

toggleButton.addEventListener("click", () => setFountainRunning(!isRunning));

function animate(time) {
  requestAnimationFrame(animate);
  const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.04) : 0;
  previousTime = time;

  for (let index = 0; index < particleCount; index += 1) {
    if (!active[index]) continue;

    ages[index] += delta;
    const age = ages[index];
    const offset = index * 3;
    positions[offset] = velocityX[index] * age;
    positions[offset + 1] =
      nozzle.y + velocityY[index] * age - 0.5 * gravity * age ** 2;
    positions[offset + 2] = velocityZ[index] * age;

    if (positions[offset + 1] <= waterLevel || age > 2.5) {
      if (isRunning) {
        spawnParticle(index);
      } else {
        active[index] = 0;
        positions[offset + 1] = waterLevel;
        alphas[index] = 0;
      }
      continue;
    }

    alphas[index] = isRunning
      ? Math.min(0.82, age * 7)
      : Math.min(0.82, Math.max(0, (positions[offset + 1] - waterLevel) * 0.7));
  }

  particleGeometry.attributes.position.needsUpdate = true;
  particleGeometry.attributes.alpha.needsUpdate = true;
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
