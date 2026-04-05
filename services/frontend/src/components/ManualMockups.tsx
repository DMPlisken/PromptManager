// Visual UI mockup components for the manual — styled divs that mirror the real UI

const mockCard: React.CSSProperties = {
  background: "var(--bg-card)", borderRadius: "var(--radius)",
  border: "1px solid var(--border)", overflow: "hidden", margin: "16px 0",
};
const mockHeader: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "10px 14px", borderBottom: "1px solid var(--border)",
  background: "rgba(255,255,255,0.015)", fontSize: 12, fontWeight: 600,
};
const mockBody: React.CSSProperties = { padding: 14 };
const mockBtn = (primary?: boolean): React.CSSProperties => ({
  padding: "4px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6,
  background: primary ? "var(--accent)" : "transparent",
  color: primary ? "#fff" : "var(--text-muted)",
  border: primary ? "none" : "1px solid var(--border)",
  cursor: "default",
});
const mockPill: React.CSSProperties = {
  fontSize: 11, fontFamily: "monospace", padding: "2px 8px", borderRadius: 4,
  background: "var(--accent-light)", color: "var(--accent)", fontWeight: 600,
};
const mockInput: React.CSSProperties = {
  width: "100%", padding: "6px 10px", background: "var(--bg-primary)",
  border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)",
  fontSize: 11, fontFamily: "monospace",
};
const label: React.CSSProperties = {
  fontSize: 10, color: "var(--text-muted)", marginTop: 8, marginBottom: 2, fontStyle: "italic", textAlign: "center",
};

export function MockStepBar() {
  const steps = [
    { num: 1, label: "Select Templates", detail: "3 added", done: true },
    { num: 2, label: "Fill Variables", detail: "2/4 filled", done: false, active: true },
    { num: 3, label: "Copy Prompts", detail: "ready", done: false },
  ];
  return (
    <div style={{ margin: "16px 0" }}>
      <div style={{
        display: "flex", alignItems: "center", padding: "12px 16px",
        background: "var(--bg-card)", borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
      }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                background: s.done ? "var(--success)" : s.active ? "var(--accent)" : "var(--bg-input)",
                color: s.done || s.active ? "#fff" : "var(--text-muted)",
                border: s.active ? "2px solid var(--accent)" : s.done ? "2px solid var(--success)" : "2px solid var(--border)",
                boxShadow: s.active ? "0 0 0 3px rgba(124,92,252,0.2)" : "none",
              }}>
                {s.done ? "\u2713" : s.num}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: s.active ? 600 : 400, color: s.active ? "var(--text-primary)" : s.done ? "var(--success)" : "var(--text-muted)" }}>{s.label}</div>
                <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{s.detail}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: "0 12px", background: s.done ? "var(--success)" : "var(--border)", borderRadius: 1 }} />
            )}
          </div>
        ))}
      </div>
      <p style={label}>The Step Bar shows your progress through the task workflow</p>
    </div>
  );
}

export function MockTemplateList() {
  const templates = [
    { name: "Design and Plan", group: "Feature Dev", selected: true },
    { name: "Implementation", group: "Feature Dev", selected: false },
    { name: "Code Review", group: "Audit", selected: false },
  ];
  return (
    <div style={{ margin: "16px 0" }}>
      <div style={mockCard}>
        <div style={mockHeader}>
          <span>Templates</span>
          <span style={mockBtn()}>+ Add Template</span>
        </div>
        <div style={mockBody}>
          {templates.map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
              borderRadius: 6, marginBottom: 4,
              background: t.selected ? "var(--accent-light)" : "transparent",
              border: t.selected ? "1px solid var(--accent)" : "1px solid transparent",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginRight: 4 }}>
                <span style={{ fontSize: 8, color: i === 0 ? "var(--text-muted)" : "var(--text-secondary)", opacity: i === 0 ? 0.3 : 1 }}>{"\u25B2"}</span>
                <span style={{ fontSize: 8, color: i === templates.length - 1 ? "var(--text-muted)" : "var(--text-secondary)", opacity: i === templates.length - 1 ? 0.3 : 1 }}>{"\u25BC"}</span>
              </div>
              <span style={{ fontSize: 12, color: t.selected ? "var(--accent)" : "var(--text-primary)", fontWeight: t.selected ? 600 : 400 }}>{t.name}</span>
              <span style={{ fontSize: 9, color: "var(--text-muted)", background: "rgba(255,255,255,0.03)", padding: "1px 6px", borderRadius: 4 }}>{t.group}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={label}>Templates list with reorder arrows (\u25B2\u25BC) and group badges</p>
    </div>
  );
}

export function MockVariableForm() {
  const vars = [
    { name: "TASK_TITLE", value: "Build Login Page" },
    { name: "DESCRIPTION", value: "Implement user authentication with..." },
    { name: "ITERATIONS", value: "20" },
  ];
  return (
    <div style={{ margin: "16px 0" }}>
      <div style={mockCard}>
        <div style={mockHeader}>
          <span>Variables</span>
          <span style={{ fontSize: 10, color: "var(--success)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)" }} />Saved
          </span>
        </div>
        <div style={mockBody}>
          {vars.map((v, i) => (
            <div key={i} style={{ marginBottom: 10, padding: "8px 10px", background: "var(--bg-input)", borderRadius: 6 }}>
              <span style={mockPill}>{"{{" + v.name + "}}"}</span>
              <input readOnly value={v.value} style={{ ...mockInput, marginTop: 6 }} />
            </div>
          ))}
        </div>
      </div>
      <p style={label}>Variables auto-save as you type — the indicator shows Saved / Saving... / Unsaved</p>
    </div>
  );
}

export function MockGeneratedPrompt() {
  return (
    <div style={{ margin: "16px 0" }}>
      <div style={mockCard}>
        <div style={mockHeader}>
          <span>Generated Prompt <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>- Design and Plan</span></span>
        </div>
        <div style={mockBody}>
          <pre style={{
            fontSize: 11, lineHeight: 1.5, color: "var(--text-secondary)",
            fontFamily: "monospace", whiteSpace: "pre-wrap", margin: 0,
            padding: 10, background: "var(--bg-primary)", borderRadius: 6,
            maxHeight: 80, overflow: "hidden",
          }}>
{`### ROLE & EXPERT PANEL
Act as a senior architect and review:
Task: Build Login Page
Description: Implement user authentication with...
Provide 20 improvement iterations.`}
          </pre>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
          <span style={mockBtn(true)}>Copy to Clipboard</span>
          <span style={mockBtn()}>Save to History</span>
        </div>
      </div>
      <p style={label}>The preview shows your template with all placeholders replaced by variable values</p>
    </div>
  );
}

export function MockToast() {
  return (
    <div style={{ margin: "16px 0" }}>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderLeft: "3px solid var(--success)", borderRadius: "var(--radius)",
        maxWidth: 300, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, background: "rgba(76,175,128,0.15)", color: "var(--success)",
        }}>{"\u2713"}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Copied to clipboard</div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>Prompt ready to paste</div>
        </div>
      </div>
      <p style={label}>Toast notifications appear in the top-right for every action (save, copy, delete)</p>
    </div>
  );
}

export function MockSidebar() {
  return (
    <div style={{ margin: "16px 0" }}>
      <div style={{ width: 200, background: "var(--bg-secondary)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 700 }}>PromptFlow</div>
        <div style={{ padding: "8px 6px" }}>
          <div style={{ padding: "6px 10px", borderRadius: 6, background: "var(--accent-light)", color: "var(--accent)", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Tasks</div>
          <div style={{ padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 8 }}>Template Library \u25BC</div>
          <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--text-secondary)" }}>Feature Development</div>
          <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--text-secondary)" }}>Code Review</div>
        </div>
        <div style={{ padding: "8px 6px", borderTop: "1px solid var(--border)" }}>
          <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--text-muted)" }}>History</div>
          <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--text-muted)" }}>Manual</div>
        </div>
      </div>
      <p style={label}>Sidebar: Tasks at top (primary), Template Library (collapsible), utilities at bottom</p>
    </div>
  );
}
