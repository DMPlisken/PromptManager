import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import HelpButton from "../components/HelpButton";
import type { PromptGroup } from "../types";

export default function Dashboard({ onHelp }: { onHelp?: (id: string) => void }) {
  const [groups, setGroups] = useState<PromptGroup[]>([]);

  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Dashboard</h2>
        {onHelp && <HelpButton onClick={() => onHelp("dashboard")} />}
      </div>

      {groups.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center", color: "var(--text-muted)",
          background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No prompt groups yet.</p>
          <p style={{ fontSize: 14 }}>Create a group in the sidebar to get started.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {groups.map((g) => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              style={{
                display: "block", padding: 20, background: "var(--bg-card)",
                borderRadius: "var(--radius-lg)", border: "1px solid var(--border)",
                textDecoration: "none", color: "var(--text-primary)",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{g.name}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {g.description || "No description"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
