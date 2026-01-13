import http from "http";
import { WebSocketServer } from "ws";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("PnP relay OK\n");
});

const wss = new WebSocketServer({ server });

// roomName -> Set of sockets
const rooms = new Map();

function room(name) {
  if (!rooms.has(name)) rooms.set(name, new Set());
  return rooms.get(name);
}

wss.on("connection", (ws) => {
  ws._room = null;

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    // Join: { t:"join", room:"abc" }
    if (msg.t === "join" && typeof msg.room === "string") {
      if (ws._room) room(ws._room).delete(ws);
      ws._room = msg.room.trim().slice(0, 64) || "default";
      const r = room(ws._room);
      r.add(ws);

      ws.send(JSON.stringify({ t: "joined", room: ws._room, peers: r.size }));
      for (const peer of r) {
        if (peer !== ws && peer.readyState === 1) {
          peer.send(JSON.stringify({ t: "peer_joined", room: ws._room, peers: r.size }));
        }
      }
      return;
    }

    // Relay anything else to everyone else in the same room
    if (!ws._room) return;
    const r = room(ws._room);
    for (const peer of r) {
      if (peer !== ws && peer.readyState === 1) peer.send(data);
    }
  });

  ws.on("close", () => {
    if (!ws._room) return;
    const r = room(ws._room);
    r.delete(ws);
    if (r.size === 0) rooms.delete(ws._room);
  });
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log("Relay listening on", port));
