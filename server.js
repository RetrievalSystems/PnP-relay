// server.js
import http from "http";
import { WebSocketServer } from "ws";
import { parse } from "url";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("PnP relay OK\n");
});

const wss = new WebSocketServer({ server, maxPayload: 5 * 1024 * 1024 }); // allow big snapshots

// roomName -> Set(ws)
const rooms = new Map();

function joinRoom(ws, room) {
  ws.room = room;
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
}

function leaveRoom(ws) {
  const room = ws.room;
  if (!room) return;
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(room);
  }
  ws.room = null;
}

ws.on("message", (data) => {
  // TEMP DEBUG: log first bit of message so we know it arrives
  const preview = Buffer.isBuffer(data) ? data.toString("utf8").slice(0, 120) : String(data).slice(0, 120);
  console.log(`[relay] room=${ws.room} bytes=${data.length ?? preview.length} preview=${preview}`);

  const peers = rooms.get(ws.room);
  if (!peers) return;

  for (const peer of peers) {
    if (peer !== ws && peer.readyState === peer.OPEN) {
      peer.send(data);
    }
  }
});


  ws.on("close", () => leaveRoom(ws));
  ws.on("error", () => leaveRoom(ws));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("Relay listening on", PORT));
