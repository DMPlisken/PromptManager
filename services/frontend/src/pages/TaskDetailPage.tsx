import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import HelpButton from "../components/HelpButton";
import Button from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import SaveIndicator, { type SaveState } from "../components/ui/SaveIndicator";
import StepBar from "../components/ui/StepBar";
import ImageAttachments, { getTemplateImagePaths } from "../components/ImageAttachments";
import type { Task, PromptGroup, PromptTemplate } from "../types";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", background: "var(--bg-input)",
  border: "1px solid var(--border)", borderRadius: "var(--radius)",
  color: "var(--text-primary)", fontSize: 14, outline: "none",
};

function renderPrompt(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{(.+?)\}\}/g, (match, key) => {
    const k = key.trim();
    const val = values[k];
    return val !== undefined && val.trim() !== "" ? val.trimEnd() : match;
  });
}

export default function TaskDetailPage({ onHelp }: { onHelp?: (id: string) => void }) {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const tid = Number(taskId);

  const [task, setTask] = useState<Task | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [allVars, setAllVars] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<number | null>(null);
  const [rendered, setRendered] = useState("");

  // Auto-save
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<number>();
  const savedFadeTimer = useRef<number>();
  const lastSavedValues = useRef<string>("");

  // Template picker
  const [showPicker, setShowPicker] = useState(false);
  const [groups, setGroups] = useState<PromptGroup[]>([]);
  const [pickerGroup, setPickerGroup] = useState<number | null>(null);
  const [pickerTemplates, setPickerTemplates] = useState<PromptTemplate[]>([]);

  // Edit
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // (image paths fetched fresh on copy - no stale state needed)

  // Variable validation highlight
  const [highlightedVars, setHighlightedVars] = useState<Set<string>>(new Set());
  const varRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Executions
  const [executions, setExecutions] = useState<Array<{ id: number; template_name: string; filled_prompt: string; created_at: string; images?: Array<{ image_type: string; original_name: string; file_path: string; url: string | null }> }>>([]);
  const [showExecs, setShowExecs] = useState(false);

  const load = async () => {
    try {
      const t = await api.getTask(tid);
      setTask(t);
      setVarValues(t.variable_values || {});
      lastSavedValues.current = JSON.stringify(t.variable_values || {});
      const vars = new Set<string>();
      t.templates.forEach((tt) => tt.placeholders.forEach((p) => vars.add(p)));
      setAllVars(Array.from(vars));
      if (t.templates.length > 0 && selectedTab === null) {
        setSelectedTab(t.templates[0].template_id);
      }
    } catch { /* */ }
  };

  const loadExecutions = async () => {
    try {
      const taskExecs = await api.getExecutions({ task_id: tid, limit: 50 });
      const withImages = await Promise.all(taskExecs.map(async (e) => {
        let images: Array<{ image_type: string; original_name: string; file_path: string; url: string | null }> = [];
        try { images = await api.getExecutionImages(e.id); } catch { /* */ }
        return {
          id: e.id, template_name: e.template_name || "Unknown",
          filled_prompt: e.filled_prompt, created_at: e.created_at, images,
        };
      }));
      setExecutions(withImages);
    } catch { /* */ }
  };

  useEffect(() => { load(); loadExecutions(); }, [tid]);

  // Auto-save debounce
  const doSave = useCallback(async (values: Record<string, string>) => {
    setSaveState("saving");
    try {
      await api.updateTask(tid, { variable_values: values });
      lastSavedValues.current = JSON.stringify(values);
      setSaveState("saved");
      clearTimeout(savedFadeTimer.current);
      savedFadeTimer.current = window.setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, [tid]);

  const handleVarChange = (name: string, value: string) => {
    if (highlightedVars.has(name)) {
      setHighlightedVars((prev) => { const next = new Set(prev); next.delete(name); return next; });
    }
    const newValues = { ...varValues, [name]: value };
    setVarValues(newValues);
    if (JSON.stringify(newValues) !== lastSavedValues.current) {
      setSaveState("unsaved");
      clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => doSave(newValues), 1500);
    }
  };

  useEffect(() => () => { clearTimeout(saveTimer.current); clearTimeout(savedFadeTimer.current); }, []);

  // Live render
  useEffect(() => {
    if (!task || !selectedTab) { setRendered(""); return; }
    fetch(`/api/templates/${selectedTab}`).then(r => r.json()).then(t => {
      setRendered(renderPrompt(t.content, varValues));
    }).catch(() => setRendered(""));
  }, [selectedTab, varValues, task]);

  const getMissingVars = (): string[] => {
    if (!task || !selectedTab) return [];
    const tmpl = task.templates.find((t) => t.template_id === selectedTab);
    if (!tmpl) return [];
    return tmpl.placeholders.filter((p) => !varValues[p] || varValues[p].trim() === "");
  };

  const triggerHighlight = (missing: string[]) => {
    setHighlightedVars(new Set(missing));
    const firstRef = varRefs.current[missing[0]];
    if (firstRef) firstRef.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightedVars(new Set()), 3000);
  };

  const handleCopy = async () => {
    const missing = getMissingVars();
    if (missing.length > 0) {
      toast.warning(
        `${missing.length} variable${missing.length > 1 ? "s" : ""} not filled`,
        missing.map((v) => `{{${v}}}`).join(", ")
      );
      triggerHighlight(missing);
      return;
    }
    // Always fetch fresh image paths and include them
    let fullText = rendered;
    if (selectedTab) {
      try {
        const imgPaths = await getTemplateImagePaths(tid, selectedTab);
        if (imgPaths.length > 0) {
          const pathList = imgPaths.map((p, i) => `${i + 1}. ${p}`).join("\n");
          fullText += `\n\n---\nAttached Images:\n${pathList}`;
        }
      } catch { /* no images */ }
    }
    await navigator.clipboard.writeText(fullText);
    toast.success("Copied to clipboard");
  };

  const handleSaveToHistory = async () => {
    if (!selectedTab) return;
    try {
      if (saveState === "unsaved") await doSave(varValues);
      const result = await api.renderTaskTemplate(tid, selectedTab);
      // Copy task-template images to execution (with actual files for thumbnails)
      const copyResult = await api.copyImagesToExecution(tid, selectedTab!, result.execution_id);
      const imgCount = copyResult.copied;
      await loadExecutions();
      toast.success("Saved to history", imgCount > 0 ? `Prompt + ${imgCount} image(s) stored` : "Prompt snapshot stored");
    } catch (e) {
      toast.error("Save failed", String(e));
    }
  };

  const handleAddTemplate = async (templateId: number) => {
    await api.addTaskTemplate(tid, templateId);
    setShowPicker(false);
    await load();
    toast.success("Template added");
  };

  const handleRemoveTemplate = async (templateId: number) => {
    await api.removeTaskTemplate(tid, templateId);
    if (selectedTab === templateId) setSelectedTab(null);
    await load();
    toast.info("Template removed");
  };

  const handleMoveTemplate = async (templateId: number, direction: "up" | "down") => {
    if (!task) return;
    const ids = task.templates.map((t) => t.template_id);
    const idx = ids.indexOf(templateId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= ids.length) return;
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    await api.reorderTaskTemplates(tid, ids);
    await load();
  };

  const handleUseCount = async (templateId: number, delta: number) => {
    if (!task) return;
    const tt = task.templates.find((t) => t.template_id === templateId);
    if (!tt) return;
    const newCount = Math.max(0, tt.use_count + delta);
    await api.updateTemplateUseCount(tid, templateId, newCount);
    await load();
  };

  const handleStatusChange = async (status: string) => {
    await api.updateTask(tid, { status });
    await load();
    toast.success(`Task marked as ${status}`);
  };

  const handleDelete = async () => {
    await api.deleteTask(tid);
    toast.success("Task deleted");
    navigate("/tasks");
  };

  const handleUpdateMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateTask(tid, { name: editName, description: editDesc });
    setEditing(false);
    await load();
    toast.success("Task updated");
  };

  const openPicker = async () => {
    setShowPicker(true);
    const gs = await api.getGroups();
    setGroups(gs);
    setPickerGroup(null);
    setPickerTemplates([]);
  };

  const selectPickerGroup = async (gid: number) => {
    setPickerGroup(gid);
    const ts = await api.getTemplates(gid);
    setPickerTemplates(ts);
  };

  // (image paths fetched fresh on copy/save - no useEffect needed)

  if (!task) return <p style={{ color: "var(--text-muted)", padding: 40 }}>Loading...</p>;

  const filledCount = allVars.filter((v) => varValues[v] && varValues[v].trim() !== "").length;
  const statusColors: Record<string, string> = { active: "var(--accent)", done: "var(--success)" };
  const selectedTmpl = task.templates.find((t) => t.template_id === selectedTab);

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 12 }}>
        <Link to="/tasks" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
          Tasks
        </Link>
        <span style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 8px" }}>/</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{task.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        {editing ? (
          <form onSubmit={handleUpdateMeta} style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, width: 250 }} />
            <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" style={{ ...inputStyle, width: 300 }} />
            <Button variant="primary" type="submit">Save</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </form>
        ) : (
          <>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700 }}>{task.name}</h2>
                <span style={{
                  fontSize: 11, padding: "2px 10px", borderRadius: 20,
                  background: `${statusColors[task.status] || "var(--text-muted)"}20`,
                  color: statusColors[task.status] || "var(--text-muted)",
                  fontWeight: 600, textTransform: "uppercase",
                }}>{task.status}</span>
              </div>
              {task.description && <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>{task.description}</p>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={task.status} onChange={(e) => handleStatusChange(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                <option value="active">Active</option>
                <option value="done">Done</option>
              </select>
              <Button variant="secondary" onClick={() => { setEditName(task.name); setEditDesc(task.description || ""); setEditing(true); }}>Edit</Button>
              <Button variant="destructive" confirm onClick={handleDelete}>Delete</Button>
            </div>
          </>
        )}
      </div>

      {/* Step Bar */}
      <StepBar steps={[
        { label: "Select Templates", detail: `${task.templates.length} added`, isComplete: task.templates.length > 0, isActive: task.templates.length === 0 },
        { label: "Fill Variables", detail: allVars.length > 0 ? `${filledCount}/${allVars.length} filled` : "waiting", isComplete: allVars.length > 0 && filledCount === allVars.length, isActive: task.templates.length > 0 && filledCount < allVars.length },
        { label: "Copy Prompts", detail: rendered ? "ready" : "waiting", isComplete: false, isActive: !!rendered },
      ]} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Left: Templates */}
        <Card>
          <CardHeader>
            <CardTitle>
              Templates
              {onHelp && <HelpButton onClick={() => onHelp("task-templates")} />}
            </CardTitle>
            <Button variant="secondary" onClick={openPicker}>+ Add Template</Button>
          </CardHeader>
          <CardBody>
            {/* Template picker */}
            {showPicker && (
              <div style={{ marginBottom: 16, padding: 14, background: "var(--bg-input)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                  Select a group, then pick a template:
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                  {groups.map((g) => (
                    <button key={g.id} onClick={() => selectPickerGroup(g.id)} style={{
                      padding: "5px 12px", fontSize: 12, borderRadius: 20, cursor: "pointer",
                      background: pickerGroup === g.id ? "var(--accent)" : "transparent",
                      color: pickerGroup === g.id ? "#fff" : "var(--text-secondary)",
                      border: "1px solid var(--border)", fontFamily: "inherit",
                    }}>{g.name}</button>
                  ))}
                </div>
                {pickerTemplates.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {pickerTemplates.map((t) => {
                      const alreadyAdded = task.templates.some((tt) => tt.template_id === t.id);
                      return (
                        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: "var(--radius)", background: "rgba(255,255,255,0.02)" }}>
                          <div>
                            <span style={{ fontSize: 13, color: alreadyAdded ? "var(--text-muted)" : "var(--text-primary)" }}>{t.name}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>{t.content.substring(0, 50)}...</span>
                          </div>
                          {alreadyAdded ? (
                            <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 500 }}>added</span>
                          ) : (
                            <Button variant="primary" onClick={() => handleAddTemplate(t.id)} style={{ padding: "3px 12px", fontSize: 11 }}>Add</Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button variant="secondary" onClick={() => setShowPicker(false)} style={{ marginTop: 10 }}>Close</Button>
              </div>
            )}

            {task.templates.length === 0 ? (
              <EmptyState
                icon="+"
                title="No templates selected"
                description="Add templates from your groups to start building prompts."
                action={<Button variant="primary" onClick={openPicker}>+ Add Template</Button>}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {task.templates.map((tt, idx) => (
                  <div
                    key={tt.template_id}
                    onClick={() => setSelectedTab(tt.template_id)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", borderRadius: "var(--radius)", cursor: "pointer",
                      background: selectedTab === tt.template_id ? "var(--accent-light)" : "transparent",
                      border: selectedTab === tt.template_id ? "1px solid var(--accent)" : "1px solid transparent",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* Reorder arrows */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginRight: 4 }}>
                        <Button variant="icon" title="Move up" style={{ width: 20, height: 16, fontSize: 10, opacity: idx === 0 ? 0.3 : 1 }}
                          onClick={(e) => { e.stopPropagation(); handleMoveTemplate(tt.template_id, "up"); }}
                          disabled={idx === 0}>{"\u25B2"}</Button>
                        <Button variant="icon" title="Move down" style={{ width: 20, height: 16, fontSize: 10, opacity: idx === task.templates.length - 1 ? 0.3 : 1 }}
                          onClick={(e) => { e.stopPropagation(); handleMoveTemplate(tt.template_id, "down"); }}
                          disabled={idx === task.templates.length - 1}>{"\u25BC"}</Button>
                      </div>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: selectedTab === tt.template_id ? 600 : 400, color: selectedTab === tt.template_id ? "var(--accent)" : "var(--text-primary)" }}>{tt.template_name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8, background: "rgba(255,255,255,0.03)", padding: "1px 6px", borderRadius: 4 }}>{tt.group_name}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      {/* Usage counter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 2, marginRight: 8 }} onClick={(e) => e.stopPropagation()}>
                        <Button variant="icon" title="Decrease count" style={{ width: 22, height: 22, fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); handleUseCount(tt.template_id, -1); }}
                          disabled={tt.use_count === 0}>-</Button>
                        <span style={{
                          minWidth: 24, textAlign: "center", fontSize: 12, fontWeight: 700,
                          color: tt.use_count > 0 ? "var(--success)" : "var(--text-muted)",
                          padding: "2px 4px", borderRadius: 4,
                          background: tt.use_count > 0 ? "rgba(76,175,128,0.15)" : "transparent",
                        }}>
                          {tt.use_count}
                        </span>
                        <Button variant="icon" title="Increase count" style={{ width: 22, height: 22, fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); handleUseCount(tt.template_id, 1); }}>+</Button>
                      </div>
                      <Button variant="icon" title="Remove template" onClick={(e) => { e.stopPropagation(); handleRemoveTemplate(tt.template_id); }}>x</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Right: Variables */}
        <Card>
          <CardHeader>
            <CardTitle>
              Variables
              {onHelp && <HelpButton onClick={() => onHelp("task-variables")} />}
            </CardTitle>
            <SaveIndicator state={saveState} onRetry={() => doSave(varValues)} />
          </CardHeader>
          <CardBody>
            {allVars.length === 0 ? (
              <EmptyState
                icon="{}"
                title="No variables found"
                description="Variables appear here when you add templates that contain {{placeholders}}."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {allVars.map((v) => {
                  const isHL = highlightedVars.has(v);
                  return (
                  <div key={v} ref={(el) => { varRefs.current[v] = el; }} style={{
                    padding: "10px 12px", background: "var(--bg-input)", borderRadius: "var(--radius)",
                    border: isHL ? "1px solid rgba(224,85,85,0.5)" : "1px solid transparent",
                    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
                    animation: isHL ? "glowPulse 1.5s ease-in-out 2" : "none",
                  }}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, fontFamily: "monospace",
                        color: isHL ? "var(--danger)" : "var(--accent)",
                        background: isHL ? "rgba(224,85,85,0.15)" : "var(--accent-light)",
                        padding: "2px 8px", borderRadius: 4,
                        transition: "all 0.3s ease",
                      }}>
                        {"{{" + v + "}}"}
                      </span>
                    </div>
                    <textarea
                      value={varValues[v] || ""}
                      onChange={(e) => handleVarChange(v, e.target.value)}
                      rows={v.toLowerCase().includes("description") || v.toLowerCase().includes("content") || v.toLowerCase().includes("artefact") ? 4 : 1}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13, background: "var(--bg-primary)" }}
                      placeholder={`Enter value for ${v}...`}
                    />
                  </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Image Attachments */}
      <ImageAttachments taskId={tid} templateId={selectedTab} onHelp={onHelp} />

      {/* Generated Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>
            Generated Prompt
            {selectedTmpl && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>- {selectedTmpl.template_name}</span>}
            {onHelp && <HelpButton onClick={() => onHelp("generated-prompt")} />}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {rendered ? (
            <pre style={{
              background: "var(--bg-input)", padding: 16, borderRadius: "var(--radius)",
              fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
              border: "1px solid var(--border)", maxHeight: 400, overflowY: "auto",
              color: "var(--text-primary)", fontFamily: "monospace",
            }}>
              {rendered}
            </pre>
          ) : (
            <EmptyState
              icon="#"
              title="Preview will appear here"
              description="Select a template and fill in the variable values to generate your prompt."
            />
          )}
        </CardBody>
        {rendered && (
          <CardFooter>
            <Button variant="primary" onClick={handleCopy}>Copy to Clipboard</Button>
            <Button variant="secondary" onClick={handleSaveToHistory}>Save to History</Button>
          </CardFooter>
        )}
      </Card>

      {/* Prompt History */}
      <Card>
        <CardHeader style={{ cursor: "pointer" }} onClick={() => setShowExecs(!showExecs)}>
          <CardTitle>Prompt History ({executions.length})</CardTitle>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{showExecs ? "\u25B2" : "\u25BC"}</span>
        </CardHeader>
        {showExecs && (
          <CardBody>
            {executions.length === 0 ? (
              <EmptyState icon="~" title="No saved prompts" description="When you generate and save a prompt, it will appear here for reference." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {executions.map((ex) => (
                  <div key={ex.id} style={{ padding: 12, background: "var(--bg-input)", borderRadius: "var(--radius)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{ex.template_name}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(ex.created_at).toLocaleString()}</span>
                    </div>
                    <pre style={{
                      fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      maxHeight: 150, overflowY: "auto", color: "var(--text-secondary)", fontFamily: "monospace",
                    }}>
                      {ex.filled_prompt}
                    </pre>
                    {ex.images && ex.images.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {ex.images.map((img, idx) => (
                          <div key={idx} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "4px 6px",
                            borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)",
                          }}>
                            {img.url ? (
                              <img src={img.url} alt={img.original_name}
                                onClick={() => window.open(img.url!, "_blank")}
                                style={{ width: 48, height: 36, objectFit: "cover", cursor: "pointer", borderRadius: 3, flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14, flexShrink: 0, background: "var(--bg-card)", borderRadius: 3 }}>{"\uD83D\uDDBC"}</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={img.file_path}>
                                {img.file_path}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        )}
      </Card>
    </div>
  );
}
