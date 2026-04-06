import { useState, useEffect, useRef } from "react";
import type { Machine, MachineStatus, MachinePlatform } from "../../types/machine";

interface MachineCardProps {
  machine: Machine;
  onEdit: (machine: Machine) => void;
  onRemove: (machine: Machine) => void;
}

/* ---------- Helpers ---------- */

function platformIcon(platform: MachinePlatform | null): string {
  switch (platform) {
    case "darwin": return "Apple";
    case "win32": return "Win";
    case "linux": return "Linux";
    default: return "?";
  }
}

function platformLabel(platform: MachinePlatform | null): string {
  switch (platform) {
    case "darwin": return "macOS";
    case "win32": return "Windows";
    case "linux": return "Linux";
    default: return "Unknown";
  }
}

const statusColorMap: Record<MachineStatus, string> = {
  online: "var(--machine-online)",
  offline: "var(--machine-offline)",
  pairing: "var(--machine-pairing)",
  error: "var(--status-failed)",
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "never";
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

function barColor(percent: number): string {
  if (percent < 60) return "var(--success)";
  if (percent < 85) return "var(--warning)";
  return "var(--danger)";
}

/* ---------- Styles ---------- */

const cardStyle = (color: string, isHovered: boolean): React.CSSProperties => ({
  background: "var(--bg-card)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  borderLeft: `4px solid ${color}`,
  padding: 16,
  transition: "border-color 0.15s",
  ...(isHovered ? { borderColor: "var(--accent)" } : {}),
});

const statusDotStyle = (status: MachineStatus): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: statusColorMap[status],
  flexShrink: 0,
  ...(status === "pairing" ? { animation: "pulseDot 1.5s ease-in-out infinite" } : {}),
});

const metricBarContainer: React.CSSProperties = {
  flex: 1,
  height: 4,
  background: "var(--bg-input)",
  borderRadius: 2,
  overflow: "hidden",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "3px 10px",
  fontSize: 11,
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-muted)",
  cursor: "pointer",
};

/* ---------- Component ---------- */

export default function MachineCard({ machine, onEdit, onRemove }: MachineCardProps) {
  const [hovered, setHovered] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => relativeTime(machine.last_seen_at));
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Update relative time every 10s
  useEffect(() => {
    const update = () => setLastSeen(relativeTime(machine.last_seen_at));
    update();
    timerRef.current = setInterval(update, 10_000);
    return () => clearInterval(timerRef.current);
  }, [machine.last_seen_at]);

  const health = machine.last_health;
  const sessionLoad = health
    ? `${health.active_sessions}/${machine.max_concurrent_sessions}`
    : `0/${machine.max_concurrent_sessions}`;

  return (
    <div
      style={cardStyle(machine.color, hovered)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {/* Platform badge */}
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: "var(--radius)",
            background: "var(--bg-input)", fontSize: 11, fontWeight: 600,
            color: "var(--text-secondary)", flexShrink: 0,
          }}>
            {platformIcon(machine.platform)}
          </span>

          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {machine.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {platformLabel(machine.platform)}
              {machine.hostname ? ` \u00B7 ${machine.hostname}` : ""}
            </div>
          </div>
        </div>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={statusDotStyle(machine.status)} />
          <span style={{
            fontSize: 11, fontWeight: 500, textTransform: "capitalize",
            color: statusColorMap[machine.status],
          }}>
            {machine.status}
          </span>
        </div>
      </div>

      {/* Pairing code for machines still pairing */}
      {machine.status === "pairing" && (
        <div style={{
          background: "var(--accent-light)", borderRadius: "var(--radius)",
          padding: "10px 14px", marginBottom: 12, textAlign: "center",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Pairing Code</div>
          <div style={{
            fontSize: 20, fontWeight: 700, letterSpacing: "0.15em",
            color: "var(--accent)", fontFamily: "monospace",
          }}>
            {machine.machine_uuid.substring(0, 6).toUpperCase()}
          </div>
        </div>
      )}

      {/* Health metrics */}
      {machine.status === "online" && health && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {/* CPU */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 32, flexShrink: 0 }}>CPU</span>
            <div style={metricBarContainer}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${Math.min(health.cpu_percent, 100)}%`,
                background: barColor(health.cpu_percent),
                transition: "width 0.3s",
              }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 36, textAlign: "right", flexShrink: 0 }}>
              {Math.round(health.cpu_percent)}%
            </span>
          </div>

          {/* Memory */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 32, flexShrink: 0 }}>MEM</span>
            <div style={metricBarContainer}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${Math.min(health.memory_percent, 100)}%`,
                background: barColor(health.memory_percent),
                transition: "width 0.3s",
              }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 36, textAlign: "right", flexShrink: 0 }}>
              {Math.round(health.memory_percent)}%
            </span>
          </div>

          {/* Sessions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 32, flexShrink: 0 }}>SESS</span>
            <div style={metricBarContainer}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${machine.max_concurrent_sessions > 0 ? Math.min((health.active_sessions / machine.max_concurrent_sessions) * 100, 100) : 0}%`,
                background: barColor(machine.max_concurrent_sessions > 0 ? (health.active_sessions / machine.max_concurrent_sessions) * 100 : 0),
                transition: "width 0.3s",
              }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 36, textAlign: "right", flexShrink: 0 }}>
              {sessionLoad}
            </span>
          </div>
        </div>
      )}

      {/* Footer: last seen + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {machine.status === "online" ? `Last seen ${lastSeen}` : machine.status === "pairing" ? "Waiting..." : `Offline \u00B7 ${lastSeen}`}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onEdit(machine)} style={smallBtnStyle}>Edit</button>
          <button
            onClick={() => onRemove(machine)}
            style={{ ...smallBtnStyle, color: "var(--danger)", borderColor: "var(--danger)" }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
