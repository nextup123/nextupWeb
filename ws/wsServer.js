// ws/wsServer.js

const WebSocket = require('ws');

class WSServer {
  constructor(port = 3000) {
    this.wss = new WebSocket.Server({ port });
    this.clients = new Set();

    this.init();
  }

  init() {
    this.wss.on('connection', (ws) => {
      console.log('Client connected');
      this.clients.add(ws);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          this.onMessage && this.onMessage(msg, ws);
        } catch (err) {
          console.error('Invalid WS message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('Client disconnected');
      });
    });
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  sendTo(ws, msg) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler) {
    this.onMessage = handler;
  }
}

module.exports = WSServer;