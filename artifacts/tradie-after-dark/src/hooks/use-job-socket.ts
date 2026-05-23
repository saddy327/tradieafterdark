import { useEffect, useRef, useCallback, useState } from "react";

export interface WsMessage {
  id: string;
  jobId: string;
  senderId: string;
  body: string;
  flagged: boolean;
  createdAt: string;
}

type WsEvent =
  | { type: "connected"; jobId: string }
  | { type: "pong" }
  | { type: "message"; data: WsMessage };

interface UseJobSocketOptions {
  jobId: string | undefined;
  onMessage: (msg: WsMessage) => void;
  enabled?: boolean;
}

interface UseJobSocketResult {
  isConnected: boolean;
}

export function useJobSocket({ jobId, onMessage, enabled = true }: UseJobSocketOptions): UseJobSocketResult {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!jobId || !isMounted.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/ws?jobId=${jobId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMounted.current) return;
      setIsConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as WsEvent;
        if (payload.type === "message") {
          onMessageRef.current(payload.data);
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = (e) => {
      if (!isMounted.current) return;
      setIsConnected(false);
      if (e.code === 4001 || e.code === 4003) return;
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [jobId]);

  useEffect(() => {
    isMounted.current = true;
    if (enabled && jobId) connect();

    return () => {
      isMounted.current = false;
      setIsConnected(false);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, enabled, jobId]);

  return { isConnected };
}
