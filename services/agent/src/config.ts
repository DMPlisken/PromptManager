/**
 * Configuration loading for the PromptFlow agent.
 *
 * Priority (highest wins): CLI args > environment variables > config file > defaults.
 * Config file location: ~/.promptflow/agent.yaml
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentConfig {
  serverUrl: string;
  machineName: string;
  authToken: string;
  machineUuid: string;
  workspaceRoot: string;
  maxConcurrentSessions: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Expand ~ to the user home directory (works on Mac, Linux, and Windows). */
export function expandHome(p: string): string {
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/** Return the default config directory: ~/.promptflow */
export function getConfigDir(): string {
  return path.join(os.homedir(), ".promptflow");
}

/** Return the default config file path: ~/.promptflow/agent.yaml */
export function getConfigPath(): string {
  return path.join(getConfigDir(), "agent.yaml");
}

/** Generate a default machine name from the OS hostname. */
function defaultMachineName(): string {
  const hostname = os.hostname();
  // Strip .local suffix common on macOS
  return hostname.replace(/\.local$/i, "");
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS: AgentConfig = {
  serverUrl: "",
  machineName: defaultMachineName(),
  authToken: "",
  machineUuid: "",
  workspaceRoot: expandHome("~/projects"),
  maxConcurrentSessions: 3,
  logLevel: "info",
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load configuration by merging defaults, config file, env vars, and CLI overrides.
 *
 * @param cliOverrides - Partial config values supplied via CLI flags.
 */
export function loadConfig(cliOverrides: Partial<AgentConfig> = {}): AgentConfig {
  // 1. Start with defaults
  const config: AgentConfig = { ...DEFAULTS };

  // 2. Merge config file (if it exists)
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = yaml.parse(raw) as Record<string, unknown> | null;
      if (parsed && typeof parsed === "object") {
        mergeFromYaml(config, parsed);
      }
    } catch (err) {
      // Log but don't crash — config file may be malformed during first setup
      console.warn(`Warning: failed to parse config file ${configPath}: ${err}`);
    }
  }

  // 3. Merge environment variables (PROMPTFLOW_AGENT_*)
  mergeFromEnv(config);

  // 4. Merge CLI overrides (highest priority)
  for (const [key, value] of Object.entries(cliOverrides)) {
    if (value !== undefined && value !== null && value !== "") {
      (config as unknown as Record<string, unknown>)[key] = value;
    }
  }

  // 5. Expand ~ in paths
  config.workspaceRoot = expandHome(config.workspaceRoot);

  return config;
}

// ---------------------------------------------------------------------------
// YAML merge
// ---------------------------------------------------------------------------

function mergeFromYaml(config: AgentConfig, parsed: Record<string, unknown>): void {
  const map: Record<string, keyof AgentConfig> = {
    server_url: "serverUrl",
    machine_name: "machineName",
    auth_token: "authToken",
    machine_uuid: "machineUuid",
    workspace_root: "workspaceRoot",
    max_concurrent_sessions: "maxConcurrentSessions",
    log_level: "logLevel",
  };

  for (const [yamlKey, configKey] of Object.entries(map)) {
    const val = parsed[yamlKey];
    if (val !== undefined && val !== null && val !== "") {
      (config as unknown as Record<string, unknown>)[configKey] = val;
    }
  }
}

// ---------------------------------------------------------------------------
// Environment variable merge
// ---------------------------------------------------------------------------

function mergeFromEnv(config: AgentConfig): void {
  const map: Record<string, keyof AgentConfig> = {
    PROMPTFLOW_AGENT_SERVER_URL: "serverUrl",
    PROMPTFLOW_AGENT_MACHINE_NAME: "machineName",
    PROMPTFLOW_AGENT_AUTH_TOKEN: "authToken",
    PROMPTFLOW_AGENT_MACHINE_UUID: "machineUuid",
    PROMPTFLOW_AGENT_WORKSPACE_ROOT: "workspaceRoot",
    PROMPTFLOW_AGENT_MAX_CONCURRENT_SESSIONS: "maxConcurrentSessions",
    PROMPTFLOW_AGENT_LOG_LEVEL: "logLevel",
  };

  for (const [envKey, configKey] of Object.entries(map)) {
    const val = process.env[envKey];
    if (val !== undefined && val !== "") {
      if (configKey === "maxConcurrentSessions") {
        const num = parseInt(val, 10);
        if (!isNaN(num)) {
          config.maxConcurrentSessions = num;
        }
      } else {
        (config as unknown as Record<string, unknown>)[configKey] = val;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Config persistence (used during pairing)
// ---------------------------------------------------------------------------

/**
 * Save the config to ~/.promptflow/agent.yaml.
 * Creates the directory if it does not exist.
 */
export function saveConfig(config: AgentConfig): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const doc: Record<string, unknown> = {
    server_url: config.serverUrl,
    machine_name: config.machineName,
    auth_token: config.authToken,
    machine_uuid: config.machineUuid,
    workspace_root: config.workspaceRoot,
    max_concurrent_sessions: config.maxConcurrentSessions,
    log_level: config.logLevel,
  };

  const content =
    "# PromptFlow Agent Configuration\n" +
    "# Generated by: promptflow-agent pair\n\n" +
    yaml.stringify(doc);

  fs.writeFileSync(getConfigPath(), content, "utf-8");
}
