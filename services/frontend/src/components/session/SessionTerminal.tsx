import { useRef, useEffect, useState } from "react";
import type { SessionMessage, ToolApprovalRequest, ContentBlock } from "../../types/session";
import ToolApprovalCard from "./ToolApprovalCard";

interface SessionTerminalProps {
  messages: SessionMessage[];
  pendingApprovals: ToolApprovalRequest[];
  onApprove: (toolUseId: string) => void;
  onDeny: (toolUseId: string) => void;
}

const containerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const textMsgStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "monospace",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  color: "var(--text-primary)",
};

const systemMsgStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  fontStyle: "italic",
  color: "var(--text-muted)",
};

const errorMsgStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "monospace",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  color: "var(--status-failed)",
  background: "rgba(224, 85, 85, 0.1)",
  borderLeft: "3px solid var(--status-failed)",
  borderRadius: "var(--radius)",
};

const toolCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  overflow: "hidden",
  marginTop: 2,
  marginBottom: 2,
};

const toolHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 12,
  color: "var(--text-secondary)",
};

const toolNameBadge: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "monospace",
  color: "var(--accent)",
  background: "var(--accent-light)",
  padding: "2px 8px",
  borderRadius: 20,
};

const toolBodyStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderTop: "1px solid var(--border)",
  fontSize: 12,
  fontFamily: "monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  color: "var(--text-secondary)",
  maxHeight: 200,
  overflowY: "auto",
};

const resultBadgeStyle = (isError: boolean): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 20,
  background: isError ? "rgba(224, 85, 85, 0.15)" : "rgba(76, 175, 128, 0.15)",
  color: isError ? "var(--status-failed)" : "var(--status-running)",
});

const roleLabelStyle = (role: string): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  color: role === "user" ? "var(--accent)" : role === "assistant" ? "var(--status-running)" : "var(--text-muted)",
  marginBottom: 2,
  padding: "0 12px",
});

function CollapsibleToolUse({ block }: { block: { name: string; input: Record<string, unknown> } }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={toolCardStyle}>
      <div style={toolHeaderStyle} onClick={() => setOpen(!open)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={toolNameBadge}>{block.name}</span>
          <span style={{ color: "var(--text-muted)" }}>Tool Use</span>
        </div>
        <span style={{ color: "var(--text-muted)" }}>{open ? "\u25B2" : "\u25BC"}</span>
      </div>
      {open && (
        <div style={toolBodyStyle}>
          {JSON.stringify(block.input, null, 2)}
        </div>
      )}
    </div>
  );
}

function CollapsibleToolResult({ content, isError }: { content: string; isError: boolean }) {
  const [open, setOpen] = useState(false);
  const preview = content.length > 120 ? content.substring(0, 120) + "..." : content;

  return (
    <div style={toolCardStyle}>
      <div style={toolHeaderStyle} onClick={() => setOpen(!open)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={resultBadgeStyle(isError)}>{isError ? "Error" : "Result"}</span>
          {!open && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{preview}</span>}
        </div>
        <span style={{ color: "var(--text-muted)" }}>{open ? "\u25B2" : "\u25BC"}</span>
      </div>
      {open && (
        <div style={toolBodyStyle}>{content}</div>
      )}
    </div>
  );
}

function CollapsibleThinking({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ ...toolCardStyle, borderColor: "rgba(124, 92, 252, 0.3)" }}>
      <div style={toolHeaderStyle} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Thinking...</span>
        <span style={{ color: "var(--text-muted)" }}>{open ? "\u25B2" : "\u25BC"}</span>
      </div>
      {open && (
        <div style={{ ...toolBodyStyle, fontStyle: "italic", color: "var(--text-muted)" }}>
          {text}
        </div>
      )}
    </div>
  );
}

function renderBlock(block: ContentBlock, index: number) {
  switch (block.type) {
    case "text":
      return <div key={index} style={textMsgStyle}>{block.text}</div>;
    case "thinking":
      return <CollapsibleThinking key={index} text={block.thinking} />;
    case "tool_use":
      return <CollapsibleToolUse key={index} block={block} />;
    case "tool_result":
      return <CollapsibleToolResult key={index} content={block.content} isError={block.is_error} />;
    case "error":
      return <div key={index} style={errorMsgStyle}>{block.error}{block.stderr ? "\n" + block.stderr : ""}</div>;
    default:
      return null;
  }
}

function renderMessage(msg: SessionMessage) {
  // If the message has blocks, render each block
  if (msg.blocks && msg.blocks.length > 0) {
    return (
      <div key={msg.id}>
        <div style={roleLabelStyle(msg.role)}>{msg.role}</div>
        {msg.blocks.map((block, i) => renderBlock(block, i))}
      </div>
    );
  }

  // Otherwise, render based on type/role
  if (msg.role === "system") {
    return (
      <div key={msg.id} style={systemMsgStyle}>
        {msg.content}
      </div>
    );
  }

  if (msg.type === "error") {
    return (
      <div key={msg.id}>
        <div style={roleLabelStyle(msg.role)}>{msg.role}</div>
        <div style={errorMsgStyle}>{msg.content}</div>
      </div>
    );
  }

  return (
    <div key={msg.id}>
      <div style={roleLabelStyle(msg.role)}>{msg.role}</div>
      <div style={textMsgStyle}>{msg.content}</div>
    </div>
  );
}

export default function SessionTerminal({ messages, pendingApprovals, onApprove, onDeny }: SessionTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const prevMessageCount = useRef(messages.length);

  // Check if user scrolled up (disable auto-scroll)
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  };

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCount.current && autoScrollRef.current) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  return (
    <div
      ref={scrollRef}
      style={containerStyle}
      onScroll={handleScroll}
    >
      {messages.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No messages yet. Session output will appear here.
        </div>
      ) : (
        messages.map((msg) => renderMessage(msg))
      )}

      {/* Pending approval cards */}
      {pendingApprovals.map((a) => (
        <ToolApprovalCard
          key={a.id}
          approval={a}
          onApprove={onApprove}
          onDeny={onDeny}
        />
      ))}
    </div>
  );
}
