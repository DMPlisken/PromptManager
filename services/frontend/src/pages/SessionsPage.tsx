import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { sessionStore } from "../stores/sessionStore";
import {
  useSessionSelector,
  useSessionMessages,
  useActiveSession,
  usePendingApprovals,
} from "../stores/sessionStore";
import { useWsContext } from "../providers/WebSocketContext";
import { useToast } from "../components/Toast";
import SessionTerminal from "../components/session/SessionTerminal";
import SessionCreateModal from "../components/session/SessionCreateModal";
import type { SessionStatus, SessionCreateRequest, ClaudeSession } from "../types/session";

/* ---------- Status helpers ---------- */

const statusColors: Record<SessionStatus, string> = {
  starting: "var(--status-waiting)",
  running: "var(--status-running)",
  waiting_approval: "var(--status-waiting)",
  completed: "var(--status-completed)",
  failed: "var(--status-failed)",
  terminated: "var(--status-terminated)",
  disconnected: "var(--status-terminated)",
};

const statusDot = (status: SessionStatus): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: statusColors[status],
  flexShrink: 0,
});

/* ---------- Shared styles (matches GroupPage.tsx pattern) ---------- */

const btnStyle = (variant: "primary" | "secondary" | "danger" = "primary"): React.CSSProperties => ({
  padding: "6px 14px",
  border: variant === "primary" ? "none" : "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  background: variant === "primary" ? "var(--accent)" : variant === "danger" ? "var(--danger)" : "var(--bg-card)",
  color: variant === "primary" || variant === "danger" ? "#fff" : "var(--text-secondary)",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "var(--bg-input)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
};

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  padding: 20,
  marginBottom: 16,
};

/* ---------- Helpers ---------- */

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateDir(dir: string, maxLen = 40): string {
  if (!dir || dir.length <= maxLen) return dir || "";
  return "..." + dir.slice(dir.length - maxLen + 3);
}

const statusLabelColors: Record<SessionStatus, string> = {
  starting: "var(--status-waiting)",
  running: "var(--status-running)",
  waiting_approval: "var(--status-waiting)",
  completed: "var(--status-completed)",
  failed: "var(--status-failed)",
  terminated: "var(--status-terminated)",
  disconnected: "var(--status-terminated)",
};

/* ---------- Filter type ---------- */

type SessionFilter = "all" | "active" | "completed";

function matchesFilter(session: ClaudeSession, filter: SessionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return ["starting", "running", "waiting_approval"].includes(session.status);
  if (filter === "completed") return ["completed", "failed", "terminated", "disconnected"].includes(session.status);
  return true;
}

/* ---------- Component ---------- */

export default function SessionsPage() {
  const { actions, send } = useWsContext();
  const sessions = useSessionSelector((s) => s.sessions);
  const sessionOrder = useSessionSelector((s) => s.sessionOrder);
  const activeSessionId = useSessionSelector((s) => s.activeSessionId);
  const activeSession = useActiveSession();
  const messages = useSessionMessages(activeSessionId);
  const pendingApprovals = usePendingApprovals(activeSessionId);

  const toast = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [followUpText, setFollowUpText] = useState("");
  const [filter, setFilter] = useState<SessionFilter>("all");

  // Load sessions on mount
  useEffect(() => {
    actions.loadSessions().catch(() => {});
  }, [actions]);

  // Subscribe to active session messages via WS AND load existing messages from API
  useEffect(() => {
    if (activeSessionId) {
      send({ type: "session.subscribe", sessionId: activeSessionId });
      // Load existing messages from DB (for completed/past sessions)
      api.getSessionMessages(activeSessionId).then((msgs) => {
        if (msgs.length > 0) {
          const sessionMsgs = msgs.map((m: any, i: number) => ({
            id: `${activeSessionId}-db-${i}`,
            sessionId: activeSessionId,
            sequence: m.sequence || i,
            role: m.role || "assistant",
            type: m.message_type || "text",
            content: m.content || "",
            timestamp: m.created_at || new Date().toISOString(),
          }));
          sessionStore.dispatch({
            type: "MESSAGES_APPENDED",
            sessionId: activeSessionId,
            messages: sessionMsgs,
          });
        }
      }).catch(() => {});
    }
  }, [activeSessionId, send]);

  const handleCreateSession = useCallback(
    async (request: SessionCreateRequest) => {
      try {
        await actions.createSession(request);
        setShowCreateModal(false);
        toast.success("Session created", request.name || "New session started");
      } catch (e) {
        toast.error("Failed to create session", String(e));
      }
    },
    [actions, toast]
  );

  const handleSendFollowUp = useCallback(() => {
    if (!activeSessionId || !followUpText.trim()) return;
    actions.sendInput(activeSessionId, followUpText.trim());
    setFollowUpText("");
  }, [activeSessionId, followUpText, actions]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendFollowUp();
      }
    },
    [handleSendFollowUp]
  );

  const handleApprove = useCallback(
    (toolUseId: string) => {
      if (activeSessionId) actions.approveToolUse(activeSessionId, toolUseId, true);
    },
    [activeSessionId, actions]
  );

  const handleDeny = useCallback(
    (toolUseId: string) => {
      if (activeSessionId) actions.approveToolUse(activeSessionId, toolUseId, false);
    },
    [activeSessionId, actions]
  );

  const handleAbort = useCallback(() => {
    if (activeSessionId && confirm("Abort this session?")) {
      actions.abortSession(activeSessionId);
    }
  }, [activeSessionId, actions]);

  const handleRemove = useCallback(
    async (sessionId: string) => {
      if (!confirm("Remove this session?")) return;
      try {
        await actions.removeSession(sessionId);
        toast.success("Session removed");
      } catch (e) {
        toast.error("Failed to remove session", String(e));
      }
    },
    [actions, toast]
  );

  const orderedSessions = sessionOrder.map((id) => sessions[id]).filter(Boolean);
  const filteredSidebar = orderedSessions.filter((s) => matchesFilter(s, filter));

  // Group sidebar sessions by status category
  const activeSidebar = filteredSidebar.filter((s) =>
    ["starting", "running", "waiting_approval"].includes(s.status)
  );
  const completedSidebar = filteredSidebar.filter((s) => s.status === "completed");
  const failedSidebar = filteredSidebar.filter((s) =>
    ["failed", "terminated", "disconnected"].includes(s.status)
  );
  const sidebarGroups: { label: string; sessions: ClaudeSession[] }[] = [
    ...(activeSidebar.length > 0 ? [{ label: "Active", sessions: activeSidebar }] : []),
    ...(completedSidebar.length > 0 ? [{ label: "Completed", sessions: completedSidebar }] : []),
    ...(failedSidebar.length > 0 ? [{ label: "Failed", sessions: failedSidebar }] : []),
  ];

  const isSessionActive = activeSession && ["starting", "running", "waiting_approval"].includes(activeSession.status);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 48px)", gap: 0 }}>
      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          {orderedSessions.map((s) => {
            const isActive = activeSessionId === s.id;
            const tabName = s.name || (s.id ? s.id.substring(0, 8) : "Session");
            return (
              <button
                key={s.id}
                onClick={() => actions.setActiveSession(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  border: isActive ? "1px solid var(--accent)" : "1px solid transparent",
                  borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  borderRadius: "var(--radius) var(--radius) 0 0",
                  background: isActive ? "var(--accent-light)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                  maxWidth: 200,
                }}
              >
                <span style={statusDot(s.status)} />
                <span style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {tabName}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "6px 14px",
              border: "1px dashed var(--border)",
              borderRadius: "var(--radius)",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            + New Session
          </button>
        </div>

        {/* Terminal / message area */}
        {activeSession ? (
          <>
            {/* Session info bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: 12,
                color: "var(--text-muted)",
                flexShrink: 0,
                background: "var(--bg-secondary)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {/* Status badge */}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "3px 10px", borderRadius: 20,
                  background: `color-mix(in srgb, ${statusLabelColors[activeSession.status]} 15%, transparent)`,
                  color: statusLabelColors[activeSession.status],
                  fontSize: 11, fontWeight: 600, textTransform: "capitalize",
                }}>
                  <span style={statusDot(activeSession.status)} />
                  {activeSession.status.replace("_", " ")}
                </span>
                {/* Model badge */}
                <span style={{
                  padding: "3px 10px", borderRadius: 20,
                  background: "var(--accent-light)", color: "var(--accent)",
                  fontSize: 11, fontWeight: 600,
                }}>
                  {activeSession.model}
                </span>
                {/* Working directory */}
                <span style={{
                  padding: "3px 10px", borderRadius: 20,
                  background: "rgba(255,255,255,0.05)", color: "var(--text-muted)",
                  fontSize: 11, fontFamily: "monospace",
                }} title={activeSession.workingDirectory}>
                  {truncateDir(activeSession.workingDirectory)}
                </span>
                {/* Cost */}
                {activeSession.totalCostUsd > 0 && (
                  <span style={{
                    padding: "3px 10px", borderRadius: 20,
                    background: "rgba(76, 175, 128, 0.1)", color: "var(--success)",
                    fontSize: 11, fontWeight: 600,
                  }}>
                    ${activeSession.totalCostUsd.toFixed(4)}
                  </span>
                )}
                {/* Token count */}
                {(activeSession.tokenCountInput > 0 || activeSession.tokenCountOutput > 0) && (
                  <span style={{
                    padding: "3px 10px", borderRadius: 20,
                    background: "rgba(255,255,255,0.05)", color: "var(--text-muted)",
                    fontSize: 11,
                  }}>
                    {activeSession.tokenCountInput.toLocaleString()}in / {activeSession.tokenCountOutput.toLocaleString()}out
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {isSessionActive && (
                  <button onClick={handleAbort} style={btnStyle("danger")}>Abort</button>
                )}
              </div>
            </div>

            <SessionTerminal
              messages={messages}
              pendingApprovals={pendingApprovals}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />

            {/* Input area */}
            {isSessionActive && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "12px 16px",
                  borderTop: "1px solid var(--border)",
                  flexShrink: 0,
                }}
              >
                <textarea
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send a follow-up message... (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  style={{
                    ...inputStyle,
                    resize: "none",
                    fontFamily: "monospace",
                    fontSize: 13,
                  }}
                />
                <button
                  onClick={handleSendFollowUp}
                  disabled={!followUpText.trim()}
                  style={{
                    ...btnStyle("primary"),
                    alignSelf: "flex-end",
                    opacity: followUpText.trim() ? 1 : 0.5,
                  }}
                >
                  Send
                </button>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {orderedSessions.length === 0 ? (
              /* Empty state — no sessions exist yet */
              <div style={{ textAlign: "center", color: "var(--text-muted)", maxWidth: 400 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "var(--accent-light)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px", fontSize: 28,
                }}>
                  {">_"}
                </div>
                <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                  No sessions yet
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                  Create your first Claude Code session to start running prompts on your connected machines.
                  Sessions let you interact with Claude CLI in real time.
                </p>
                <button onClick={() => setShowCreateModal(true)} style={btnStyle("primary")}>
                  Create your first session
                </button>
              </div>
            ) : (
              /* Sessions exist but none is selected */
              <div style={{ textAlign: "center", color: "var(--text-muted)", maxWidth: 400 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "var(--accent-light)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px", fontSize: 22, color: "var(--accent)",
                  border: "1px solid rgba(124, 92, 252, 0.2)",
                }}>
                  {">_"}
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                  No session selected
                </p>
                <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20, color: "var(--text-muted)" }}>
                  Select a session from the tabs above or the sidebar to view its output, or start a new one.
                </p>
                <button onClick={() => setShowCreateModal(true)} style={btnStyle("primary")}>
                  + New Session
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right sidebar: session list */}
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-secondary)",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Sessions</h3>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {orderedSessions.length} total
          </span>
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {(["all", "active", "completed"] as SessionFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "4px 10px",
                border: filter === f ? "1px solid var(--accent)" : "1px solid var(--border)",
                borderRadius: "var(--radius)",
                background: filter === f ? "var(--accent-light)" : "transparent",
                color: filter === f ? "var(--accent)" : "var(--text-muted)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Session list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {filteredSidebar.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
              No sessions match filter.
            </div>
          ) : (
            sidebarGroups.map((group) => (
              <div key={group.label}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  padding: "8px 8px 4px", marginTop: 4,
                }}>
                  {group.label} ({group.sessions.length})
                </div>
                {group.sessions.map((s) => {
                  const isSelected = activeSessionId === s.id;
                  const timeAgo = relativeTime(s.startedAt);
                  return (
                    <div
                      key={s.id}
                      onClick={() => actions.setActiveSession(s.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "var(--radius-lg)",
                        marginBottom: 6,
                        cursor: "pointer",
                        background: isSelected ? "var(--accent-light)" : "var(--bg-card)",
                        border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? "0 0 0 1px rgba(124, 92, 252, 0.1)" : "none",
                      }}
                    >
                      {/* Top row: status dot + name + time */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={statusDot(s.status)} />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? "var(--accent)" : "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                        >
                          {s.name || (s.id ? s.id.substring(0, 12) : "Session")}
                        </span>
                        {timeAgo && (
                          <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                            {timeAgo}
                          </span>
                        )}
                      </div>
                      {/* Second row: model badge + status */}
                      <div style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 16, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 12,
                          background: `color-mix(in srgb, ${statusColors[s.status]} 15%, transparent)`,
                          color: statusColors[s.status], textTransform: "capitalize",
                        }}>{s.status.replace("_", " ")}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 500, padding: "1px 6px", borderRadius: 12,
                          background: "var(--accent-light)", color: "var(--accent)",
                        }}>{s.model}</span>
                        {s.totalCostUsd > 0 && (
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            ${s.totalCostUsd.toFixed(3)}
                          </span>
                        )}
                      </div>
                      {/* Prompt preview */}
                      {(s.initialPrompt ?? "").length > 0 && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            paddingLeft: 16,
                            marginTop: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {(s.initialPrompt ?? "").substring(0, 60)}{(s.initialPrompt ?? "").length > 60 ? "..." : ""}
                        </div>
                      )}
                      {/* Remove button */}
                      {["completed", "failed", "terminated", "disconnected"].includes(s.status) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemove(s.id); }}
                          style={{
                            marginTop: 6,
                            marginLeft: 16,
                            padding: "2px 8px",
                            fontSize: 11,
                            background: "transparent",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Create modal */}
      {showCreateModal && (
        <SessionCreateModal
          onConfirm={handleCreateSession}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
