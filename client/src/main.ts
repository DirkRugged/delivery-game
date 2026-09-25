import * as THREE from "three";
import { SceneManager } from "./scene";
import { BoundingCamera } from "./camera";
import { NetworkManager } from "./network";

async function main() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const scene = new SceneManager();
  const camera = new BoundingCamera();
  const network = new NetworkManager(scene);

  await network.connect();

  const keys: Record<string, boolean> = {};
  const overlay = document.getElementById("focus-overlay")!;
  overlay.addEventListener("click", () => { overlay.classList.remove("visible"); });
  window.addEventListener("focus", () => { overlay.classList.remove("visible"); });
  window.addEventListener("blur",  () => {
    Object.keys(keys).forEach((k) => { keys[k] = false; }); // release all keys on blur
    overlay.classList.add("visible");
  });

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.updateAspect(window.innerWidth / window.innerHeight);
  });

  // Send inputs at fixed rate; action is edge-triggered (send once per keydown)
  let lastAction = false;
  setInterval(() => {
    const action = keys["Space"] === true;
    network.sendInput({
      forward: keys["KeyW"] || keys["ArrowUp"]
        ? 1
        : keys["KeyS"] || keys["ArrowDown"]
        ? -1
        : 0,
      turn: keys["KeyA"] || keys["ArrowLeft"]
        ? -1
        : keys["KeyD"] || keys["ArrowRight"]
        ? 1
        : 0,
      action: action && !lastAction, // edge: only first frame of keydown
    });
    lastAction = action;
  }, 1000 / 20);

  function animate() {
    requestAnimationFrame(animate);
    camera.update(scene.getPlayerPositions());
    renderer.render(scene.scene, camera.camera);
  }
  animate();
}

main().catch(console.error);
