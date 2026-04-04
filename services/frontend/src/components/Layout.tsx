import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { PromptGroup } from "../types";

export default function Layout({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<PromptGroup[]>([]);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const loadGroups = async () => {
    try {
      setGroups(await api.getGroups());
    } catch {
      /* backend not ready */
    }
  };

  useEffect(() => { loadGroups(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await api.createGroup({ name: newName.trim() });
    setNewName("");
    setShowForm(false);
    await loadGroups();
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <aside style={{
        width: 260, background: "var(--bg-secondary)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border)" }}>
          <Link to="/" style={{ textDecoration: "none", color: "var(--text-primary)" }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Prompt Manager
            </h1>
          </Link>
        </div>

        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
          <div style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Groups
          </div>
          {groups.map((g) => {
            const active = location.pathname === `/groups/${g.id}`;
            return (
              <Link
                key={g.id}
                to={`/groups/${g.id}`}
                style={{
                  display: "block", padding: "8px 12px", borderRadius: "var(--radius)",
                  background: active ? "var(--accent-light)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 14, textDecoration: "none", marginBottom: 2,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {g.name}
              </Link>
            );
          })}

          {showForm ? (
            <form onSubmit={handleCreate} style={{ padding: "8px 4px" }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Group name..."
                autoFocus
                style={{
                  width: "100%", padding: "6px 10px", background: "var(--bg-input)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius)",
                  color: "var(--text-primary)", fontSize: 13, outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                <button type="submit" style={{
                  flex: 1, padding: "4px 8px", background: "var(--accent)", color: "#fff",
                  border: "none", borderRadius: "var(--radius)", fontSize: 12,
                }}>Add</button>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  flex: 1, padding: "4px 8px", background: "var(--bg-card)", color: "var(--text-secondary)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12,
                }}>Cancel</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)} style={{
              display: "block", width: "100%", padding: "8px 12px", marginTop: 4,
              background: "transparent", border: "1px dashed var(--border)",
              borderRadius: "var(--radius)", color: "var(--text-muted)", fontSize: 13,
              textAlign: "left",
            }}>+ New Group</button>
          )}
        </nav>

        <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
          <Link
            to="/history"
            style={{
              display: "block", padding: "8px 12px", borderRadius: "var(--radius)",
              background: location.pathname === "/history" ? "var(--accent-light)" : "transparent",
              color: location.pathname === "/history" ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 14, textDecoration: "none", fontWeight: location.pathname === "/history" ? 600 : 400,
            }}
          >
            History
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {children}
      </main>
    </div>
  );
}
