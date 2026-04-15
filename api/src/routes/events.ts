/**
 * SSE endpoint — Push notifications to connected frontends.
 *
 * GET /api/events  → Server-Sent Events stream
 *
 * Events emitted:
 *   - crm-updated: CRM data changed (delta sync detected modifications)
 *   - files-imported: Excel files imported via fileWatcher
 */

import { Router, Request, Response } from "express";
import { log } from "../utils/logger.js";

const router = Router();

// ── Connected clients ──

interface SSEClient {
  id: number;
  res: Response;
}

let nextClientId = 1;
const clients: SSEClient[] = [];

router.get("/", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send initial heartbeat
  res.write(": connected\n\n");

  const client: SSEClient = { id: nextClientId++, res };
  clients.push(client);
  log("sse", `Client ${client.id} connected (${clients.length} total)`);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const idx = clients.indexOf(client);
    if (idx !== -1) clients.splice(idx, 1);
    log("sse", `Client ${client.id} disconnected (${clients.length} total)`);
  });
});

// ── Broadcast to all connected clients ──

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let sent = 0;
  for (let i = clients.length - 1; i >= 0; i--) {
    try {
      if (clients[i].res.writableEnded) {
        clients.splice(i, 1);
      } else {
        clients[i].res.write(payload);
        sent++;
      }
    } catch {
      // Client disconnected — remove silently
      clients.splice(i, 1);
    }
  }
  log("sse", `Broadcast "${event}" → ${sent} client(s)`);
}

export default router;
