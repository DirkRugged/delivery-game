import * as THREE from "three";

const MIN_SPAN = 30;    // never zoom tighter than this world-unit span
const MAX_HEIGHT = 120; // never pull back past this height
const PADDING = 18;
const LERP = 0.06;

export class BoundingCamera {
  camera: THREE.PerspectiveCamera;
  private targetPos = new THREE.Vector3(0, 70, 20);
  private targetLook = new THREE.Vector3(0, 0, 0);

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );
    this.camera.position.copy(this.targetPos);
    this.camera.lookAt(this.targetLook);
  }

  updateAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(positions: THREE.Vector3[]) {
    if (positions.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of positions) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxZ - minZ, MIN_SPAN) + PADDING;
    const height = Math.min(span * 1.3, MAX_HEIGHT);

    this.targetPos.set(cx, height, cz + height * 0.25);
    this.targetLook.set(cx, 0, cz);

    this.camera.position.lerp(this.targetPos, LERP);
    // Smooth look-at by lerping a tracked look-at point
    this.camera.lookAt(
      this.camera.position.x + (this.targetLook.x - this.camera.position.x) * 0.12,
      0,
      this.camera.position.z + (this.targetLook.z - this.camera.position.z) * 0.12
    );
    this.camera.lookAt(this.targetLook);
  }
}
