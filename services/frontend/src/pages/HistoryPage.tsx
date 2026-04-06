import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { copyToClipboard } from "../utils/clipboard";
import { useToast } from "../components/Toast";
import HelpButton from "../components/HelpButton";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import type { TaskExecution, PromptGroup } from "../types";

interface TaskGroup {
  taskId: number | null;
  taskName: string;
  executions: TaskExecution[];
}

const HISTORY_LS_KEY = "promptflow_history_view";

function loadHistoryState(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem(HISTORY_LS_KEY) || "{}"); } catch { return {}; }
}
function saveHistoryState(patch: Record<string, any>) {
  try { localStorage.setItem(HISTORY_LS_KEY, JSON.stringify({ ...loadHistoryState(), ...patch })); } catch { /* */ }
}

export default function HistoryPage({ onHelp }: { onHelp?: (id: string) => void }) {
  const saved = loadHistoryState();
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [groups, setGroups] = useState<PromptGroup[]>([]);
  const [filterGroup, setFilterGroup] = useState<number | undefined>();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [collapsedTasks, _setCollapsedTasks] = useState<Set<string>>(new Set(saved.collapsedTasks || []));
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, _setSortDir] = useState<"desc" | "asc">(saved.sortDir || "desc");
  const [execImages, setExecImages] = useState<Record<number, Array<{ original_name: string; file_path: string; url: string | null }>>>({});
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const toast = useToast();

  const setCollapsedTasks = (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    _setCollapsedTasks((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveHistoryState({ collapsedTasks: Array.from(next) });
      return next;
    });
  };
  const setSortDir = (v: "desc" | "asc") => { _setSortDir(v); saveHistoryState({ sortDir: v }); };

  const load = async () => {
    try {
      const [execs, gs] = await Promise.all([
        api.getExecutions({ group_id: filterGroup, limit: 200 }),
        api.getGroups(),
      ]);
      setExecutions(execs);
      setGroups(gs);
    } catch { /* */ }
  };

  useEffect(() => { load(); }, [filterGroup]);

  // Group executions by task, apply search and sort
  const taskGroups = useMemo((): TaskGroup[] => {
    const map = new Map<string, TaskGroup>();
    for (const ex of executions) {
      const key = ex.task_id ? String(ex.task_id) : "__ungrouped__";
      if (!map.has(key)) {
        map.set(key, {
          taskId: ex.task_id,
          taskName: ex.task_name || "Ungrouped",
          executions: [],
        });
      }
      map.get(key)!.executions.push(ex);
    }
    let result = Array.from(map.values());
    // Search filter on task name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((tg) => tg.taskName.toLowerCase().includes(q));
    }
    // Sort by most recent execution date
    result.sort((a, b) => {
      if (a.taskId === null) return 1;
      if (b.taskId === null) return -1;
      const cmp = new Date(b.executions[0].created_at).getTime() - new Date(a.executions[0].created_at).getTime();
      return sortDir === "desc" ? cmp : -cmp;
    });
    return result;
  }, [executions, searchQuery, sortDir]);

  const toggleTaskCollapse = (key: string) => {
    setCollapsedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleExpand = async (exId: number) => {
    if (expanded === exId) { setExpanded(null); return; }
    setExpanded(exId);
    if (!execImages[exId]) {
      try {
        const imgs = await api.getExecutionImages(exId);
        setExecImages((prev) => ({ ...prev, [exId]: imgs }));
      } catch { setExecImages((prev) => ({ ...prev, [exId]: [] })); }
    }
  };

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    toast.success("Copied to clipboard");
  };

  const handleDelete = async (id: number) => {
    await api.deleteExecution(id);
    await load();
    toast.success("Entry deleted");
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", background: "var(--bg-input)",
    border: "1px solid var(--border)", borderRadius: "var(--radius)",
    color: "var(--text-primary)", fontSize: 14, outline: "none",
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Prompt History</h2>
          {onHelp && <HelpButton onClick={() => onHelp("history")} />}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            style={{ ...inputStyle, width: 180 }}
          />
          <button onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")} style={{
            padding: "6px 12px", fontSize: 12, background: "var(--bg-card)",
            border: "1px solid var(--border)", borderRadius: "var(--radius)",
            color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          }}>Date {sortDir === "desc" ? "\u2193" : "\u2191"}</button>
          <select
            value={filterGroup ?? ""}
            onChange={(e) => setFilterGroup(e.target.value ? Number(e.target.value) : undefined)}
            style={inputStyle}
          >
            <option value="">All Groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {executions.length === 0 ? (
        <EmptyState icon="~" title="No saved prompts" description="When you generate and save a prompt from a task, it will appear here." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {taskGroups.map((tg) => {
            const key = tg.taskId ? String(tg.taskId) : "__ungrouped__";
            const isCollapsed = collapsedTasks.has(key);

            return (
              <div key={key}>
                {/* Task header */}
                <div
                  onClick={() => toggleTaskCollapse(key)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 16px", cursor: "pointer",
                    background: "var(--bg-secondary)", borderRadius: "var(--radius)",
                    border: "1px solid var(--border)", marginBottom: isCollapsed ? 0 : 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                      {tg.taskName}
                    </span>
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 20,
                      background: "var(--accent-light)", color: "var(--accent)", fontWeight: 600,
                    }}>
                      {tg.executions.length} prompt{tg.executions.length !== 1 ? "s" : ""}
                    </span>
                    {tg.taskId && (
                      <Link
                        to={`/tasks/${tg.taskId}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      >
                        open task
                      </Link>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {isCollapsed ? "\u25BC" : "\u25B2"}
                  </span>
                </div>

                {/* Executions under this task */}
                {!isCollapsed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 12 }}>
                    {tg.executions.map((ex) => (
                      <div
                        key={ex.id}
                        style={{
                          background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
                          border: "1px solid var(--border)", overflow: "hidden",
                        }}
                      >
                        <div
                          onClick={() => handleExpand(ex.id)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "12px 16px", cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{ex.template_name}</span>
                            <span style={{
                              fontSize: 10, color: "var(--accent)", background: "var(--accent-light)",
                              padding: "1px 6px", borderRadius: 12,
                            }}>{ex.group_name}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {new Date(ex.created_at).toLocaleString()}
                            </span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {expanded === ex.id ? "\u25B2" : "\u25BC"}
                            </span>
                          </div>
                        </div>

                        {expanded === ex.id && (
                          <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--border)" }}>
                            {ex.notes && (
                              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 10, marginBottom: 6, fontStyle: "italic" }}>
                                {ex.notes}
                              </p>
                            )}

                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, marginBottom: 4 }}>Variables:</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                              {Object.entries(ex.variable_values).map(([k, v]) => (
                                <span key={k} style={{
                                  fontSize: 10, padding: "2px 6px", background: "var(--bg-input)",
                                  borderRadius: 12, color: "var(--text-secondary)", fontFamily: "monospace",
                                }}>
                                  {k}: {String(v).substring(0, 40)}{String(v).length > 40 ? "..." : ""}
                                </span>
                              ))}
                            </div>

                            <pre style={{
                              background: "var(--bg-input)", padding: 12, borderRadius: "var(--radius)",
                              fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                              maxHeight: 250, overflowY: "auto", fontFamily: "monospace",
                              color: "var(--text-primary)",
                            }}>
                              {ex.filled_prompt}
                            </pre>

                            {/* Images */}
                            {execImages[ex.id] && execImages[ex.id].length > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Attached Images:</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {execImages[ex.id].map((img, idx) => (
                                    <div key={idx} style={{
                                      display: "flex", alignItems: "center", gap: 10, padding: "6px 8px",
                                      borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)",
                                    }}>
                                      {img.url ? (
                                        <img src={img.url} alt={img.original_name}
                                          onClick={() => setFullImageUrl(img.url)}
                                          style={{ width: 60, height: 45, objectFit: "cover", cursor: "pointer", borderRadius: 3, flexShrink: 0 }} />
                                      ) : (
                                        <div style={{ width: 60, height: 45, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 16, flexShrink: 0, background: "var(--bg-card)", borderRadius: 3 }}>{"\uD83D\uDDBC"}</div>
                                      )}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>
                                          {(img.file_path || img.original_name || "").split(/[/\\]/).pop()}
                                        </div>
                                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={img.file_path || ""}>
                                          {img.file_path || ""}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <Button variant="primary" onClick={() => handleCopy(ex.filled_prompt)} style={{ fontSize: 11, padding: "4px 12px" }}>
                                Copy Prompt
                              </Button>
                              <Button variant="destructive" confirm onClick={() => handleDelete(ex.id)} style={{ fontSize: 11, padding: "4px 12px" }}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Full image overlay */}
      {fullImageUrl && (
        <div onClick={() => setFullImageUrl(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out",
        }}>
          <img src={fullImageUrl} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </div>
  );
}
