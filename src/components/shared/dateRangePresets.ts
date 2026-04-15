import type { PresetGroup, PresetItem } from "./DateRangeFilter";

// ─── Shared resolve helpers ──────────────────────────────────────────────────

function resolveRecentDays(presetId: string, today: Date): { startDate: Date; endDate: Date } | null {
  const recentDays: Record<string, number> = { "7J": 7, "30J": 30, "90J": 90 };
  if (recentDays[presetId] === undefined) return null;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - recentDays[presetId]);
  return { startDate, endDate: today };
}

function resolveWeekStart(today: Date): Date {
  const dow = today.getDay();
  const diff = dow === 0 ? 6 : dow - 1;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - diff);
  return startDate;
}

// ─── Pipeline presets ────────────────────────────────────────────────────────

export const PIPELINE_PRESETS: PresetGroup[] = [
  {
    items: [
      { id: "7J", label: "7 days", days: 7 },
      { id: "30J", label: "30 days", days: 30 },
      { id: "90J", label: "90 days", days: 90 },
    ],
  },
  {
    items: [
      { id: "WTD", label: "Week", type: "week" },
      { id: "MTD", label: "Month", type: "month" },
      { id: "YTD", label: "Year", type: "year" },
    ],
  },
];

export function resolvePipelinePreset(presetId: string): { startDate: Date; endDate: Date } | null {
  const today = new Date();
  const recent = resolveRecentDays(presetId, today);
  if (recent) return recent;

  let startDate: Date | undefined;
  if (presetId === "WTD") startDate = resolveWeekStart(today);
  else if (presetId === "MTD") startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  else if (presetId === "YTD") startDate = new Date(today.getFullYear(), 0, 1);

  return startDate ? { startDate, endDate: today } : null;
}

// ─── Bookings presets ────────────────────────────────────────────────────────

export const BOOKINGS_PRESETS: PresetGroup[] = [
  {
    items: [
      { id: "7J", label: "7 days", days: 7 },
      { id: "30J", label: "30 days", days: 30 },
      { id: "90J", label: "90 days", days: 90 },
    ],
  },
  {
    items: [
      { id: "WTD", label: "Week", type: "week" },
      { id: "MTD", label: "Month", type: "month" },
      { id: "LY", label: "Last Year", type: "lastYear" },
    ],
  },
];

export function resolveBookingsPreset(presetId: string): { startDate: Date; endDate: Date } | null {
  const today = new Date();
  const recent = resolveRecentDays(presetId, today);
  if (recent) return recent;

  let startDate: Date | undefined;
  let endDate: Date = today;
  if (presetId === "WTD") startDate = resolveWeekStart(today);
  else if (presetId === "MTD") startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  else if (presetId === "LY") {
    startDate = new Date(today.getFullYear() - 1, 0, 1);
    endDate = new Date(today.getFullYear() - 1, 11, 31);
  }

  return startDate ? { startDate, endDate } : null;
}

export function matchBookingsPreset(
  preset: PresetItem,
  normalizedStart: Date,
  normalizedEnd: Date,
  normalizedToday: Date
): boolean {
  const today = normalizedToday;

  if (preset.type === "lastYear") {
    const lyStart = new Date(today.getFullYear() - 1, 0, 1);
    lyStart.setHours(0, 0, 0, 0);
    const lyEnd = new Date(today.getFullYear() - 1, 11, 31);
    lyEnd.setHours(0, 0, 0, 0);
    return normalizedStart.getTime() === lyStart.getTime() && normalizedEnd.getTime() === lyEnd.getTime();
  }

  if (normalizedEnd.getTime() !== today.getTime()) return false;

  let expectedStart: Date | undefined;
  if (preset.days !== undefined) {
    expectedStart = new Date(today);
    expectedStart.setDate(today.getDate() - preset.days);
  } else if (preset.type === "week") {
    expectedStart = resolveWeekStart(today);
  } else if (preset.type === "month") {
    expectedStart = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  if (!expectedStart) return false;
  expectedStart.setHours(0, 0, 0, 0);
  return normalizedStart.getTime() === expectedStart.getTime();
}
