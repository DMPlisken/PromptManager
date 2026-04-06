import { useEffect, useCallback } from "react";
import type { ToolApprovalRequest } from "../../types/session";

interface ToolApprovalCardProps {
  approval: ToolApprovalRequest;
  onApprove: (toolUseId: string) => void;
  onDeny: (toolUseId: string) => void;
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: "var(--radius-lg)",
  border: "2px solid var(--status-waiting)",
  padding: 16,
  marginBottom: 8,
  animation: "pulse-border 2s ease-in-out infinite",
};

const toolNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--status-waiting)",
  fontFamily: "monospace",
  marginBottom: 8,
};

const inputPreviewStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  padding: 10,
  borderRadius: "var(--radius)",
  fontSize: 12,
  fontFamily: "monospace",
  color: "var(--text-secondary)",
  maxHeight: 120,
  overflowY: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  marginBottom: 12,
};

const btnGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const approveBtn: React.CSSProperties = {
  padding: "6px 16px",
  border: "none",
  borderRadius: "var(--radius)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  background: "var(--status-running)",
  color: "#fff",
};

const denyBtn: React.CSSProperties = {
  padding: "6px 16px",
  border: "none",
  borderRadius: "var(--radius)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  background: "var(--status-failed)",
  color: "#fff",
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginLeft: "auto",
  alignSelf: "center",
};

function formatToolInput(input: Record<string, unknown>): string {
  // Show a compact summary of key fields
  const command = input.command as string | undefined;
  const file_path = input.file_path as string | undefined;
  const content = input.content as string | undefined;

  if (command) return command;
  if (file_path) return file_path + (content ? "\n" + content.substring(0, 200) : "");
  return JSON.stringify(input, null, 2).substring(0, 400);
}

export default function ToolApprovalCard({ approval, onApprove, onDeny }: ToolApprovalCardProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        onApprove(approval.id);
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        onDeny(approval.id);
      }
    },
    [approval.id, onApprove, onDeny]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
        Tool approval required
      </div>
      <div style={toolNameStyle}>{approval.toolName}</div>
      <div style={inputPreviewStyle}>
        {formatToolInput(approval.toolInput)}
      </div>
      <div style={btnGroupStyle}>
        <button style={approveBtn} onClick={() => onApprove(approval.id)}>
          Approve
        </button>
        <button style={denyBtn} onClick={() => onDeny(approval.id)}>
          Deny
        </button>
        <span style={hintStyle}>Y = approve, N = deny</span>
      </div>
    </div>
  );
}
