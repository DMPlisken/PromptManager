// Session status
export type SessionStatus =
  | "starting"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "terminated"
  | "disconnected";

// Content block types from Claude Code stream-json
export interface TextBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
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
  is_error: boolean;
}

export interface ErrorBlock {
  type: "error";
  error: string;
  stderr?: string;
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolUseBlock
  | ToolResultBlock
  | ErrorBlock;

// A single message in the session stream
export interface SessionMessage {
  id: string;
  sessionId: string;
  sequence: number;
  role: "user" | "assistant" | "system" | "result";
  type: string;
  content: string;
  blocks?: ContentBlock[];
  timestamp: string;
  costUsd?: number;
}

// Tool approval request
export interface ToolApprovalRequest {
  id: string;
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  requestedAt: string;
  status: "pending" | "approved" | "denied" | "timeout";
}

// Session metadata
export interface ClaudeSession {
  id: string;
  name: string;
  groupId?: number;
  templateId?: number;
  executionId?: number;
  status: SessionStatus;
  workingDirectory: string;
  model: string;
  initialPrompt: string;
  tokenCountInput: number;
  tokenCountOutput: number;
  totalCostUsd: number;
  startedAt: string;
  endedAt?: string;
  error?: string;
}

// Session creation request
export interface SessionCreateRequest {
  prompt: string;
  workingDirectory: string;
  model?: string;
  groupId?: number;
  templateId?: number;
  name?: string;
  permissionMode?: string;
  allowedTools?: string[];
}

// WebSocket protocol — client messages
export type WsClientMessage =
  | { type: "session.create"; sessionId: string; prompt: string; options: SessionCreateRequest }
  | { type: "session.input"; sessionId: string; text: string }
  | { type: "session.approve"; sessionId: string; toolUseId: string; approved: boolean }
  | { type: "session.abort"; sessionId: string }
  | { type: "protocol.ping"; timestamp: number };

// WebSocket protocol — server messages
export type WsServerMessage =
  | { type: "session.started"; sessionId: string }
  | { type: "session.message"; sessionId: string; sequence: number; message: SessionMessage }
  | { type: "session.approval_required"; sessionId: string; toolUse: ToolApprovalRequest }
  | {
      type: "session.completed";
      sessionId: string;
      result: { costUsd: number; tokenCountInput: number; tokenCountOutput: number; duration: number };
    }
  | {
      type: "session.error";
      sessionId: string;
      error: { code: string; message: string; retryable: boolean };
    }
  | { type: "session.status_changed"; sessionId: string; status: SessionStatus }
  | { type: "protocol.pong"; timestamp: number; serverTimestamp: number }
  | { type: "system.sidecar_status"; status: "connected" | "disconnected" };

// Session store state
export interface SessionState {
  sessions: Record<string, ClaudeSession>;
  sessionOrder: string[];
  activeSessionId: string | null;
  messages: Record<string, SessionMessage[]>;
  approvals: Record<string, ToolApprovalRequest[]>;
  sidecarStatus: "connected" | "disconnected" | "unknown";
  wsStatus: "connecting" | "connected" | "reconnecting" | "disconnected";
}

// Session store actions
export type SessionAction =
  | { type: "SESSION_CREATED"; session: ClaudeSession }
  | { type: "SESSION_STATUS_CHANGED"; sessionId: string; status: SessionStatus; error?: string }
  | {
      type: "SESSION_COMPLETED";
      sessionId: string;
      result: { costUsd: number; tokenCountInput: number; tokenCountOutput: number };
    }
  | { type: "SESSION_REMOVED"; sessionId: string }
  | { type: "SET_ACTIVE_SESSION"; sessionId: string | null }
  | { type: "MESSAGES_APPENDED"; sessionId: string; messages: SessionMessage[] }
  | { type: "APPROVAL_REQUESTED"; approval: ToolApprovalRequest }
  | { type: "APPROVAL_RESOLVED"; sessionId: string; approvalId: string; resolution: "approved" | "denied" }
  | { type: "SET_WS_STATUS"; status: SessionState["wsStatus"] }
  | { type: "SET_SIDECAR_STATUS"; status: SessionState["sidecarStatus"] }
  | { type: "SESSIONS_LOADED"; sessions: ClaudeSession[] };
