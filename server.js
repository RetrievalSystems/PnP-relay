const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Relay Server Running\n');
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      if (msg.type === 'join_room') {
        ws.roomId = msg.room;
        ws.role = msg.role;
        
        if (!rooms.has(msg.room)) rooms.set(msg.room, new Set());
        rooms.get(msg.room).add(ws);
        
        console.log(`${msg.role} joined room ${msg.room}`);
        return;
      }
      
      // Broadcast to room
      if (ws.roomId && rooms.has(ws.roomId)) {
        const msgStr = JSON.stringify(msg);
        rooms.get(ws.roomId).forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(msgStr);
          }
        });
      }
    } catch (e) {
      console.error('Error:', e);
    }
  });
  
  ws.on('close', () => {
    if (ws.roomId && rooms.has(ws.roomId)) {
      rooms.get(ws.roomId).delete(ws);
      if (rooms.get(ws.roomId).size === 0) rooms.delete(ws.roomId);
    }
  });
});

setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => console.log(`Server on port ${PORT}`));
