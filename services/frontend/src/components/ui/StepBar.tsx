interface Step {
  label: string;
  detail?: string;
  isComplete: boolean;
  isActive: boolean;
}

export default function StepBar({ steps }: { steps: Step[] }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", padding: "16px 24px",
      background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border)", marginBottom: 20,
    }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              transition: "all 0.2s ease",
              background: step.isComplete ? "var(--success)" : step.isActive ? "var(--accent)" : "var(--bg-input)",
              color: step.isComplete || step.isActive ? "#fff" : "var(--text-muted)",
              border: step.isActive ? "2px solid var(--accent)" : step.isComplete ? "2px solid var(--success)" : "2px solid var(--border)",
              boxShadow: step.isActive ? "0 0 0 3px rgba(124,92,252,0.2)" : "none",
            }}>
              {step.isComplete ? "\u2713" : i + 1}
            </div>
            <div>
              <div style={{
                fontSize: 13, whiteSpace: "nowrap",
                fontWeight: step.isActive ? 600 : 400,
                color: step.isActive ? "var(--text-primary)" : step.isComplete ? "var(--success)" : "var(--text-muted)",
              }}>
                {step.label}
              </div>
              {step.detail && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {step.detail}
                </div>
              )}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: 2, margin: "0 16px",
              background: step.isComplete ? "var(--success)" : "var(--border)",
              borderRadius: 1, transition: "background 0.3s ease", minWidth: 24,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}
