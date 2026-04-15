/**
 * Structured logger with timestamps and log levels.
 * Format: [HH:MM:SS] [tag] message        (INFO — default, no level shown)
 * Format: [HH:MM:SS] [WARN] [tag] message (WARN/ERROR/DEBUG — level shown)
 *
 * Levels: INFO (default), WARN, ERROR, DEBUG
 * DEBUG output is suppressed unless LOG_LEVEL=debug env var is set.
 */

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

const debugEnabled = (process.env.LOG_LEVEL || "").toLowerCase() === "debug";

// ANSI colors (disabled if NO_COLOR is set)
const nc = !!process.env.NO_COLOR;
const c = {
  dim: nc ? "" : "\x1b[2m",
  reset: nc ? "" : "\x1b[0m",
  green: nc ? "" : "\x1b[32m",
  yellow: nc ? "" : "\x1b[33m",
  red: nc ? "" : "\x1b[31m",
  cyan: nc ? "" : "\x1b[36m",
  bold: nc ? "" : "\x1b[1m",
};

function ts(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function fmt(level: LogLevel, tag: string): string {
  const t = `${c.dim}${ts()}${c.reset}`;
  const tagStr = `${c.cyan}${tag}${c.reset}`;
  if (level === "INFO") return `${t} ${tagStr}`;
  const levelColor = level === "WARN" ? c.yellow : level === "ERROR" ? c.red : c.dim;
  return `${t} ${levelColor}${level}${c.reset} ${tagStr}`;
}

export const log = (tag: string, ...args: unknown[]) => console.log(fmt("INFO", tag), ...args);

export const warn = (tag: string, ...args: unknown[]) => console.warn(fmt("WARN", tag), ...args);

export const error = (tag: string, ...args: unknown[]) => console.error(fmt("ERROR", tag), ...args);

export const debug = (tag: string, ...args: unknown[]) => {
  if (debugEnabled) console.debug(fmt("DEBUG", tag), ...args);
};

/** Print a blank line separator */
export const sep = () => console.log();
