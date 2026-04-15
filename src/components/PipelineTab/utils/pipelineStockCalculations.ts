import { calculateRevenueWithSegmentLogic } from "../../../utils/dataUtils";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(raw: any): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

function isExited(opp: Record<string, any>): boolean {
  const status = Number(opp.status);
  return status === 14 || status === 15;
}

function getExitDate(opp: Record<string, any>): Date | null {
  if (!isExited(opp)) return null;
  return parseDate(opp.bookingDate) || null;
}

/**
 * Pure function: compute pipeline stock data (entries, exits, stock) per month per year.
 * Must be wrapped in useMemo.
 */
export function computePipelineStock(
  allOpps: any[],
  showNetRevenue: boolean,
  minYear?: number | null
): { years: number[]; monthlyData: Record<string, any>[] } {
  if (!allOpps || allOpps.length === 0) return { years: [], monthlyData: [] };

  const getRevenue = (opp: any) => (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0);
  const getAllocatedRevenue = (opp: any) =>
    opp.isAllocated
      ? showNetRevenue
        ? opp.allocatedNetRevenue || 0
        : opp.allocatedGrossRevenue || 0
      : getRevenue(opp);
  const getIO = (opp: any) => calculateRevenueWithSegmentLogic(opp, showNetRevenue);

  // Gather all years from creation dates and exit dates
  const yearSet = new Set<number>();
  const oppsWithDates: {
    opp: any;
    creationDate: Date | null;
    exitDate: Date | null;
    hasExited: boolean;
    exitStatus: number | null;
  }[] = [];

  for (const opp of allOpps) {
    const status = Number(opp.status);
    // Only consider pipeline-relevant statuses: 1-11 (active) and 14-15 (exited)
    if (!(status >= 1 && status <= 11) && status !== 14 && status !== 15) continue;
    const cd = parseDate(opp.creationDate);
    const hasEx = isExited(opp);
    const exitDate = getExitDate(opp);
    const exitStatus = hasEx ? status : null;
    if (cd) yearSet.add(cd.getFullYear());
    if (exitDate) yearSet.add(exitDate.getFullYear());
    oppsWithDates.push({ opp, creationDate: cd, exitDate, hasExited: hasEx, exitStatus });
  }

  const years = [...yearSet].filter((y) => y >= (minYear ?? 2022)).sort((a, b) => a - b);
  if (years.length === 0) return { years: [], monthlyData: [] };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Build 12-month array
  const monthlyData: Record<string, any>[] = MONTH_NAMES.map((name, i) => ({
    month: i,
    monthName: name,
  }));

  for (const year of years) {
    // Per-month accumulators
    const entries: any[][] = Array.from({ length: 12 }, () => []);
    const exits: any[][] = Array.from({ length: 12 }, () => []);
    const exitsBooked: any[][] = Array.from({ length: 12 }, () => []);
    const exitsLost: any[][] = Array.from({ length: 12 }, () => []);

    for (const { opp, creationDate, exitDate, exitStatus } of oppsWithDates) {
      // Entries (only opps with a creation date)
      if (creationDate && creationDate.getFullYear() === year) {
        entries[creationDate.getMonth()].push(opp);
      }
      // Exits
      if (exitDate && exitDate.getFullYear() === year) {
        exits[exitDate.getMonth()].push(opp);
        if (exitStatus === 14) exitsBooked[exitDate.getMonth()].push(opp);
        if (exitStatus === 15) exitsLost[exitDate.getMonth()].push(opp);
      }
    }

    for (let m = 0; m < 12; m++) {
      // Skip future months for current year
      if (year === currentYear && m > currentMonth) continue;

      // For current month of current year, use today as cutoff instead of end of month
      const eom = year === currentYear && m === currentMonth ? now : lastDayOfMonth(year, m);

      // Entries
      const entryRevenue = entries[m].reduce((s, o) => s + getRevenue(o), 0);
      const entryAllocated = entries[m].reduce((s, o) => s + getAllocatedRevenue(o), 0);
      const entryIO = entries[m].reduce((s, o) => s + getIO(o), 0);

      // Exits
      const exitRevenue = exits[m].reduce((s, o) => s + getRevenue(o), 0);
      const exitAllocated = exits[m].reduce((s, o) => s + getAllocatedRevenue(o), 0);
      const exitIO = exits[m].reduce((s, o) => s + getIO(o), 0);
      const exitBookedRevenue = exitsBooked[m].reduce((s, o) => s + getRevenue(o), 0);
      const exitLostRevenue = exitsLost[m].reduce((s, o) => s + getRevenue(o), 0);

      // Stock at end of month: created before or during this month AND not yet exited
      const stockOpps = oppsWithDates.filter(({ creationDate, exitDate, hasExited }) => {
        const entered = !creationDate || (creationDate <= eom && creationDate.getFullYear() <= year);
        const stillIn = !hasExited || exitDate == null || exitDate > eom;
        return entered && stillIn;
      });
      const stockRevenue = stockOpps.reduce((s, { opp }) => s + getRevenue(opp), 0);
      const stockAllocated = stockOpps.reduce((s, { opp }) => s + getAllocatedRevenue(opp), 0);
      const stockIO = stockOpps.reduce((s, { opp }) => s + getIO(opp), 0);

      // Detect if allocation differs from total (= service line filter is active)
      const hasAllocation = Math.abs(stockRevenue - stockAllocated) > 1 || Math.abs(entryRevenue - entryAllocated) > 1;

      const md = monthlyData[m];
      md[`${year}_entries`] = entryRevenue;
      md[`${year}_entries_allocated`] = entryAllocated;
      md[`${year}_entries_io`] = entryIO;
      md[`${year}_entries_count`] = entries[m].length;
      md[`${year}EntryOpps`] = entries[m];

      md[`${year}_exits`] = exitRevenue;
      md[`${year}_exits_allocated`] = exitAllocated;
      md[`${year}_exits_io`] = exitIO;
      md[`${year}_exits_count`] = exits[m].length;
      md[`${year}_exits_booked`] = exitBookedRevenue;
      md[`${year}_exits_lost`] = exitLostRevenue;
      md[`${year}ExitOpps`] = exits[m];

      md[`${year}_stock`] = stockRevenue;
      md[`${year}_stock_allocated`] = stockAllocated;
      md[`${year}_stock_io`] = stockIO;
      md[`${year}_stock_count`] = stockOpps.length;
      md[`${year}StockOpps`] = stockOpps.map(({ opp }) => opp);
      md[`${year}_has_allocation`] = hasAllocation;
    }
  }

  return { years, monthlyData };
}
