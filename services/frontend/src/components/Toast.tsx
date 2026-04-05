import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration: number;
}

interface ToastCtx {
  toast: (t: Omit<Toast, "id" | "duration"> & { duration?: number }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const variantColors: Record<ToastVariant, string> = {
  success: "var(--success)",
  error: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--accent)",
};

const variantIcons: Record<ToastVariant, string> = {
  success: "\u2713",
  error: "!",
  warning: "\u26A0",
  info: "i",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), toast.duration - 250);
    const t2 = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toast.id, toast.duration, onDismiss]);

  const color = variantColors[toast.variant];

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderLeft: `3px solid ${color}`, borderRadius: "var(--radius)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)", minWidth: 280, maxWidth: 380,
      animation: exiting ? "slideOutRight 0.25s ease-in forwards" : "slideInRight 0.25s ease-out",
      position: "relative", overflow: "hidden", pointerEvents: "auto",
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, marginTop: 1,
        background: `${color}20`, color,
      }}>
        {variantIcons[toast.variant]}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
          {toast.title}
        </div>
        {toast.message && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4, marginTop: 2 }}>
            {toast.message}
          </div>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", padding: "0 0 0 8px", lineHeight: 1 }}
      >
        x
      </button>
      <div style={{
        position: "absolute", bottom: 0, left: 0, height: 2,
        background: color, animation: `shrinkWidth ${toast.duration}ms linear forwards`,
        borderRadius: "0 0 0 var(--radius)",
      }} />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((t: Omit<Toast, "id" | "duration"> & { duration?: number }) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const duration = t.duration ?? (t.variant === "error" || t.variant === "warning" ? 5000 : 3000);
    setToasts((prev) => [...prev, { ...t, id, duration }]);
  }, []);

  const ctx: ToastCtx = {
    toast: addToast,
    success: (title, message) => addToast({ variant: "success", title, message }),
    error: (title, message) => addToast({ variant: "error", title, message }),
    warning: (title, message) => addToast({ variant: "warning", title, message }),
    info: (title, message) => addToast({ variant: "info", title, message }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div style={{
        position: "fixed", top: 16, right: 16, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8,
        pointerEvents: "none", maxWidth: 380,
      }}>
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}
