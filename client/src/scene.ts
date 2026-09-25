import * as THREE from "three";

const MAP_HALF = 40;

export class SceneManager {
  scene: THREE.Scene;
  mySessionId = "";

  private vehicles = new Map<string, THREE.Mesh>();
  private packages = new Map<string, THREE.Mesh>();
  private deliveryMarkers = new Map<string, THREE.Mesh>();
  private scoresEl = document.getElementById("scores")!;
  private scores = new Map<string, number>();

  // Latest transforms received from the server (20Hz) — meshes lerp toward
  // these every render frame (60fps) instead of snapping on each update.
  private vehicleTargets = new Map<string, { x: number; y: number; z: number; rotY: number }>();
  private packageTargets = new Map<string, { x: number; y: number; z: number }>();
  private static readonly LERP_RATE = 15; // higher = snappier, lower = smoother

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.buildGround();
    this.buildWalls();
    this.buildLights();
  }

  private buildGround() {
    const geo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, 16, 16);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a6b3e });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.scene.add(new THREE.GridHelper(MAP_HALF * 2, 20, 0x2a4b2e, 0x2a4b2e));
  }

  private buildWalls() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
    const configs: [number, number, number, number, number, number][] = [
      [0,        2,  MAP_HALF, MAP_HALF, 2, 1],
      [0,        2, -MAP_HALF, MAP_HALF, 2, 1],
      [ MAP_HALF, 2, 0,        1,        2, MAP_HALF],
      [-MAP_HALF, 2, 0,        1,        2, MAP_HALF],
    ];
    for (const [x, y, z, hw, hh, hd] of configs) {
      const geo = new THREE.BoxGeometry(hw * 2, hh * 2, hd * 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
    }
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(40, 80, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -MAP_HALF;
    sun.shadow.camera.right = MAP_HALF;
    sun.shadow.camera.top = MAP_HALF;
    sun.shadow.camera.bottom = -MAP_HALF;
    this.scene.add(sun);
  }

  upsertVehicle(sessionId: string, x: number, y: number, z: number, rotY: number) {
    const isMine = sessionId === this.mySessionId;
    if (!this.vehicles.has(sessionId)) {
      const geo = new THREE.BoxGeometry(2, 1, 3);
      const mat = new THREE.MeshLambertMaterial({ color: isMine ? 0x2196f3 : 0xf44336 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      // Windshield indicator so you can see which way the car faces
      const wsGeo = new THREE.BoxGeometry(1.6, 0.4, 0.1);
      const wsMat = new THREE.MeshLambertMaterial({ color: 0x90caf9 });
      const ws = new THREE.Mesh(wsGeo, wsMat);
      ws.position.set(0, 0.7, -1.1);
      mesh.add(ws);
      mesh.position.set(x, y + 0.5, z);
      mesh.rotation.y = rotY;
      this.scene.add(mesh);
      this.vehicles.set(sessionId, mesh);
    }
    this.vehicleTargets.set(sessionId, { x, y, z, rotY });
  }

  removeVehicle(sessionId: string) {
    const mesh = this.vehicles.get(sessionId);
    if (mesh) { this.scene.remove(mesh); this.vehicles.delete(sessionId); }
    this.vehicleTargets.delete(sessionId);
    this.scores.delete(sessionId);
    this.renderScores();
  }

  upsertPackage(id: string, x: number, y: number, z: number, pickedUp: boolean) {
    if (pickedUp) {
      const mesh = this.packages.get(id);
      if (mesh) { mesh.visible = false; }
      this.packageTargets.delete(id);
      return;
    }
    if (!this.packages.has(id)) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshLambertMaterial({ color: 0xffc107 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.position.set(x, y + 0.5, z);
      this.scene.add(mesh);
      this.packages.set(id, mesh);
    }
    const mesh = this.packages.get(id)!;
    if (!mesh.visible) mesh.position.set(x, y + 0.5, z); // reappearing after a drop — snap, don't slide in
    mesh.visible = true;
    this.packageTargets.set(id, { x, y, z });
  }

  removePackage(id: string) {
    const mesh = this.packages.get(id);
    if (mesh) { this.scene.remove(mesh); this.packages.delete(id); }
    this.packageTargets.delete(id);
  }

  upsertDeliveryPoint(id: string, x: number, z: number) {
    if (!this.deliveryMarkers.has(id)) {
      const geo = new THREE.CylinderGeometry(4, 4, 0.15, 24);
      const mat = new THREE.MeshLambertMaterial({
        color: 0x00e676,
        transparent: true,
        opacity: 0.7,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);
      this.deliveryMarkers.set(id, mesh);
    }
    this.deliveryMarkers.get(id)!.position.set(x, 0.08, z);
  }

  removeDeliveryPoint(id: string) {
    const mesh = this.deliveryMarkers.get(id);
    if (mesh) { this.scene.remove(mesh); this.deliveryMarkers.delete(id); }
  }

  updateScore(sessionId: string, score: number) {
    this.scores.set(sessionId, score);
    this.renderScores();
  }

  updatePackageStatus(heldPackageId: string) {
    const el = document.getElementById("package-status")!;
    el.textContent = heldPackageId ? "Carrying package — find a green zone!" : "";
  }

  private renderScores() {
    const lines = Array.from(this.scores.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([id, s]) => {
        const tag = id === this.mySessionId ? "▶ " : "  ";
        return `${tag}${id.slice(0, 6)}  ${s}pts`;
      });
    this.scoresEl.textContent = lines.join("\n");
  }

  getPlayerPositions(): THREE.Vector3[] {
    return Array.from(this.vehicles.values()).map((v) => v.position);
  }

  // Called every render frame to smoothly move meshes toward the latest
  // server-reported transform, decoupling render rate from the 20Hz network tick.
  interpolate(dtSeconds: number) {
    const t = 1 - Math.exp(-SceneManager.LERP_RATE * dtSeconds);

    this.vehicleTargets.forEach((target, id) => {
      const mesh = this.vehicles.get(id);
      if (!mesh) return;
      mesh.position.x += (target.x - mesh.position.x) * t;
      mesh.position.y += (target.y + 0.5 - mesh.position.y) * t;
      mesh.position.z += (target.z - mesh.position.z) * t;

      const diff = Math.atan2(Math.sin(target.rotY - mesh.rotation.y), Math.cos(target.rotY - mesh.rotation.y));
      mesh.rotation.y += diff * t;
    });

    this.packageTargets.forEach((target, id) => {
      const mesh = this.packages.get(id);
      if (!mesh) return;
      mesh.position.x += (target.x - mesh.position.x) * t;
      mesh.position.y += (target.y + 0.5 - mesh.position.y) * t;
      mesh.position.z += (target.z - mesh.position.z) * t;
    });
  }
}
