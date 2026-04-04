import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
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
    return values[k] !== undefined && values[k] !== "" ? values[k] : match;
  });
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
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

  // New variable
  const [showNewVar, setShowNewVar] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [newVarType, setNewVarType] = useState("text");
  const [newVarDefault, setNewVarDefault] = useState("");

  // New/Edit template
  const [showNewTmpl, setShowNewTmpl] = useState(false);
  const [editTmplId, setEditTmplId] = useState<number | null>(null);
  const [tmplName, setTmplName] = useState("");
  const [tmplContent, setTmplContent] = useState("");

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
      // Init var values from defaults
      const defaults: Record<string, string> = {};
      v.forEach((vr) => { defaults[vr.name] = vr.default_value || ""; });
      setVarValues((prev) => {
        const merged = { ...defaults };
        Object.keys(prev).forEach((k) => { if (prev[k]) merged[k] = prev[k]; });
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
      alert("Execution saved to history!");
    } catch (e) {
      alert("Failed to save: " + e);
    }
    setSaving(false);
  };

  const handleDeleteGroup = async () => {
    if (!confirm(`Delete group "${group?.name}" and all its templates?`)) return;
    await api.deleteGroup(gid);
    navigate("/");
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
    if (!confirm("Delete this template?")) return;
    await api.deleteTemplate(id);
    if (selectedTemplate === id) setSelectedTemplate(null);
    await load();
  };

  if (!group) return <p style={{ color: "var(--text-muted)" }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 1100 }}>
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
              <button onClick={handleDeleteGroup} style={btnStyle("danger")}>Delete</button>
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
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Variables</h3>
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
                  <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                        {"{{" + v.name + "}}"}
                        <span style={{ fontWeight: 400, marginLeft: 6, color: "var(--text-muted)" }}>{v.var_type}</span>
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
                    <button onClick={() => handleDeleteVariable(v.id)} title="Delete variable" style={{
                      marginTop: 22, padding: "4px 8px", background: "transparent", border: "none",
                      color: "var(--text-muted)", fontSize: 16, cursor: "pointer",
                    }}>x</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Templates Section */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Templates</h3>
              <button onClick={() => { setShowNewTmpl(!showNewTmpl); setEditTmplId(null); setTmplName(""); setTmplContent(""); }} style={btnStyle("secondary")}>
                {showNewTmpl ? "Cancel" : "+ Add"}
              </button>
            </div>

            {showNewTmpl && (
              <form onSubmit={handleSaveTemplate} style={{ marginBottom: 12, padding: 12, background: "var(--bg-input)", borderRadius: "var(--radius)" }}>
                <input value={tmplName} onChange={(e) => setTmplName(e.target.value)} placeholder="Template name" style={{ ...inputStyle, marginBottom: 8 }} />
                <textarea
                  value={tmplContent}
                  onChange={(e) => setTmplContent(e.target.value)}
                  placeholder={"Use {{VARIABLE_NAME}} for placeholders...\n\nExample:\nPlease review {{TASK_TITLE}}:\n{{DESCRIPTION}}"}
                  rows={8}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13, marginBottom: 8 }}
                />
                <button type="submit" style={btnStyle("primary")}>{editTmplId ? "Update" : "Create"} Template</button>
              </form>
            )}

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
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Prompt Preview</h3>

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
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Save to History</h4>
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
    </div>
  );
}
