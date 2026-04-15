import React, { memo, useState, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Paper from "@mui/material/Paper";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../../../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import ScienceIcon from "@mui/icons-material/Science";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { formatLocalDate } from "../../utils/dateUtils";
import { JOB_CATEGORIES, CATEGORY_LABELS, WORK_HOURS_PER_DAY } from "../../constants";

/**
 * Simulation Panel -- What-if scenario analysis
 * Allows adding temporary assignments and seeing their impact on team KPIs in real-time.
 */

const SimAssignmentCard = memo(({ assignment, employees, onRemove }: any) => {
  const empName = employees.find((e: any) => e.empId === assignment.empId)?.name || assignment.empId;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: "#eef2ff",
        border: "1px solid #c7d2fe",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "text.primary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {empName}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
          {assignment.jobName} -- {assignment.utilization}% -- {assignment.startDate} &rarr; {assignment.endDate}
        </Typography>
      </Box>
      <IconButton
        onClick={() => onRemove(assignment.id)}
        size="small"
        sx={{ color: "text.disabled", "&:hover": { color: "#ef4444", bgcolor: "#fef2f2" } }}
      >
        <DeleteIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
});
SimAssignmentCard.displayName = "SimAssignmentCard";

const KPIDelta = memo(({ label, before, after, suffix = "%", higherIsBetter = true }: any) => {
  const delta = after - before;
  const isPositive = higherIsBetter ? delta >= 0 : delta <= 0;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: "text.primary" }}>
          {after.toFixed(1)}
          {suffix}
        </Typography>
        {delta !== 0 && (
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: isPositive ? "#059669" : "#ef4444" }}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}
            {suffix}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>
        avant: {before.toFixed(1)}
        {suffix}
      </Typography>
    </Paper>
  );
});
KPIDelta.displayName = "KPIDelta";

export const SimulationPanel = memo(({ employees }: any) => {
  const [simAssignments, setSimAssignments] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [nextId, setNextId] = useState(1);

  const [formData, setFormData] = useState({
    empId: "",
    jobName: "",
    startDate: formatLocalDate(new Date()),
    endDate: "",
    utilization: 50,
    category: JOB_CATEGORIES.CHARGEABLE,
  });

  const handleAddSimAssignment = useCallback(() => {
    if (!formData.empId || !formData.jobName || !formData.startDate || !formData.endDate) return;
    setSimAssignments((prev) => [
      ...prev,
      { ...formData, id: nextId, utilization: parseFloat(String(formData.utilization)) },
    ]);
    setNextId((n) => n + 1);
    setFormData({
      empId: "",
      jobName: "",
      startDate: formatLocalDate(new Date()),
      endDate: "",
      utilization: 50,
      category: JOB_CATEGORIES.CHARGEABLE,
    });
    setShowAddForm(false);
  }, [formData, nextId]);

  const handleRemoveSimAssignment = useCallback((id: number) => {
    setSimAssignments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleReset = useCallback(() => {
    setSimAssignments([]);
  }, []);

  const { beforeStats, afterStats, impactedEmployees } = useMemo(() => {
    let totalChBefore = 0,
      totalNetBefore = 0;
    employees.forEach((emp: any) => {
      const net = emp.totalNetHours || 0;
      const ch = (emp.trueUtilizationRate / 100) * net;
      totalChBefore += ch;
      totalNetBefore += net;
    });
    const tuBefore = totalNetBefore > 0 ? (totalChBefore / totalNetBefore) * 100 : 0;
    const avgUtilBefore =
      employees.length > 0
        ? employees.reduce((s: number, e: any) => s + e.trueUtilizationRate, 0) / employees.length
        : 0;
    const benchBefore = employees.filter((e: any) => e.trueUtilizationRate === 0).length;
    const overloadBefore = employees.filter((e: any) => e.trueUtilizationRate > 100).length;

    let additionalChHours = 0;
    const impacted = new Set();

    simAssignments.forEach((sim) => {
      if (sim.category !== JOB_CATEGORIES.CHARGEABLE) return;
      const start = new Date(sim.startDate);
      const end = new Date(sim.endDate);
      let workingDays = 0;
      const cur = new Date(start);
      while (cur <= end) {
        if (cur.getDay() !== 0 && cur.getDay() !== 6) workingDays++;
        cur.setDate(cur.getDate() + 1);
      }
      const hoursPerDay = (sim.utilization / 100) * WORK_HOURS_PER_DAY;
      additionalChHours += hoursPerDay * workingDays;
      impacted.add(sim.empId);
    });

    const totalChAfter = totalChBefore + additionalChHours;
    const tuAfter = totalNetBefore > 0 ? (totalChAfter / totalNetBefore) * 100 : 0;

    const empAdjustments: Record<string, number> = {};
    simAssignments.forEach((sim) => {
      if (!empAdjustments[sim.empId]) empAdjustments[sim.empId] = 0;
      empAdjustments[sim.empId] += sim.utilization * 0.3;
    });

    let benchAfter = benchBefore;
    let overloadAfter = overloadBefore;
    employees.forEach((emp: any) => {
      const adj = empAdjustments[emp.empId] || 0;
      if (adj > 0) {
        const newRate = emp.trueUtilizationRate + adj;
        if (emp.trueUtilizationRate === 0 && newRate > 0) benchAfter--;
        if (emp.trueUtilizationRate <= 100 && newRate > 100) overloadAfter++;
      }
    });

    const avgUtilAfter =
      employees.length > 0
        ? employees.reduce((s: number, e: any) => s + e.trueUtilizationRate + (empAdjustments[e.empId] || 0), 0) /
          employees.length
        : 0;

    return {
      beforeStats: { tu: tuBefore, avgUtil: avgUtilBefore, bench: benchBefore, overload: overloadBefore },
      afterStats: { tu: tuAfter, avgUtil: avgUtilAfter, bench: Math.max(0, benchAfter), overload: overloadAfter },
      impactedEmployees: [...impacted],
    };
  }, [employees, simAssignments]);

  return (
    <Box sx={{ "& > * + *": { mt: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: "text.primary", display: "flex", alignItems: "center", gap: 1 }}
        >
          <ScienceIcon sx={{ color: "#4f46e5" }} />
          Simulation What-if
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {simAssignments.length > 0 && (
            <Button
              onClick={handleReset}
              startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
              sx={{ textTransform: "none", color: "text.secondary", "&:hover": { bgcolor: "#f3f4f6" } }}
            >
              Reinitialiser
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => setShowAddForm(true)}
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", bgcolor: "#4f46e5", "&:hover": { bgcolor: "#4338ca" } }}
          >
            Add assignment
          </Button>
        </Box>
      </Box>

      {/* Info */}
      <Alert
        severity="info"
        sx={{ bgcolor: "#eef2ff", borderColor: "#c7d2fe", "& .MuiAlert-message": { color: "#4338ca" } }}
      >
        Add simulated assignments to see their impact on team KPIs in real time. These assignments are{" "}
        <strong>not</strong> saved -- they are only for exploring scenarios.
      </Alert>

      {/* Simulated assignments list */}
      {simAssignments.length > 0 && (
        <Box sx={{ "& > * + *": { mt: 1 } }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary" }}>
            Assignations simulees ({simAssignments.length})
          </Typography>
          {simAssignments.map((a) => (
            <SimAssignmentCard key={a.id} assignment={a} employees={employees} onRemove={handleRemoveSimAssignment} />
          ))}
        </Box>
      )}

      {/* KPI Impact */}
      {simAssignments.length > 0 && (
        <Box>
          <Typography
            sx={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "text.secondary",
              mb: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <TrendingUpIcon sx={{ fontSize: 16, color: "#059669" }} />
            Estimated impact
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 1.5 }}>
            <KPIDelta label="Team TU" before={beforeStats.tu} after={afterStats.tu} />
            <KPIDelta label="Avg. Utilization" before={beforeStats.avgUtil} after={afterStats.avgUtil} />
            <KPIDelta
              label="On Bench"
              before={beforeStats.bench}
              after={afterStats.bench}
              suffix=""
              higherIsBetter={false}
            />
            <KPIDelta
              label="Overloaded"
              before={beforeStats.overload}
              after={afterStats.overload}
              suffix=""
              higherIsBetter={false}
            />
          </Box>
          {impactedEmployees.length > 0 && (
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: 1 }}>
              {impactedEmployees.length} impacted employee{impactedEmployees.length > 1 ? "s" : ""}
            </Typography>
          )}
        </Box>
      )}

      {/* Empty state */}
      {simAssignments.length === 0 && !showAddForm && (
        <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
          <ScienceIcon sx={{ fontSize: 64, mx: "auto", mb: 2, display: "block", color: "#d1d5db" }} />
          <Typography sx={{ fontSize: "1.125rem", fontWeight: 500, color: "text.secondary", mb: 1 }}>
            No simulations in progress
          </Typography>
          <Typography sx={{ fontSize: "0.875rem" }}>
            Add hypothetical assignments to explore staffing scenarios
          </Typography>
        </Box>
      )}

      {/* Add form modal */}
      <Dialog
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        TransitionComponent={DialogTransition}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ScienceIcon sx={{ color: "#4f46e5" }} />
            <Typography variant="h6">Simulated assignment</Typography>
          </Box>
          <IconButton onClick={() => setShowAddForm(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ "& > * + *": { mt: 2 } }}>
            <Box>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary", mb: 0.5 }}>
                Employee *
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={formData.empId}
                  onChange={(e) => setFormData((p) => ({ ...p, empId: e.target.value }))}
                  displayEmpty
                >
                  <MenuItem value="">Select...</MenuItem>
                  {employees
                    .sort((a: any, b: any) => (a.availableCapacityHours > b.availableCapacityHours ? -1 : 1))
                    .map((emp: any) => (
                      <MenuItem key={emp.empId} value={emp.empId}>
                        {emp.name} -- TU {emp.trueUtilizationRate.toFixed(0)}% --{" "}
                        {emp.availableCapacityHours.toFixed(1)}h ({(emp.availableCapacityHours / 8).toFixed(2)}d) avail.
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary", mb: 0.5 }}>
                Project name *
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={formData.jobName}
                onChange={(e) => setFormData((p) => ({ ...p, jobName: e.target.value }))}
                placeholder="e.g. Project Alpha"
              />
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary", mb: 0.5 }}>
                  Start *
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary", mb: 0.5 }}>
                  End *
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary", mb: 0.5 }}>
                  Utilization (%)
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  inputProps={{ min: 5, max: 100, step: 5 }}
                  value={formData.utilization}
                  onChange={(e) => setFormData((p) => ({ ...p, utilization: Number(e.target.value) }))}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary", mb: 0.5 }}>
                  Category
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value as typeof p.category }))}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <MenuItem key={key} value={key}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ bgcolor: "background.default", px: 2, py: 1.5 }}>
          <Button onClick={() => setShowAddForm(false)} sx={{ textTransform: "none", color: "text.secondary" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddSimAssignment}
            disabled={!formData.empId || !formData.jobName || !formData.startDate || !formData.endDate}
            startIcon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", bgcolor: "#4f46e5", "&:hover": { bgcolor: "#4338ca" } }}
          >
            Simuler
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

SimulationPanel.displayName = "SimulationPanel";
