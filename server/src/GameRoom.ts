import { Room, Client } from "colyseus";
import { GameState, PlayerState } from "./schemas/GameState";
import { ServerPhysics, InputState } from "./ServerPhysics";
import { Spawner } from "./Spawner";

const TICK_RATE      = 20;   // Hz
const PICKUP_RADIUS  = 4.5;  // world units
const DELIVER_RADIUS = 5.0;
const STEAL_RADIUS   = 3.0;

export class GameRoom extends Room<GameState> {
  physics!: ServerPhysics;
  spawner!: Spawner;

  async onCreate() {
    this.setState(new GameState());

    this.physics = new ServerPhysics();
    await this.physics.init();

    this.spawner = new Spawner(this.state);

    this.setSimulationInterval((dt) => this.tick(dt), 1000 / TICK_RATE);

    this.onMessage("input", (client: Client, input: InputState) => {
      this.physics.setInput(client.sessionId, input);
      if (input.action) this.handleAction(client.sessionId);
    });
  }

  onJoin(client: Client) {
    const player = new PlayerState();
    // Spawn in a ring so players don't overlap
    const angle = (this.state.players.size / 8) * Math.PI * 2;
    player.x = Math.cos(angle) * 12;
    player.z = Math.sin(angle) * 12;
    this.state.players.set(client.sessionId, player);
    this.physics.addVehicle(client.sessionId, player.x, player.z);
    console.log(`[+] ${client.sessionId} joined (${this.state.players.size} players)`);
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player?.heldPackageId) {
      const pkg = this.state.packages.get(player.heldPackageId);
      if (pkg) {
        pkg.isPickedUp = false;
        pkg.heldBy = "";
        pkg.x = player.x;
        pkg.z = player.z;
      }
    }
    this.state.players.delete(client.sessionId);
    this.physics.removeVehicle(client.sessionId);
    console.log(`[-] ${client.sessionId} left (${this.state.players.size} players)`);
  }

  private tick(dt: number) {
    this.physics.step(dt / 1000);
    this.spawner.tick(dt);

    // Write physics positions back to schema (broadcasts delta to all clients)
    this.state.players.forEach((player, sessionId) => {
      const pos = this.physics.getPosition(sessionId);
      if (!pos) return;
      player.x    = pos.x;
      player.y    = pos.y;
      player.z    = pos.z;
      player.rotY = pos.rotY;

      // Keep held package riding on vehicle
      if (player.heldPackageId) {
        const pkg = this.state.packages.get(player.heldPackageId);
        if (pkg) { pkg.x = pos.x; pkg.y = pos.y + 1.5; pkg.z = pos.z; }
      }
    });
  }

  private dist2D(ax: number, az: number, bx: number, bz: number) {
    return Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2);
  }

  private handleAction(sessionId: string) {
    const player = this.state.players.get(sessionId);
    if (!player) return;

    if (player.heldPackageId) {
      // Try to deliver to nearest delivery zone
      for (const pt of this.state.deliveryPoints) {
        if (this.dist2D(player.x, player.z, pt.x, pt.z) < DELIVER_RADIUS) {
          this.state.packages.delete(player.heldPackageId);
          player.heldPackageId = "";
          player.score += 1;
          this.spawner.spawnPackage(); // replace delivered package
          console.log(`[score] ${sessionId.slice(0, 6)} → ${player.score}`);
          return;
        }
      }
      // Not near delivery zone — drop package
      const pkg = this.state.packages.get(player.heldPackageId);
      if (pkg) {
        pkg.isPickedUp = false;
        pkg.heldBy     = "";
        pkg.x          = player.x;
        pkg.z          = player.z;
      }
      player.heldPackageId = "";
    } else {
      // Try to steal from a nearby player first
      const nearby = this.physics.getNearby(player.x, player.z, STEAL_RADIUS, sessionId);
      for (const otherId of nearby) {
        const other = this.state.players.get(otherId);
        if (!other?.heldPackageId) continue;
        // Steal!
        const pkg = this.state.packages.get(other.heldPackageId);
        if (pkg) {
          player.heldPackageId = other.heldPackageId;
          pkg.heldBy           = sessionId;
          other.heldPackageId  = "";
          console.log(`[steal] ${sessionId.slice(0, 6)} stole from ${otherId.slice(0, 6)}`);
          return;
        }
      }

      // Pick up nearest loose package
      let nearestId: string | null = null;
      let nearestDist = Infinity;
      this.state.packages.forEach((pkg, id) => {
        if (pkg.isPickedUp) return;
        const d = this.dist2D(player.x, player.z, pkg.x, pkg.z);
        if (d < PICKUP_RADIUS && d < nearestDist) {
          nearestId = id;
          nearestDist = d;
        }
      });
      if (nearestId) {
        const pkg = this.state.packages.get(nearestId)!;
        pkg.isPickedUp       = true;
        pkg.heldBy           = sessionId;
        player.heldPackageId = nearestId;
      }
    }
  }
}
