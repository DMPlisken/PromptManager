import { useSessionSelector } from "../../stores/sessionStore";
import { useMachineStats } from "../../stores/machineStore";

const dotStyle = (color: string, pulsing?: boolean): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: color,
  flexShrink: 0,
  ...(pulsing ? { animation: "pulseDot 1.5s ease-in-out infinite" } : {}),
});

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: "var(--text-muted)",
  marginTop: 6,
};

export default function ConnectionStatus() {
  const wsStatus = useSessionSelector((s) => s.wsStatus);
  const sidecarStatus = useSessionSelector((s) => s.sidecarStatus);
  const machineStats = useMachineStats();

  let color: string;
  let label: string;
  let pulsing = false;

  if (wsStatus === "connected" && sidecarStatus === "connected") {
    color = "var(--status-running)";
    label = "Connected";
  } else if (wsStatus === "reconnecting") {
    color = "var(--status-waiting)";
    label = "Reconnecting...";
    pulsing = true;
  } else if (wsStatus === "connecting") {
    color = "var(--status-waiting)";
    label = "Connecting...";
    pulsing = true;
  } else if (machineStats.online > 0) {
    // WS is disconnected but machines are online via polling -- not alarming
    color = "var(--status-waiting)";
    label = "WS offline";
    pulsing = true;
  } else {
    color = "var(--text-muted)";
    label = "Offline";
  }

  return (
    <div style={containerStyle}>
      <span style={dotStyle(color, pulsing)} />
      <span>{label}</span>
    </div>
  );
}
