import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getHelpSection } from "../data/helpContent";

interface HelpPanelProps {
  sectionId: string | null;
  onClose: () => void;
}

export default function HelpPanel({ sectionId, onClose }: HelpPanelProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!sectionId) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [sectionId, onClose]);

  if (!sectionId) return null;

  const section = getHelpSection(sectionId);
  if (!section) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 1000, cursor: "pointer",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
        background: "var(--bg-secondary)", borderLeft: "1px solid var(--border)",
        zIndex: 1001, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            {section.title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              fontSize: 20, cursor: "pointer", padding: "4px 8px", lineHeight: 1,
            }}
          >
            x
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {section.content.map((line, i) => {
            if (line.startsWith("- ")) {
              return (
                <div key={i} style={{
                  fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
                  paddingLeft: 16, marginBottom: 4,
                }}>
                  {"\u2022 " + line.slice(2)}
                </div>
              );
            }
            if (line.startsWith("  ")) {
              return (
                <pre key={i} style={{
                  fontSize: 12, color: "var(--accent)", background: "var(--bg-input)",
                  padding: "8px 12px", borderRadius: "var(--radius)", marginBottom: 8,
                  fontFamily: "monospace", whiteSpace: "pre-wrap",
                }}>
                  {line.trim()}
                </pre>
              );
            }
            if (line.endsWith(":")) {
              return (
                <p key={i} style={{
                  fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                  marginTop: 12, marginBottom: 4,
                }}>
                  {line}
                </p>
              );
            }
            return (
              <p key={i} style={{
                fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
                marginBottom: 8,
              }}>
                {line}
              </p>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <button
            onClick={() => { onClose(); navigate("/manual"); }}
            style={{
              background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: "var(--radius)", padding: "8px 16px", fontSize: 13,
              fontWeight: 500, cursor: "pointer",
            }}
          >
            View Full Manual
          </button>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-card)", color: "var(--text-secondary)",
              border: "1px solid var(--border)", borderRadius: "var(--radius)",
              padding: "8px 16px", fontSize: 13, cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
