/**
 * JobcodeGanttRow — one opportunity row, visually aligned with the
 * StaffingTab EmployeeRow.
 *
 * Layout mirrors EmployeeRow exactly: a GANTT_LEFT_COL_WIDTH fixed
 * column on the left containing a dense header (chevron + name +
 * account chip + status chip + revenue badge) and a cell-grid strip
 * on the right coloured by the opportunity's lifecycle window.
 */
import { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { CellStrip } from "../../common/Gantt/CellStrip";
import { STATUS_TEXT } from "../../../utils/constants";

const STATUS_COLOR: Record<number, string> = {
  1: "#94a3b8", // Lead
  4: "#94a3b8", // Go
  6: "#f59e0b", // Proposal
  11: "#16a34a", // Won
  13: "#16a34a", // Authorized
  14: "#2563eb", // Booked
  15: "#dc2626", // Lost
};

const STATUS_CHIP_COLOR: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#e2e8f0", fg: "#475569" },
  4: { bg: "#e2e8f0", fg: "#475569" },
  6: { bg: "#fef3c7", fg: "#92400e" },
  11: { bg: "#dcfce7", fg: "#14532d" },
  13: { bg: "#dcfce7", fg: "#14532d" },
  14: { bg: "#dbeafe", fg: "#1e3a8a" },
  15: { bg: "#fee2e2", fg: "#7f1d1d" },
};

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

interface JobcodeGanttRowProps {
  opportunity: OpportunityLike;
  timelineStart: Date | string;
  timelineEnd: Date | string;
  leftColumnWidth: number;
  rowHeight?: number;
  /** Cumulative left-col shrink for nested grouped rows (mirror of staffing's EmployeeRow.leftColShrink). */
  leftColShrink?: number;
  onOpportunityClick?: (opp: OpportunityLike) => void;
}

const TODAY_PADDING_DAYS = 30;

const JobcodeGanttRow = memo(
  ({
    opportunity,
    timelineStart,
    timelineEnd,
    leftColumnWidth,
    rowHeight = 44,
    leftColShrink = 0,
    onOpportunityClick,
  }: JobcodeGanttRowProps) => {
    const [collapsed, setCollapsed] = useState(true);
    const status = opportunity.status ?? 0;
    const chipPalette = STATUS_CHIP_COLOR[status] ?? STATUS_CHIP_COLOR[1];
    const barColor = STATUS_COLOR[status] ?? "#94a3b8";
    const statusLabel = STATUS_TEXT[status] || `Status ${status}`;

    // Resolve start/end timestamps. Both fields are optional — fall back to
    // lastStatusChangeDate, then to a synthetic window so every row renders.
    const parseMs = (v?: string | null): number => {
      if (!v) return NaN;
      const t = new Date(v).getTime();
      return Number.isFinite(t) ? t : NaN;
    };
    const creationMs = parseMs(opportunity.creationDate);
    const bookingMs = parseMs(opportunity.bookingDate);
    const statusChangeMs = parseMs(opportunity.lastStatusChangeDate as string | undefined);
    const todayMs = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();

    let startMs = creationMs;
    let endMs = bookingMs;

    if (!Number.isFinite(startMs)) {
      // No creation date — fall back to status-change date, then to a 30-day
      // window before the end so the row still draws something readable.
      if (Number.isFinite(statusChangeMs)) startMs = statusChangeMs;
      else if (Number.isFinite(endMs)) startMs = endMs - TODAY_PADDING_DAYS * 86_400_000;
    }
    if (!Number.isFinite(endMs)) {
      endMs = Number.isFinite(statusChangeMs)
        ? Math.max(statusChangeMs, todayMs + TODAY_PADDING_DAYS * 86_400_000)
        : todayMs + TODAY_PADDING_DAYS * 86_400_000;
    }
    // Swap if the data is inverted (defensive — shouldn't happen, but cheap).
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > endMs) {
      const tmp = startMs;
      startMs = endMs;
      endMs = tmp;
    }

    // Compute exact left/width percentages from the day boundaries — the bar
    // is an absolute overlay over a blank CellStrip background.
    const barPosition = useMemo(() => {
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
      const tlStart = new Date(timelineStart).getTime();
      const tlEnd = new Date(timelineEnd).getTime();
      if (!Number.isFinite(tlStart) || !Number.isFinite(tlEnd) || tlEnd <= tlStart) return null;
      // Reject only if the segment is fully outside the visible window.
      if (endMs < tlStart || startMs > tlEnd) return null;
      const span = tlEnd - tlStart;
      const left = ((Math.max(startMs, tlStart) - tlStart) / span) * 100;
      const right = ((Math.min(endMs, tlEnd) - tlStart) / span) * 100;
      const width = Math.max(0, right - left);
      return { left, width };
    }, [startMs, endMs, timelineStart, timelineEnd]);

    const barTooltip = `${fmtDate(opportunity.creationDate)} → ${opportunity.bookingDate ? fmtDate(opportunity.bookingDate) : "aujourd'hui"}\n${opportunity.opportunity || ""} · ${statusLabel}`;

    const ChevronIcon = collapsed ? ChevronRightIcon : ExpandMoreIcon;

    const effectiveLeftCol = leftColumnWidth - leftColShrink;

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          minHeight: rowHeight,
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: "background.paper",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          animation: "fadeInUp 0.3s ease both",
          "@keyframes fadeInUp": {
            from: { opacity: 0, transform: "translateY(8px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
          transition: "background-color 0.3s ease, box-shadow 0.3s ease",
          "&:hover": { bgcolor: "action.hover" },
          contentVisibility: "auto",
          containIntrinsicBlockSize: "auto 52px",
        }}
      >
        {/* ── Left label column — mirrors EmployeeRowHeader (employeeRowStyles.ts) ── */}
        <Box
          sx={{
            width: effectiveLeftCol,
            minWidth: effectiveLeftCol,
            flexShrink: 0,
            px: 1.5,
            py: 1,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            overflow: "hidden",
          }}
          onClick={() => {
            setCollapsed((c) => !c);
            onOpportunityClick?.(opportunity);
          }}
          style={{ cursor: "pointer" }}
        >
          <ChevronIcon sx={{ height: 12, width: 12, color: "text.disabled", flexShrink: 0 }} />
          {opportunity.opportunityId && (
            <Typography
              component="span"
              sx={{
                fontSize: "0.6rem",
                fontWeight: 600,
                color: "text.secondary",
                fontVariantNumeric: "tabular-nums",
                bgcolor: "grey.100",
                px: 0.5,
                py: 0.125,
                borderRadius: 0.5,
                flexShrink: 0,
                lineHeight: 1.4,
              }}
              title={opportunity.opportunityId}
            >
              {opportunity.opportunityId}
            </Typography>
          )}
          <Typography
            component="span"
            sx={{
              fontWeight: 400,
              fontSize: "0.875rem",
              color: "text.primary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: 1,
              minWidth: 0,
            }}
            title={opportunity.opportunity || ""}
          >
            {opportunity.opportunity || "—"}
          </Typography>
          {opportunity.account && (
            <Chip
              label={opportunity.account}
              size="small"
              title={opportunity.account}
              sx={{
                height: 18,
                fontSize: "0.6rem",
                fontWeight: 500,
                bgcolor: "grey.100",
                color: "text.secondary",
                border: "none",
                "& .MuiChip-label": { px: 0.5, textOverflow: "ellipsis", overflow: "hidden", maxWidth: 120 },
                flexShrink: 1,
                minWidth: 0,
              }}
            />
          )}
          <Box sx={{ flex: 1 }} />
          <Typography
            component="span"
            sx={{
              fontSize: "0.875rem",
              fontWeight: 400,
              color: "text.primary",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {formatRevenue(opportunity.grossRevenue)}
          </Typography>
          <Chip
            label={statusLabel}
            size="small"
            sx={{
              height: 18,
              fontSize: "0.6rem",
              fontWeight: 700,
              bgcolor: chipPalette.bg,
              color: chipPalette.fg,
              border: "none",
              "& .MuiChip-label": { px: 0.5 },
              flexShrink: 0,
            }}
          />
        </Box>

        {/* ── Right cell-grid strip with absolute bar overlay ── */}
        <Box sx={{ flex: 1, minWidth: 0, pr: 1.5, py: 0.25, position: "relative" }}>
          <CellStrip timelineStart={timelineStart} timelineEnd={timelineEnd} getCellFill={() => null} height={16} />
          {barPosition && (
            <Tooltip title={barTooltip} arrow placement="top" disableInteractive>
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  left: `calc(${barPosition.left}% + 0px)`,
                  width: `max(3px, ${barPosition.width}%)`,
                  height: 16,
                  bgcolor: barColor,
                  borderRadius: "4px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                  pointerEvents: "auto",
                  cursor: "pointer",
                  transition: "filter 120ms ease",
                  "&:hover": { filter: "brightness(1.1)" },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpportunityClick?.(opportunity);
                }}
              />
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  }
);
JobcodeGanttRow.displayName = "JobcodeGanttRow";

export { JobcodeGanttRow };
