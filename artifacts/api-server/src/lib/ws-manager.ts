import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

import { verifyAccessToken } from "./auth";
import { logger } from "./logger";

function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

interface AuthedSocket extends WebSocket {
  userId: string;
  role: string;
  jobId: string;
  isAlive: boolean;
}

const rooms = new Map<string, Set<AuthedSocket>>();

export function createWsServer(server: import("http").Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (rawSocket: WebSocket, req: IncomingMessage) => {
    const ws = rawSocket as AuthedSocket;

    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const jobId = url.searchParams.get("jobId");
    if (!jobId) {
      ws.close(4001, "Missing jobId");
      return;
    }

    const cookies = parseCookies(req.headers.cookie ?? "");
    const token = cookies["access_token"];
    if (!token) {
      ws.close(4003, "Unauthenticated");
      return;
    }

    let payload: { userId: string; role: string } | null = null;
    try {
      payload = verifyAccessToken(token) as { userId: string; role: string };
    } catch {
      ws.close(4003, "Invalid token");
      return;
    }

    ws.userId = payload.userId;
    ws.role = payload.role;
    ws.jobId = jobId;
    ws.isAlive = true;

    if (!rooms.has(jobId)) rooms.set(jobId, new Set());
    rooms.get(jobId)!.add(ws);

    logger.info({ userId: ws.userId, jobId }, "WS client connected");

    ws.on("pong", () => { ws.isAlive = true; });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      rooms.get(jobId)?.delete(ws);
      if (rooms.get(jobId)?.size === 0) rooms.delete(jobId);
      logger.info({ userId: ws.userId, jobId }, "WS client disconnected");
    });

    ws.on("error", (err) => {
      logger.warn({ err, userId: ws.userId, jobId }, "WS error");
    });

    ws.send(JSON.stringify({ type: "connected", jobId }));
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((rawSocket) => {
      const ws = rawSocket as AuthedSocket;
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}

export function broadcastToJob(jobId: string, payload: object): void {
  const clients = rooms.get(jobId);
  if (!clients) return;
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}
