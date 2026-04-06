/**
 * Session runner — spawns Claude Code CLI subprocesses and streams output.
 *
 * Each session is a child process running:
 *   claude --print --output-format stream-json --model <model> [--permission-mode <mode>]
 *
 * The prompt is written to stdin, then stdin is closed.
 * Stdout is read line-by-line; each line is parsed as a stream-json message.
 */

import { ChildProcess, spawn } from "child_process";
import { EventEmitter } from "events";
import * as path from "path";
import * as readline from "readline";
import type { StreamJsonMessage, ServerSessionCreate } from "./protocol";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionRunnerEvents {
  output: (sessionId: string, sequence: number, data: StreamJsonMessage) => void;
  completed: (sessionId: string, exitCode: number, durationMs: number) => void;
  failed: (sessionId: string, error: string, exitCode?: number) => void;
}

export interface SessionInfo {
  sessionId: string;
  pid: number | undefined;
  startedAt: Date;
  workingDirectory: string;
  model: string | undefined;
}

// ---------------------------------------------------------------------------
// SessionRunner
// ---------------------------------------------------------------------------

export class SessionRunner extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private sessionInfo: Map<string, SessionInfo> = new Map();
  private sequences: Map<string, number> = new Map();
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 3) {
    super();
    this.maxConcurrent = maxConcurrent;
  }

  /** Number of active sessions. */
  get activeCount(): number {
    return this.processes.size;
  }

  /** Get info for all active sessions. */
  getActiveSessions(): SessionInfo[] {
    return Array.from(this.sessionInfo.values());
  }

  /** Check whether a session is currently running. */
  isRunning(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }

  /**
   * Spawn a new Claude CLI session.
   *
   * @throws Error if max concurrent sessions would be exceeded.
   */
  async createSession(cmd: ServerSessionCreate): Promise<void> {
    if (this.processes.size >= this.maxConcurrent) {
      this.emit(
        "failed",
        cmd.sessionId,
        `Max concurrent sessions (${this.maxConcurrent}) reached`,
        undefined
      );
      return;
    }

    if (this.processes.has(cmd.sessionId)) {
      this.emit("failed", cmd.sessionId, "Session already exists", undefined);
      return;
    }

    const args = buildCliArgs(cmd);
    const startTime = Date.now();

    // Determine the Claude CLI command name
    const claudeCmd = findClaudeCli();

    let child: ChildProcess;
    try {
      child = spawn(claudeCmd, args, {
        cwd: cmd.workingDirectory,
        stdio: ["pipe", "pipe", "pipe"],
        // On Windows, use shell: true so that .cmd/.ps1 scripts are found
        shell: process.platform === "win32",
        env: {
          ...process.env,
          // Ensure non-interactive mode
          CI: "true",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emit("failed", cmd.sessionId, `Failed to spawn Claude CLI: ${msg}`, undefined);
      return;
    }

    this.processes.set(cmd.sessionId, child);
    this.sequences.set(cmd.sessionId, 0);
    this.sessionInfo.set(cmd.sessionId, {
      sessionId: cmd.sessionId,
      pid: child.pid,
      startedAt: new Date(),
      workingDirectory: cmd.workingDirectory,
      model: cmd.model,
    });

    // Write prompt to stdin and close it
    if (child.stdin) {
      child.stdin.write(cmd.prompt);
      child.stdin.end();
    }

    // Read stdout line-by-line (stream-json format: one JSON object per line)
    if (child.stdout) {
      const rl = readline.createInterface({ input: child.stdout });
      rl.on("line", (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const data = JSON.parse(trimmed) as StreamJsonMessage;
          const seq = (this.sequences.get(cmd.sessionId) ?? 0) + 1;
          this.sequences.set(cmd.sessionId, seq);
          this.emit("output", cmd.sessionId, seq, data);
        } catch {
          // Non-JSON line — wrap it as a system message
          const seq = (this.sequences.get(cmd.sessionId) ?? 0) + 1;
          this.sequences.set(cmd.sessionId, seq);
          this.emit("output", cmd.sessionId, seq, {
            type: "system",
            message: trimmed,
          } as StreamJsonMessage);
        }
      });
    }

    // Capture stderr for error reporting
    let stderrBuf = "";
    if (child.stderr) {
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuf += chunk.toString();
      });
    }

    // Handle process exit
    child.on("close", (code: number | null) => {
      this.cleanup(cmd.sessionId);
      const durationMs = Date.now() - startTime;
      const exitCode = code ?? 1;

      if (exitCode === 0) {
        this.emit("completed", cmd.sessionId, exitCode, durationMs);
      } else {
        const errMsg = stderrBuf.trim() || `Process exited with code ${exitCode}`;
        this.emit("failed", cmd.sessionId, errMsg, exitCode);
      }
    });

    child.on("error", (err: Error) => {
      this.cleanup(cmd.sessionId);
      this.emit("failed", cmd.sessionId, `Process error: ${err.message}`, undefined);
    });
  }

  /**
   * Abort a running session.
   * Sends SIGTERM on Mac/Linux, uses taskkill on Windows.
   */
  abortSession(sessionId: string): boolean {
    const child = this.processes.get(sessionId);
    if (!child) return false;

    try {
      if (process.platform === "win32") {
        // On Windows, child.kill() may not kill the process tree.
        // Use taskkill to kill the entire process tree.
        if (child.pid) {
          const { execSync } = require("child_process");
          execSync(`taskkill /PID ${child.pid} /T /F`, { timeout: 5000 });
        }
      } else {
        // On Unix, send SIGTERM for graceful shutdown
        child.kill("SIGTERM");

        // If still running after 5 seconds, force kill
        const pid = child.pid;
        if (pid) {
          setTimeout(() => {
            try {
              process.kill(pid, 0); // Check if alive
              child.kill("SIGKILL");
            } catch {
              // Already dead — good
            }
          }, 5000);
        }
      }
    } catch {
      // Process may have already exited
    }

    return true;
  }

  /** Abort all running sessions. */
  abortAll(): void {
    for (const sessionId of this.processes.keys()) {
      this.abortSession(sessionId);
    }
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private cleanup(sessionId: string): void {
    this.processes.delete(sessionId);
    this.sequences.delete(sessionId);
    this.sessionInfo.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// CLI argument builder
// ---------------------------------------------------------------------------

function buildCliArgs(cmd: ServerSessionCreate): string[] {
  const args: string[] = ["--print", "--output-format", "stream-json"];

  if (cmd.model) {
    args.push("--model", cmd.model);
  }

  if (cmd.permissionMode) {
    args.push("--permission-mode", cmd.permissionMode);
  }

  if (cmd.allowedTools && cmd.allowedTools.length > 0) {
    for (const tool of cmd.allowedTools) {
      args.push("--allowedTools", tool);
    }
  }

  return args;
}

/**
 * Find the Claude CLI executable.
 * Returns "claude" and relies on PATH resolution.
 */
function findClaudeCli(): string {
  return "claude";
}
