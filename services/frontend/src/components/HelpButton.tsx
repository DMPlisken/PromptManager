interface HelpButtonProps {
  onClick: () => void;
  size?: "small" | "normal";
}

export default function HelpButton({ onClick, size = "small" }: HelpButtonProps) {
  const dim = size === "small" ? 20 : 26;
  const font = size === "small" ? 12 : 15;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title="Help"
      style={{
        width: dim, height: dim, borderRadius: "50%",
        background: "var(--accent-light)", border: "1px solid var(--accent)",
        color: "var(--accent)", fontSize: font, fontWeight: 700,
        cursor: "pointer", display: "inline-flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0, lineHeight: 1, padding: 0,
      }}
    >
      ?
    </button>
  );
}
