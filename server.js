// server.js (CommonJS)
const http = require("http");
const { WebSocketServer } = require("ws");
const url = require("url");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("PnP relay OK\n");
});

const wss = new WebSocketServer({ server, maxPayload: 5 * 1024 * 1024 });

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

wss.on("connection", (ws, req) => {
  const parsed = url.parse(req.url, true);
  const room = String((parsed.query && parsed.query.room) || "lobby");
  joinRoom(ws, room);

  ws.on("message", (data) => {
    // TEMP DEBUG: confirm messages arrive
    const preview = Buffer.from(data).toString("utf8").slice(0, 140);
    console.log(`[relay] room=${ws.room} bytes=${Buffer.byteLength(data)} preview=${preview}`);

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
