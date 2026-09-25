import { ArraySchema } from "@colyseus/schema";
import { GameState, PackageState, DeliveryPoint } from "./schemas/GameState";

const MAP_HALF        = 34;
const MAX_PACKAGES    = 5;
const DELIVERY_COUNT  = 3;
const DELIVERY_RADIUS = MAP_HALF * 0.6;
const SPAWN_INTERVAL  = 15_000; // ms between auto-spawns + delivery point rotation

export class Spawner {
  private state: GameState;
  private pkgCounter = 0;
  private timer = 0;

  constructor(state: GameState) {
    this.state = state;
    this.initDeliveryPoints();
    this.spawnPackage(); // one package at match start
  }

  private rand(half: number) {
    return (Math.random() * 2 - 1) * half;
  }

  // First pattern: DELIVERY_COUNT points evenly spaced on a circle — symmetric start
  private initDeliveryPoints() {
    for (let i = 0; i < DELIVERY_COUNT; i++) {
      const angle = (i / DELIVERY_COUNT) * Math.PI * 2;
      const pt = new DeliveryPoint();
      pt.x = Math.cos(angle) * DELIVERY_RADIUS;
      pt.z = Math.sin(angle) * DELIVERY_RADIUS;
      (this.state.deliveryPoints as ArraySchema<DeliveryPoint>).push(pt);
    }
  }

  spawnPackage(): string | null {
    if (this.state.packages.size >= MAX_PACKAGES) return null;
    const pkg = new PackageState();
    pkg.x = this.rand(MAP_HALF * 0.75);
    pkg.y = 0;
    pkg.z = this.rand(MAP_HALF * 0.75);
    const id = `pkg_${this.pkgCounter++}`;
    this.state.packages.set(id, pkg);
    return id;
  }

  // Rotate one delivery point to a new random position — keeps the ring moving
  private rotateDeliveryPoint() {
    const pts = this.state.deliveryPoints as ArraySchema<DeliveryPoint>;
    const idx = Math.floor(Math.random() * pts.length);
    const pt = pts[idx];
    if (!pt) return;
    const angle = Math.random() * Math.PI * 2;
    pt.x = Math.cos(angle) * DELIVERY_RADIUS;
    pt.z = Math.sin(angle) * DELIVERY_RADIUS;
  }

  tick(dtMs: number) {
    this.timer += dtMs;
    if (this.timer >= SPAWN_INTERVAL) {
      this.timer = 0;
      this.spawnPackage();
      this.rotateDeliveryPoint();
    }
  }
}
