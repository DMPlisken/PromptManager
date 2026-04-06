/**
 * Message type definitions for the agent <-> server WebSocket protocol.
 *
 * Direction conventions:
 *   agent -> server:  "agent.*"
 *   server -> agent:  "server.*"
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** System health snapshot sent with hello and periodic health reports. */
export interface MachineHealth {
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskFreeGb: number;
  activeSessions: number;
  maxSessions: number;
}

/** Minimal machine descriptor included in hello and pairing. */
export interface MachineInfo {
  machineUuid: string;
  machineName: string;
  platform: "darwin" | "win32" | "linux";
  nodeVersion: string;
  agentVersion: string;
  workspaceRoot: string;
  maxConcurrentSessions: number;
}

// ---------------------------------------------------------------------------
// Agent -> Server messages
// ---------------------------------------------------------------------------

export interface AgentHello {
  type: "agent.hello";
  authToken: string;
  machine: MachineInfo;
  health: MachineHealth;
}

export interface AgentHealth {
  type: "agent.health";
  health: MachineHealth;
}

export interface AgentSessionOutput {
  type: "agent.session.output";
  sessionId: string;
  sequence: number;
  data: StreamJsonMessage;
}

export interface AgentSessionCompleted {
  type: "agent.session.completed";
  sessionId: string;
  exitCode: number;
  durationMs: number;
  costUsd?: number;
}

export interface AgentSessionFailed {
  type: "agent.session.failed";
  sessionId: string;
  error: string;
  exitCode?: number;
}

export interface AgentPong {
  type: "agent.pong";
  timestamp: number;
}

export type AgentMessage =
  | AgentHello
  | AgentHealth
  | AgentSessionOutput
  | AgentSessionCompleted
  | AgentSessionFailed
  | AgentPong;

// ---------------------------------------------------------------------------
// Server -> Agent messages
// ---------------------------------------------------------------------------

export interface ServerWelcome {
  type: "server.welcome";
  serverId: string;
  serverVersion: string;
}

export interface ServerSessionCreate {
  type: "server.session.create";
  sessionId: string;
  prompt: string;
  workingDirectory: string;
  model?: string;
  permissionMode?: string;
  allowedTools?: string[];
}

export interface ServerSessionAbort {
  type: "server.session.abort";
  sessionId: string;
}

export interface ServerPing {
  type: "server.ping";
  timestamp: number;
}

export interface ServerError {
  type: "server.error";
  code: string;
  message: string;
}

export type ServerMessage =
  | ServerWelcome
  | ServerSessionCreate
  | ServerSessionAbort
  | ServerPing
  | ServerError;

// ---------------------------------------------------------------------------
// Claude CLI stream-json output types
// ---------------------------------------------------------------------------

/**
 * The Claude CLI `--output-format stream-json` emits one JSON object per line.
 * These are the known message types.
 */
export interface StreamJsonInit {
  type: "init";
  session_id?: string;
  model?: string;
  tools?: string[];
}

export interface StreamJsonAssistant {
  type: "assistant";
  message: {
    id: string;
    role: "assistant";
    content: ContentBlock[];
    model: string;
    usage?: { input_tokens: number; output_tokens: number };
  };
  session_id?: string;
}

export interface StreamJsonResult {
  type: "result";
  result: string;
  duration_ms?: number;
  cost_usd?: number;
  session_id?: string;
  is_error?: boolean;
}

export interface StreamJsonSystem {
  type: "system";
  message: string;
  session_id?: string;
}

export type StreamJsonMessage =
  | StreamJsonInit
  | StreamJsonAssistant
  | StreamJsonResult
  | StreamJsonSystem
  | { type: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Content blocks (within assistant messages)
// ---------------------------------------------------------------------------

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;
