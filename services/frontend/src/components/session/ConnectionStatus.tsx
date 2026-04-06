import { useSessionSelector } from "../../stores/sessionStore";

const dotStyle = (color: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: color,
  flexShrink: 0,
});

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: "var(--text-muted)",
};

export default function ConnectionStatus() {
  const wsStatus = useSessionSelector((s) => s.wsStatus);
  const sidecarStatus = useSessionSelector((s) => s.sidecarStatus);

  let color: string;
  let label: string;

  if (wsStatus === "connected" && sidecarStatus === "connected") {
    color = "var(--status-running)";
    label = "Connected";
  } else if (wsStatus === "reconnecting") {
    color = "var(--status-waiting)";
    label = "Reconnecting...";
  } else if (wsStatus === "connecting") {
    color = "var(--status-waiting)";
    label = "Connecting...";
  } else {
    color = "var(--status-failed)";
    label = "Disconnected";
  }

  return (
    <div style={containerStyle}>
      <span style={dotStyle(color)} />
      <span>{label}</span>
    </div>
  );
}
