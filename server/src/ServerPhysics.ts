// Kinematic vehicle movement — no physics engine, direct position integration.
// Swap back to Rapier once the input pipeline is confirmed working end-to-end.

const MAP_HALF   = 36;
const SPEED      = 15;   // units per second at full throttle
const TURN_SPEED = 2.2;  // radians per second

interface VehicleState {
  x: number;
  y: number;
  z: number;
  heading: number; // radians
}

export interface InputState {
  forward: number;  // -1 | 0 | 1
  turn:    number;  // -1 | 0 | 1
  action:  boolean;
}

export class ServerPhysics {
  private vehicles = new Map<string, VehicleState>();
  private inputs   = new Map<string, InputState>();

  async init() {} // no-op — kept so GameRoom.onCreate can still await it

  addVehicle(sessionId: string, spawnX: number, spawnZ: number) {
    this.vehicles.set(sessionId, { x: spawnX, y: 0, z: spawnZ, heading: 0 });
  }

  removeVehicle(sessionId: string) {
    this.vehicles.delete(sessionId);
    this.inputs.delete(sessionId);
  }

  setInput(sessionId: string, input: InputState) {
    this.inputs.set(sessionId, input);
  }

  step(dtSeconds: number) {
    this.vehicles.forEach((v, sessionId) => {
      const input = this.inputs.get(sessionId);
      if (!input) return;

      v.heading -= input.turn * TURN_SPEED * dtSeconds;
      v.x = Math.max(-MAP_HALF, Math.min(MAP_HALF,
        v.x - Math.sin(v.heading) * input.forward * SPEED * dtSeconds
      ));
      v.z = Math.max(-MAP_HALF, Math.min(MAP_HALF,
        v.z - Math.cos(v.heading) * input.forward * SPEED * dtSeconds
      ));
    });
  }

  getPosition(sessionId: string): { x: number; y: number; z: number; rotY: number } | null {
    const v = this.vehicles.get(sessionId);
    if (!v) return null;
    return { x: v.x, y: v.y, z: v.z, rotY: v.heading };
  }

  getNearby(x: number, z: number, radius: number, excludeId: string): string[] {
    const result: string[] = [];
    this.vehicles.forEach((v, id) => {
      if (id === excludeId) return;
      const d = Math.sqrt((v.x - x) ** 2 + (v.z - z) ** 2);
      if (d < radius) result.push(id);
    });
    return result;
  }
}
