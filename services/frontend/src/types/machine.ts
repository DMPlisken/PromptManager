// Machine status
export type MachineStatus = 'online' | 'offline' | 'pairing' | 'error';
export type MachinePlatform = 'darwin' | 'win32' | 'linux';

export interface Machine {
  id: number;
  machine_uuid: string;
  name: string;
  hostname: string | null;
  platform: MachinePlatform | null;
  platform_version: string | null;
  status: MachineStatus;
  agent_version: string | null;
  claude_cli_version: string | null;
  claude_cli_available: boolean;
  workspace_root: string | null;
  max_concurrent_sessions: number;
  last_health: MachineHealth | null;
  ip_address: string | null;
  color: string;
  last_seen_at: string | null;
  registered_at: string;
}

export interface MachineHealth {
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskFreeGb: number;
  activeSessions: number;
  maxSessions?: number;
  uptimeSeconds?: number;
}

export interface PairingCode {
  code: string;
  api_key: string;
  expires_at: string;
  machine_id: number;
}

// Machine store state
export interface MachineState {
  machines: Record<number, Machine>;
  machineOrder: number[];
}

// Machine store actions
export type MachineAction =
  | { type: "MACHINES_LOADED"; machines: Machine[] }
  | { type: "MACHINE_ADDED"; machine: Machine }
  | { type: "MACHINE_UPDATED"; machine: Machine }
  | { type: "MACHINE_REMOVED"; machineId: number }
  | { type: "MACHINE_STATUS_CHANGED"; machineId: number; status: MachineStatus; lastHealth?: MachineHealth | null }
  | { type: "MACHINE_HEALTH_UPDATED"; machineId: number; health: MachineHealth };
