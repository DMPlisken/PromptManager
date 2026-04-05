import type { ReactNode } from "react";

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border)", overflow: "hidden", marginBottom: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function CardHeader({ children, style, onClick }: { children: ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "14px 20px", borderBottom: "1px solid var(--border)",
      background: "rgba(255,255,255,0.015)", ...style,
    }}
    onClick={onClick}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
      {children}
    </div>
  );
}

export function CardBody({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div style={{ padding: 20, ...style }}>{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "12px 20px", borderTop: "1px solid var(--border)",
      background: "rgba(255,255,255,0.01)",
    }}>
      {children}
    </div>
  );
}
