import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import HelpButton from "../components/HelpButton";
import Button from "../components/ui/Button";
import type { PromptGroup, Variable, PromptTemplate } from "../types";

const btnStyle = (variant: "primary" | "secondary" | "danger" = "primary"): React.CSSProperties => ({
  padding: "6px 14px",
  border: variant === "primary" ? "none" : "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  background: variant === "primary" ? "var(--accent)" : variant === "danger" ? "var(--danger)" : "var(--bg-card)",
  color: variant === "primary" || variant === "danger" ? "#fff" : "var(--text-secondary)",
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", background: "var(--bg-input)",
  border: "1px solid var(--border)", borderRadius: "var(--radius)",
  color: "var(--text-primary)", fontSize: 14, outline: "none",
};

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)", padding: 20, marginBottom: 16,
};

function renderPrompt(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{(.+?)\}\}/g, (match, key) => {
    const k = key.trim();
    const val = values[k];
    return val !== undefined && val.trim() !== "" ? val.trimEnd() : match;
  });
}

function TemplateEditor({ tmplName, setTmplName, tmplContent, setTmplContent, variables, onSubmit, submitLabel }: {
  tmplName: string; setTmplName: (v: string) => void;
  tmplContent: string; setTmplContent: (v: string) => void;
  variables: Variable[];
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCursorPos = useRef(0);
  const savedScrollTop = useRef(0);
  const [justInserted, setJustInserted] = useState<string | null>(null);
  const [acQuery, setAcQuery] = useState<string | null>(null);
  const [acPos, setAcPos] = useState(0);

  // Restore scroll position after content changes from insertion
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta && savedScrollTop.current > 0) {
      ta.scrollTop = savedScrollTop.current;
    }
  }, [tmplContent]);

  const trackCursor = () => {
    const ta = textareaRef.current;
    if (ta) lastCursorPos.current = ta.selectionStart;
  };

  const insertTag = (varName: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const tag = `{{${varName}}}`;
    const pos = lastCursorPos.current;
    savedScrollTop.current = ta.scrollTop;
    const before = tmplContent.slice(0, pos);
    const after = tmplContent.slice(pos);
    const newPos = pos + tag.length;
    setTmplContent(before + tag + after);
    lastCursorPos.current = newPos;
    setJustInserted(varName);
    setTimeout(() => setJustInserted(null), 1200);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = newPos;
      ta.scrollTop = savedScrollTop.current;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setTmplContent(val);
    lastCursorPos.current = pos;
    // Check for {{ autocomplete trigger
    if (pos >= 2 && val.slice(pos - 2, pos) === "{{") {
      setAcQuery("");
      setAcPos(pos - 2);
    } else if (acQuery !== null) {
      // Continue filtering if we're in autocomplete mode
      const textAfterOpen = val.slice(acPos + 2, pos);
      if (textAfterOpen.includes("}}") || textAfterOpen.includes("\n") || pos <= acPos) {
        setAcQuery(null);
      } else {
        setAcQuery(textAfterOpen);
      }
    }
  };

  const handleAcSelect = (varName: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    savedScrollTop.current = ta.scrollTop;
    const replacement = `{{${varName}}}`;
    const before = tmplContent.slice(0, acPos);
    const cursorPos = ta.selectionStart;
    const after = tmplContent.slice(cursorPos);
    const newPos = acPos + replacement.length;
    setTmplContent(before + replacement + after);
    lastCursorPos.current = newPos;
    setAcQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = newPos;
      ta.scrollTop = savedScrollTop.current;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (acQuery !== null && e.key === "Escape") {
      e.preventDefault();
      setAcQuery(null);
    }
  };

  const filteredVars = acQuery !== null
    ? variables.filter((v) => v.name.toLowerCase().includes(acQuery.toLowerCase()))
    : [];

  return (
    <form onSubmit={onSubmit} style={{ marginBottom: 12, padding: 12, background: "var(--bg-input)", borderRadius: "var(--radius)" }}>
      <input value={tmplName} onChange={(e) => setTmplName(e.target.value)} placeholder="Template name" style={{ ...inputStyle, marginBottom: 8 }} />

      {/* Variable pills - click to insert at cursor */}
      {variables.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
            Click to insert at cursor position, or type {"{{" } in the editor:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            {variables.map((v) => (
              <span
                key={v.id}
                onClick={() => insertTag(v.name)}
                style={{
                  padding: "3px 10px", fontSize: 12, fontFamily: "monospace",
                  background: justInserted === v.name ? "var(--accent)" : "var(--accent-light)",
                  color: justInserted === v.name ? "#fff" : "var(--accent)",
                  border: "1px solid var(--accent)", borderRadius: 20,
                  cursor: "pointer", userSelect: "none", fontWeight: 600,
                  transition: "all 0.15s ease",
                  transform: justInserted === v.name ? "scale(0.93)" : "scale(1)",
                }}
                title={`Click to insert {{${v.name}}} at cursor`}
              >
                {"+ {{" + v.name + "}}"}
              </span>
            ))}
            {justInserted && (
              <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 500, marginLeft: 4, transition: "opacity 0.3s" }}>
                Inserted!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Template content textarea with autocomplete */}
      <div style={{ position: "relative" }}>
        <textarea
          ref={textareaRef}
          value={tmplContent}
          onChange={handleChange}
          onBlur={trackCursor}
          onSelect={trackCursor}
          onKeyUp={trackCursor}
          onKeyDown={handleKeyDown}
          placeholder={"Write your prompt template here...\n\nUse {{VARIABLE_NAME}} for placeholders.\nType {{ to see available variables.\n\nExample:\nPlease review {{TASK_TITLE}}:\n{{DESCRIPTION}}"}
          rows={18}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13, marginBottom: 8, minHeight: 300 }}
        />

        {/* {{ autocomplete dropdown */}
        {acQuery !== null && filteredVars.length > 0 && (
          <div style={{
            position: "absolute", bottom: 16, left: 8, right: 8,
            background: "var(--bg-secondary)", border: "1px solid var(--accent)",
            borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 10, maxHeight: 180, overflowY: "auto",
          }}>
            <div style={{ padding: "6px 10px", fontSize: 11, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              Select variable to insert:
            </div>
            {filteredVars.map((v) => (
              <div
                key={v.id}
                onClick={() => handleAcSelect(v.name)}
                style={{
                  padding: "8px 12px", fontSize: 13, fontFamily: "monospace",
                  color: "var(--accent)", cursor: "pointer",
                  borderBottom: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-light)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {"{{" + v.name + "}}"}
                {v.description && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8, fontFamily: "inherit" }}>{v.description}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="submit" style={btnStyle("primary")}>{submitLabel} Template</button>
    </form>
  );
}

export default function GroupPage({ onHelp }: { onHelp?: (id: string) => void }) {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const gid = Number(groupId);

  const [group, setGroup] = useState<PromptGroup | null>(null);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  // Edit states
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  // New/Edit variable
  const [showNewVar, setShowNewVar] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [newVarType, setNewVarType] = useState("text");
  const [newVarDefault, setNewVarDefault] = useState("");
  const [editVarId, setEditVarId] = useState<number | null>(null);
  const [editVarName, setEditVarName] = useState("");
  const [editVarType, setEditVarType] = useState("text");
  const [editVarDefault, setEditVarDefault] = useState("");

  // New/Edit template
  const [showNewTmpl, setShowNewTmpl] = useState(false);
  const [editTmplId, setEditTmplId] = useState<number | null>(null);
  const [tmplName, setTmplName] = useState("");
  const [tmplContent, setTmplContent] = useState("");

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSelection, setExportSelection] = useState<Set<number>>(new Set());

  const load = async () => {
    try {
      const [g, v, t] = await Promise.all([
        api.getGroups().then((gs) => gs.find((x) => x.id === gid) || null),
        api.getVariables(gid),
        api.getTemplates(gid),
      ]);
      setGroup(g);
      setVariables(v);
      setTemplates(t);
      // Rebuild var values: only keep values for variables that still exist
      const currentNames = new Set(v.map((vr) => vr.name));
      setVarValues((prev) => {
        const merged: Record<string, string> = {};
        v.forEach((vr) => {
          merged[vr.name] = prev[vr.name] ?? vr.default_value ?? "";
        });
        return merged;
      });
    } catch { /* */ }
  };

  useEffect(() => { load(); }, [gid]);

  const selectedTmpl = templates.find((t) => t.id === selectedTemplate);
  const rendered = selectedTmpl ? renderPrompt(selectedTmpl.content, varValues) : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rendered);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveExecution = async () => {
    if (!selectedTmpl) return;
    setSaving(true);
    try {
      await api.createExecution({
        group_id: gid, template_id: selectedTmpl.id,
        filled_prompt: rendered, variable_values: varValues, notes: notes || undefined,
      });
      setNotes("");
      toast.success("Saved to history");
    } catch (e) {
      toast.error("Failed to save", String(e));
    }
    setSaving(false);
  };

  const handleDeleteGroup = async () => {
    await api.deleteGroup(gid);
    toast.success("Group deleted");
    window.dispatchEvent(new Event("groups-changed"));
    navigate("/tasks");
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateGroup(gid, { name: groupName, description: groupDesc });
    setEditingGroup(false);
    await load();
  };

  const handleAddVariable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarName.trim()) return;
    await api.createVariable({ group_id: gid, name: newVarName.trim(), var_type: newVarType, default_value: newVarDefault || undefined });
    setNewVarName(""); setNewVarType("text"); setNewVarDefault(""); setShowNewVar(false);
    await load();
  };

  const handleDeleteVariable = async (id: number) => {
    await api.deleteVariable(id);
    await load();
    toast.success("Variable deleted");
  };

  const handleUpdateVariable = async (id: number) => {
    if (!editVarName.trim()) return;
    await api.updateVariable(id, { name: editVarName.trim(), var_type: editVarType, default_value: editVarDefault || undefined });
    setEditVarId(null);
    await load();
    toast.success("Variable updated");
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmplName.trim() || !tmplContent.trim()) return;
    if (editTmplId) {
      await api.updateTemplate(editTmplId, { name: tmplName, content: tmplContent });
    } else {
      await api.createTemplate({ group_id: gid, name: tmplName, content: tmplContent });
    }
    setTmplName(""); setTmplContent(""); setShowNewTmpl(false); setEditTmplId(null);
    await load();
  };

  const handleDeleteTemplate = async (id: number) => {
    await api.deleteTemplate(id);
    if (selectedTemplate === id) setSelectedTemplate(null);
    await load();
    toast.success("Template deleted");
  };

  if (!group) return <p style={{ color: "var(--text-muted)" }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Group Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        {editingGroup ? (
          <form onSubmit={handleUpdateGroup} style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} style={{ ...inputStyle, width: 200 }} />
            <input value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} placeholder="Description" style={{ ...inputStyle, width: 300 }} />
            <button type="submit" style={btnStyle("primary")}>Save</button>
            <button type="button" onClick={() => setEditingGroup(false)} style={btnStyle("secondary")}>Cancel</button>
          </form>
        ) : (
          <>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>{group.name}</h2>
              {group.description && <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>{group.description}</p>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setGroupName(group.name); setGroupDesc(group.description || ""); setEditingGroup(true); }} style={btnStyle("secondary")}>Edit</button>
              <Button variant="secondary" onClick={() => { setExportSelection(new Set(templates.map((t) => t.id))); setShowExportModal(true); }}>Export</Button>
              <Button variant="destructive" confirm onClick={handleDeleteGroup}>Delete</Button>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Left Column: Variables + Templates */}
        <div>
          {/* Variables Section */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>Variables</h3>
                {onHelp && <HelpButton onClick={() => onHelp("variables")} />}
              </div>
              <button onClick={() => setShowNewVar(!showNewVar)} style={btnStyle("secondary")}>
                {showNewVar ? "Cancel" : "+ Add"}
              </button>
            </div>

            {showNewVar && (
              <form onSubmit={handleAddVariable} style={{ marginBottom: 12, padding: 12, background: "var(--bg-input)", borderRadius: "var(--radius)" }}>
                <input value={newVarName} onChange={(e) => setNewVarName(e.target.value)} placeholder="Variable name (e.g. TASK_TITLE)" style={{ ...inputStyle, marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select value={newVarType} onChange={(e) => setNewVarType(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="number">Number</option>
                  </select>
                  <input value={newVarDefault} onChange={(e) => setNewVarDefault(e.target.value)} placeholder="Default value" style={inputStyle} />
                </div>
                <button type="submit" style={btnStyle("primary")}>Add Variable</button>
              </form>
            )}

            {variables.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No variables defined. Add variables to use as placeholders in templates.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {variables.map((v) => (
                  <div key={v.id}>
                    {editVarId === v.id ? (
                      /* Edit mode */
                      <div style={{ padding: 10, background: "var(--bg-input)", borderRadius: "var(--radius)", border: "1px solid var(--accent)" }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                          <input value={editVarName} onChange={(e) => setEditVarName(e.target.value)} placeholder="Variable name" style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
                          <select value={editVarType} onChange={(e) => setEditVarType(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 12 }}>
                            <option value="text">text</option>
                            <option value="textarea">textarea</option>
                            <option value="number">number</option>
                          </select>
                        </div>
                        <input value={editVarDefault} onChange={(e) => setEditVarDefault(e.target.value)} placeholder="Default value (optional)" style={{ ...inputStyle, fontSize: 12, marginBottom: 6 }} />
                        <div style={{ display: "flex", gap: 4 }}>
                          <button type="button" onClick={() => handleUpdateVariable(v.id)} style={{ ...btnStyle("primary"), fontSize: 11, padding: "3px 10px" }}>Save</button>
                          <button type="button" onClick={() => setEditVarId(null)} style={{ ...btnStyle("secondary"), fontSize: 11, padding: "3px 10px" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                            {"{{" + v.name + "}}"}
                            <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>{v.var_type}</span>
                            {v.default_value && <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 11 }}>default: {v.default_value}</span>}
                          </label>
                          {v.var_type === "textarea" ? (
                            <textarea
                              value={varValues[v.name] || ""}
                              onChange={(e) => setVarValues({ ...varValues, [v.name]: e.target.value })}
                              rows={3}
                              style={{ ...inputStyle, resize: "vertical" }}
                            />
                          ) : (
                            <input
                              type={v.var_type === "number" ? "number" : "text"}
                              value={varValues[v.name] || ""}
                              onChange={(e) => setVarValues({ ...varValues, [v.name]: e.target.value })}
                              placeholder={v.default_value || ""}
                              style={inputStyle}
                            />
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 2, marginTop: 22 }}>
                          <button onClick={() => { setEditVarId(v.id); setEditVarName(v.name); setEditVarType(v.var_type); setEditVarDefault(v.default_value || ""); }} title="Edit variable" style={{
                            padding: "3px 6px", background: "transparent", border: "none",
                            color: "var(--text-muted)", fontSize: 11, cursor: "pointer",
                          }}>edit</button>
                          <button onClick={() => handleDeleteVariable(v.id)} title="Delete variable" style={{
                            padding: "3px 6px", background: "transparent", border: "none",
                            color: "var(--text-muted)", fontSize: 11, cursor: "pointer",
                          }}>del</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Templates Section */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>Templates</h3>
                {onHelp && <HelpButton onClick={() => onHelp("templates")} />}
              </div>
              <button onClick={() => { setShowNewTmpl(!showNewTmpl); setEditTmplId(null); setTmplName(""); setTmplContent(""); }} style={btnStyle("secondary")}>
                {showNewTmpl ? "Cancel" : "+ Add"}
              </button>
            </div>

            {showNewTmpl && <TemplateEditor
              tmplName={tmplName} setTmplName={setTmplName}
              tmplContent={tmplContent} setTmplContent={setTmplContent}
              variables={variables}
              onSubmit={handleSaveTemplate}
              submitLabel={editTmplId ? "Update" : "Create"}
            />}

            {templates.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No templates yet. Create one to start building prompts.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {templates.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                      borderRadius: "var(--radius)", cursor: "pointer",
                      background: selectedTemplate === t.id ? "var(--accent-light)" : "transparent",
                      border: selectedTemplate === t.id ? "1px solid var(--accent)" : "1px solid transparent",
                    }}
                    onClick={() => setSelectedTemplate(t.id)}
                  >
                    <span style={{ flex: 1, fontSize: 14, color: selectedTemplate === t.id ? "var(--accent)" : "var(--text-primary)" }}>{t.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setEditTmplId(t.id); setTmplName(t.name); setTmplContent(t.content); setShowNewTmpl(true); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>edit</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>del</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Prompt Preview</h3>
              {onHelp && <HelpButton onClick={() => onHelp("preview")} />}
            </div>

            {selectedTmpl ? (
              <>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                  Template: <strong style={{ color: "var(--text-secondary)" }}>{selectedTmpl.name}</strong>
                </div>
                <pre style={{
                  background: "var(--bg-input)", padding: 16, borderRadius: "var(--radius)",
                  fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                  border: "1px solid var(--border)", maxHeight: 400, overflowY: "auto",
                  color: "var(--text-primary)", fontFamily: "monospace",
                }}>
                  {rendered}
                </pre>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={handleCopy} style={btnStyle("primary")}>
                    {copied ? "Copied!" : "Copy to Clipboard"}
                  </button>
                </div>

                {/* Save Execution */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Save to History</h4>
                    {onHelp && <HelpButton onClick={() => onHelp("executions")} />}
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes about this execution..."
                    rows={2}
                    style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }}
                  />
                  <button onClick={handleSaveExecution} disabled={saving} style={btnStyle("secondary")}>
                    {saving ? "Saving..." : "Save Execution"}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
                Select a template to see the rendered preview.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <>
          <div onClick={() => setShowExportModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: 24, zIndex: 1001, minWidth: 400,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Export Templates</h3>
            <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
              <Button variant="secondary" onClick={() => setExportSelection(new Set(templates.map((t) => t.id)))} style={{ fontSize: 11 }}>Select All</Button>
              <Button variant="secondary" onClick={() => setExportSelection(new Set())} style={{ fontSize: 11 }}>Deselect All</Button>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
              {templates.map((t) => (
                <label key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  borderRadius: "var(--radius)", cursor: "pointer", fontSize: 14,
                  background: exportSelection.has(t.id) ? "var(--accent-light)" : "transparent",
                }}>
                  <input type="checkbox" checked={exportSelection.has(t.id)}
                    onChange={(e) => {
                      setExportSelection((prev) => {
                        const next = new Set(prev);
                        e.target.checked ? next.add(t.id) : next.delete(t.id);
                        return next;
                      });
                    }}
                    style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
                  {t.name}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setShowExportModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={async () => {
                try {
                  const ids = exportSelection.size > 0 && exportSelection.size < templates.length
                    ? Array.from(exportSelection) : undefined;
                  await api.exportGroup(gid, ids);
                  setShowExportModal(false);
                  toast.success("Group exported");
                } catch (e) {
                  toast.error("Export failed", String(e));
                }
              }}>
                Export {exportSelection.size > 0 ? `${exportSelection.size} Templates` : "All"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
