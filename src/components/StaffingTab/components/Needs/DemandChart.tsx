/**
 * DemandChart — Stacked bar chart showing ETP demand by grade over monthly buckets,
 * with a supply line overlay and gap visualization.
 *
 * Uses Recharts ComposedChart (same pattern as TUTrendChart).
 */

import { memo, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { alpha, useTheme } from "@mui/material/styles";
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { GRADE_ORDER, getGradeColor, getGradeAbbr } from "../../constants";
import { sanitizeGrade } from "../../utils/demandCalc";
import { brand, functional } from "../../../../config/brandConfig";
import DemandTooltip from "./DemandTooltip";
import type { DemandSupplyRow } from "../../utils/demandCalc";

// Reversed order: Intern at bottom, Partner at top of stack
const GRADE_ORDER_REVERSED = [...GRADE_ORDER].reverse();

interface DemandChartProps {
  rows: DemandSupplyRow[];
  mode: "etp" | "headcount";
  showPipeline: boolean;
  onBarClick?: (monthKey: string, grade: string) => void;
  selectedMonth?: string | null;
  selectedGrade?: string | null;
  hideLegend?: boolean;
}

const DemandChart = memo(
  ({ rows, mode, showPipeline, onBarClick, selectedMonth, selectedGrade, hideLegend }: DemandChartProps) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    // Current month label for ReferenceLine
    const todayMonthLabel = useMemo(() => {
      const now = new Date();
      return now.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    }, []);

    // Y-axis max (auto with some padding)
    const yMax = useMemo(() => {
      let max = 0;
      for (const row of rows) {
        if (selectedGrade) {
          const sk = sanitizeGrade(selectedGrade);
          max = Math.max(max, row[`demand_${sk}`] || 0, row[`supply_${sk}`] || 0);
        } else {
          max = Math.max(max, row.demandTotal, row.supplyTotal);
        }
      }
      return Math.ceil(max + 1);
    }, [rows, selectedGrade]);

    // Smoothed averages over the entire period
    const averages = useMemo(() => {
      if (!rows.length) return { demand: 0, matched: 0, gap: 0 };
      let demandSum = 0,
        matchedSum = 0;
      for (const row of rows) {
        if (selectedGrade) {
          const sk = sanitizeGrade(selectedGrade);
          demandSum += row[`demand_${sk}`] || 0;
          matchedSum += row[`matched_${sk}`] || 0;
        } else {
          demandSum += row.demandTotal;
          matchedSum += row.matchedTotal;
        }
      }
      const n = rows.length;
      const demand = Math.round((demandSum / n) * 10) / 10;
      const matched = Math.round((matchedSum / n) * 10) / 10;
      return { demand, matched, gap: Math.round((demand - matched) * 10) / 10 };
    }, [rows, selectedGrade]);

    const handleBarClick = useCallback(
      (data: any, grade: string) => {
        if (onBarClick && data?.monthKey) {
          onBarClick(data.monthKey, grade);
        }
      },
      [onBarClick]
    );

    if (rows.length === 0) {
      return (
        <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
          <Typography variant="body2">No staffing needs defined</Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ width: "100%", position: "relative" }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 40, left: -10, bottom: 0 }}
            barGap={0}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.5)} />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={{ stroke: theme.palette.divider }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={false}
              domain={[0, yMax]}
              allowDecimals
              width={36}
            />
            <Tooltip content={<DemandTooltip mode={mode} />} />

            {/* ── Bar group 1: Demande (stacked by grade) ── */}
            {(() => {
              const grades = GRADE_ORDER_REVERSED.filter((g) => !selectedGrade || g === selectedGrade);
              const topGrade = grades[grades.length - 1]; // last rendered = top of stack
              return grades.map((grade) => {
                const sk = sanitizeGrade(grade);
                const gc = getGradeColor(grade);
                return (
                  <Bar
                    key={`d_${grade}`}
                    dataKey={`demand_${sk}`}
                    stackId="demand"
                    fill={gc.text}
                    name={`Demand ${grade}`}
                    cursor="pointer"
                    onClick={(data: any) => handleBarClick(data, grade)}
                    radius={grade === topGrade ? [6, 6, 0, 0] : undefined}
                  />
                );
              });
            })()}

            {/* ── Bar group 2: Dispo = matched (green) + unmatched (grey) stacked ── */}
            {/* Matched at bottom, unmatched on top → unmatched gets the radius */}
            {GRADE_ORDER_REVERSED.filter((g) => !selectedGrade || g === selectedGrade).map((grade) => {
              const sk = sanitizeGrade(grade);
              return <Bar key={`m_${grade}`} dataKey={`matched_${sk}`} stackId="dispo" fill="#10b981" />;
            })}
            {(() => {
              const grades = GRADE_ORDER_REVERSED.filter((g) => !selectedGrade || g === selectedGrade);
              const topGrade = grades[grades.length - 1];
              return grades.map((grade) => {
                const sk = sanitizeGrade(grade);
                return (
                  <Bar
                    key={`u_${grade}`}
                    dataKey={`unmatched_${sk}`}
                    stackId="dispo"
                    fill="#d1d5db"
                    radius={grade === topGrade ? [6, 6, 0, 0] : undefined}
                  />
                );
              });
            })()}

            {/* Pipeline overlay (probability-weighted) */}
            {showPipeline &&
              GRADE_ORDER_REVERSED.filter((g) => !selectedGrade || g === selectedGrade).map((grade) => {
                const sk = sanitizeGrade(grade);
                const gc = getGradeColor(grade);
                return (
                  <Bar
                    key={`pipe_${grade}`}
                    dataKey={`pipeline_${sk}`}
                    stackId="pipeline"
                    fill={gc.text}
                    fillOpacity={0.15}
                    stroke={gc.text}
                    strokeWidth={0.5}
                    strokeDasharray="4 2"
                    strokeOpacity={0.3}
                  />
                );
              })}

            {/* Smoothed gap line (demand - matched supply average) */}
            {averages.gap !== 0 && (
              <ReferenceLine
                y={Math.abs(averages.gap)}
                stroke={averages.gap > 0 ? "#ef4444" : "#10b981"}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: `Gap Ø ${averages.gap > 0 ? "+" : ""}${averages.gap}`,
                  position: "right",
                  fontSize: 10,
                  fontWeight: 700,
                  fill: averages.gap > 0 ? "#ef4444" : "#10b981",
                }}
              />
            )}

            {/* Today marker */}
            <ReferenceLine x={todayMonthLabel} stroke={brand.primary} strokeDasharray="3 3" strokeWidth={1} />

            {/* Selected month highlight */}
            {selectedMonth && (
              <ReferenceLine
                x={rows.find((r) => r.monthKey === selectedMonth)?.monthLabel}
                stroke={theme.palette.primary.main}
                strokeWidth={2}
                strokeOpacity={0.3}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Bar type legend (always visible) */}
        <Box sx={{ display: "flex", gap: 2, px: 1, pb: 0.5, justifyContent: "center" }}>
          <LegendItem color={brand.secondaryDark} label="Demand" />
          <LegendItem color="#10b981" label="Matched supply" />
          <LegendItem color="#d1d5db" label="Unmatched supply" />
          {averages.gap !== 0 && (
            <Typography
              sx={{ fontSize: "0.68rem", fontWeight: 700, color: averages.gap > 0 ? "#ef4444" : "#10b981", ml: 1 }}
            >
              Avg. gap: {averages.gap > 0 ? "+" : ""}
              {averages.gap} FTE
            </Typography>
          )}
        </Box>

        {/* Grade legend (hidden when hideLegend) */}
        {hideLegend ? null : (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4, px: 1, pb: 0.5, justifyContent: "center" }}>
            {GRADE_ORDER.map((grade) => {
              const gc = getGradeColor(grade);
              const hasData = rows.some((r) => (r[`demand_${sanitizeGrade(grade)}`] || 0) > 0);
              if (!hasData) return null;
              const isActive = !selectedGrade || selectedGrade === grade;
              return (
                <Chip
                  key={grade}
                  label={getGradeAbbr(grade)}
                  size="small"
                  onClick={() => onBarClick?.(selectedMonth || "", grade)}
                  sx={{
                    height: 18,
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    bgcolor: isActive ? gc.bg : "transparent",
                    color: isActive ? gc.text : theme.palette.text.disabled,
                    border: `1px solid ${isActive ? gc.border : theme.palette.divider}`,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                />
              );
            })}
            {/* Supply legends */}
            <Chip
              label="Avail."
              size="small"
              sx={{
                height: 18,
                fontSize: "0.6rem",
                fontWeight: 600,
                color: functional.successDark,
                border: `1.5px solid ${functional.success}`,
                bgcolor: "transparent",
              }}
            />
            <Chip
              label="Supply"
              size="small"
              sx={{
                height: 18,
                fontSize: "0.6rem",
                fontWeight: 600,
                color: "text.secondary",
                border: `1px dashed ${brand.secondary}`,
                bgcolor: "transparent",
              }}
            />
          </Box>
        )}
      </Box>
    );
  }
);
DemandChart.displayName = "DemandChart";

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
    <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color }} />
    <Typography sx={{ fontSize: "0.68rem", color: "#6b7280", fontWeight: 500 }}>{label}</Typography>
  </Box>
);

export default DemandChart;
