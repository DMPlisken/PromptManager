/**
 * Main Agent class.
 *
 * Orchestrates the WebSocket connection, session runners, and health reporting.
 * This is the central coordinator that ties all modules together.
 */

import * as os from "os";
import type { AgentConfig } from "./config";
import { AgentConnection } from "./connection";
import { SessionRunner } from "./session-runner";
import { collectHealth } from "./health";
import type {
  ServerMessage,
  ServerSessionCreate,
  MachineInfo,
  MachineHealth,
} from "./protocol";

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class Agent {
  private connection: AgentConnection;
  private sessions: SessionRunner;
  private config: AgentConfig;
  private shutdownRequested = false;

  constructor(config: AgentConfig) {
    this.config = config;
    this.sessions = new SessionRunner(config.maxConcurrentSessions);

    const machineInfo = this.buildMachineInfo();
    this.connection = new AgentConnection(
      config.serverUrl,
      config.authToken,
      machineInfo,
      () => this.getHealth()
    );

    this.wireEvents();
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Start the agent: connect to server and begin accepting commands. */
  async start(): Promise<void> {
    if (!this.config.serverUrl) {
      console.error(
        "Error: server_url is not configured.\n" +
        "Run `promptflow-agent pair <code> --server <url>` first."
      );
      process.exit(1);
    }

    if (!this.config.authToken) {
      console.error(
        "Error: auth_token is not configured.\n" +
        "Run `promptflow-agent pair <code> --server <url>` first."
      );
      process.exit(1);
    }

    console.log("PromptFlow Agent starting...");
    console.log(`  Machine:  ${this.config.machineName}`);
    console.log(`  Server:   ${this.config.serverUrl}`);
    console.log(`  Sessions: max ${this.config.maxConcurrentSessions}`);
    console.log(`  Workspace: ${this.config.workspaceRoot}`);
    console.log("");

    this.connection.connect();

    // Keep the process alive
    await this.waitForShutdown();
  }

  /** Gracefully shut down the agent. */
  async shutdown(): Promise<void> {
    if (this.shutdownRequested) return;
    this.shutdownRequested = true;

    console.log("\nShutting down agent...");

    // Abort all running sessions
    this.sessions.abortAll();

    // Disconnect from server
    this.connection.disconnect();

    console.log("Agent stopped.");
  }

  // -----------------------------------------------------------------------
  // Command handling
  // -----------------------------------------------------------------------

  /** Route an incoming server message to the appropriate handler. */
  private async handleCommand(msg: ServerMessage): Promise<void> {
    switch (msg.type) {
      case "server.welcome":
        console.log(
          `Connected to server (id=${msg.serverId}, version=${msg.serverVersion})`
        );
        break;

      case "server.session.create":
        await this.createSession(msg);
        break;

      case "server.session.abort":
        this.abortSession(msg.sessionId);
        break;

      case "server.session.input":
        this.sendInput(msg.sessionId, (msg as any).text || "");
        break;

      case "server.session.end":
        this.endSession(msg.sessionId);
        break;

      case "server.error":
        console.error(`Server error [${msg.code}]: ${msg.message}`);
        break;

      default: {
        const unknown = msg as { type: string };
        if (this.config.logLevel === "debug") {
          console.log(`Unknown message type: ${unknown.type}`);
        }
      }
    }
  }

  /** Handle a session.create command from the server. */
  private async createSession(cmd: ServerSessionCreate): Promise<void> {
    console.log(
      `Creating session ${cmd.sessionId} (model=${cmd.model || "default"}, ` +
      `dir=${cmd.workingDirectory})`
    );

    await this.sessions.createSession(cmd);
  }

  /** Send follow-up input to a running session. */
  private sendInput(sessionId: string, text: string): void {
    if (!text.trim()) return;
    console.log(`Sending input to session ${sessionId}: "${text.substring(0, 60)}..."`);
    const sent = this.sessions.sendInput(sessionId, text);
    if (!sent) {
      console.warn(`Session ${sessionId} not found or stdin closed (cannot send input)`);
    }
  }

  /** Gracefully end a session (close stdin, let Claude finish). */
  private endSession(sessionId: string): void {
    console.log(`Ending session ${sessionId} (closing stdin)`);
    const ended = this.sessions.endSession(sessionId);
    if (!ended) {
      console.warn(`Session ${sessionId} not found (may have already completed)`);
    }
  }

  /** Handle a session.abort command from the server. */
  private abortSession(sessionId: string): void {
    console.log(`Aborting session ${sessionId}`);
    const aborted = this.sessions.abortSession(sessionId);
    if (!aborted) {
      console.warn(`Session ${sessionId} not found (may have already completed)`);
    }
  }

  // -----------------------------------------------------------------------
  // Event wiring
  // -----------------------------------------------------------------------

  private wireEvents(): void {
    // Connection events
    this.connection.on("message", (msg: ServerMessage) => {
      this.handleCommand(msg).catch((err) => {
        console.error(`Error handling command: ${err}`);
      });
    });

    this.connection.on("stateChange", (state: string) => {
      if (this.config.logLevel === "debug") {
        console.log(`Connection state: ${state}`);
      }
    });

    this.connection.on("error", (err: Error) => {
      if (this.config.logLevel === "debug") {
        console.error(`Connection error: ${err.message}`);
      }
    });

    // Session runner events -> forward to server
    this.sessions.on("output", (sessionId: string, sequence: number, data: unknown) => {
      this.connection.send({
        type: "agent.session.output",
        sessionId,
        sequence,
        data: data as import("./protocol").StreamJsonMessage,
      });
    });

    this.sessions.on(
      "completed",
      (sessionId: string, exitCode: number, durationMs: number) => {
        console.log(
          `Session ${sessionId} completed (exit=${exitCode}, duration=${durationMs}ms)`
        );
        this.connection.send({
          type: "agent.session.completed",
          sessionId,
          exitCode,
          durationMs,
        });
      }
    );

    this.sessions.on(
      "failed",
      (sessionId: string, error: string, exitCode?: number) => {
        console.error(`Session ${sessionId} failed: ${error}`);
        this.connection.send({
          type: "agent.session.failed",
          sessionId,
          error,
          exitCode,
        });
      }
    );
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  private getHealth(): MachineHealth {
    return collectHealth(
      this.sessions.activeCount,
      this.config.maxConcurrentSessions
    );
  }

  // -----------------------------------------------------------------------
  // Machine info
  // -----------------------------------------------------------------------

  private buildMachineInfo(): MachineInfo {
    return {
      machineUuid: this.config.machineUuid,
      machineName: this.config.machineName,
      platform: process.platform as "darwin" | "win32" | "linux",
      nodeVersion: process.version,
      agentVersion: "0.1.0",
      workspaceRoot: this.config.workspaceRoot,
      maxConcurrentSessions: this.config.maxConcurrentSessions,
    };
  }

  // -----------------------------------------------------------------------
  // Process lifecycle
  // -----------------------------------------------------------------------

  /** Block until a shutdown signal is received (SIGINT, SIGTERM). */
  private waitForShutdown(): Promise<void> {
    return new Promise<void>((resolve) => {
      const onSignal = () => {
        this.shutdown().then(resolve).catch(resolve);
      };

      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);

      // On Windows, handle Ctrl+C via SIGINT (supported in Node.js)
      if (process.platform === "win32") {
        // readline interface keeps the process alive and handles Ctrl+C
        const rl = require("readline").createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.on("close", onSignal);
      }
    });
  }
}
