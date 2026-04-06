import { useState, useEffect, useRef } from "react";
import { api } from "../../api/client";
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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; status: string; output: string; machine_name: string; message_count: number } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const result = await api.testMachine(machine.id);
      setTestResult(result);
    } catch (e: any) {
      setTestError(e?.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  // Update relative time every 10s
  useEffect(() => {
    const update = () => setLastSeen(relativeTime(machine.last_seen_at));
    update();
    timerRef.current = setInterval(update, 10_000);
    return () => clearInterval(timerRef.current);
  }, [machine.last_seen_at]);

  const health = machine.last_health;
  const sessionLoad = health
    ? `${health.activeSessions}/${machine.max_concurrent_sessions}`
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
                width: `${Math.min(health.cpuPercent, 100)}%`,
                background: barColor(health.cpuPercent),
                transition: "width 0.3s",
              }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 36, textAlign: "right", flexShrink: 0 }}>
              {Math.round(health.cpuPercent)}%
            </span>
          </div>

          {/* Memory */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 32, flexShrink: 0 }}>MEM</span>
            <div style={metricBarContainer}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${Math.min(health.memoryPercent, 100)}%`,
                background: barColor(health.memoryPercent),
                transition: "width 0.3s",
              }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 36, textAlign: "right", flexShrink: 0 }}>
              {Math.round(health.memoryPercent)}%
            </span>
          </div>

          {/* Sessions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 32, flexShrink: 0 }}>SESS</span>
            <div style={metricBarContainer}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${machine.max_concurrent_sessions > 0 ? Math.min((health.activeSessions / machine.max_concurrent_sessions) * 100, 100) : 0}%`,
                background: barColor(machine.max_concurrent_sessions > 0 ? (health.activeSessions / machine.max_concurrent_sessions) * 100 : 0),
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
          {machine.status === "online" && (
            <button
              onClick={handleTest}
              disabled={testing}
              style={{
                ...smallBtnStyle,
                color: testing ? "var(--text-muted)" : "var(--accent)",
                borderColor: testing ? "var(--border)" : "var(--accent)",
                cursor: testing ? "wait" : "pointer",
              }}
            >
              {testing ? "Testing..." : "Test"}
            </button>
          )}
          <button onClick={() => onEdit(machine)} style={smallBtnStyle}>Edit</button>
          <button
            onClick={() => onRemove(machine)}
            style={{ ...smallBtnStyle, color: "var(--danger)", borderColor: "var(--danger)" }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Test Result Popup */}
      {(testResult || testError) && (
        <>
          <div
            onClick={() => { setTestResult(null); setTestError(null); }}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: 24, zIndex: 1001,
            minWidth: 420, maxWidth: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                Machine Test {testResult?.success ? "Passed" : "Failed"}
              </h3>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: testResult?.success ? "var(--success)" : "var(--danger)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, color: "#fff", fontWeight: 700,
              }}>
                {testResult?.success ? "\u2713" : "\u2717"}
              </div>
            </div>

            {testError && (
              <div style={{
                background: "rgba(224, 85, 85, 0.1)", border: "1px solid rgba(224, 85, 85, 0.3)",
                borderRadius: "var(--radius)", padding: 12, marginBottom: 16,
                fontSize: 13, color: "var(--danger)",
              }}>
                {testError}
              </div>
            )}

            {testResult && (
              <>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                  Machine: <strong style={{ color: "var(--text-primary)" }}>{testResult.machine_name}</strong>
                  {" \u00B7 "}
                  Status: <strong style={{ color: testResult.success ? "var(--success)" : "var(--danger)" }}>{testResult.status}</strong>
                  {" \u00B7 "}
                  Messages: {testResult.message_count}
                </div>
                <div style={{
                  background: "var(--bg-card)", borderRadius: "var(--radius)",
                  border: "1px solid var(--border)", padding: 16, marginTop: 12,
                  fontFamily: "monospace", fontSize: 13, lineHeight: 1.6,
                  color: "var(--text-primary)", whiteSpace: "pre-wrap",
                  maxHeight: 300, overflowY: "auto",
                }}>
                  {testResult.output || "(no output)"}
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                onClick={() => { setTestResult(null); setTestError(null); }}
                style={{
                  padding: "8px 20px", background: "var(--accent)", color: "#fff",
                  border: "none", borderRadius: "var(--radius)", fontSize: 13,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
