import * as Colyseus from "colyseus.js";
import { SceneManager } from "./scene";

export interface InputPayload {
  forward: number; // -1 | 0 | 1
  turn: number;    // -1 | 0 | 1
  action: boolean; // edge-triggered pickup / deliver
}

export class NetworkManager {
  private client: Colyseus.Client;
  private room: Colyseus.Room | null = null;
  private scene: SceneManager;

  constructor(scene: SceneManager) {
    this.scene = scene;
    const endpoint = import.meta.env.DEV
      ? "ws://localhost:2567"
      : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
    this.client = new Colyseus.Client(endpoint);
  }

  async connect() {
    const statusEl = document.getElementById("status")!;
    const scoreEl = document.getElementById("score")!;
    statusEl.textContent = "Connecting…";

    this.room = await this.client.joinOrCreate<any>("game_room");
    this.scene.mySessionId = this.room.sessionId;
    statusEl.textContent = `You: ${this.room.sessionId.slice(0, 6)}`;

    const state = this.room.state;

    state.players.onAdd((player: any, sessionId: string) => {
      const syncPlayer = () => {
        this.scene.upsertVehicle(sessionId, player.x, player.y, player.z, player.rotY);
        this.scene.updateScore(sessionId, player.score);
        if (sessionId === this.room!.sessionId) {
          scoreEl.textContent = `Score: ${player.score}`;
          this.scene.updatePackageStatus(player.heldPackageId);
        }
      };
      syncPlayer();              // render immediately with initial state
      player.onChange(syncPlayer); // re-render on every subsequent update
    });

    state.players.onRemove((_: any, sessionId: string) => {
      this.scene.removeVehicle(sessionId);
    });

    state.packages.onAdd((pkg: any, id: string) => {
      this.scene.upsertPackage(id, pkg.x, pkg.y, pkg.z, pkg.isPickedUp);
      pkg.onChange(() => {
        this.scene.upsertPackage(id, pkg.x, pkg.y, pkg.z, pkg.isPickedUp);
      });
    });

    state.packages.onRemove((_: any, id: string) => {
      this.scene.removePackage(id);
    });

    state.deliveryPoints.onAdd((pt: any, idx: number) => {
      this.scene.upsertDeliveryPoint(String(idx), pt.x, pt.z);
      pt.onChange(() => {
        this.scene.upsertDeliveryPoint(String(idx), pt.x, pt.z);
      });
    });
  }

  sendInput(input: InputPayload) {
    this.room?.send("input", input);
  }
}
