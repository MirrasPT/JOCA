import { WebSocket } from 'ws';

// Single source of the connected-client set + the broadcast/send helpers. Both the HTTP routers
// (llm, automations, tasks) and the WS connection handler import from here, so no module threads a
// `broadcast` dependency through its constructor — they import it directly.
const clients = new Set<WebSocket>();

export function addClient(ws: WebSocket) {
  clients.add(ws);
}

export function removeClient(ws: WebSocket) {
  clients.delete(ws);
}

export function broadcast(data: object) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

export function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
