import { useEffect, useState, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "./Toast";
import type { PromptGroup } from "../types";
import { useAllPendingApprovals, useSessionSelector } from "../stores/sessionStore";
import { useMachineStats } from "../stores/machineStore";
import ConnectionStatus from "./session/ConnectionStatus";
import ErrorBoundary from "./ErrorBoundary";

export default function Layout({ children, onHelp }: { children: ReactNode; onHelp?: () => void }) {
  const [groups, setGroups] = useState<PromptGroup[]>([]);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [importName, setImportName] = useState("");
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [suggestedName, setSuggestedName] = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const pendingApprovals = useAllPendingApprovals();
  const machineStats = useMachineStats();
  const activeSessionCount = useSessionSelector(
    (s) => s.sessionOrder.filter((id) => {
      const sess = s.sessions[id];
      return sess && ["starting", "running", "waiting_approval"].includes(sess.status);
    }).length
  );

  const loadGroups = async () => {
    try {
      setGroups(await api.getGroups());
    } catch {
      /* backend not ready */
    }
  };

  useEffect(() => { loadGroups(); }, []);

  // Listen for group changes from other pages
  useEffect(() => {
    const handler = () => loadGroups();
    window.addEventListener("groups-changed", handler);
    return () => window.removeEventListener("groups-changed", handler);
  }, []);

  // Auto-expand groups section when on a group page
  useEffect(() => {
    if (location.pathname.startsWith("/groups")) setShowGroups(true);
  }, [location.pathname]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await api.createGroup({ name: newName.trim() });
    setNewName("");
    setShowForm(false);
    await loadGroups();
  };

  const navLink = (to: string, label: string, match?: (path: string) => boolean) => {
    const active = match ? match(location.pathname) : location.pathname === to;
    return (
      <Link
        to={to}
        style={{
          display: "block", padding: "8px 12px", borderRadius: "var(--radius)",
          background: active ? "var(--accent-light)" : "transparent",
          color: active ? "var(--accent)" : "var(--text-secondary)",
          fontSize: 14, textDecoration: "none", fontWeight: active ? 600 : 400,
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
      >
        {label}
      </Link>
    );
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <aside style={{
        width: 260, background: "var(--bg-secondary)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border)" }}>
          <Link to="/" style={{ textDecoration: "none", color: "var(--text-primary)" }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
              PromptFlow
            </h1>
          </Link>
          <ConnectionStatus />
        </div>

        {/* Primary: Tasks */}
        <div style={{ padding: "12px 8px" }}>
          <Link
            to="/tasks"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 12px", borderRadius: "var(--radius)",
              background: location.pathname.startsWith("/tasks") ? "var(--accent-light)" : "rgba(124, 92, 252, 0.06)",
              color: location.pathname.startsWith("/tasks") ? "var(--accent)" : "var(--text-primary)",
              fontSize: 14, textDecoration: "none",
              fontWeight: 600,
              border: location.pathname.startsWith("/tasks") ? "1px solid rgba(124, 92, 252, 0.25)" : "1px solid transparent",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { if (!location.pathname.startsWith("/tasks")) e.currentTarget.style.background = "rgba(124, 92, 252, 0.08)"; }}
            onMouseLeave={(e) => { if (!location.pathname.startsWith("/tasks")) e.currentTarget.style.background = "rgba(124, 92, 252, 0.06)"; }}
          >
            Tasks
          </Link>
        </div>

        {/* Scrollable middle area */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "0 8px", borderTop: "1px solid var(--border)" }}>
          {/* Template Library - collapsible */}
          <button
            onClick={() => setShowGroups(!showGroups)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", padding: "10px 8px", marginTop: 4,
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left",
            }}
          >
            <span>Template Library</span>
            <span style={{ fontSize: 10 }}>{showGroups ? "\u25B2" : "\u25BC"}</span>
          </button>

          {showGroups && (
            <>
              {groups.map((g) => {
                const active = location.pathname === `/groups/${g.id}`;
                return (
                  <Link
                    key={g.id}
                    to={`/groups/${g.id}`}
                    style={{
                      display: "block", padding: "7px 12px", borderRadius: "var(--radius)",
                      background: active ? "var(--accent-light)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                      fontSize: 13, textDecoration: "none", marginBottom: 1,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {g.name}
                  </Link>
                );
              })}

              {showForm ? (
                <form onSubmit={handleCreate} style={{ padding: "6px 4px" }}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Group name..."
                    autoFocus
                    style={{
                      width: "100%", padding: "5px 10px", background: "var(--bg-input)",
                      border: "1px solid var(--border)", borderRadius: "var(--radius)",
                      color: "var(--text-primary)", fontSize: 12, outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button type="submit" style={{
                      flex: 1, padding: "3px 8px", background: "var(--accent)", color: "#fff",
                      border: "none", borderRadius: "var(--radius)", fontSize: 11,
                    }}>Add</button>
                    <button type="button" onClick={() => setShowForm(false)} style={{
                      flex: 1, padding: "3px 8px", background: "var(--bg-card)", color: "var(--text-secondary)",
                      border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 11,
                    }}>Cancel</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowForm(true)} style={{
                  display: "block", width: "100%", padding: "6px 12px", marginTop: 2,
                  background: "transparent", border: "1px dashed var(--border)",
                  borderRadius: "var(--radius)", color: "var(--text-muted)", fontSize: 12,
                  textAlign: "left", cursor: "pointer",
                }}>+ New Group</button>
              )}
              <button onClick={() => importFileRef.current?.click()} style={{
                display: "block", width: "100%", padding: "6px 12px", marginTop: 2,
                background: "transparent", border: "1px dashed var(--border)",
                borderRadius: "var(--radius)", color: "var(--text-muted)", fontSize: 12,
                textAlign: "left", cursor: "pointer",
              }}>Import Group</button>
              <input ref={importFileRef} type="file" accept=".json,.promptflow.json" style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = "";
                  try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    if (!data.format_version || !data.group) {
                      toast.error("Invalid file", "Not a valid PromptFlow export file");
                      return;
                    }
                    setImportData(data);
                    setImportName(data.group.name || "");
                    setNameAvailable(null);
                    setShowImportModal(true);
                    // Check name
                    try {
                      const check = await api.checkGroupName(data.group.name);
                      setNameAvailable(check.available);
                      if (!check.available && check.suggested_name) {
                        setSuggestedName(check.suggested_name);
                        setImportName(check.suggested_name);
                      }
                    } catch { /* */ }
                  } catch {
                    toast.error("Invalid file", "Could not parse as JSON");
                  }
                }} />
            </>
          )}
        </nav>

        {/* Footer */}
        <div style={{ padding: "8px 8px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 1 }}>
          <Link
            to="/sessions"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: "var(--radius)",
              background: location.pathname === "/sessions" ? "var(--accent-light)" : "transparent",
              color: location.pathname === "/sessions" ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 14, textDecoration: "none", fontWeight: location.pathname === "/sessions" ? 600 : 400,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { if (location.pathname !== "/sessions") e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={(e) => { if (location.pathname !== "/sessions") e.currentTarget.style.background = "transparent"; }}
          >
            <span>Sessions{activeSessionCount > 0 ? ` (${activeSessionCount})` : ""}</span>
            {pendingApprovals.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, minWidth: 18, height: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--status-waiting)", color: "#fff", borderRadius: 20,
                padding: "0 5px",
              }}>
                {pendingApprovals.length}
              </span>
            )}
          </Link>
          <Link
            to="/machines"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: "var(--radius)",
              background: location.pathname === "/machines" ? "var(--accent-light)" : "transparent",
              color: location.pathname === "/machines" ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 14, textDecoration: "none", fontWeight: location.pathname === "/machines" ? 600 : 400,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { if (location.pathname !== "/machines") e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={(e) => { if (location.pathname !== "/machines") e.currentTarget.style.background = "transparent"; }}
          >
            <span>Machines{machineStats.total > 0 ? ` (${machineStats.online})` : ""}</span>
            {machineStats.offline > 0 && machineStats.total > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, minWidth: 18, height: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--danger)", color: "#fff", borderRadius: 20,
                padding: "0 5px",
              }}>
                {machineStats.offline}
              </span>
            )}
          </Link>
          {navLink("/history", "History")}
          {navLink("/manual", "Manual")}
          {onHelp && (
            <button
              onClick={onHelp}
              style={{
                display: "block", width: "100%", padding: "8px 12px", borderRadius: "var(--radius)",
                background: "transparent", border: "none", textAlign: "left",
                color: "var(--text-muted)", fontSize: 14, cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              ? Quick Help
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      {/* Import Preview Modal */}
      {showImportModal && importData && (
        <>
          <div onClick={() => setShowImportModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: 24, zIndex: 1001, minWidth: 420,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Import Group</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Group Name</label>
              <input value={importName} onChange={async (e) => {
                setImportName(e.target.value);
                if (e.target.value.trim()) {
                  try {
                    const check = await api.checkGroupName(e.target.value.trim());
                    setNameAvailable(check.available);
                    if (!check.available && check.suggested_name) setSuggestedName(check.suggested_name);
                  } catch { /* */ }
                }
              }} style={{
                width: "100%", padding: "8px 12px", background: "var(--bg-input)",
                border: `1px solid ${nameAvailable === false ? "var(--danger)" : "var(--border)"}`,
                borderRadius: "var(--radius)", color: "var(--text-primary)", fontSize: 14, outline: "none",
              }} />
              {nameAvailable === false && (
                <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>
                  Name already exists.{" "}
                  <button onClick={() => { setImportName(suggestedName); setNameAvailable(true); }}
                    style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>
                    Use "{suggestedName}"
                  </button>
                </div>
              )}
              {nameAvailable === true && (
                <div style={{ fontSize: 11, color: "var(--success)", marginTop: 4 }}>Name available</div>
              )}
            </div>
            <div style={{ marginBottom: 16, fontSize: 13, color: "var(--text-secondary)" }}>
              <div>{importData.variables?.length || 0} variables, {importData.templates?.length || 0} templates</div>
              {importData.templates?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {importData.templates.map((t: any, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: "var(--text-muted)", padding: "2px 0" }}>
                      {"\u2022"} {t.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowImportModal(false)} style={{
                padding: "8px 16px", background: "var(--bg-card)", color: "var(--text-secondary)",
                border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={async () => {
                try {
                  const result = await api.importGroup(importData, importName.trim() || undefined);
                  setShowImportModal(false);
                  setImportData(null);
                  toast.success("Group imported", `"${result.name}" with ${importData.variables?.length || 0} variables and ${importData.templates?.length || 0} templates`);
                  await loadGroups();
                  setShowGroups(true);
                  navigate(`/groups/${result.id}`);
                } catch (e: any) {
                  const msg = String(e);
                  if (msg.includes("409")) {
                    setNameAvailable(false);
                  } else {
                    toast.error("Import failed", msg);
                  }
                }
              }} disabled={nameAvailable === false} style={{
                padding: "8px 16px", background: nameAvailable === false ? "var(--text-muted)" : "var(--accent)",
                color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: 13,
                fontWeight: 600, cursor: nameAvailable === false ? "not-allowed" : "pointer",
              }}>Import</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
