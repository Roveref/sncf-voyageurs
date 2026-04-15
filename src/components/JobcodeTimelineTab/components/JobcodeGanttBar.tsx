/**
 * JobcodeGanttBar — opportunity → Gantt bar mapper.
 *
 * Wraps the generic GanttBar primitive, mapping an opportunity to:
 *   - bar geometry (creationDate → bookingDate ?? today + 30d)
 *   - status colour
 *   - rich tooltip (name, account, dates, revenue, status)
 *   - event markers (creation, status change, win, loss)
 *
 * Status colour map matches the existing dashboard semantics:
 *   Proposal (6): amber, Won (11/13): green, Booked (14): blue,
 *   Lost (15): red, Lead/Go (1/4): slate.
 */
import { memo, useMemo } from "react";
import { GanttBar, type GanttBarEvent } from "../../common/Gantt/GanttBar";
import { calculateBarPosition } from "../../../utils/timelineUtils";
import { STATUS_TEXT } from "../../../utils/constants";

const STATUS_COLOR: Record<number, string> = {
  1: "#64748b", // Lead
  4: "#64748b", // Go
  6: "#f59e0b", // Proposal
  11: "#16a34a", // Won
  13: "#16a34a", // Authorized engagement
  14: "#2563eb", // Booked
  15: "#dc2626", // Lost
};

const TODAY_PADDING_DAYS = 30;

const formatRevenue = (n?: number): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`;
  return `${Math.round(n)}€`;
};

const fmtDate = (d?: string | Date | null): string => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

interface OpportunityLike {
  opportunityId?: string;
  opportunity?: string;
  account?: string;
  status?: number;
  grossRevenue?: number;
  netRevenue?: number;
  creationDate?: string;
  bookingDate?: string;
  lastStatusChangeDate?: string;
  [key: string]: unknown;
}

interface JobcodeGanttBarProps {
  opportunity: OpportunityLike;
  timelineStart: Date | string;
  timelineEnd: Date | string;
  height?: number;
  onClick?: (opp: OpportunityLike) => void;
}

const JobcodeGanttBar = memo(
  ({ opportunity, timelineStart, timelineEnd, height = 16, onClick }: JobcodeGanttBarProps) => {
    const { left, width, color, tooltip, events } = useMemo(() => {
      const status = opportunity.status ?? 0;
      const barColor = STATUS_COLOR[status] ?? "#64748b";

      // Compute end date — booking date if known, else today + padding for open opportunities
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const padded = new Date(today.getTime() + TODAY_PADDING_DAYS * 86_400_000);
      const endRaw = opportunity.bookingDate || padded.toISOString().slice(0, 10);

      const startRaw = opportunity.creationDate;
      if (!startRaw) {
        return { left: 0, width: 0, color: barColor, tooltip: "", events: [] as GanttBarEvent[] };
      }

      const pos = calculateBarPosition(startRaw, endRaw, timelineStart, timelineEnd);

      // Build the tooltip — multi-line so it breaks naturally in MUI Tooltip.
      const tip = [
        opportunity.opportunity || "Opportunité",
        opportunity.account ? `Compte : ${opportunity.account}` : null,
        `Statut : ${STATUS_TEXT[status] || `Status ${status}`}`,
        `Revenu : ${formatRevenue(opportunity.grossRevenue)}`,
        `Création : ${fmtDate(opportunity.creationDate)}`,
        opportunity.bookingDate ? `Booking : ${fmtDate(opportunity.bookingDate)}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      // Build event markers — creation, optional status change, win/loss
      const ev: GanttBarEvent[] = [];
      const addEvent = (date: string | undefined, label: string, evColor?: string, shape?: GanttBarEvent["shape"]) => {
        if (!date) return;
        const evPos = calculateBarPosition(date, date, timelineStart, timelineEnd);
        ev.push({ leftPct: evPos.left, label, color: evColor, shape });
      };

      addEvent(opportunity.creationDate, `Création — ${fmtDate(opportunity.creationDate)}`, "#94a3b8", "circle");
      if (opportunity.lastStatusChangeDate && opportunity.lastStatusChangeDate !== opportunity.creationDate) {
        addEvent(
          opportunity.lastStatusChangeDate,
          `Changement de statut — ${fmtDate(opportunity.lastStatusChangeDate)}`,
          "#cbd5e1",
          "circle"
        );
      }
      if (status === 14 && opportunity.bookingDate) {
        addEvent(opportunity.bookingDate, `Booking — ${fmtDate(opportunity.bookingDate)}`, "#2563eb", "diamond");
      } else if (status === 11 && opportunity.bookingDate) {
        addEvent(opportunity.bookingDate, `Won — ${fmtDate(opportunity.bookingDate)}`, "#16a34a", "diamond");
      } else if (status === 15 && opportunity.bookingDate) {
        addEvent(opportunity.bookingDate, `Lost — ${fmtDate(opportunity.bookingDate)}`, "#dc2626", "diamond");
      }

      return { left: pos.left, width: pos.width, color: barColor, tooltip: tip, events: ev };
    }, [opportunity, timelineStart, timelineEnd]);

    if (width <= 0) return null;

    return (
      <GanttBar
        left={left}
        width={width}
        color={color}
        tooltip={tooltip}
        events={events}
        height={height}
        onClick={onClick ? () => onClick(opportunity) : undefined}
      />
    );
  }
);
JobcodeGanttBar.displayName = "JobcodeGanttBar";

export { JobcodeGanttBar };
