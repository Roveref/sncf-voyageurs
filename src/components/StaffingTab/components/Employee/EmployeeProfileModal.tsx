import React, { memo, useState, useEffect, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Dialog from "@mui/material/Dialog";
import { useLoadingStore } from "../../../../stores/useLoadingStore";
import DialogTransition from "../../../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import GroupIcon from "@mui/icons-material/Group";
import BadgeIcon from "@mui/icons-material/Badge";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import SchoolIcon from "@mui/icons-material/School";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import BarChartIcon from "@mui/icons-material/BarChart";
import WarningIcon from "@mui/icons-material/Warning";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { GRADE_ORDER, TU_LOW, TU_FULL, FRAG_WARN, FRAG_ALERT, TL_WARN, TL_ALERT, HOURS_PER_DAY } from "../../constants";
import type { EmployeeMetadata, GradeTransition, EtpAdjustment } from "../../types";
import { getEffectiveGrade } from "../../types";
import useScenarioStore from "../../../../stores/useScenarioStore";
import { useCrmData } from "../../../../queries/useCrmData";
import { useUserDataStore } from "../../../../stores/useUserDataStore";
import { getRealEmpId } from "../../utils/empIdUtils";

const ALL_GRADES = [...GRADE_ORDER];

interface StaffingInfo {
  team?: string;
  role?: string;
  arrivalDate?: string;
  departureDate?: string;
}

interface EmployeeModalProps {
  open: boolean;
  onClose: () => void;
  employee: any | null; // null = new employee
  onSave: (empId: string, metadata: EmployeeMetadata) => void;
  onDelete?: (empId: string) => void;
  isManual?: boolean;
  onShowWaterfall?: (employee: any) => void;
  staffingInfo?: StaffingInfo;
  existingMetadata?: EmployeeMetadata;
  sapGradeHistory?: GradeTransition[];
  employeeNames?: string[];
  internToAnalystMapping?: Record<string, string>;
  allSapGradeResults?: Record<string, { gradeHistory: GradeTransition[] }>;
}

const FormRow = memo(({ label, icon: Icon, children }: { label: string; icon?: any; children: React.ReactNode }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
    {Icon && <Icon sx={{ fontSize: 18, color: "text.disabled", flexShrink: 0 }} />}
    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: "text.secondary", minWidth: 100, flexShrink: 0 }}>
      {label}
    </Typography>
    <Box sx={{ flex: 1 }}>{children}</Box>
  </Box>
));
FormRow.displayName = "FormRow";

export const EmployeeModal = memo(
  ({
    open,
    onClose,
    employee,
    onSave,
    onDelete,
    isManual,
    onShowWaterfall,
    staffingInfo,
    existingMetadata,
    sapGradeHistory,
    employeeNames = [],
    internToAnalystMapping,
    allSapGradeResults,
  }: EmployeeModalProps) => {
    const isNew = !employee;
    const isRecruit = !!employee?._isRecruit;
    const isConfirmedRecruit = isRecruit && !!existingMetadata?.segment; // has user-confirmed metadata
    const hints = existingMetadata?._recruitmentHints;
    const { filterOptions } = useCrmData();

    const [name, setName] = useState("");
    const [empId, setEmpId] = useState("");
    const [segment, setSegment] = useState("");
    const [serviceLine, setServiceLine] = useState("");
    const [role, setRole] = useState("");
    const [dm, setDm] = useState("");
    const [arrivalDate, setArrivalDate] = useState("");
    const [departureDate, setDepartureDate] = useState("");
    const [gradeHistory, setGradeHistory] = useState<GradeTransition[]>([]);
    const [etpAdjustments, setEtpAdjustments] = useState<EtpAdjustment[]>([]);

    // Initialize form when modal opens
    useEffect(() => {
      if (!open) return;

      // Grade history priority: saved metadata > SAP-detected > current grade
      // For intern↔analyst links, merge both grade histories
      const resolveGradeHistory = (): GradeTransition[] => {
        let history: GradeTransition[] = [];
        // Prefer saved metadata if it has a real transition (>1 entry), otherwise use SAP-detected
        if (existingMetadata?.gradeHistory?.length && existingMetadata.gradeHistory.length > 1)
          history = [...existingMetadata.gradeHistory];
        else if (sapGradeHistory?.length) history = [...sapGradeHistory];
        else if (existingMetadata?.gradeHistory?.length) history = [...existingMetadata.gradeHistory];
        else if (employee?.grade && employee.grade !== "No grade") history = [{ grade: employee.grade, since: "" }];

        // Merge linked intern↔analyst grade history
        if (employee && internToAnalystMapping && allSapGradeResults) {
          const empId = employee.empId;
          let linkedId: string | null = null;
          if (internToAnalystMapping[empId])
            linkedId = internToAnalystMapping[empId]; // intern → analyst
          else {
            // analyst → intern (reverse lookup)
            for (const [intId, anaId] of Object.entries(internToAnalystMapping)) {
              if (anaId === empId) {
                linkedId = intId;
                break;
              }
            }
          }
          if (linkedId && allSapGradeResults[linkedId]?.gradeHistory?.length) {
            const linkedHistory = allSapGradeResults[linkedId].gradeHistory;
            // Merge and deduplicate by grade+since
            const existing = new Set(history.map((h) => `${h.grade}::${h.since}`));
            for (const h of linkedHistory) {
              if (!existing.has(`${h.grade}::${h.since}`)) history.push(h);
            }
            // Sort by since date
            history.sort((a, b) => (a.since || "").localeCompare(b.since || ""));
          }
        }
        return history;
      };

      if (existingMetadata) {
        // Saved metadata takes priority
        setName(existingMetadata.name || employee?.name || "");
        setSegment(existingMetadata.segment || existingMetadata.team || ""); // backward compat team→segment
        setServiceLine(existingMetadata.serviceLine || "");
        setDm(existingMetadata.dm || employee?.directManager || "");
        setRole(existingMetadata.role || staffingInfo?.role || "");
        setArrivalDate(existingMetadata.arrivalDate || staffingInfo?.arrivalDate || "");
        setDepartureDate(existingMetadata.departureDate || staffingInfo?.departureDate || "");
        setGradeHistory(resolveGradeHistory());
        setEtpAdjustments(existingMetadata.etpAdjustments?.length ? [...existingMetadata.etpAdjustments] : []);
      } else if (staffingInfo) {
        // Pre-fill from staffing file
        setName(employee?.name || "");
        setSegment("");
        setServiceLine("");
        setDm(employee?.directManager || "");
        setRole(staffingInfo.role || "");
        setArrivalDate(staffingInfo.arrivalDate || "");
        setDepartureDate(staffingInfo.departureDate || "");
        setGradeHistory(resolveGradeHistory());
        setEtpAdjustments([]);
      } else {
        // Defaults
        setName(employee?.name || "");
        setSegment("");
        setServiceLine("");
        setDm(employee?.directManager || "");
        setRole("");
        setArrivalDate("");
        setDepartureDate("");
        setGradeHistory(resolveGradeHistory());
        setEtpAdjustments([]);
      }

      setEmpId(employee ? getRealEmpId(employee) : "");
    }, [open, employee, staffingInfo, existingMetadata, sapGradeHistory]);

    const handleAddGrade = useCallback(() => {
      setGradeHistory((prev) => [...prev, { grade: ALL_GRADES[0], since: "" }]);
    }, []);

    const handleRemoveGrade = useCallback((index: number) => {
      setGradeHistory((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleGradeChange = useCallback((index: number, field: keyof GradeTransition, value: string) => {
      setGradeHistory((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
    }, []);

    const handleAddEtp = useCallback(() => {
      setEtpAdjustments((prev) => [...prev, { startDate: "", endDate: "", ratio: 0.8 }]);
    }, []);

    const handleRemoveEtp = useCallback((index: number) => {
      setEtpAdjustments((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleEtpChange = useCallback((index: number, field: keyof EtpAdjustment, value: string | number) => {
      setEtpAdjustments((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
    }, []);

    // Scenario routing
    const activeScenarioId = useScenarioStore((s) => s.activeScenarioId);
    const upsertEmployeeOverride = useScenarioStore((s) => s.upsertEmployeeOverride);

    const buildMetadata = useCallback((): { id: string; metadata: EmployeeMetadata } | null => {
      if (arrivalDate && departureDate && departureDate < arrivalDate) {
        useLoadingStore.getState().notify("Departure date cannot be before arrival date", "error");
        return null;
      }
      const validEtp = etpAdjustments.filter((a) => a.startDate && a.endDate && a.ratio > 0);
      for (const a of validEtp) {
        if (a.startDate > a.endDate) {
          useLoadingStore.getState().notify("FTE: start date is after end date", "error");
          return null;
        }
      }
      const id = empId || name.replace(/\s+/g, "_").toLowerCase();
      return {
        id,
        metadata: {
          name: isNew ? name : undefined,
          segment: segment || undefined,
          serviceLine: serviceLine || undefined,
          dm: dm || undefined,
          role: role || undefined,
          arrivalDate: arrivalDate || undefined,
          departureDate: departureDate || undefined,
          manualArrival: !!arrivalDate,
          manualDeparture: !!departureDate,
          gradeHistory: gradeHistory
            .filter((g) => g.grade)
            .filter((g, i, arr) => arr.findIndex((h) => h.grade === g.grade && h.since === g.since) === i),
          etpAdjustments: validEtp.length > 0 ? validEtp : undefined,
        },
      };
    }, [empId, name, segment, serviceLine, dm, role, arrivalDate, departureDate, gradeHistory, etpAdjustments, isNew]);

    const handleSave = useCallback(() => {
      const result = buildMetadata();
      if (!result) return;
      if (activeScenarioId) {
        upsertEmployeeOverride(result.id, { metadata: result.metadata });
        if (isNew) {
          const gh = result.metadata.gradeHistory;
          const currentGr = gh?.length > 0 ? gh[gh.length - 1].grade : undefined;
          useUserDataStore.getState().addManualEmployee({
            empId: result.id,
            name,
            grade: currentGr,
            subTeam: result.metadata.segment,
            serviceLine: result.metadata.serviceLine,
            managerId: result.metadata.dm,
            arrivalDate: result.metadata.arrivalDate,
            departureDate: result.metadata.departureDate,
          });
        }
      } else {
        onSave(result.id, result.metadata);
      }
      onClose();
    }, [buildMetadata, isNew, name, onSave, onClose, activeScenarioId, upsertEmployeeOverride]);

    /** Confirm a recruited candidate → saves as user_employee + metadata, integrates into team */
    const handleConfirmRecruit = useCallback(() => {
      const result = buildMetadata();
      if (!result) return;
      // Use hints as defaults if user left fields empty
      const meta = result.metadata;
      if (!meta.segment && hints?.segment) meta.segment = hints.segment;
      if (!meta.serviceLine && hints?.serviceLine) meta.serviceLine = hints.serviceLine;
      if (!meta.arrivalDate && hints?.arrivalDate) meta.arrivalDate = hints.arrivalDate;
      if (meta.arrivalDate) meta.manualArrival = true;
      // Add as manual employee with full data
      const overridesStore = useUserDataStore.getState();
      const gh = meta.gradeHistory;
      const currentGr = gh?.length > 0 ? gh[gh.length - 1].grade : undefined;
      overridesStore.addManualEmployee({
        empId: result.id,
        name: employee?.name || name,
        grade: currentGr,
        subTeam: meta.segment,
        serviceLine: meta.serviceLine,
        managerId: meta.dm,
        arrivalDate: meta.arrivalDate,
        departureDate: meta.departureDate,
      });
      // Save metadata
      onSave(result.id, meta);
      onClose();
    }, [buildMetadata, hints, employee, name, onSave, onClose]);

    const currentGrade = useMemo(() => getEffectiveGrade(gradeHistory), [gradeHistory]);

    return (
      <Dialog
        open={open}
        onClose={onClose}
        TransitionComponent={DialogTransition}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PersonIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" fontWeight={700}>
              {isNew ? "New employee" : employee?.name}
            </Typography>
            {currentGrade && (
              <Chip label={currentGrade} size="small" sx={{ fontWeight: 600, fontSize: "0.7rem", height: 22 }} />
            )}
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Close employee modal">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ pt: 2 }}>
          {/* Employee identity */}
          {isNew && (
            <>
              <FormRow label="Name" icon={PersonIcon}>
                <TextField
                  size="small"
                  fullWidth
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First Last"
                  inputProps={{ "aria-label": "Employee name" }}
                />
              </FormRow>
              <FormRow label="ID" icon={BadgeIcon}>
                <TextField
                  size="small"
                  fullWidth
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  placeholder="Unique identifier"
                  inputProps={{ "aria-label": "Employee ID" }}
                />
              </FormRow>
            </>
          )}
          {!isNew && (
            <FormRow label="ID" icon={BadgeIcon}>
              <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>{employee?.empId}</Typography>
            </FormRow>
          )}

          {/* Info section */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary", mt: 2, mb: 1 }}>
            Information
          </Typography>
          <Divider sx={{ mb: 1.5 }} />

          <FormRow label="Segment" icon={GroupIcon}>
            <Autocomplete
              freeSolo
              size="small"
              options={filterOptions?.subSegmentCodes || []}
              value={segment}
              disabled={!!serviceLine}
              onChange={(_, v) => {
                setSegment(v || "");
                if (v) setServiceLine("");
              }}
              onInputChange={(_, v) => {
                setSegment(v || "");
                if (v) setServiceLine("");
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={
                    serviceLine
                      ? "Service Line selected"
                      : hints?.segment
                        ? `${hints.segment} (from recruitment)`
                        : "e.g. IEM, LSC, AUTO..."
                  }
                />
              )}
              sx={{ "& .MuiInputBase-root": { fontSize: "0.875rem" } }}
            />
          </FormRow>

          <FormRow label="Service Line" icon={GroupIcon}>
            <Autocomplete
              freeSolo
              size="small"
              options={filterOptions?.serviceLine1 || []}
              value={serviceLine}
              disabled={!!segment}
              onChange={(_, v) => {
                setServiceLine(v || "");
                if (v) setSegment("");
              }}
              onInputChange={(_, v) => {
                setServiceLine(v || "");
                if (v) setSegment("");
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={
                    segment
                      ? "Segment selected"
                      : hints?.serviceLine
                        ? `${hints.serviceLine} (from recruitment)`
                        : "e.g. Enterprise SAP..."
                  }
                />
              )}
              sx={{ "& .MuiInputBase-root": { fontSize: "0.875rem" } }}
            />
          </FormRow>

          <FormRow label="DM" icon={SupervisorAccountIcon}>
            <Autocomplete
              freeSolo
              size="small"
              options={employeeNames}
              value={dm}
              onChange={(_, v) => setDm(v || "")}
              onInputChange={(_, v) => setDm(v || "")}
              renderInput={(params) => <TextField {...params} placeholder="Reporting manager" />}
              sx={{ "& .MuiInputBase-root": { fontSize: "0.875rem" } }}
            />
          </FormRow>

          <FormRow label="Arrival date" icon={CalendarTodayIcon}>
            <TextField
              size="small"
              type="date"
              fullWidth
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ "aria-label": "Arrival date" }}
              helperText={
                isRecruit && !isConfirmedRecruit && hints?.arrivalDate && !arrivalDate
                  ? `Last GO: ${hints.arrivalDate}`
                  : undefined
              }
            />
          </FormRow>

          <FormRow label="Departure date" icon={CalendarTodayIcon}>
            <TextField
              size="small"
              type="date"
              fullWidth
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ "aria-label": "Departure date" }}
            />
          </FormRow>

          {/* Grade history */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary", mt: 2.5, mb: 1 }}>
            Grade history
          </Typography>
          <Divider sx={{ mb: 1.5 }} />

          {gradeHistory.length === 0 && (
            <Typography variant="body2" sx={{ color: "text.disabled", mb: 1, fontStyle: "italic" }}>
              No grade defined
            </Typography>
          )}

          {gradeHistory.map((entry, idx) => {
            const isCurrent = idx === gradeHistory.length - 1;
            // End date: use SAP `until` (last charged day) if available, else day before next grade's since
            const endDate = !isCurrent
              ? entry.until ||
                (() => {
                  const nextSince = gradeHistory[idx + 1]?.since;
                  if (!nextSince) return null;
                  const d = new Date(nextSince);
                  d.setDate(d.getDate() - 1);
                  return d.toISOString().slice(0, 10);
                })()
              : entry.until || null;
            const fmtDate = (iso: string) => {
              if (!iso) return "—";
              const [y, m, d] = iso.split("-");
              return `${d}/${m}/${y}`;
            };
            return (
              <Box
                key={idx}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mb: 1,
                  p: 1,
                  borderRadius: 2,
                  bgcolor: isCurrent ? alpha("#10b981", 0.06) : "transparent",
                }}
              >
                <SchoolIcon sx={{ fontSize: 16, color: isCurrent ? "#10b981" : "text.disabled", flexShrink: 0 }} />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <Select value={entry.grade} onChange={(e) => handleGradeChange(idx, "grade", e.target.value)}>
                    {ALL_GRADES.map((g) => (
                      <MenuItem key={g} value={g}>
                        {g}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", flexShrink: 0 }}>from</Typography>
                <TextField
                  size="small"
                  type="date"
                  value={entry.since}
                  onChange={(e) => handleGradeChange(idx, "since", e.target.value)}
                  sx={{ minWidth: 135 }}
                  InputLabelProps={{ shrink: true }}
                />
                {isCurrent ? (
                  <Chip
                    label={`current${entry.since ? ` (since ${fmtDate(entry.since)})` : ""}`}
                    size="small"
                    sx={{
                      bgcolor: alpha("#10b981", 0.1),
                      color: "#047857",
                      fontWeight: 600,
                      fontSize: "0.65rem",
                      height: 18,
                    }}
                  />
                ) : (
                  <>
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", flexShrink: 0 }}>to</Typography>
                    <Typography sx={{ fontSize: "0.8rem", color: "text.primary", fontWeight: 500, flexShrink: 0 }}>
                      {fmtDate(endDate || "")}
                    </Typography>
                  </>
                )}
                <IconButton
                  size="small"
                  onClick={() => handleRemoveGrade(idx)}
                  aria-label="Remove grade entry"
                  sx={{ color: "text.disabled", "&:hover": { color: "#ef4444" }, ml: "auto" }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            );
          })}

          <Button
            startIcon={<AddIcon />}
            size="small"
            onClick={handleAddGrade}
            sx={{ textTransform: "none", fontSize: "0.8125rem", color: "text.secondary", mt: 0.5 }}
          >
            Add grade
          </Button>

          {/* ETP Adjustments */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary", mt: 2.5, mb: 1 }}>
            FTE Adjustment
          </Typography>
          <Divider sx={{ mb: 1.5 }} />

          {etpAdjustments.length === 0 && (
            <Typography variant="body2" sx={{ color: "text.disabled", mb: 1, fontStyle: "italic" }}>
              No adjustment (1.0 FTE by default)
            </Typography>
          )}

          {etpAdjustments.map((adj, idx) => (
            <Box
              key={idx}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 1,
                p: 1,
                borderRadius: 2,
                bgcolor: alpha("#3b82f6", 0.04),
              }}
            >
              <TextField
                size="small"
                type="number"
                label="FTE"
                value={adj.ratio}
                onChange={(e) =>
                  handleEtpChange(idx, "ratio", Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)))
                }
                inputProps={{ step: 0.1, min: 0, max: 1 }}
                sx={{ minWidth: 100, "& input": { fontSize: "0.95rem", p: "8px 12px" } }}
              />
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", flexShrink: 0 }}>from</Typography>
              <TextField
                size="small"
                type="date"
                value={adj.startDate}
                onChange={(e) => handleEtpChange(idx, "startDate", e.target.value)}
                sx={{ minWidth: 135 }}
                InputLabelProps={{ shrink: true }}
              />
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", flexShrink: 0 }}>to</Typography>
              <TextField
                size="small"
                type="date"
                value={adj.endDate}
                onChange={(e) => handleEtpChange(idx, "endDate", e.target.value)}
                sx={{ minWidth: 135 }}
                InputLabelProps={{ shrink: true }}
              />
              <IconButton
                size="small"
                onClick={() => handleRemoveEtp(idx)}
                aria-label="Remove FTE period"
                sx={{ color: "text.disabled", "&:hover": { color: "#ef4444" }, ml: "auto" }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))}

          <Button
            startIcon={<AddIcon />}
            size="small"
            onClick={handleAddEtp}
            sx={{ textTransform: "none", fontSize: "0.8125rem", color: "text.secondary", mt: 0.5 }}
          >
            Add FTE period
          </Button>

          {/* Diagnostics section — alerts, fragmentation, transition loss */}
          {!isNew &&
            employee?._hoursInfo &&
            (() => {
              const hi = employee._hoursInfo;
              const avgUtil =
                hi.totalH > 0 ? ((hi.chargeableH + hi.trainingH + hi.otherH + hi.absenceH) / hi.totalH) * 100 : 0;
              const isOverloaded = avgUtil > TU_FULL;
              const isLowTU = hi.tu < TU_LOW && hi.chargeableH > 0;
              const noBillable = hi.chargeableH === 0 && hi.totalH > 0;
              const fragScore = hi.fragScore || 0;
              const tlPct = hi.tuTransitionLossPoints || 0;
              const tlHours = hi.tuTransitionLossHours || 0;
              const hasAlerts = isOverloaded || isLowTU || noBillable;
              const hasDiag = hasAlerts || fragScore > 0 || tlPct > 0;
              if (!hasDiag) return null;
              return (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary", mt: 2.5, mb: 1 }}>
                    Diagnostics
                  </Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {isOverloaded && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 1,
                          borderRadius: 2,
                          bgcolor: alpha("#ef4444", 0.06),
                        }}
                      >
                        <WarningIcon sx={{ fontSize: 16, color: "#ef4444" }} />
                        <Typography sx={{ fontSize: "0.8125rem", color: "#ef4444", fontWeight: 500 }}>
                          Overloaded: {avgUtil.toFixed(0)}% average utilization
                        </Typography>
                      </Box>
                    )}
                    {isLowTU && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 1,
                          borderRadius: 2,
                          bgcolor: alpha("#f59e0b", 0.06),
                        }}
                      >
                        <WarningIcon sx={{ fontSize: 16, color: "#f59e0b" }} />
                        <Typography sx={{ fontSize: "0.8125rem", color: "#d97706", fontWeight: 500 }}>
                          Low TU: {hi.tu.toFixed(1)}%
                        </Typography>
                      </Box>
                    )}
                    {noBillable && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 1,
                          borderRadius: 2,
                          bgcolor: alpha("#f59e0b", 0.06),
                        }}
                      >
                        <WarningIcon sx={{ fontSize: 16, color: "#f59e0b" }} />
                        <Typography sx={{ fontSize: "0.8125rem", color: "#d97706", fontWeight: 500 }}>
                          No billable assignment
                        </Typography>
                      </Box>
                    )}
                    {fragScore > 0 && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 1,
                          borderRadius: 2,
                          bgcolor: alpha(
                            fragScore >= FRAG_ALERT ? "#ef4444" : fragScore >= FRAG_WARN ? "#d97706" : "#16a34a",
                            0.06
                          ),
                        }}
                      >
                        <WarningIcon
                          sx={{
                            fontSize: 16,
                            color: fragScore >= FRAG_ALERT ? "#ef4444" : fragScore >= FRAG_WARN ? "#d97706" : "#16a34a",
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: "0.8125rem",
                            fontWeight: 500,
                            color: fragScore >= FRAG_ALERT ? "#ef4444" : fragScore >= FRAG_WARN ? "#d97706" : "#16a34a",
                          }}
                        >
                          Fragmentation: F{fragScore}
                        </Typography>
                      </Box>
                    )}
                    {tlPct > 0 && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 1,
                          borderRadius: 2,
                          bgcolor: alpha(
                            tlPct >= TL_ALERT ? "#ef4444" : tlPct >= TL_WARN ? "#d97706" : "#ea580c",
                            0.06
                          ),
                        }}
                      >
                        <TrendingDownIcon
                          sx={{
                            fontSize: 16,
                            color: tlPct >= TL_ALERT ? "#ef4444" : tlPct >= TL_WARN ? "#d97706" : "#ea580c",
                          }}
                        />
                        <Box>
                          <Typography
                            sx={{
                              fontSize: "0.8125rem",
                              fontWeight: 500,
                              color: tlPct >= TL_ALERT ? "#ef4444" : tlPct >= TL_WARN ? "#d97706" : "#ea580c",
                            }}
                          >
                            Transition loss: {tlPct.toFixed(2)}% ({tlHours.toFixed(1)}h)
                          </Typography>
                          {hi.shortfallDetails?.length > 0 && (
                            <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", mt: 0.25 }}>
                              {hi.shortfallDetails.length} day{hi.shortfallDetails.length > 1 ? "s" : ""} with
                              transition gap
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </>
              );
            })()}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ px: 3, py: 1.5, justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            {!isNew && onShowWaterfall && (
              <Button
                startIcon={<BarChartIcon />}
                size="small"
                onClick={() => {
                  onShowWaterfall(employee);
                  onClose();
                }}
                sx={{ textTransform: "none" }}
              >
                Waterfall
              </Button>
            )}
            {!isNew && isManual && onDelete && (
              <Button
                startIcon={<DeleteIcon />}
                size="small"
                color="error"
                onClick={() => {
                  onDelete(employee.empId);
                  onClose();
                }}
                sx={{ textTransform: "none" }}
              >
                Delete
              </Button>
            )}
            {isRecruit && !isConfirmedRecruit && (
              <Button
                startIcon={<DeleteIcon />}
                size="small"
                color="error"
                onClick={() => {
                  // Mark as rejected in metadata → pipeline will filter out
                  onSave(employee.empId, { rejected: true, gradeHistory: existingMetadata?.gradeHistory || [] });
                  onClose();
                }}
                sx={{ textTransform: "none" }}
              >
                Reject
              </Button>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={onClose} sx={{ textTransform: "none" }}>
              Cancel
            </Button>
            {isRecruit && !isConfirmedRecruit ? (
              <Button
                variant="contained"
                color="success"
                startIcon={<SaveIcon />}
                onClick={handleConfirmRecruit}
                sx={{ textTransform: "none" }}
              >
                Confirm recruitment
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                sx={{ textTransform: "none" }}
                disabled={isNew && !name.trim()}
              >
                Save
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>
    );
  }
);

EmployeeModal.displayName = "EmployeeModal";
export default EmployeeModal;
