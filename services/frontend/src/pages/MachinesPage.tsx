import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { machineStore, useMachines, useMachineStats } from "../stores/machineStore";
import MachineCard from "../components/machines/MachineCard";
import MachineEditModal from "../components/machines/MachineEditModal";
import SetupWizard from "../components/machines/SetupWizard";
import type { Machine } from "../types/machine";

/* ---------- Styles ---------- */

const btnStyle = (variant: "primary" | "secondary" = "primary"): React.CSSProperties => ({
  padding: "8px 20px",
  border: variant === "primary" ? "none" : "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  background: variant === "primary" ? "var(--accent)" : "transparent",
  color: variant === "primary" ? "#fff" : "var(--text-secondary)",
});

const badgeStyle = (color: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 12px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  background: `color-mix(in srgb, ${color} 15%, transparent)`,
  color,
});

/* ---------- Component ---------- */

export default function MachinesPage() {
  const machines = useMachines();
  const stats = useMachineStats();
  const [showWizard, setShowWizard] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

  // Load machines on mount
  useEffect(() => {
    const load = async () => {
      try {
        const list = await api.getMachines();
        machineStore.dispatch({ type: "MACHINES_LOADED", machines: list });
      } catch {
        // Backend may not be ready
      }
    };
    load();
  }, []);

  const handleEdit = useCallback((machine: Machine) => {
    setEditingMachine(machine);
  }, []);

  const handleRemove = useCallback(async (machine: Machine) => {
    if (!confirm(`Remove machine "${machine.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteMachine(machine.id);
      machineStore.dispatch({ type: "MACHINE_REMOVED", machineId: machine.id });
    } catch (e) {
      alert("Failed to remove machine: " + e);
    }
  }, []);

  const handleSaveEdit = useCallback(async (
    id: number,
    data: { name: string; color: string; workspace_root: string; max_concurrent_sessions: number }
  ) => {
    try {
      const updated = await api.updateMachine(id, data);
      machineStore.dispatch({ type: "MACHINE_UPDATED", machine: updated });
      setEditingMachine(null);
    } catch (e) {
      alert("Failed to update machine: " + e);
    }
  }, []);

  const handleEditRemove = useCallback(async (machine: Machine) => {
    try {
      await api.deleteMachine(machine.id);
      machineStore.dispatch({ type: "MACHINE_REMOVED", machineId: machine.id });
      setEditingMachine(null);
    } catch (e) {
      alert("Failed to remove machine: " + e);
    }
  }, []);

  const handleWizardComplete = useCallback((_machine: Machine) => {
    setShowWizard(false);
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Machines</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Manage connected machines that run Claude sessions.
          </p>
        </div>
        <button onClick={() => setShowWizard(true)} style={btnStyle("primary")}>
          + Add Machine
        </button>
      </div>

      {/* Stats bar */}
      <div style={{
        display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap",
      }}>
        <span style={badgeStyle("var(--success)")}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} />
          {stats.online} online
        </span>
        <span style={badgeStyle("var(--text-muted)")}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)" }} />
          {stats.offline} offline
        </span>
        {stats.pairing > 0 && (
          <span style={badgeStyle("var(--accent)")}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
            {stats.pairing} pairing
          </span>
        )}
        <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
          {stats.total} total
        </span>
      </div>

      {/* Machine cards grid */}
      {machines.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 8 }}>
            No machines connected yet.
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
            Add a machine to start running Claude sessions across your network.
          </p>
          <button onClick={() => setShowWizard(true)} style={btnStyle("primary")}>
            + Add Machine
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 16,
        }}>
          {machines.map((m) => (
            <MachineCard
              key={m.id}
              machine={m}
              onEdit={handleEdit}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Setup wizard */}
      {showWizard && (
        <SetupWizard
          onClose={() => setShowWizard(false)}
          onComplete={handleWizardComplete}
        />
      )}

      {/* Edit modal */}
      {editingMachine && (
        <MachineEditModal
          machine={editingMachine}
          onSave={handleSaveEdit}
          onRemove={handleEditRemove}
          onCancel={() => setEditingMachine(null)}
        />
      )}
    </div>
  );
}
