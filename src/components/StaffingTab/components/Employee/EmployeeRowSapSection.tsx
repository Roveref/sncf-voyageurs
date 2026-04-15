import React, { memo, useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  GANTT_LEFT_COL_WIDTH,
  HOURS_PER_DAY,
  CHARGEABLE_CATS,
  GO_CATS,
  ABSENCE_CATS,
  TRAINING_CATS,
} from "../../constants";
import { CATEGORY_THEME } from "../../constants/theme";
import { UtilizationChart } from "../Timeline";
import { PeriodBar } from "../Timeline/PeriodBar";
import { getSegmentColor } from "../../../Sidebars/segmentConstants";

// ── Shared sx constants (module-level, never recreated) ──
const LEFT_COL = GANTT_LEFT_COL_WIDTH;
const SX_FLEX_CENTER = { display: "flex", alignItems: "center" } as const;
const SX_LEFT_COL_DETAIL = {
  flexShrink: 0,
  px: 1.5,
  display: "flex",
  alignItems: "center",
  gap: 1,
  minWidth: 0,
  position: "relative",
} as const;
const SX_RIGHT_COL = { flex: 1, pr: 1.5 } as const;
const SX_COL_JOBNO = {
  fontSize: "0.75rem",
  color: "text.secondary",
  flexShrink: 0,
  width: 60,
  textAlign: "right",
} as const;
const SX_COL_HOURS = {
  fontSize: "0.75rem",
  color: "text.secondary",
  flexShrink: 0,
  width: 40,
  textAlign: "right",
} as const;
const SX_COL_DAYS = {
  fontSize: "0.75rem",
  color: "text.disabled",
  flexShrink: 0,
  width: 32,
  textAlign: "right",
} as const;
const SX_ACCOUNT_CLICK = {
  display: "flex",
  alignItems: "center",
  flex: 1,
  minWidth: 0,
  gap: 0.25,
  cursor: "pointer",
  overflow: "hidden",
  "&:hover": {
    overflow: "visible",
    zIndex: 5,
    "& .MuiTypography-root": {
      overflow: "visible",
      textOverflow: "clip",
      flex: "none",
      bgcolor: "rgba(249,250,251,0.95)",
    },
    "& .account-sep": { display: "inline" },
    "& .MuiTypography-root:last-of-type": {
      pr: 6,
      maskImage: "linear-gradient(to right, black calc(100% - 48px), transparent)",
      WebkitMaskImage: "linear-gradient(to right, black calc(100% - 48px), transparent)",
    },
  },
} as const;
const SX_TEXT_PRIMARY_TRUNC = {
  fontSize: "0.875rem",
  color: "text.primary",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
} as const;
const SX_TEXT_SECONDARY_TRUNC = {
  fontSize: "0.875rem",
  color: "text.secondary",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
} as const;
const SX_ACTIONS_COL = {
  display: "flex",
  alignItems: "center",
  gap: 0.5,
  flexShrink: 0,
  width: 64,
  justifyContent: "flex-end",
} as const;
const SX_IO_BADGE = {
  fontSize: "0.7rem",
  px: 0.5,
  py: 0,
  borderRadius: 0.5,
  bgcolor: "#ede9fe",
  color: "#7c3aed",
  flexShrink: 0,
  lineHeight: 1.5,
} as const;
const SX_COLOR_DOT = { width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, ml: 1.5 } as const;
const SX_SECTION_HEADER_LEFT = {
  flexShrink: 0,
  px: 1.5,
  py: 0.75,
  display: "flex",
  alignItems: "center",
  gap: 1,
} as const;
const SX_FLEX_1_PR = { flex: 1, pr: 1.5, minWidth: 0 } as const;
const SX_SECTION_DIVIDER = { borderTop: "0.5px solid", borderColor: "divider", ml: "10px" } as const;
const SX_SECTION_LABEL = {
  fontSize: "0.875rem",
  color: "text.secondary",
  letterSpacing: 0.5,
  textTransform: "uppercase",
} as const;
const SX_SUBSECTION_TITLE = {
  fontSize: "0.75rem",
  color: "text.disabled",
  letterSpacing: 0.5,
  textTransform: "uppercase",
} as const;
const SX_ROW_HOVER = { "&:hover": { bgcolor: "rgba(249,250,251,0.5)" }, transition: "background-color 0.15s" } as const;
const SX_COL_HEADER = { fontSize: "0.75rem", color: "text.disabled", flexShrink: 0, textAlign: "right" } as const;

// ── Types ──
interface TimelineGeometry {
  totalDays: number;
  numCols: number;
  dayToCol: number[];
  weekendSet: Set<number>;
  mondayCols: number[];
  start: Date;
}

interface EmployeeRowSapSectionProps {
  sapDayData: Record<string, any>;
  employee: any;
  timelineStart: string | Date;
  timelineEnd: string | Date;
  leftColShrink: number;
  tl: TimelineGeometry;
  enabledHolidayDates: Set<string>;
  showIO: string;
  pipelineJobcodes: Map<string, any> | null;
  ioJobcodes: Set<string> | null;
  resolveOppForJob: (job: any) => any;
  onNavigateToOpportunity: ((jobCode: string) => void) | undefined;
  onContextMenu: (e: React.MouseEvent | MouseEvent, job: any, selectedDates?: string[]) => void;
}

// ── Helper: build contiguous date ranges from a set of dates ──
function buildPeriods(dates: Set<string>) {
  const sorted = [...dates].sort();
  if (sorted.length === 0) return [];
  const periods: { startDate: string; endDate: string; utilization: number; status: string }[] = [];
  let start = sorted[0],
    prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i];
    const prevDate = new Date(prev);
    const curDate = new Date(d);
    const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / 86400000);
    const isWeekendBridge = diffDays <= 3 && prevDate.getDay() === 5 && curDate.getDay() === 1;
    const isWeekendAdjacent =
      diffDays <= 2 &&
      (prevDate.getDay() === 0 || prevDate.getDay() === 6 || curDate.getDay() === 0 || curDate.getDay() === 6);
    if (diffDays === 1 || isWeekendBridge || isWeekendAdjacent) {
      prev = d;
    } else {
      periods.push({ startDate: start, endDate: prev, utilization: 100, status: "C" });
      start = d;
      prev = d;
    }
  }
  periods.push({ startDate: start, endDate: prev, utilization: 100, status: "C" });
  return periods;
}

/**
 * SAP actuals detail section inside an expanded EmployeeRow.
 * Shows UtilizationChart + grouped-by-category PeriodBar timeline bars.
 */
export const EmployeeRowSapSection = memo(
  ({
    sapDayData,
    employee,
    timelineStart,
    timelineEnd,
    leftColShrink,
    tl,
    enabledHolidayDates,
    showIO,
    pipelineJobcodes,
    ioJobcodes,
    resolveOppForJob,
    onNavigateToOpportunity,
    onContextMenu,
  }: EmployeeRowSapSectionProps) => {
    const [sapHighlightJobNo, setSapHighlightJobNo] = useState<string | null>(null);

    const tlStartStr = useMemo(() => new Date(timelineStart).toISOString().slice(0, 10), [timelineStart]);
    const tlEndStr = useMemo(() => new Date(timelineEnd).toISOString().slice(0, 10), [timelineEnd]);

    // Filter SAP records to visible timeline, group by key
    const { entries, sapSections } = useMemo(() => {
      const sapAgg: Record<
        string,
        { label: string; jobCode: string; category: string; totalHours: number; dates: Set<string>; _origKey: string }
      > = {};
      Object.entries(sapDayData).forEach(([dateStr, day]: [string, any]) => {
        if (dateStr < tlStartStr || dateStr >= tlEndStr) return;
        if (!day.records) return;
        day.records.forEach((r: any) => {
          const sapKey = r.salesOrder || r.absenceType || r.text || "other";
          const cat = r.category ?? "other";
          const aggKey = `${sapKey}__${cat}`;
          if (!sapAgg[aggKey])
            sapAgg[aggKey] = {
              label: r.text || r.absenceType || "?",
              jobCode: r.salesOrder || "",
              category: cat,
              totalHours: 0,
              dates: new Set(),
              _origKey: sapKey,
            };
          sapAgg[aggKey].totalHours += r.hours || 0;
          sapAgg[aggKey].dates.add(dateStr);
        });
      });
      const entriesArr = Object.entries(sapAgg).sort((a, b) => b[1].totalHours - a[1].totalHours);
      const chCats = new Set([...CHARGEABLE_CATS, ...GO_CATS]);
      const sections = [
        { title: "Billable", key: "sap-chargeable", items: entriesArr.filter(([, v]) => chCats.has(v.category)) },
        { title: "Training", key: "sap-training", items: entriesArr.filter(([, v]) => TRAINING_CATS.has(v.category)) },
        { title: "Absences", key: "sap-absences", items: entriesArr.filter(([, v]) => ABSENCE_CATS.has(v.category)) },
        {
          title: "Non-Billable",
          key: "sap-other",
          items: entriesArr.filter(
            ([, v]) => !chCats.has(v.category) && !ABSENCE_CATS.has(v.category) && !TRAINING_CATS.has(v.category)
          ),
        },
      ].filter((s) => s.items.length > 0);
      return { entries: entriesArr, sapSections: sections };
    }, [sapDayData, tlStartStr, tlEndStr]);

    const handleHighlightToggle = useCallback((jobCode: string | undefined) => {
      const jc = jobCode?.trim();
      if (jc) setSapHighlightJobNo((prev) => (prev === jc ? null : jc));
    }, []);

    if (entries.length === 0) return null;

    return (
      <Box sx={{ borderTop: "0.5px solid", borderColor: "divider", mt: 0.5 }}>
        <Box sx={SX_FLEX_CENTER}>
          <Box sx={SX_SECTION_HEADER_LEFT} style={{ width: LEFT_COL - leftColShrink }}>
            <Typography sx={SX_SECTION_LABEL}>SAP</Typography>
          </Box>
          <Box sx={SX_FLEX_1_PR}>
            <UtilizationChart
              assignments={[]}
              timelineStart={timelineStart}
              timelineEnd={timelineEnd}
              showLegend={false}
              showMonths={false}
              enabledHolidayDates={enabledHolidayDates}
              sapDayData={sapDayData}
              grade={employee.grade}
              highlightJobNo={sapHighlightJobNo}
            />
          </Box>
        </Box>
        {/* Column headers for h / d */}
        <Box sx={{ display: "flex", pb: 0.25 }}>
          <Box
            sx={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 1, px: 1.5 }}
            style={{ width: LEFT_COL - leftColShrink }}
          >
            <Box sx={{ flex: 1 }} />
            <Typography component="span" sx={{ ...SX_COL_HEADER, width: 60 }} />
            <Typography component="span" sx={{ ...SX_COL_HEADER, width: 40 }}>
              h
            </Typography>
            <Typography component="span" sx={{ ...SX_COL_HEADER, width: 32 }}>
              d
            </Typography>
            <Box component="span" sx={{ flexShrink: 0, width: 64 }} />
          </Box>
        </Box>
        {sapSections.map((section) => (
          <React.Fragment key={section.key}>
            {(() => {
              const secH = section.items.reduce((sum, [, v]) => sum + v.totalHours, 0);
              const secD = Math.round((secH / HOURS_PER_DAY) * 10) / 10;
              const hStr = secH % 1 === 0 ? `${secH}` : `${secH.toFixed(1)}`;
              const dStr = secD % 1 === 0 ? `${secD}` : `${secD.toFixed(1)}`;
              return (
                <>
                  <Box sx={SX_SECTION_DIVIDER} />
                  <Box sx={{ ...SX_FLEX_CENTER, pt: 0.5, pb: 0.25 }}>
                    <Box sx={SX_LEFT_COL_DETAIL} style={{ width: LEFT_COL - leftColShrink }}>
                      <Typography sx={{ ...SX_SUBSECTION_TITLE, flex: 1, minWidth: 0 }}>{section.title}</Typography>
                      <Typography component="span" sx={{ ...SX_COL_HEADER, width: 60 }} />
                      <Typography component="span" sx={{ ...SX_COL_HEADER, width: 40 }}>
                        {hStr}
                      </Typography>
                      <Typography component="span" sx={{ ...SX_COL_HEADER, width: 32 }}>
                        {dStr}
                      </Typography>
                      <Box component="span" sx={{ flexShrink: 0, width: 64 }} />
                    </Box>
                  </Box>
                </>
              );
            })()}
            {section.items.map(([key, v]) => {
              const color = CATEGORY_THEME[v.category]?.hex || "#9ca3af";
              const periods = buildPeriods(v.dates);
              const origKey = v._origKey || key;
              return (
                <Box
                  key={key}
                  sx={{
                    ...SX_FLEX_CENTER,
                    ...SX_ROW_HOVER,
                    cursor: "pointer",
                    ...(sapHighlightJobNo === v.jobCode?.trim() && v.jobCode && { bgcolor: "rgba(59,130,246,0.06)" }),
                  }}
                  onClick={() => handleHighlightToggle(v.jobCode)}
                >
                  <Box
                    sx={SX_LEFT_COL_DETAIL}
                    style={{ width: LEFT_COL - leftColShrink }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onContextMenu(e, {
                        _sapKey: origKey,
                        jobNo: v.jobCode,
                        jobName: v.label,
                        category: v.category,
                        _dates: v.dates,
                        periods: [{ startDate: [...v.dates].sort()[0] || "" }],
                      });
                    }}
                  >
                    <Box component="span" sx={SX_COLOR_DOT} style={{ backgroundColor: color }} />
                    {(() => {
                      const sortedDates = [...v.dates].sort();
                      const opp = resolveOppForJob({
                        jobNo: v.jobCode,
                        periods: [
                          { startDate: sortedDates[0] || "", endDate: sortedDates[sortedDates.length - 1] || "" },
                        ],
                      });
                      const isCh = CHARGEABLE_CATS.has(v.category);
                      const isGo = GO_CATS.has(v.category);
                      const shouldTr = isCh || isGo;
                      const totalDays = Math.round((v.totalHours / HOURS_PER_DAY) * 10) / 10;
                      const dStr = totalDays % 1 === 0 ? `${totalDays}` : `${totalDays.toFixed(1)}`;
                      const hStr = v.totalHours % 1 === 0 ? `${v.totalHours}` : `${v.totalHours.toFixed(1)}`;
                      const sapClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (v.jobCode && onNavigateToOpportunity) onNavigateToOpportunity(String(v.jobCode).trim());
                      };
                      return opp?.account ? (
                        <>
                          <Box component="span" onClick={sapClick} sx={SX_ACCOUNT_CLICK}>
                            <Typography component="span" sx={SX_TEXT_PRIMARY_TRUNC}>
                              {opp.account}
                            </Typography>
                            <Typography
                              component="span"
                              className="account-sep"
                              sx={{ fontSize: "0.8125rem", color: "text.disabled", flexShrink: 0, display: "none" }}
                            >
                              &nbsp;-&nbsp;
                            </Typography>
                            <Typography component="span" sx={SX_TEXT_SECONDARY_TRUNC}>
                              {opp.oppName || opp.opportunityName || ""}
                            </Typography>
                          </Box>
                          <Typography component="span" sx={SX_COL_JOBNO}>
                            {shouldTr ? v.jobCode : ""}
                          </Typography>
                          <Typography component="span" sx={SX_COL_HOURS}>
                            {hStr}
                          </Typography>
                          <Typography component="span" sx={SX_COL_DAYS}>
                            {dStr}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography
                            component="span"
                            className="sap-label"
                            onClick={sapClick}
                            sx={{ ...SX_TEXT_PRIMARY_TRUNC, cursor: "pointer" }}
                          >
                            {v.label}
                          </Typography>
                          <Box component="span" sx={{ flexShrink: 0, width: 60 }} />
                          <Typography component="span" sx={SX_COL_HOURS}>
                            {hStr}
                          </Typography>
                          <Typography component="span" sx={SX_COL_DAYS}>
                            {dStr}
                          </Typography>
                        </>
                      );
                    })()}
                    <Box component="span" sx={SX_ACTIONS_COL}>
                      {showIO !== "off" && v.jobCode && ioJobcodes?.has(String(v.jobCode).trim()) && (
                        <Box component="span" sx={SX_IO_BADGE}>
                          I&O
                        </Box>
                      )}
                      {v.jobCode &&
                        (CHARGEABLE_CATS.has(v.category) || GO_CATS.has(v.category)) &&
                        pipelineJobcodes?.get(v.jobCode)?.segment && (
                          <Box
                            component="span"
                            sx={{
                              ...SX_IO_BADGE,
                              bgcolor: getSegmentColor(pipelineJobcodes.get(v.jobCode).segment),
                              color: "#fff",
                            }}
                          >
                            {pipelineJobcodes.get(v.jobCode).segment}
                          </Box>
                        )}
                    </Box>
                  </Box>
                  <Box sx={SX_RIGHT_COL}>
                    <PeriodBar
                      periods={periods}
                      color={color}
                      tlStart={tl.start}
                      totalDays={tl.totalDays}
                      numCols={tl.numCols}
                      dayToCol={tl.dayToCol}
                      weekendSet={tl.weekendSet}
                      mondayCols={tl.mondayCols}
                      jobName={(() => {
                        const opp = v.jobCode && pipelineJobcodes?.get(v.jobCode);
                        const isCh = CHARGEABLE_CATS.has(v.category);
                        const tr = (s: string, max = 10) =>
                          isCh && s && s.length > max ? s.slice(0, max) + "\u2026" : s;
                        const namePart = opp?.account ? `${tr(opp.account)} - ${tr(opp.opportunityName)}` : tr(v.label);
                        const totalDays = Math.round((v.totalHours / HOURS_PER_DAY) * 10) / 10;
                        const dStr = totalDays % 1 === 0 ? `${totalDays}d` : `${totalDays.toFixed(1)}d`;
                        const hStr = v.totalHours % 1 === 0 ? `${v.totalHours}h` : `${v.totalHours.toFixed(1)}h`;
                        return v.jobCode
                          ? `SAP: ${namePart} - ${v.jobCode} - ${hStr} - ${dStr}`
                          : `SAP: ${namePart} - ${hStr} - ${dStr}`;
                      })()}
                      onDragSelect={(dateRange: any, mouseEvent: any) => {
                        const { start, end } = dateRange;
                        const selected = [...v.dates].filter((d: string) => d >= start && d <= end);
                        if (selected.length === 0) return;
                        onContextMenu(
                          mouseEvent,
                          {
                            _sapKey: origKey,
                            jobNo: v.jobCode,
                            jobName: v.label,
                            category: v.category,
                            _dates: v.dates,
                            periods: [{ startDate: [...v.dates].sort()[0] || "" }],
                          },
                          selected
                        );
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </React.Fragment>
        ))}
      </Box>
    );
  }
);
EmployeeRowSapSection.displayName = "EmployeeRowSapSection";
