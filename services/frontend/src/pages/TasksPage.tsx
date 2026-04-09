import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import HelpButton from "../components/HelpButton";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import type { TaskListItem, PromptGroup, Tag } from "../types";

const statusColors: Record<string, string> = { active: "var(--accent)", done: "var(--success)" };
const statusBarColors: Record<string, string> = { active: "#7c5cfc", done: "#4caf80" };
const COLOR_PRESETS = ["#e05555", "#e0a030", "#4caf80", "#5c9cfc", "#7c5cfc", "#e06090", "#40bfa0", "#a0a0b8"];

const LS_KEY = "promptflow_tasks_view";

function loadViewState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return {};
}

function saveViewState(state: Record<string, unknown>) {
  try {
    const prev = loadViewState();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...prev, ...state }));
  } catch { /* */ }
}

export default function TasksPage({ onHelp }: { onHelp?: (id: string) => void }) {
  const saved = loadViewState();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [groups, setGroups] = useState<PromptGroup[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [filter, _setFilter] = useState<string>(saved.filter ?? "");
  const [searchQuery, _setSearchQuery] = useState<string>(saved.searchQuery ?? "");
  const [sortField, _setSortField] = useState<"date" | "name">(saved.sortField ?? "date");
  const [sortDir, _setSortDir] = useState<"asc" | "desc">(saved.sortDir ?? "desc");
  const [activeTagIds, _setActiveTagIds] = useState<Set<number>>(new Set(saved.activeTagIds ?? []));

  const setFilter = (v: string) => { _setFilter(v); saveViewState({ filter: v }); };
  const setSearchQuery = (v: string) => { _setSearchQuery(v); saveViewState({ searchQuery: v }); };
  const setSortField = (v: "date" | "name") => { _setSortField(v); saveViewState({ sortField: v }); };
  const setSortDir = (v: "asc" | "desc") => { _setSortDir(v); saveViewState({ sortDir: v }); };
  const setActiveTagIds = (updater: Set<number> | ((prev: Set<number>) => Set<number>)) => {
    _setActiveTagIds((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveViewState({ activeTagIds: Array.from(next) });
      return next;
    });
  };

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [prefillTemplates, setPrefillTemplates] = useState(true);
  const [lastTaskTemplateCount, setLastTaskTemplateCount] = useState(0);

  // Tag management
  const [showTagForm, setShowTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(COLOR_PRESETS[0]);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");

  // Tag assignment popover
  const [tagPopoverTaskId, setTagPopoverTaskId] = useState<number | null>(null);

  const navigate = useNavigate();
  const toast = useToast();

  const load = async () => {
    try {
      const [t, g, tg] = await Promise.all([
        api.getTasks(filter || undefined),
        api.getGroups(),
        api.getTags(),
      ]);
      setTasks(t); setGroups(g); setTags(tg);
    } catch { /* */ }
  };

  useEffect(() => { load(); }, [filter]);

  // Client-side search, tag filter, sort
  const displayedTasks = useMemo(() => {
    let result = [...tasks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (activeTagIds.size > 0) {
      result = result.filter((t) => t.tag_ids.some((id) => activeTagIds.has(id)));
    }
    result.sort((a, b) => {
      // Active always above Done
      if (a.status !== b.status) {
        if (a.status === "active") return -1;
        if (b.status === "active") return 1;
      }
      // Then by selected sort
      if (sortField === "date") {
        const cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        return sortDir === "desc" ? -cmp : cmp;
      }
      const cmp = a.name.localeCompare(b.name);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [tasks, searchQuery, sortField, sortDir, activeTagIds]);

  const cycleSort = () => {
    if (sortField === "date" && sortDir === "desc") { setSortField("date"); setSortDir("asc"); }
    else if (sortField === "date" && sortDir === "asc") { setSortField("name"); setSortDir("asc"); }
    else if (sortField === "name" && sortDir === "asc") { setSortField("name"); setSortDir("desc"); }
    else { setSortField("date"); setSortDir("desc"); }
  };

  const toggleTagFilter = (tagId: number) => {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
      return next;
    });
  };

  const openCreateForm = async () => {
    setShowForm(true);
    if (tasks.length > 0) {
      try {
        const lastTask = await api.getTask(tasks[0].id);
        setLastTaskTemplateCount(lastTask.templates.length);
        setPrefillTemplates(lastTask.templates.length > 0);
      } catch { setLastTaskTemplateCount(0); }
    } else { setLastTaskTemplateCount(0); setPrefillTemplates(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    let templateIds: number[] = [];
    if (prefillTemplates && tasks.length > 0) {
      try {
        const lastTask = await api.getTask(tasks[0].id);
        templateIds = lastTask.templates.map((t) => t.template_id);
      } catch { /* */ }
    }
    const task = await api.createTask({ name: name.trim(), description: desc.trim() || undefined, template_ids: templateIds });
    setName(""); setDesc(""); setShowForm(false);
    toast.success("Task created", templateIds.length > 0 ? `with ${templateIds.length} templates` : undefined);
    navigate(`/tasks/${task.id}`);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    await api.createTag({ name: newTagName.trim(), color: newTagColor });
    setNewTagName(""); setShowTagForm(false);
    toast.success("Tag created");
    await load();
  };

  const handleUpdateTag = async (id: number) => {
    await api.updateTag(id, { name: editTagName, color: editTagColor });
    setEditingTagId(null);
    toast.success("Tag updated");
    await load();
  };

  const handleDeleteTag = async (id: number) => {
    await api.deleteTag(id);
    setActiveTagIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    toast.success("Tag deleted");
    await load();
  };

  const handleDuplicate = async (taskId: number) => {
    try {
      const newTask = await api.duplicateTask(taskId);
      toast.success("Task duplicated", `"${newTask.name}" created`);
      await load();
    } catch { toast.error("Failed to duplicate task"); }
  };

  const handleSetTaskTags = async (taskId: number, tagId: number, checked: boolean) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newTagIds = checked
      ? [...task.tag_ids, tagId]
      : task.tag_ids.filter((id) => id !== tagId);
    await api.setTaskTags(taskId, newTagIds);
    await load();
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", background: "var(--bg-input)",
    border: "1px solid var(--border)", borderRadius: "var(--radius)",
    color: "var(--text-primary)", fontSize: 13, outline: "none",
  };

  const filters = ["", "active", "done"];
  const filterLabels: Record<string, string> = { "": "All", active: "Active", done: "Done" };
  const sortLabel = `${sortField === "date" ? "Date" : "Name"} ${sortDir === "desc" ? "\u2193" : "\u2191"}`;

  const isEmpty = displayedTasks.length === 0 && !showForm;

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Row 1: Title + Search + Sort + Filter + New */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Tasks</h2>
          {onHelp && <HelpButton onClick={() => onHelp("tasks")} />}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            style={{ ...inputStyle, width: 180 }}
          />
          <button onClick={cycleSort} style={{
            padding: "6px 12px", fontSize: 12, background: "var(--bg-card)",
            border: "1px solid var(--border)", borderRadius: "var(--radius)",
            color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          }}>{sortLabel}</button>
          <div style={{ display: "flex", background: "var(--bg-card)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
            {filters.map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "6px 14px", fontSize: 12, fontWeight: filter === f ? 600 : 400,
                background: filter === f ? "var(--accent-light)" : "transparent",
                color: filter === f ? "var(--accent)" : "var(--text-muted)",
                border: "none", cursor: "pointer", fontFamily: "inherit",
                borderRight: f !== "done" ? "1px solid var(--border)" : "none",
              }}>{filterLabels[f]}</button>
            ))}
          </div>
          <Button variant="primary" onClick={() => showForm ? setShowForm(false) : openCreateForm()}>+ New Task</Button>
        </div>
      </div>

      {/* Row 2: Tag management */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        {tags.map((tag) => (
          editingTagId === tag.id ? (
            <div key={tag.id} style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 8px", background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)" }}>
              <input value={editTagName} onChange={(e) => setEditTagName(e.target.value)} style={{ ...inputStyle, width: 80, padding: "2px 6px", fontSize: 11 }} />
              <div style={{ display: "flex", gap: 2 }}>
                {COLOR_PRESETS.map((c) => (
                  <div key={c} onClick={() => setEditTagColor(c)} style={{
                    width: 14, height: 14, borderRadius: "50%", background: c, cursor: "pointer",
                    border: editTagColor === c ? "2px solid #fff" : "2px solid transparent",
                  }} />
                ))}
              </div>
              <button onClick={() => handleUpdateTag(tag.id)} style={{ background: "none", border: "none", color: "var(--success)", fontSize: 11, cursor: "pointer" }}>ok</button>
              <button onClick={() => setEditingTagId(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>x</button>
            </div>
          ) : (
            <div key={tag.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => toggleTagFilter(tag.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
                  borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  background: activeTagIds.has(tag.id) ? `${tag.color}30` : `${tag.color}15`,
                  color: tag.color, border: `1px solid ${tag.color}${activeTagIds.has(tag.id) ? "60" : "30"}`,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
                {tag.name}
              </button>
              <Button variant="icon" onClick={() => { setEditingTagId(tag.id); setEditTagName(tag.name); setEditTagColor(tag.color); }}
                title="Edit tag" style={{ width: 26, height: 26, fontSize: 12 }}>{"\u270E"}</Button>
              <Button variant="destructive" confirm onClick={() => handleDeleteTag(tag.id)}
                title="Delete tag" style={{ padding: "3px 8px", fontSize: 11 }}>{"\u2715"}</Button>
            </div>
          )
        ))}

        {showTagForm ? (
          <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 8px", background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--accent)" }}>
            <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateTag(); }}
              style={{ ...inputStyle, width: 80, padding: "2px 6px", fontSize: 11 }} />
            <div style={{ display: "flex", gap: 2 }}>
              {COLOR_PRESETS.map((c) => (
                <div key={c} onClick={() => setNewTagColor(c)} style={{
                  width: 14, height: 14, borderRadius: "50%", background: c, cursor: "pointer",
                  border: newTagColor === c ? "2px solid #fff" : "2px solid transparent",
                }} />
              ))}
            </div>
            <button onClick={handleCreateTag} style={{ background: "none", border: "none", color: "var(--success)", fontSize: 11, cursor: "pointer" }}>ok</button>
            <button onClick={() => setShowTagForm(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>x</button>
          </div>
        ) : (
          <button onClick={() => setShowTagForm(true)} style={{
            padding: "4px 10px", borderRadius: 16, fontSize: 11, cursor: "pointer",
            background: "transparent", border: "1px dashed var(--border)", color: "var(--text-muted)", fontFamily: "inherit",
          }}>+ Tag</button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--accent)", padding: 20, marginBottom: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>Create New Task</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Task name (e.g., Build Login Page)" autoFocus style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" style={{ ...inputStyle, width: "100%", marginBottom: 12 }} />
          {lastTaskTemplateCount > 0 && (
            <label style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
              padding: "8px 12px", background: "var(--bg-input)", borderRadius: "var(--radius)",
              border: prefillTemplates ? "1px solid var(--accent)" : "1px solid var(--border)",
            }}>
              <input type="checkbox" checked={prefillTemplates} onChange={(e) => setPrefillTemplates(e.target.checked)}
                style={{ accentColor: "var(--accent)", width: 16, height: 16, cursor: "pointer" }} />
              <div>
                <div style={{ fontWeight: 500 }}>Use templates from last task</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {lastTaskTemplateCount} template{lastTaskTemplateCount !== 1 ? "s" : ""} from "{tasks[0]?.name}"
                </div>
              </div>
            </label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" type="submit">Create Task</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Task list */}
      {isEmpty ? (
        tasks.length === 0 && !searchQuery && activeTagIds.size === 0 ? (
          groups.length === 0 ? (
            <EmptyState icon="+" title="Welcome to PromptFlow" description="Set up your first template library to get started."
              action={<Button variant="primary" onClick={() => navigate("/groups/new")}>Create Template Library</Button>} />
          ) : (
            <EmptyState icon="+" title="No tasks yet" description="Create your first task to start using your prompt templates."
              action={<Button variant="primary" onClick={openCreateForm}>+ Create Your First Task</Button>} />
          )
        ) : (
          <EmptyState icon="?" title="No matching tasks" description="Try adjusting your search, filters, or tags." />
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayedTasks.map((t) => {
            const taskTags = tags.filter((tag) => t.tag_ids.includes(tag.id));
            return (
              <div key={t.id} style={{ position: "relative" }}>
                <Link to={`/tasks/${t.id}`} style={{
                  display: "flex", alignItems: "stretch", textDecoration: "none",
                  background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border)", overflow: "visible", position: "relative",
                  transition: "border-color 0.15s ease",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ width: 4, background: statusBarColors[t.status] || "#6b6b85", flexShrink: 0, borderRadius: "12px 0 0 12px" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flex: 1, padding: "14px 20px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</span>
                        <span style={{
                          fontSize: 10, padding: "2px 8px", borderRadius: 20,
                          background: `${statusColors[t.status] || "var(--text-muted)"}20`,
                          color: statusColors[t.status] || "var(--text-muted)",
                          fontWeight: 600, textTransform: "uppercase",
                        }}>{t.status}</span>
                      </div>
                      {t.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{t.description}</p>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {/* Assigned tag chips */}
                      {taskTags.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {taskTags.map((tag) => (
                            <span key={tag.id} style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                              background: `${tag.color}20`, color: tag.color,
                              border: `1px solid ${tag.color}30`, whiteSpace: "nowrap",
                            }}>{tag.name}</span>
                          ))}
                        </div>
                      )}
                      {/* Duplicate button */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDuplicate(t.id); }}
                        style={{
                          background: "var(--bg-input)", border: "1px solid var(--border)",
                          borderRadius: "var(--radius)", color: "var(--text-muted)",
                          fontSize: 11, cursor: "pointer", padding: "4px 8px", fontFamily: "inherit",
                          display: "flex", alignItems: "center", gap: 4,
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                        title="Duplicate task"
                      >{"\u2398"} Copy</button>
                      {/* Tag assign button */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTagPopoverTaskId(tagPopoverTaskId === t.id ? null : t.id); }}
                        style={{
                          background: "var(--bg-input)", border: "1px solid var(--border)",
                          borderRadius: "var(--radius)", color: "var(--text-muted)",
                          fontSize: 11, cursor: "pointer", padding: "4px 8px", fontFamily: "inherit",
                          display: "flex", alignItems: "center", gap: 4,
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                        title="Assign tags"
                      >{"\uD83C\uDFF7"} Tags</button>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.template_count} tmpl</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{new Date(t.updated_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Tag assignment popover */}
                {tagPopoverTaskId === t.id && (
                  <>
                    <div onClick={() => setTagPopoverTaskId(null)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
                    <div style={{
                      position: "absolute", right: 40, top: "100%", marginTop: 4, zIndex: 100,
                      background: "var(--bg-card)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      padding: 8, minWidth: 160,
                    }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, padding: "0 4px" }}>Assign tags:</div>
                      {tags.length === 0 ? (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px" }}>No tags yet. Create one above.</div>
                      ) : tags.map((tag) => (
                        <label key={tag.id} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "4px 6px",
                          cursor: "pointer", borderRadius: 4, fontSize: 12,
                        }}>
                          <input type="checkbox" checked={t.tag_ids.includes(tag.id)}
                            onChange={(e) => handleSetTaskTags(t.id, tag.id, e.target.checked)}
                            style={{ accentColor: tag.color }} />
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: tag.color }} />
                          <span style={{ color: "var(--text-secondary)" }}>{tag.name}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
