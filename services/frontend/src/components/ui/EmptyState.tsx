import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: "var(--accent-light)", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 20, color: "var(--accent)", marginBottom: 16,
        border: "1px solid rgba(124,92,252,0.2)",
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 280, lineHeight: 1.5, marginBottom: action ? 16 : 0 }}>
        {description}
      </div>
      {action}
    </div>
  );
}
