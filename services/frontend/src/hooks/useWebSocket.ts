import { useEffect, useRef } from "react";
import { sessionStore } from "../stores/sessionStore";
import { machineStore } from "../stores/machineStore";
import type { WsServerMessage, SessionMessage } from "../types/session";
import type { Machine, MachineStatus, MachineHealth } from "../types/machine";

const WS_URL = `ws://${window.location.host}/ws/orchestrator`;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];
const HEARTBEAT_INTERVAL = 15000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatTimer = useRef<ReturnType<typeof setInterval>>();
  const messageBuffer = useRef<SessionMessage[]>([]);
  const rafId = useRef<number | null>(null);
  const mountedRef = useRef(true);

  function flushMessages() {
    if (messageBuffer.current.length === 0) return;
    const batch = messageBuffer.current;
    messageBuffer.current = [];
    rafId.current = null;

    const grouped: Record<string, SessionMessage[]> = {};
    for (const msg of batch) {
      (grouped[msg.sessionId] ??= []).push(msg);
    }
    for (const [sessionId, messages] of Object.entries(grouped)) {
      sessionStore.dispatch({ type: "MESSAGES_APPENDED", sessionId, messages });
    }
  }

  function scheduleFlush() {
    if (rafId.current !== null) return;
    if (document.hidden) {
      rafId.current = window.setTimeout(flushMessages, 100) as unknown as number;
    } else {
      rafId.current = requestAnimationFrame(flushMessages);
    }
  }

  function handleMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data) as WsServerMessage;

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
          break;

        // Machine messages
        case "machine.status_changed": {
          const machineUuid = msg.machineUuid as string;
          const machineStatus = msg.status as MachineStatus;
          const lastHealth = msg.lastHealth as MachineHealth | null | undefined;
          // Find machine by UUID in the store
          const machineState = machineStore.getState();
          const matchedMachine = Object.values(machineState.machines).find(
            (m) => m.machine_uuid === machineUuid
          );
          if (matchedMachine) {
            machineStore.dispatch({
              type: "MACHINE_STATUS_CHANGED",
              machineId: matchedMachine.id,
              status: machineStatus,
              lastHealth: lastHealth,
            });
          }
          break;
        }

        case "machine.registered": {
          const newMachine = msg.machine as Machine;
          machineStore.dispatch({ type: "MACHINE_ADDED", machine: newMachine });
          break;
        }
      }
    } catch (e) {
      console.error("WS message parse error:", e);
    }
  }

  function connect() {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return;

    sessionStore.dispatch({ type: "SET_WS_STATUS", status: "connecting" });

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        sessionStore.dispatch({ type: "SET_WS_STATUS", status: "connected" });

        heartbeatTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "protocol.ping", timestamp: Date.now() }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        clearInterval(heartbeatTimer.current);

        if (!mountedRef.current) return;

        if (reconnectAttempt.current >= MAX_RECONNECT_ATTEMPTS) {
          sessionStore.dispatch({ type: "SET_WS_STATUS", status: "disconnected" });
          return;
        }

        sessionStore.dispatch({ type: "SET_WS_STATUS", status: "reconnecting" });

        const delay = RECONNECT_DELAYS[
          Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)
        ];
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.error("WS connect error:", e);
      sessionStore.dispatch({ type: "SET_WS_STATUS", status: "disconnected" });
    }
  }

  function disconnect() {
    mountedRef.current = false;
    clearTimeout(reconnectTimer.current);
    clearInterval(heartbeatTimer.current);
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect on intentional close
      wsRef.current.close();
      wsRef.current = null;
    }
    sessionStore.dispatch({ type: "SET_WS_STATUS", status: "disconnected" });
  }

  function send(message: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }

  // Connect once on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();
    return disconnect;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { send, disconnect, reconnect: connect };
}
