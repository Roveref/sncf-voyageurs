/**
 * Simple frontend logger with timestamps.
 * Format: [HH:MM:SS] [tag] message
 */

function ts(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export const fLog = (tag: string, ...args: unknown[]) => console.log(`[${ts()}] [${tag}]`, ...args);

export const fWarn = (tag: string, ...args: unknown[]) => console.warn(`[${ts()}] [${tag}]`, ...args);
