/**
 * TimelineChart — Cumulative recruitment stock chart, year-overlaid.
 * Same pattern as CumulativePipelineChart:
 *   Entry = candidate created, Exit = rejected/hired (via lastActivity), Stock = active pipeline at EOM.
 * X = Jan-Dec, one set of bars+line per year.
 */

import React, { useMemo, useState, useCallback, useEffect } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { chartPalette } from "../../../config/brandConfig";
import type { RecruitmentCandidate } from "../../../types/recruitment";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  candidates: RecruitmentCandidate[];
}

interface MonthRow {
  month: number;
  monthLabel: string;
  [key: string]: number | string;
}

function computeRecruitmentStock(candidates: RecruitmentCandidate[]) {
  const yearSet = new Set<number>();
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth(); // 0-based

  // Parse dates
  const parsed = candidates.map((c) => {
    const createdY = c.creationDate ? parseInt(c.creationDate.slice(0, 4), 10) : 0;
    const createdM = c.creationDate ? parseInt(c.creationDate.slice(5, 7), 10) - 1 : 0;
    const exitY = c.lastActivity ? parseInt(c.lastActivity.slice(0, 4), 10) : 0;
    const exitM = c.lastActivity ? parseInt(c.lastActivity.slice(5, 7), 10) - 1 : 0;
    const hasExited = c.status === "rejected" || c.status === "hired";
    if (createdY) yearSet.add(createdY);
    return { ...c, createdY, createdM, exitY, exitM, hasExited };
  });

  const years = [...yearSet].sort();

  // For each year, compute monthly entries, exits, stock
  const monthlyData: MonthRow[] = [];
  for (let m = 0; m < 12; m++) {
    const row: MonthRow = { month: m, monthLabel: MONTH_LABELS[m] };

    for (const y of years) {
      // Skip future months
      if (y > nowY || (y === nowY && m > nowM)) {
        continue;
      }

      // Entries: created this year+month
      const entries = parsed.filter((c) => c.createdY === y && c.createdM === m);
      row[`${y}_entries`] = entries.length;

      // Exits: exited this year+month
      const exits = parsed.filter((c) => c.hasExited && c.exitY === y && c.exitM === m);
      row[`${y}_exits`] = exits.length;
      row[`${y}_exits_hired`] = exits.filter((c) => c.status === "hired").length;
      row[`${y}_exits_rejected`] = exits.filter((c) => c.status === "rejected").length;

      // Stock: candidates that entered <= this month AND (not exited OR exited after this month)
      const endOfMonth = new Date(y, m + 1, 0); // last day of month
      let stock = 0;
      for (const c of parsed) {
        // Entered before or during this month of this year
        const enteredBefore = c.createdY < y || (c.createdY === y && c.createdM <= m);
        if (!enteredBefore) continue;
        // Not exited, or exited after this month
        if (!c.hasExited) {
          stock++;
        } else {
          const exitedAfter = c.exitY > y || (c.exitY === y && c.exitM > m);
          if (exitedAfter) stock++;
        }
      }
      row[`${y}_stock`] = stock;
    }

    monthlyData.push(row);
  }

  return { years, monthlyData };
}

const TimelineChart = React.memo(({ candidates }: Props) => {
  const theme = useTheme();

  const { years, monthlyData } = useMemo(() => computeRecruitmentStock(candidates), [candidates]);

  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
  const [showExits, setShowExits] = useState(false);

  // Default to 2 most recent years
  useEffect(() => {
    if (years.length > 0 && selectedYears.size === 0) {
      setSelectedYears(new Set(years.slice(-2)));
    }
  }, [years]);

  const toggleYear = useCallback((y: number) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(y)) {
        if (next.size > 1) next.delete(y);
      } else {
        next.add(y);
      }
      return next;
    });
  }, []);

  const colorMap = useMemo(() => {
    const map: Record<number, { bar: string; line: string }> = {};
    const sorted = [...years].sort((a, b) => b - a);
    sorted.forEach((y, i) => {
      const hex = chartPalette[i % chartPalette.length];
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      map[y] = {
        bar: hex,
        line: `rgb(${Math.round(r * 0.7)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.7)})`,
      };
    });
    return map;
  }, [years]);

  const yearsSorted = useMemo(() => [...selectedYears].sort((a, b) => a - b), [selectedYears]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          Stock candidatures
        </Typography>
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
          <Chip
            label={showExits ? "Sorties" : "Entrees"}
            size="small"
            variant="outlined"
            onClick={() => setShowExits((s) => !s)}
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
          {years.map((y) => {
            const active = selectedYears.has(y);
            const c = colorMap[y]?.bar || "#999";
            return (
              <Chip
                key={y}
                label={y}
                size="small"
                variant={active ? "filled" : "outlined"}
                onClick={() => toggleYear(y)}
                sx={{
                  fontWeight: active ? 700 : 400,
                  bgcolor: active ? alpha(c, 0.15) : undefined,
                  borderColor: c,
                  color: active ? c : theme.palette.text.secondary,
                  "&:hover": { bgcolor: alpha(c, 0.1) },
                }}
              />
            );
          })}
        </Box>
      </Box>
      <Divider sx={{ mb: 2 }} />

      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <defs>
            {yearsSorted.map((y) => (
              <linearGradient key={`grad-${y}`} id={`recruit-grad-${y}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorMap[y]?.bar} stopOpacity={0.85} />
                <stop offset="100%" stopColor={colorMap[y]?.bar} stopOpacity={0.5} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            label={{
              value: showExits ? "Sorties" : "Entrees",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: theme.palette.text.secondary },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            label={{
              value: "Stock",
              angle: 90,
              position: "insideRight",
              style: { fontSize: 11, fill: theme.palette.text.secondary },
            }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              backgroundColor: theme.palette.background.paper,
            }}
            formatter={
              ((value: any, name: string) => {
                if (name.includes("stock")) return [value, `Stock ${name.split("_")[0]}`];
                if (name.includes("entries")) return [value, `Entrees ${name.split("_")[0]}`];
                if (name.includes("exits_hired")) return [value, `Hired ${name.split("_")[0]}`];
                if (name.includes("exits_rejected")) return [value, `Rejetes ${name.split("_")[0]}`];
                if (name.includes("exits")) return [value, `Sorties ${name.split("_")[0]}`];
                return [value, name];
              }) as any
            }
          />

          {/* Bars: entries or exits */}
          {yearsSorted.map((y) =>
            showExits ? (
              <React.Fragment key={`exits-${y}`}>
                <Bar
                  yAxisId="left"
                  dataKey={`${y}_exits_hired`}
                  name={`${y}_exits_hired`}
                  stackId={`exits-${y}`}
                  fill={colorMap[y]?.bar}
                  opacity={0.85}
                  radius={[0, 0, 0, 0]}
                  barSize={Math.max(8, 36 / selectedYears.size)}
                />
                <Bar
                  yAxisId="left"
                  dataKey={`${y}_exits_rejected`}
                  name={`${y}_exits_rejected`}
                  stackId={`exits-${y}`}
                  fill={colorMap[y]?.bar}
                  opacity={0.35}
                  radius={[3, 3, 0, 0]}
                  barSize={Math.max(8, 36 / selectedYears.size)}
                />
              </React.Fragment>
            ) : (
              <Bar
                key={`entries-${y}`}
                yAxisId="left"
                dataKey={`${y}_entries`}
                name={`${y}_entries`}
                fill={`url(#recruit-grad-${y})`}
                radius={[3, 3, 0, 0]}
                barSize={Math.max(8, 36 / selectedYears.size)}
              />
            )
          )}

          {/* Lines: stock */}
          {yearsSorted.map((y) => (
            <Line
              key={`stock-${y}`}
              yAxisId="right"
              dataKey={`${y}_stock`}
              name={`${y}_stock`}
              stroke={colorMap[y]?.line}
              strokeWidth={2.5}
              dot={{ r: 3, fill: colorMap[y]?.line }}
              activeDot={{ r: 5 }}
              type="monotone"
              connectNulls
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </Paper>
  );
});
TimelineChart.displayName = "TimelineChart";

export default TimelineChart;
