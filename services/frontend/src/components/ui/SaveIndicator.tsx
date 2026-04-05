type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

const colors: Record<SaveState, string> = {
  idle: "transparent",
  unsaved: "var(--warning)",
  saving: "var(--accent)",
  saved: "var(--success)",
  error: "var(--danger)",
};

const labels: Record<SaveState, string> = {
  idle: "",
  unsaved: "Unsaved changes",
  saving: "Saving...",
  saved: "Saved",
  error: "Save failed",
};

export default function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry?: () => void }) {
  if (state === "idle") return null;

  const color = colors[state];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 12, fontWeight: 500, padding: "3px 10px",
      borderRadius: 20, transition: "all 0.2s ease",
      background: `${color}15`, color,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%", background: color,
        animation: state === "saving" ? "pulseDot 1s infinite" : "none",
      }} />
      {labels[state]}
      {state === "error" && onRetry && (
        <button onClick={onRetry} style={{
          background: "none", border: "none", color: "var(--danger)",
          fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0, marginLeft: 4,
        }}>Retry</button>
      )}
    </div>
  );
}

export type { SaveState };
