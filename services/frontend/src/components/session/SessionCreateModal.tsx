import { useState } from "react";
import type { SessionCreateRequest } from "../../types/session";

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

export default function SessionCreateModal({ initialPrompt, onConfirm, onCancel }: SessionCreateModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [model, setModel] = useState("sonnet");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onConfirm({
      prompt: prompt.trim(),
      workingDirectory: workingDirectory.trim() || ".",
      model,
      name: name.trim() || undefined,
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
