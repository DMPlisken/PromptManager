#!/usr/bin/env node

/**
 * CLI entry point for the PromptFlow agent.
 *
 * Commands:
 *   promptflow-agent pair <code> --server <url>  — Pair with a PromptFlow server
 *   promptflow-agent start                       — Start the agent (foreground)
 *   promptflow-agent status                      — Show current status
 *   promptflow-agent config                      — Show current configuration
 */

import { Command } from "commander";
import { loadConfig, getConfigPath, AgentConfig } from "./config";
import { Agent } from "./agent";
import { pairWithServer } from "./pairing";
import { collectHealth } from "./health";

const program = new Command();

program
  .name("promptflow-agent")
  .description("PromptFlow remote agent for Claude Code CLI orchestration")
  .version("0.1.0");

// ---------------------------------------------------------------------------
// pair
// ---------------------------------------------------------------------------

program
  .command("pair <code>")
  .description("Pair this machine with a PromptFlow server using a 6-char code")
  .requiredOption("-s, --server <url>", "Server HTTP URL (e.g., http://192.168.2.188:3001)")
  .option("-n, --name <name>", "Machine name (default: hostname)")
  .option("-w, --workspace <path>", "Workspace root directory")
  .option("-m, --max-sessions <n>", "Max concurrent sessions", parseInt)
  .action(async (code: string, opts: {
    server: string;
    name?: string;
    workspace?: string;
    maxSessions?: number;
  }) => {
    const overrides: Partial<AgentConfig> = {};
    if (opts.name) overrides.machineName = opts.name;
    if (opts.workspace) overrides.workspaceRoot = opts.workspace;
    if (opts.maxSessions) overrides.maxConcurrentSessions = opts.maxSessions;

    try {
      await pairWithServer(code, opts.server, overrides);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\nPairing failed: ${msg}`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

program
  .command("start")
  .description("Start the agent (runs in foreground)")
  .option("-s, --server <url>", "Override server WebSocket URL")
  .option("-l, --log-level <level>", "Log level (debug, info, warn, error)")
  .action(async (opts: { server?: string; logLevel?: string }) => {
    const overrides: Partial<AgentConfig> = {};
    if (opts.server) overrides.serverUrl = opts.server;
    if (opts.logLevel) overrides.logLevel = opts.logLevel as AgentConfig["logLevel"];

    const config = loadConfig(overrides);
    const agent = new Agent(config);

    try {
      await agent.start();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Agent error: ${msg}`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

program
  .command("status")
  .description("Show agent status and system health")
  .action(() => {
    const config = loadConfig();
    const health = collectHealth(0, config.maxConcurrentSessions);

    console.log("PromptFlow Agent Status");
    console.log("=======================");
    console.log("");
    console.log("Configuration:");
    console.log(`  Config file:    ${getConfigPath()}`);
    console.log(`  Server URL:     ${config.serverUrl || "(not configured)"}`);
    console.log(`  Machine name:   ${config.machineName}`);
    console.log(`  Machine UUID:   ${config.machineUuid || "(not paired)"}`);
    console.log(`  Auth token:     ${config.authToken ? "(set)" : "(not set)"}`);
    console.log(`  Workspace:      ${config.workspaceRoot}`);
    console.log(`  Max sessions:   ${config.maxConcurrentSessions}`);
    console.log(`  Log level:      ${config.logLevel}`);
    console.log("");
    console.log("System Health:");
    console.log(`  CPU usage:      ${health.cpuPercent}%`);
    console.log(`  Memory:         ${health.memoryUsedMb}MB / ${health.memoryTotalMb}MB (${health.memoryPercent}%)`);
    console.log(`  Disk free:      ${health.diskFreeGb >= 0 ? health.diskFreeGb + " GB" : "unknown"}`);
    console.log(`  Platform:       ${process.platform}`);
    console.log(`  Node.js:        ${process.version}`);

    // Check if Claude CLI is available
    try {
      const { execSync } = require("child_process");
      const version = execSync("claude --version", {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      console.log(`  Claude CLI:     ${version}`);
    } catch {
      console.log("  Claude CLI:     NOT FOUND (ensure 'claude' is in PATH)");
    }
  });

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

program
  .command("config")
  .description("Show current configuration")
  .option("--path", "Show only the config file path")
  .action((opts: { path?: boolean }) => {
    if (opts.path) {
      console.log(getConfigPath());
      return;
    }

    const config = loadConfig();
    const configPath = getConfigPath();

    console.log(`Config file: ${configPath}`);
    console.log("");
    console.log(JSON.stringify(config, null, 2));
  });

// ---------------------------------------------------------------------------
// Parse and run
// ---------------------------------------------------------------------------

program.parse(process.argv);

// Show help if no command was given
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
