/**
 * HTTP-based pairing flow.
 *
 * The user generates a 6-character pairing code in the PromptFlow web UI,
 * then runs `promptflow-agent pair <code> --server <url>` on the agent machine.
 * The agent sends the code along with its machine info to the server, which
 * responds with an auth token and machine UUID.
 */

import * as http from "http";
import * as https from "https";
import * as os from "os";
import * as crypto from "crypto";
import { URL } from "url";
import { AgentConfig, saveConfig, loadConfig, expandHome } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PairRequest {
  pairingCode: string;
  machineName: string;
  machineUuid: string;
  platform: string;
  nodeVersion: string;
  agentVersion: string;
  workspaceRoot: string;
  maxConcurrentSessions: number;
}

interface PairResponse {
  success: boolean;
  authToken?: string;
  machineUuid?: string;
  machineName?: string;
  serverVersion?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------

/**
 * Execute the pairing handshake with the PromptFlow server.
 *
 * @param pairingCode   - The 6-character code from the web UI.
 * @param serverHttpUrl - The HTTP base URL (e.g., "http://192.168.2.188:3001").
 * @param overrides     - Optional partial config overrides from CLI flags.
 */
export async function pairWithServer(
  pairingCode: string,
  serverHttpUrl: string,
  overrides: Partial<AgentConfig> = {}
): Promise<void> {
  // Load existing config (for defaults), then apply overrides
  const config = loadConfig(overrides);

  // Generate a machine UUID if we don't have one yet
  const machineUuid = config.machineUuid || crypto.randomUUID();

  // Build the pairing request
  const body: PairRequest = {
    pairingCode: pairingCode.toUpperCase().trim(),
    machineName: config.machineName,
    machineUuid,
    platform: process.platform,
    nodeVersion: process.version,
    agentVersion: "0.1.0",
    workspaceRoot: config.workspaceRoot,
    maxConcurrentSessions: config.maxConcurrentSessions,
  };

  console.log(`Pairing with server at ${serverHttpUrl} ...`);
  console.log(`  Machine name: ${body.machineName}`);
  console.log(`  Machine UUID: ${body.machineUuid}`);
  console.log(`  Platform:     ${body.platform}`);

  // POST to /api/machines/pair
  const response = await httpPost(
    `${serverHttpUrl.replace(/\/$/, "")}/api/machines/pair`,
    body
  );

  if (!response.success) {
    console.error(`\nPairing failed: ${response.error || "Unknown error"}`);
    console.error("Make sure the pairing code is correct and has not expired.");
    process.exit(1);
  }

  // Derive the WebSocket URL from the HTTP URL
  const wsUrl = deriveWsUrl(serverHttpUrl);

  // Save the updated config
  const newConfig: AgentConfig = {
    serverUrl: wsUrl,
    machineName: response.machineName || config.machineName,
    authToken: response.authToken || "",
    machineUuid: response.machineUuid || machineUuid,
    workspaceRoot: config.workspaceRoot,
    maxConcurrentSessions: config.maxConcurrentSessions,
    logLevel: config.logLevel,
  };

  saveConfig(newConfig);

  console.log("\nPairing successful!");
  console.log(`  Auth token saved to config file.`);
  console.log(`  Server version: ${response.serverVersion || "unknown"}`);
  console.log(`\nStart the agent with: promptflow-agent start`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an HTTP URL to its WebSocket counterpart. */
function deriveWsUrl(httpUrl: string): string {
  const url = new URL(httpUrl);
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${url.host}/ws/agent`;
}

/** Simple HTTP POST that returns parsed JSON. */
function httpPost(url: string, body: unknown): Promise<PairResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);
    const transport = parsed.protocol === "https:" ? https : http;

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(data) as PairResponse;
            resolve(json);
          } catch {
            reject(new Error(`Invalid response from server: ${data.slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", (err) => {
      reject(new Error(`Failed to connect to server: ${err.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Connection to server timed out (15s)"));
    });

    req.write(payload);
    req.end();
  });
}
