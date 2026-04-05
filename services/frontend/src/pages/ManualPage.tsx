import { helpSections } from "../data/helpContent";
import { MockStepBar, MockTemplateList, MockVariableForm, MockGeneratedPrompt, MockToast, MockSidebar } from "../components/ManualMockups";
import type { ReactNode } from "react";

// Map section IDs to their visual mockups
const sectionMockups: Record<string, ReactNode> = {
  "getting-started": <><MockSidebar /><MockStepBar /></>,
  "dashboard": null,
  "groups": null,
  "variables": <MockVariableForm />,
  "templates": <MockTemplateList />,
  "preview": <MockGeneratedPrompt />,
  "tasks": <><MockStepBar /><MockTemplateList /><MockVariableForm /><MockGeneratedPrompt /></>,
  "executions": <MockToast />,
  "history": null,
  "docker": null,
};

export default function ManualPage() {
  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>User Manual</h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
        Complete guide to using PromptFlow. Click the ? buttons throughout the app for context-specific help.
      </p>

      {/* Table of Contents */}
      <div style={{
        background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)", padding: 20, marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>
          Table of Contents
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {helpSections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", padding: "4px 0" }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      {helpSections.map((section) => (
        <div
          key={section.id}
          id={section.id}
          style={{
            background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)", padding: 20, marginBottom: 16,
          }}
        >
          <h3 style={{
            fontSize: 16, fontWeight: 700, color: "var(--text-primary)",
            marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--border)",
          }}>
            {section.title}
          </h3>

          {/* Visual mockup for this section */}
          {sectionMockups[section.id]}

          {section.content.map((line, i) => {
            if (line.startsWith("- ")) {
              return (
                <div key={i} style={{
                  fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7,
                  paddingLeft: 20, marginBottom: 4,
                }}>
                  {"\u2022 " + line.slice(2)}
                </div>
              );
            }
            if (line.startsWith("  ")) {
              return (
                <pre key={i} style={{
                  fontSize: 13, color: "var(--accent)", background: "var(--bg-input)",
                  padding: "10px 14px", borderRadius: "var(--radius)", marginBottom: 10,
                  fontFamily: "monospace", whiteSpace: "pre-wrap",
                }}>
                  {line.trim()}
                </pre>
              );
            }
            if (line.endsWith(":")) {
              return (
                <p key={i} style={{
                  fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                  marginTop: 14, marginBottom: 6,
                }}>
                  {line}
                </p>
              );
            }
            return (
              <p key={i} style={{
                fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7,
                marginBottom: 8,
              }}>
                {line}
              </p>
            );
          })}
        </div>
      ))}

      {/* Back to top */}
      <div style={{ textAlign: "center", padding: "16px 0 32px" }}>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}
        >
          Back to top
        </a>
      </div>
    </div>
  );
}
