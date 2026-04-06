/**
 * System health reporter.
 *
 * Collects CPU, memory, and disk metrics using Node.js built-in modules.
 * Handles cross-platform differences between macOS, Linux, and Windows.
 */

import * as os from "os";
import { execSync } from "child_process";
import type { MachineHealth } from "./protocol";

// ---------------------------------------------------------------------------
// CPU utilization
// ---------------------------------------------------------------------------

/**
 * Get CPU usage as a percentage (0-100).
 *
 * - macOS / Linux: use os.loadavg()[0] normalized to number of cores.
 * - Windows: sample os.cpus() twice with a short delay (synchronous fallback
 *   uses a simpler single-sample heuristic based on idle time proportion).
 */
function getCpuPercent(): number {
  if (process.platform === "win32") {
    return getCpuPercentWindows();
  }

  // macOS / Linux: 1-minute load average normalized to core count
  const loadAvg = os.loadavg()[0];
  const cores = os.cpus().length || 1;
  const percent = (loadAvg / cores) * 100;
  return Math.min(Math.round(percent * 10) / 10, 100);
}

/**
 * Windows CPU usage estimate.
 * Uses a snapshot of all CPU cores idle vs. total time.
 */
function getCpuPercentWindows(): number {
  const cpus = os.cpus();
  if (cpus.length === 0) return 0;

  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    const { user, nice, sys, idle, irq } = cpu.times;
    totalIdle += idle;
    totalTick += user + nice + sys + idle + irq;
  }

  if (totalTick === 0) return 0;
  const percent = ((totalTick - totalIdle) / totalTick) * 100;
  return Math.round(percent * 10) / 10;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

function getMemoryInfo(): { percent: number; usedMb: number; totalMb: number } {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  return {
    percent: Math.round((usedBytes / totalBytes) * 1000) / 10,
    usedMb: Math.round(usedBytes / (1024 * 1024)),
    totalMb: Math.round(totalBytes / (1024 * 1024)),
  };
}

// ---------------------------------------------------------------------------
// Disk free space
// ---------------------------------------------------------------------------

/**
 * Get free disk space in GB for the root/system drive.
 *
 * - macOS / Linux: parse `df -k /`
 * - Windows: parse `wmic logicaldisk where DeviceID='C:' get FreeSpace`
 *
 * Returns -1 if the information cannot be determined.
 */
function getDiskFreeGb(): number {
  try {
    if (process.platform === "win32") {
      return getDiskFreeWindows();
    }
    return getDiskFreeUnix();
  } catch {
    return -1;
  }
}

function getDiskFreeUnix(): number {
  // df -k / outputs kilobytes; second line has the data
  const output = execSync("df -k /", { encoding: "utf-8", timeout: 5000 });
  const lines = output.trim().split("\n");
  if (lines.length < 2) return -1;

  // Fields: Filesystem 1K-blocks Used Available Use% Mounted
  const parts = lines[1].split(/\s+/);
  // Available is index 3
  const availKb = parseInt(parts[3], 10);
  if (isNaN(availKb)) return -1;

  return Math.round((availKb / (1024 * 1024)) * 10) / 10;
}

function getDiskFreeWindows(): number {
  const output = execSync(
    'wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace /value',
    { encoding: "utf-8", timeout: 5000 }
  );
  // Output: FreeSpace=123456789
  const match = output.match(/FreeSpace=(\d+)/);
  if (!match) return -1;

  const freeBytes = parseInt(match[1], 10);
  if (isNaN(freeBytes)) return -1;

  return Math.round((freeBytes / (1024 * 1024 * 1024)) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Collect a full health snapshot.
 *
 * @param activeSessions - Number of currently running Claude CLI sessions.
 * @param maxSessions    - Maximum concurrent sessions allowed by config.
 */
export function collectHealth(activeSessions: number, maxSessions: number): MachineHealth {
  const mem = getMemoryInfo();

  return {
    cpuPercent: getCpuPercent(),
    memoryPercent: mem.percent,
    memoryUsedMb: mem.usedMb,
    memoryTotalMb: mem.totalMb,
    diskFreeGb: getDiskFreeGb(),
    activeSessions,
    maxSessions,
  };
}
