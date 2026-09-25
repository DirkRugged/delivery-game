import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
  @type("number") rotY: number = 0;
  @type("number") score: number = 0;
  @type("string") heldPackageId: string = "";
}

export class PackageState extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
  @type("boolean") isPickedUp: boolean = false;
  @type("string") heldBy: string = "";
}

export class DeliveryPoint extends Schema {
  @type("number") x: number = 0;
  @type("number") z: number = 0;
}

export class GameState extends Schema {
  @type({ map: PlayerState })  players        = new MapSchema<PlayerState>();
  @type({ map: PackageState }) packages       = new MapSchema<PackageState>();
  @type([DeliveryPoint])       deliveryPoints = new ArraySchema<DeliveryPoint>();
}
