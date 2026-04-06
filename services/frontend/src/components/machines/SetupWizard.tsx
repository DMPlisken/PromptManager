import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../../api/client";
import { machineStore } from "../../stores/machineStore";
import type { PairingCode, Machine, MachinePlatform } from "../../types/machine";

interface SetupWizardProps {
  onClose: () => void;
  onComplete: (machine: Machine) => void;
}

type WizardStep = "platform" | "pairing" | "instructions" | "waiting" | "done";

/* ---------- Styles ---------- */

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  padding: 28,
  width: 560,
  maxWidth: "90vw",
  maxHeight: "85vh",
  overflowY: "auto",
};

const btnStyle = (variant: "primary" | "secondary" = "primary"): React.CSSProperties => ({
  padding: "10px 24px",
  border: variant === "primary" ? "none" : "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  background: variant === "primary" ? "var(--accent)" : "transparent",
  color: variant === "primary" ? "#fff" : "var(--text-secondary)",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "var(--bg-input)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
};

const platformBtnStyle = (selected: boolean): React.CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  padding: "24px 16px",
  borderRadius: "var(--radius-lg)",
  border: selected ? "2px solid var(--accent)" : "2px solid var(--border)",
  background: selected ? "var(--accent-light)" : "var(--bg-card)",
  cursor: "pointer",
  transition: "all 0.15s",
});

const codeBlockStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "14px 16px",
  fontFamily: "monospace",
  fontSize: 13,
  lineHeight: 1.6,
  color: "var(--text-primary)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  position: "relative",
};

const copyBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  padding: "3px 10px",
  fontSize: 11,
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-muted)",
  cursor: "pointer",
};

const stepIndicatorStyle = (active: boolean, completed: boolean): React.CSSProperties => ({
  width: 24,
  height: 24,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 700,
  background: completed ? "var(--success)" : active ? "var(--accent)" : "var(--bg-input)",
  color: completed || active ? "#fff" : "var(--text-muted)",
  border: completed || active ? "none" : "1px solid var(--border)",
  flexShrink: 0,
});

/* ---------- Component ---------- */

export default function SetupWizard({ onClose, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<WizardStep>("platform");
  const [platform, setPlatform] = useState<MachinePlatform | null>(null);
  const [pairingCode, setPairingCode] = useState<PairingCode | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pairedMachine, setPairedMachine] = useState<Machine | null>(null);
  const [machineName, setMachineName] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const initialMachineIds = useRef<Set<number>>(new Set());

  // Capture current machine IDs when entering the waiting step
  useEffect(() => {
    if (step === "waiting") {
      const state = machineStore.getState();
      initialMachineIds.current = new Set(state.machineOrder);
    }
  }, [step]);

  // Poll for new machine while waiting
  useEffect(() => {
    if (step !== "waiting") return;

    const poll = async () => {
      try {
        const machines = await api.getMachines();
        // Check for a new machine that was not present before
        for (const m of machines) {
          if (!initialMachineIds.current.has(m.id)) {
            setPairedMachine(m);
            setMachineName(m.name);
            setStep("done");
            // Also update the store
            machineStore.dispatch({ type: "MACHINES_LOADED", machines });
            return;
          }
        }
      } catch {
        // Ignore poll errors
      }
    };

    pollRef.current = setInterval(poll, 3000);
    // Also check immediately
    poll();

    return () => clearInterval(pollRef.current);
  }, [step]);

  // Also listen for machine.registered events from the store
  useEffect(() => {
    if (step !== "waiting") return;

    const unsubscribe = machineStore.subscribe(() => {
      const state = machineStore.getState();
      for (const id of state.machineOrder) {
        if (!initialMachineIds.current.has(id)) {
          const m = state.machines[id];
          if (m) {
            setPairedMachine(m);
            setMachineName(m.name);
            setStep("done");
            clearInterval(pollRef.current);
          }
          break;
        }
      }
    });

    return unsubscribe;
  }, [step]);

  const handleGeneratePairingCode = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const code = await api.generatePairingCode();
      setPairingCode(code);
      setStep("pairing");
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
    }
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const serverHost = window.location.hostname || "localhost";
  const serverPort = "3001";

  const installCmd = platform === "win32"
    ? `npm install -g @promptflow/agent\npromptflow-agent pair ${pairingCode?.code || "XXXXXX"} --server ws://${serverHost}:${serverPort}`
    : `npm install -g @promptflow/agent\npromptflow-agent pair ${pairingCode?.code || "XXXXXX"} --server ws://${serverHost}:${serverPort}`;

  const steps: { key: WizardStep; label: string }[] = [
    { key: "platform", label: "Platform" },
    { key: "pairing", label: "Pairing Code" },
    { key: "instructions", label: "Install" },
    { key: "waiting", label: "Connect" },
    { key: "done", label: "Done" },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={modalStyle}>
        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 24 }}>
          {steps.map((s, i) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={stepIndicatorStyle(i === stepIndex, i < stepIndex)}>
                {i < stepIndex ? "\u2713" : i + 1}
              </div>
              <span style={{
                fontSize: 11, color: i <= stepIndex ? "var(--text-secondary)" : "var(--text-muted)",
                fontWeight: i === stepIndex ? 600 : 400,
              }}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div style={{
                  width: 20, height: 1,
                  background: i < stepIndex ? "var(--accent)" : "var(--border)",
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Step: Choose platform */}
        {step === "platform" && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Add a Machine</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              Choose the platform of the machine you want to connect.
            </p>

            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              <button
                type="button"
                onClick={() => setPlatform("darwin")}
                style={platformBtnStyle(platform === "darwin") as React.CSSProperties}
              >
                <span style={{ fontSize: 28 }}>Apple</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>macOS</span>
              </button>
              <button
                type="button"
                onClick={() => setPlatform("win32")}
                style={platformBtnStyle(platform === "win32") as React.CSSProperties}
              >
                <span style={{ fontSize: 28 }}>Win</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Windows</span>
              </button>
              <button
                type="button"
                onClick={() => setPlatform("linux")}
                style={platformBtnStyle(platform === "linux") as React.CSSProperties}
              >
                <span style={{ fontSize: 28 }}>Tux</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Linux</span>
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onClose} style={btnStyle("secondary")}>Cancel</button>
              <button
                onClick={handleGeneratePairingCode}
                style={{ ...btnStyle("primary"), opacity: platform ? 1 : 0.5 }}
                disabled={!platform || generating}
              >
                {generating ? "Generating..." : "Next"}
              </button>
            </div>

            {error && (
              <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 12 }}>{error}</div>
            )}
          </>
        )}

        {/* Step: Show pairing code */}
        {step === "pairing" && pairingCode && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Pairing Code Generated</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              Use this code on the target machine to pair with PromptFlow.
            </p>

            {/* Pairing code display */}
            <div style={{
              background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
              border: "2px solid var(--accent)", padding: "24px 20px",
              textAlign: "center", marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Pairing Code
              </div>
              <div style={{
                fontSize: 36, fontWeight: 700, letterSpacing: "0.2em",
                color: "var(--accent)", fontFamily: "monospace",
              }}>
                {pairingCode.code}
              </div>
              <button
                onClick={() => handleCopy(pairingCode.code, "code")}
                style={{
                  marginTop: 12, padding: "4px 14px", fontSize: 12,
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", color: "var(--text-muted)", cursor: "pointer",
                }}
              >
                {copied === "code" ? "Copied!" : "Copy Code"}
              </button>
            </div>

            {/* API key (collapsible) */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>API Key (for manual setup)</div>
              <div style={{ ...codeBlockStyle, fontSize: 12 }}>
                {pairingCode.api_key}
                <button
                  onClick={() => handleCopy(pairingCode.api_key, "key")}
                  style={copyBtnStyle}
                >
                  {copied === "key" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20 }}>
              Expires: {new Date(pairingCode.expires_at).toLocaleString()}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setStep("platform")} style={btnStyle("secondary")}>Back</button>
              <button onClick={() => setStep("instructions")} style={btnStyle("primary")}>Next</button>
            </div>
          </>
        )}

        {/* Step: Install instructions */}
        {step === "instructions" && pairingCode && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Install the Agent</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              Run these commands on the target machine ({platform === "darwin" ? "macOS Terminal" : platform === "win32" ? "Windows PowerShell" : "Linux Terminal"}).
            </p>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                Step 1: Install the agent
              </div>
              <div style={codeBlockStyle}>
                npm install -g @promptflow/agent
                <button
                  onClick={() => handleCopy("npm install -g @promptflow/agent", "install")}
                  style={copyBtnStyle}
                >
                  {copied === "install" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, marginTop: 16 }}>
                Step 2: Pair with this server
              </div>
              <div style={codeBlockStyle}>
                {`promptflow-agent pair ${pairingCode.code} --server ws://${serverHost}:${serverPort}`}
                <button
                  onClick={() => handleCopy(`promptflow-agent pair ${pairingCode.code} --server ws://${serverHost}:${serverPort}`, "pair")}
                  style={copyBtnStyle}
                >
                  {copied === "pair" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Full command block */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                Or copy the full command
              </div>
              <div style={codeBlockStyle}>
                {installCmd}
                <button
                  onClick={() => handleCopy(installCmd, "full")}
                  style={copyBtnStyle}
                >
                  {copied === "full" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setStep("pairing")} style={btnStyle("secondary")}>Back</button>
              <button onClick={() => setStep("waiting")} style={btnStyle("primary")}>
                I've run the commands
              </button>
            </div>
          </>
        )}

        {/* Step: Waiting for connection */}
        {step === "waiting" && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Waiting for Connection</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
              Waiting for the agent to connect. Make sure you've run the install commands on the target machine.
            </p>

            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "32px 20px", marginBottom: 24,
            }}>
              {/* Spinner */}
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                border: "3px solid var(--border)",
                borderTopColor: "var(--accent)",
                animation: "spin 1s linear infinite",
                marginBottom: 16,
              }} />
              <div style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>
                Listening for agent connection...
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                Pairing code: <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--accent)" }}>
                  {pairingCode?.code}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setStep("instructions")} style={btnStyle("secondary")}>Back</button>
              <button onClick={onClose} style={btnStyle("secondary")}>Cancel</button>
            </div>
          </>
        )}

        {/* Step: Done */}
        {step === "done" && pairedMachine && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Machine Connected</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              The machine has been successfully paired with PromptFlow.
            </p>

            {/* Success indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "rgba(76, 175, 128, 0.1)",
              border: "1px solid rgba(76, 175, 128, 0.3)",
              borderRadius: "var(--radius-lg)", padding: "16px 20px",
              marginBottom: 20,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "var(--success)", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 20, color: "#fff", fontWeight: 700, flexShrink: 0,
              }}>
                {"\u2713"}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  {pairedMachine.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {pairedMachine.hostname || "Unknown host"} &middot; {pairedMachine.platform === "darwin" ? "macOS" : pairedMachine.platform === "win32" ? "Windows" : "Linux"}
                </div>
              </div>
            </div>

            {/* Set name */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                Machine Name (optional)
              </label>
              <input
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                placeholder="Give this machine a friendly name..."
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={async () => {
                  if (machineName.trim() && machineName.trim() !== pairedMachine.name) {
                    try {
                      const updated = await api.updateMachine(pairedMachine.id, { name: machineName.trim() });
                      machineStore.dispatch({ type: "MACHINE_UPDATED", machine: updated });
                      onComplete(updated);
                    } catch {
                      onComplete(pairedMachine);
                    }
                  } else {
                    onComplete(pairedMachine);
                  }
                }}
                style={btnStyle("primary")}
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>

      {/* Inline spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
