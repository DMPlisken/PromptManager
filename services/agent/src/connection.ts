/**
 * WebSocket client with automatic reconnection.
 *
 * Connects OUTBOUND to the PromptFlow server at ws://<server>/ws/agent.
 * Implements:
 *   - agent.hello handshake on connect
 *   - Exponential backoff reconnection (1s, 2s, 4s, 8s, 15s, 30s max)
 *   - Periodic heartbeat (every 30s)
 *   - Message routing to registered handlers
 */

import WebSocket from "ws";
import { EventEmitter } from "events";
import type {
  AgentMessage,
  ServerMessage,
  AgentHello,
  MachineInfo,
  MachineHealth,
} from "./protocol";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];
const HEARTBEAT_INTERVAL_MS = 30000;
const CONNECTION_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface ConnectionEvents {
  stateChange: (state: ConnectionState) => void;
  message: (msg: ServerMessage) => void;
  error: (err: Error) => void;
}

// ---------------------------------------------------------------------------
// AgentConnection
// ---------------------------------------------------------------------------

export class AgentConnection extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private serverUrl: string;
  private authToken: string;
  private machineInfo: MachineInfo;
  private healthProvider: () => MachineHealth;
  private intentionallyClosed = false;

  constructor(
    serverUrl: string,
    authToken: string,
    machineInfo: MachineInfo,
    healthProvider: () => MachineHealth
  ) {
    super();
    this.serverUrl = serverUrl;
    this.authToken = authToken;
    this.machineInfo = machineInfo;
    this.healthProvider = healthProvider;
  }

  /** Current connection state. */
  getState(): ConnectionState {
    return this.state;
  }

  /** Connect to the server. */
  connect(): void {
    if (this.state === "connected" || this.state === "connecting") return;

    this.intentionallyClosed = false;
    this.doConnect();
  }

  /** Gracefully disconnect. */
  disconnect(): void {
    this.intentionallyClosed = true;
    this.stopHeartbeat();
    this.cancelReconnect();

    if (this.ws) {
      try {
        this.ws.close(1000, "Agent shutting down");
      } catch {
        // Already closed
      }
      this.ws = null;
    }

    this.setState("disconnected");
  }

  /** Send a typed message to the server. */
  send(msg: AgentMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  private doConnect(): void {
    this.setState(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    try {
      this.ws = new WebSocket(this.serverUrl, {
        handshakeTimeout: CONNECTION_TIMEOUT_MS,
        headers: {
          "X-Agent-Auth": this.authToken,
          "X-Machine-UUID": this.machineInfo.machineUuid,
        },
      });
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => this.onOpen());
    this.ws.on("message", (data: WebSocket.Data) => this.onMessage(data));
    this.ws.on("close", (code: number, reason: Buffer) => this.onClose(code, reason));
    this.ws.on("error", (err: Error) => this.onError(err));
  }

  private onOpen(): void {
    this.reconnectAttempt = 0;
    this.setState("connected");

    // Send agent.hello handshake
    const hello: AgentHello = {
      type: "agent.hello",
      authToken: this.authToken,
      machine: this.machineInfo,
      health: this.healthProvider(),
    };
    this.send(hello);

    // Start heartbeat
    this.startHeartbeat();
  }

  private onMessage(data: WebSocket.Data): void {
    try {
      const raw = typeof data === "string" ? data : data.toString();
      const msg = JSON.parse(raw) as ServerMessage;

      // Handle ping internally
      if (msg.type === "server.ping") {
        this.send({ type: "agent.pong", timestamp: msg.timestamp });
        return;
      }

      this.emit("message", msg);
    } catch (err) {
      this.emit("error", new Error(`Failed to parse server message: ${err}`));
    }
  }

  private onClose(code: number, reason: Buffer): void {
    this.ws = null;
    this.stopHeartbeat();

    if (this.intentionallyClosed) {
      this.setState("disconnected");
      return;
    }

    const reasonStr = reason.toString() || "unknown";
    console.log(`WebSocket closed: code=${code} reason=${reasonStr}`);

    this.scheduleReconnect();
  }

  private onError(err: Error): void {
    // The 'error' event is always followed by 'close', so we don't
    // need to trigger reconnection here — just forward the error.
    this.emit("error", err);
  }

  // -------------------------------------------------------------------------
  // Heartbeat
  // -------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({
        type: "agent.health",
        health: this.healthProvider(),
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Reconnection with exponential backoff
  // -------------------------------------------------------------------------

  private scheduleReconnect(): void {
    this.cancelReconnect();
    this.setState("reconnecting");

    const delayIndex = Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1);
    const delay = RECONNECT_DELAYS[delayIndex];
    this.reconnectAttempt++;

    console.log(
      `Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempt})...`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // State management
  // -------------------------------------------------------------------------

  private setState(newState: ConnectionState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.emit("stateChange", newState);
  }
}
