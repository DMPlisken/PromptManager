import { useEffect, useRef, useCallback } from "react";
import { sessionStore } from "../stores/sessionStore";
import type { WsServerMessage, SessionMessage } from "../types/session";

const WS_URL = `ws://${window.location.host}/ws/orchestrator`;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];
const HEARTBEAT_INTERVAL = 15000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<number>();
  const heartbeatTimer = useRef<number>();
  const messageBuffer = useRef<SessionMessage[]>([]);
  const rafId = useRef<number | null>(null);

  const flushMessages = useCallback(() => {
    if (messageBuffer.current.length === 0) return;
    const batch = messageBuffer.current;
    messageBuffer.current = [];
    rafId.current = null;

    // Group by sessionId for efficient dispatch
    const grouped: Record<string, SessionMessage[]> = {};
    for (const msg of batch) {
      (grouped[msg.sessionId] ??= []).push(msg);
    }
    for (const [sessionId, messages] of Object.entries(grouped)) {
      sessionStore.dispatch({ type: "MESSAGES_APPENDED", sessionId, messages });
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafId.current !== null) return;
    if (document.hidden) {
      rafId.current = window.setTimeout(flushMessages, 100) as unknown as number;
    } else {
      rafId.current = requestAnimationFrame(flushMessages);
    }
  }, [flushMessages]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg: WsServerMessage = JSON.parse(event.data);

        switch (msg.type) {
          case "session.started":
            sessionStore.dispatch({
              type: "SESSION_STATUS_CHANGED",
              sessionId: msg.sessionId,
              status: "running",
            });
            break;

          case "session.message": {
            const sessionMsg: SessionMessage = {
              id: `${msg.sessionId}-${msg.sequence}`,
              sessionId: msg.sessionId,
              sequence: msg.sequence,
              role: msg.message.role || "assistant",
              type: msg.message.type || "text",
              content: msg.message.content || "",
              timestamp: new Date().toISOString(),
              costUsd: msg.message.costUsd,
            };
            messageBuffer.current.push(sessionMsg);
            scheduleFlush();
            break;
          }

          case "session.approval_required":
            sessionStore.dispatch({
              type: "APPROVAL_REQUESTED",
              approval: msg.toolUse,
            });
            break;

          case "session.completed":
            sessionStore.dispatch({
              type: "SESSION_COMPLETED",
              sessionId: msg.sessionId,
              result: msg.result,
            });
            break;

          case "session.error":
            sessionStore.dispatch({
              type: "SESSION_STATUS_CHANGED",
              sessionId: msg.sessionId,
              status: "failed",
              error: msg.error.message,
            });
            break;

          case "session.status_changed":
            sessionStore.dispatch({
              type: "SESSION_STATUS_CHANGED",
              sessionId: msg.sessionId,
              status: msg.status,
            });
            break;

          case "system.sidecar_status":
            sessionStore.dispatch({
              type: "SET_SIDECAR_STATUS",
              status: msg.status,
            });
            break;

          case "protocol.pong":
            // Heartbeat acknowledged
            break;
        }
      } catch (e) {
        console.error("WS message parse error:", e);
      }
    },
    [scheduleFlush]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    sessionStore.dispatch({ type: "SET_WS_STATUS", status: "connecting" });

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      sessionStore.dispatch({ type: "SET_WS_STATUS", status: "connected" });

      // Start heartbeat
      heartbeatTimer.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "protocol.ping", timestamp: Date.now() }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      clearInterval(heartbeatTimer.current);
      sessionStore.dispatch({ type: "SET_WS_STATUS", status: "reconnecting" });

      const delay =
        RECONNECT_DELAYS[
          Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)
        ];
      reconnectAttempt.current++;
      reconnectTimer.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [handleMessage]);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    clearInterval(heartbeatTimer.current);
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }
    reconnectAttempt.current = Infinity; // Prevent reconnect
    wsRef.current?.close();
    sessionStore.dispatch({ type: "SET_WS_STATUS", status: "disconnected" });
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { send, disconnect, reconnect: connect };
}
