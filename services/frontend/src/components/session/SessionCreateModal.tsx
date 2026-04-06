import { useState } from "react";
import type { SessionCreateRequest } from "../../types/session";
import { useMachines } from "../../stores/machineStore";
import type { Machine } from "../../types/machine";

interface SessionCreateModalProps {
  initialPrompt?: string;
  onConfirm: (request: SessionCreateRequest) => void;
  onCancel: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  padding: 24,
  width: 520,
  maxWidth: "90vw",
  maxHeight: "85vh",
  overflowY: "auto",
};

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

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 16,
};

const btnStyle = (variant: "primary" | "secondary" = "primary"): React.CSSProperties => ({
  padding: "8px 20px",
  border: variant === "primary" ? "none" : "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  background: variant === "primary" ? "var(--accent)" : "transparent",
  color: variant === "primary" ? "#fff" : "var(--text-secondary)",
});

function platformIcon(platform: Machine["platform"]): string {
  switch (platform) {
    case "darwin": return "Apple";
    case "win32": return "Win";
    case "linux": return "Linux";
    default: return "?";
  }
}

export default function SessionCreateModal({ initialPrompt, onConfirm, onCancel }: SessionCreateModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [model, setModel] = useState("sonnet");
  const [name, setName] = useState("");
  const [targetMachineId, setTargetMachineId] = useState<number | "auto">("auto");
  const machines = useMachines();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onConfirm({
      prompt: prompt.trim(),
      workingDirectory: workingDirectory.trim() || ".",
      model,
      name: name.trim() || undefined,
      machineId: targetMachineId === "auto" ? undefined : targetMachineId,
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={modalStyle}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>New Claude Session</h3>

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Prompt *</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt for Claude..."
              rows={6}
              autoFocus={!initialPrompt}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Working Directory</label>
            <input
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder="e.g., /home/user/project (defaults to .)"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ ...inputStyle, width: "auto", minWidth: 180 }}
            >
              <option value="sonnet">Sonnet</option>
              <option value="opus">Opus</option>
              <option value="haiku">Haiku</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Session Name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Give this session a name..."
              style={inputStyle}
            />
          </div>

          {/* Target Machine */}
          {machines.length > 0 && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Target Machine</label>
              <select
                value={targetMachineId}
                onChange={(e) => setTargetMachineId(e.target.value === "auto" ? "auto" : parseInt(e.target.value))}
                style={{ ...inputStyle, width: "auto", minWidth: 260 }}
              >
                <option value="auto">Auto (least loaded)</option>
                {machines.map((m) => {
                  const health = m.last_health;
                  const atCapacity = health ? health.activeSessions >= m.max_concurrent_sessions : false;
                  const isOffline = m.status !== "online";
                  const disabled = isOffline || atCapacity;
                  const sessionInfo = health
                    ? `${health.activeSessions}/${m.max_concurrent_sessions}`
                    : `0/${m.max_concurrent_sessions}`;
                  const label = `${platformIcon(m.platform)} ${m.name} - ${sessionInfo} sessions${isOffline ? " (offline)" : atCapacity ? " (full)" : ""}`;
                  return (
                    <option key={m.id} value={m.id} disabled={disabled}>
                      {label}
                    </option>
                  );
                })}
              </select>
              {targetMachineId !== "auto" && (() => {
                const selected = machines.find((m) => m.id === targetMachineId);
                return selected ? (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    marginTop: 6, padding: "3px 10px", borderRadius: 20,
                    background: `color-mix(in srgb, ${selected.color} 15%, transparent)`,
                    fontSize: 11, color: selected.color, fontWeight: 500,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: selected.color }} />
                    {selected.name}
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={onCancel} style={btnStyle("secondary")}>
              Cancel
            </button>
            <button type="submit" style={btnStyle("primary")} disabled={!prompt.trim()}>
              Start Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
