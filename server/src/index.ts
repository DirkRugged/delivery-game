import http from "http";
import path from "path";
import express from "express";
import { Server } from "colyseus";
import { GameRoom } from "./GameRoom";

const PORT = Number(process.env.PORT) || 2567;
const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");

async function main() {
  const app = express();
  app.use(express.static(CLIENT_DIST));
  app.get("*", (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));

  const httpServer = http.createServer(app);
  const gameServer = new Server({ server: httpServer });
  gameServer.define("game_room", GameRoom);
  await gameServer.listen(PORT);
  console.log(`Game server (+ client) listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
