import { useState, useEffect, useRef, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "icon" | "destructive";

interface ButtonProps {
  variant?: ButtonVariant;
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  confirm?: boolean; // if true + destructive, requires 2-click
  style?: React.CSSProperties;
}

const baseStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  gap: 6, cursor: "pointer", fontFamily: "inherit",
  transition: "all 0.15s ease", border: "none", outline: "none",
};

const variants: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    ...baseStyle, padding: "8px 18px", background: "var(--accent)", color: "#fff",
    borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600,
    boxShadow: "0 1px 3px rgba(124,92,252,0.3)",
  },
  secondary: {
    ...baseStyle, padding: "8px 16px", background: "transparent", color: "var(--text-secondary)",
    border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 500,
  },
  icon: {
    ...baseStyle, width: 30, height: 30, padding: 0,
    background: "transparent", color: "var(--text-muted)",
    border: "1px solid transparent", borderRadius: "var(--radius)", fontSize: 14,
  },
  destructive: {
    ...baseStyle, padding: "8px 16px", background: "transparent", color: "var(--danger)",
    border: "1px solid rgba(224,85,85,0.3)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 500,
  },
};

const hoverStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: "var(--accent-hover)", transform: "translateY(-1px)", boxShadow: "0 4px 12px rgba(124,92,252,0.4)" },
  secondary: { background: "rgba(255,255,255,0.03)", borderColor: "var(--text-muted)", color: "var(--text-primary)" },
  icon: { background: "rgba(255,255,255,0.05)", borderColor: "var(--border)", color: "var(--text-secondary)" },
  destructive: { background: "rgba(224,85,85,0.1)", borderColor: "var(--danger)" },
};

export default function Button({ variant = "secondary", children, onClick, type = "button", disabled, title, confirm, style }: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<number>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    if (confirm && variant === "destructive" && !confirming) {
      setConfirming(true);
      timerRef.current = window.setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setConfirming(false);
    onClick?.(e);
  };

  const confirmStyle: React.CSSProperties = confirming
    ? { background: "var(--danger)", color: "#fff", borderColor: "var(--danger)", fontWeight: 600, animation: "pulse 0.3s ease" }
    : {};

  return (
    <button
      type={type}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      title={title}
      style={{
        ...variants[variant],
        ...(hovered && !confirming ? hoverStyles[variant] : {}),
        ...confirmStyle,
        ...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
        ...style,
      }}
    >
      {confirming ? "Confirm?" : children}
    </button>
  );
}
