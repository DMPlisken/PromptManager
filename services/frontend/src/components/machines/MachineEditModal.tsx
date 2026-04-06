import { useState } from "react";
import type { Machine } from "../../types/machine";

interface MachineEditModalProps {
  machine: Machine;
  onSave: (id: number, data: { name: string; color: string; workspace_root: string; max_concurrent_sessions: number }) => void;
  onRemove: (machine: Machine) => void;
  onCancel: () => void;
}

/* ---------- Styles ---------- */

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
  width: 460,
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

const btnStyle = (variant: "primary" | "secondary" | "danger" = "primary"): React.CSSProperties => ({
  padding: "8px 20px",
  border: variant === "primary" ? "none" : variant === "danger" ? "none" : "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  background: variant === "primary" ? "var(--accent)" : variant === "danger" ? "var(--danger)" : "transparent",
  color: variant === "primary" || variant === "danger" ? "#fff" : "var(--text-secondary)",
});

/* ---------- Color presets ---------- */

const PRESET_COLORS = [
  "#7c5cfc", // purple (accent)
  "#4caf80", // green
  "#e0a030", // amber
  "#e05555", // red
  "#3b82f6", // blue
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

/* ---------- Component ---------- */

export default function MachineEditModal({ machine, onSave, onRemove, onCancel }: MachineEditModalProps) {
  const [name, setName] = useState(machine.name);
  const [color, setColor] = useState(machine.color);
  const [workspaceRoot, setWorkspaceRoot] = useState(machine.workspace_root || "");
  const [maxSessions, setMaxSessions] = useState(machine.max_concurrent_sessions);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(machine.id, {
      name: name.trim(),
      color,
      workspace_root: workspaceRoot.trim(),
      max_concurrent_sessions: maxSessions,
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={modalStyle}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Edit Machine</h3>

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Machine name..."
              style={inputStyle}
              autoFocus
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: c,
                    border: color === c ? "3px solid var(--text-primary)" : "3px solid transparent",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                />
              ))}
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Workspace Root</label>
            <input
              value={workspaceRoot}
              onChange={(e) => setWorkspaceRoot(e.target.value)}
              placeholder="e.g., /home/user/projects"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Default working directory for sessions on this machine
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Max Concurrent Sessions</label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxSessions}
              onChange={(e) => setMaxSessions(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              style={{ ...inputStyle, width: 100 }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            {/* Danger zone */}
            <div>
              {showConfirmRemove ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--danger)" }}>Remove this machine?</span>
                  <button
                    type="button"
                    onClick={() => onRemove(machine)}
                    style={btnStyle("danger")}
                  >
                    Yes, Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmRemove(false)}
                    style={btnStyle("secondary")}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmRemove(true)}
                  style={{
                    padding: "6px 14px",
                    background: "transparent",
                    border: "1px solid var(--danger)",
                    borderRadius: "var(--radius)",
                    color: "var(--danger)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Remove Machine
                </button>
              )}
            </div>

            {/* Save / Cancel */}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onCancel} style={btnStyle("secondary")}>
                Cancel
              </button>
              <button type="submit" style={btnStyle("primary")} disabled={!name.trim()}>
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
