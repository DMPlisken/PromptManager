import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { TaskExecution, PromptGroup } from "../types";

export default function HistoryPage() {
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [groups, setGroups] = useState<PromptGroup[]>([]);
  const [filterGroup, setFilterGroup] = useState<number | undefined>();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = async () => {
    try {
      const [execs, gs] = await Promise.all([
        api.getExecutions({ group_id: filterGroup, limit: 100 }),
        api.getGroups(),
      ]);
      setExecutions(execs);
      setGroups(gs);
    } catch { /* */ }
  };

  useEffect(() => { load(); }, [filterGroup]);

  const handleCopy = async (text: string, id: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this execution record?")) return;
    await api.deleteExecution(id);
    await load();
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", background: "var(--bg-input)",
    border: "1px solid var(--border)", borderRadius: "var(--radius)",
    color: "var(--text-primary)", fontSize: 14, outline: "none",
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Execution History</h2>
        <select
          value={filterGroup ?? ""}
          onChange={(e) => setFilterGroup(e.target.value ? Number(e.target.value) : undefined)}
          style={inputStyle}
        >
          <option value="">All Groups</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {executions.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center", color: "var(--text-muted)",
          background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        }}>
          No executions recorded yet. Use a template and save the execution to see it here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {executions.map((ex) => (
            <div
              key={ex.id}
              style={{
                background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)", overflow: "hidden",
              }}
            >
              <div
                onClick={() => setExpanded(expanded === ex.id ? null : ex.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 20px", cursor: "pointer",
                }}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{ex.template_name}</span>
                  <span style={{
                    fontSize: 12, color: "var(--accent)", background: "var(--accent-light)",
                    padding: "2px 8px", borderRadius: 20, marginLeft: 10,
                  }}>{ex.group_name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(ex.created_at).toLocaleString()}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {expanded === ex.id ? "\u25B2" : "\u25BC"}
                  </span>
                </div>
              </div>

              {expanded === ex.id && (
                <div style={{ padding: "0 20px 16px", borderTop: "1px solid var(--border)" }}>
                  {ex.notes && (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 12, marginBottom: 8, fontStyle: "italic" }}>
                      {ex.notes}
                    </p>
                  )}

                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, marginBottom: 4 }}>Variables used:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {Object.entries(ex.variable_values).map(([k, v]) => (
                      <span key={k} style={{
                        fontSize: 11, padding: "3px 8px", background: "var(--bg-input)",
                        borderRadius: 20, color: "var(--text-secondary)",
                      }}>
                        {k}: {String(v).substring(0, 50)}{String(v).length > 50 ? "..." : ""}
                      </span>
                    ))}
                  </div>

                  <pre style={{
                    background: "var(--bg-input)", padding: 14, borderRadius: "var(--radius)",
                    fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                    maxHeight: 300, overflowY: "auto", fontFamily: "monospace",
                    color: "var(--text-primary)",
                  }}>
                    {ex.filled_prompt}
                  </pre>

                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => handleCopy(ex.filled_prompt, ex.id)} style={{
                      padding: "5px 12px", background: "var(--accent)", color: "#fff",
                      border: "none", borderRadius: "var(--radius)", fontSize: 12, cursor: "pointer",
                    }}>
                      {copiedId === ex.id ? "Copied!" : "Copy Prompt"}
                    </button>
                    <button onClick={() => handleDelete(ex.id)} style={{
                      padding: "5px 12px", background: "transparent", color: "var(--danger)",
                      border: "1px solid var(--danger)", borderRadius: "var(--radius)", fontSize: 12, cursor: "pointer",
                    }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
