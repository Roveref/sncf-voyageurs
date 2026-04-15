import React, { memo, useState, useMemo, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../../../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import useScenarioStore from "../../../../stores/useScenarioStore";
import { applyAssignmentOverrides, mergeEmployeeOverrides } from "../../utils/scenarioUtils";
import { buildEmployeeStructures } from "../../utils/dataProcessing";
import { CHARGEABLE_CATS, GO_CATS } from "../../constants";

// Distinct colors for scenario lines
const SCENARIO_COLORS = ["#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316"];

interface Props {
  open: boolean;
  onClose: () => void;
  data: any[];
  employeeMetadata: Record<string, any>;
  enabledHolidayDates: Set<string> | string[];
  realTU: number;
  realChH: number;
  realNetH: number;
  employeeCount: number;
}

/** Lightweight TU computation from employee structures */
const computeQuickStats = (employees: any[]) => {
  let totalCh = 0,
    totalNet = 0;
  employees.forEach((emp) => {
    const net = emp._displayNetH || emp.totalNetHours || 0;
    const ch = emp._displayChH || 0;
    totalCh += ch;
    totalNet += net;
  });
  const tu = totalNet > 0 ? (totalCh / totalNet) * 100 : 0;
  return { tu, totalCh, totalNet, count: employees.length };
};

const ScenarioCompareView = memo(
  ({ open, onClose, data, employeeMetadata, enabledHolidayDates, realTU, realChH, realNetH, employeeCount }: Props) => {
    const theme = useTheme();
    const scenarios = useScenarioStore((s) => s.scenarios);
    const resolveAssignmentOverrides = useScenarioStore((s) => s.resolveAssignmentOverrides);
    const resolveEmployeeOverrides = useScenarioStore((s) => s.resolveEmployeeOverrides);

    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggleScenario = useCallback((id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }, []);

    // Compute stats for each selected scenario
    const scenarioStats = useMemo(() => {
      const results: Record<
        string,
        { tu: number; totalCh: number; totalNet: number; count: number; name: string; overrides: number }
      > = {};
      selected.forEach((id) => {
        const sc = scenarios.find((s) => s.id === id);
        if (!sc) return;
        const assignOv = resolveAssignmentOverrides(id);
        const empOv = resolveEmployeeOverrides(id);
        const scData = applyAssignmentOverrides(data, assignOv);
        const scMeta = mergeEmployeeOverrides(employeeMetadata, empOv);
        const holidayArr = enabledHolidayDates instanceof Set ? [...enabledHolidayDates] : enabledHolidayDates;
        const emps = buildEmployeeStructures(scData, holidayArr);
        // Apply metadata (simplified — just for stats)
        emps.forEach((emp) => {
          const m = scMeta[emp.empId];
          if (m?.gradeHistory?.length) {
            const latest = m.gradeHistory[m.gradeHistory.length - 1];
            if (latest?.grade) emp.grade = latest.grade;
          }
        });
        const stats = computeQuickStats(emps);
        const overrideCount = Object.keys(sc.assignmentOverrides).length + Object.keys(sc.employeeOverrides).length;
        results[id] = { ...stats, name: sc.name, overrides: overrideCount };
      });
      return results;
    }, [
      selected,
      scenarios,
      data,
      employeeMetadata,
      enabledHolidayDates,
      resolveAssignmentOverrides,
      resolveEmployeeOverrides,
    ]);

    // Build trend data for mini chart
    const trendData = useMemo(() => {
      if (selected.size === 0) return [];
      // Simple monthly buckets from employee data
      const months = new Map<string, { label: string; real: number }>();

      // We'll build a simplified monthly TU using the base data as "real"
      // For now, show a simple comparison bar rather than a full time-series
      return [];
    }, [selected]);

    const selectedArr = Array.from(selected);

    return (
      <Dialog
        open={open}
        onClose={onClose}
        TransitionComponent={DialogTransition}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CompareArrowsIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" fontWeight={700}>
              Compare scenarios
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ pt: 2 }}>
          {/* Scenario selection */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary", mb: 1 }}>
            Select scenarios to compare
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
            {scenarios.map((sc, idx) => (
              <FormControlLabel
                key={sc.id}
                control={
                  <Checkbox
                    checked={selected.has(sc.id)}
                    onChange={() => toggleScenario(sc.id)}
                    size="small"
                    sx={{
                      color: SCENARIO_COLORS[idx % SCENARIO_COLORS.length],
                      "&.Mui-checked": { color: SCENARIO_COLORS[idx % SCENARIO_COLORS.length] },
                    }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: selected.has(sc.id) ? 600 : 400 }}>
                    {sc.name}
                  </Typography>
                }
              />
            ))}
            {scenarios.length === 0 && (
              <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
                No scenario created
              </Typography>
            )}
          </Box>

          {/* KPI comparison table */}
          {selectedArr.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary", mb: 1.5 }}>
                Comparison table
              </Typography>
              <Box
                sx={{
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                {/* Header row */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: `160px repeat(${selectedArr.length + 1}, 1fr)`,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <Box sx={{ p: 1.5 }} />
                  <Box sx={{ p: 1.5, textAlign: "center", borderLeft: `1px solid ${theme.palette.divider}` }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#047857" }}>
                      Actual data
                    </Typography>
                  </Box>
                  {selectedArr.map((id, idx) => (
                    <Box
                      key={id}
                      sx={{ p: 1.5, textAlign: "center", borderLeft: `1px solid ${theme.palette.divider}` }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          color: SCENARIO_COLORS[scenarios.findIndex((s) => s.id === id) % SCENARIO_COLORS.length],
                        }}
                      >
                        {scenarioStats[id]?.name || id}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* Data rows */}
                {[
                  {
                    label: "TU %",
                    getReal: () => realTU,
                    getScenario: (s: any) => s.tu,
                    format: (v: number) => `${v.toFixed(1)}%`,
                    isDelta: false,
                  },
                  {
                    label: "Billable hrs",
                    getReal: () => realChH,
                    getScenario: (s: any) => s.totalCh,
                    format: (v: number) => `${Math.round(v)}h`,
                    isDelta: false,
                  },
                  {
                    label: "Net hrs",
                    getReal: () => realNetH,
                    getScenario: (s: any) => s.totalNet,
                    format: (v: number) => `${Math.round(v)}h`,
                    isDelta: false,
                  },
                  {
                    label: "Delta TU",
                    getReal: () => 0,
                    getScenario: (s: any) => s.tu - realTU,
                    format: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} pts`,
                    isDelta: true,
                  },
                  {
                    label: "Changes",
                    getReal: () => 0,
                    getScenario: (s: any) => s.overrides,
                    format: (v: number) => `${v}`,
                    isDelta: false,
                  },
                  {
                    label: "Employees",
                    getReal: () => employeeCount,
                    getScenario: (s: any) => s.count,
                    format: (v: number) => `${v}`,
                    isDelta: false,
                  },
                ].map((row, rowIdx) => (
                  <Box
                    key={row.label}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: `160px repeat(${selectedArr.length + 1}, 1fr)`,
                      borderBottom: rowIdx < 5 ? `1px solid ${alpha(theme.palette.divider, 0.5)}` : "none",
                    }}
                  >
                    <Box sx={{ p: 1.25, display: "flex", alignItems: "center" }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                        {row.label}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        p: 1.25,
                        textAlign: "center",
                        borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>
                        {row.label === "Delta TU" || row.label === "Modifications" ? "—" : row.format(row.getReal())}
                      </Typography>
                    </Box>
                    {selectedArr.map((id) => {
                      const stats = scenarioStats[id];
                      if (!stats)
                        return (
                          <Box
                            key={id}
                            sx={{ p: 1.25, borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}
                          />
                        );
                      const val = row.getScenario(stats);
                      const deltaColor = row.isDelta
                        ? val > 0
                          ? "#047857"
                          : val < 0
                            ? "#dc2626"
                            : "text.secondary"
                        : "text.primary";
                      return (
                        <Box
                          key={id}
                          sx={{
                            p: 1.25,
                            textAlign: "center",
                            borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.82rem",
                              color: deltaColor,
                              ...(row.isDelta &&
                                val > 0 && { bgcolor: alpha("#047857", 0.06), borderRadius: 1, px: 0.5 }),
                              ...(row.isDelta &&
                                val < 0 && { bgcolor: alpha("#dc2626", 0.06), borderRadius: 1, px: 0.5 }),
                            }}
                          >
                            {row.format(val)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>

              {/* TU comparison bar chart */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary", mb: 1.5 }}>
                  TU Comparison
                </Typography>
                <Box sx={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={[
                        {
                          name: "Actual",
                          tu: parseFloat(realTU.toFixed(1)),
                          fill: "#047857",
                        },
                        ...selectedArr.map((id, idx) => ({
                          name: scenarioStats[id]?.name || id,
                          tu: parseFloat((scenarioStats[id]?.tu || 0).toFixed(1)),
                          fill: SCENARIO_COLORS[scenarios.findIndex((s) => s.id === id) % SCENARIO_COLORS.length],
                        })),
                      ]}
                      margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} width={45} />
                      <Tooltip
                        formatter={((value: number) => [`${value.toFixed(1)}%`, "TU"]) as any}
                        contentStyle={{ borderRadius: 8, fontSize: "0.8rem" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="tu"
                        stroke={theme.palette.primary.main}
                        strokeWidth={0}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          return (
                            <circle
                              key={payload.name}
                              cx={cx}
                              cy={cy}
                              r={8}
                              fill={payload.fill}
                              stroke="#fff"
                              strokeWidth={2}
                            />
                          );
                        }}
                        activeDot={{ r: 10, strokeWidth: 3, stroke: "#fff" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            </>
          )}

          {selectedArr.length === 0 && scenarios.length > 0 && (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CompareArrowsIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Select at least one scenario to compare
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} sx={{ textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
);

ScenarioCompareView.displayName = "ScenarioCompareView";
export default ScenarioCompareView;
