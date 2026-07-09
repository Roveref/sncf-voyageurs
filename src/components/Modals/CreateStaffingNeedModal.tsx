/**
 * CreateStaffingNeedModal — Staffing need creation modal.
 *
 * Layout: Form (full width) on top, Pyramid + Timeline side by side below.
 * Flow: Fill form → click grade in pyramid = instant add. Or: select grade → fill → Add.
 * Features: auto-add on grade click, quick utilization chips, grade-sorted bars,
 *   click-to-edit bars, today line, hover highlight, flash animation, Enter shortcut.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect, memo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import useResponsive from "../../hooks/useResponsive";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import GroupIcon from "@mui/icons-material/Group";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { getGradeColor, getGradeAbbr } from "../StaffingTab/constants";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useComputedStore } from "../../stores/useComputedStore";
import { formatLocalDate, addMonths } from "../StaffingTab/utils/dateUtils";
import { easing, keyframes } from "../../styles/animations";
import { SkillsAutocomplete } from "../shared";
import NeedsPyramid from "./NeedsPyramid";
import NeedsTimeline from "./NeedsTimeline";
import {
  generateId,
  getValidGrades,
  getGradeIndex,
  getMPlusSet,
  type NeedItem,
  type EditForm,
  emptyEditForm,
  nextMonday,
  firstOfNextMonth,
  endOfQuarter,
  computeWorkingDays,
  buildGanttRange,
  buildMonthColumns,
  filledSx,
  filledSmallSx,
  UTIL_PRESETS,
} from "./staffingNeedUtils";

// ─── Component ──────────────────────────────────────────────────────────────

const PYRAMID_WIDTH = 220; // fixed px

const CreateStaffingNeedModal = ({ open, onClose, opportunityData = [] as any[], initialOpportunity = null }: any) => {
  const theme = useTheme();
  const { isPhone } = useResponsive();
  const isDark = theme.palette.mode === "dark";

  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);

  // Pre-fill when initialOpportunity is provided
  useEffect(() => {
    if (open && initialOpportunity) {
      const account = initialOpportunity.account?.trim() || null;
      setSelectedAccount(account);
      // Find matching opportunity in opportunityData to get the full object with label
      const match = opportunityData.find((o: any) => o.opportunityId === initialOpportunity.opportunityId);
      if (match) {
        setSelectedOpportunity({
          ...match,
          label: match.opportunity || match.opportunityId,
          account: match.account || "",
        });
      } else {
        setSelectedOpportunity({
          ...initialOpportunity,
          label: initialOpportunity.opportunity || initialOpportunity.opportunityId,
          account: account || "",
        });
      }
    }
  }, [open, initialOpportunity, opportunityData]);
  const [addedNeeds, setAddedNeeds] = useState<NeedItem[]>([]);
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm());
  const [editingNeedId, setEditingNeedId] = useState<string | null>(null);
  const [hoveredGrade, setHoveredGrade] = useState<string | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const flashTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const manualAccounts = useUserDataStore((s) => s.manualAccounts);
  const allStaffingNeeds = useUserDataStore((s) => s.staffingNeeds);
  const staffingEmployees = useComputedStore((s) => s.staffingEmployees);

  // Existing needs for selected opportunity
  const existingNeeds = useMemo(() => {
    if (!selectedOpportunity) return [];
    const opportunityId = selectedOpportunity.opportunityId;
    const needs = allStaffingNeeds[opportunityId] || [];
    return needs;
  }, [selectedOpportunity, allStaffingNeeds]);

  // ─── Derived ────────────────────────────────────────────────────────────
  const accountList = useMemo(() => {
    const set = new Set<string>();
    opportunityData.forEach((o: any) => {
      if (o.account?.trim()) set.add(o.account.trim());
    });
    manualAccounts.forEach((a: any) => set.add(a.account));
    return [...set].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [opportunityData, manualAccounts]);

  const filteredOpportunities = useMemo(() => {
    const opps = selectedAccount ? opportunityData.filter((o: any) => o.account === selectedAccount) : opportunityData;
    return opps.map((o: any) => ({ ...o, label: `${o.opportunity || o.opportunityId}`, account: o.account || "" }));
  }, [opportunityData, selectedAccount]);

  const employeeOptions = useMemo(() => {
    if (!staffingEmployees?.length) return [];
    const seen = new Set<string>();
    return staffingEmployees
      .filter((e: any) => {
        if (!e.empId || seen.has(e.empId)) return false;
        seen.add(e.empId);
        return true;
      })
      .map((e: any) => ({ empId: e.empId, name: e.name || e.empId, grade: e.grade || "" }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  }, [staffingEmployees]);

  const sortedEmployeeOptions = useMemo(() => {
    if (!editingGrade) return employeeOptions;
    const matching = employeeOptions.filter((e) => e.grade === editingGrade);
    const others = employeeOptions.filter((e) => e.grade !== editingGrade);
    return [...matching, ...others];
  }, [employeeOptions, editingGrade]);

  // Count per grade: new + existing (for pyramid) — existing uses quantity
  const countPerGrade = useMemo(() => {
    const m: Record<string, { added: number; existing: number }> = {};
    for (const n of addedNeeds) {
      const g = n.grade;
      if (!m[g]) m[g] = { added: 0, existing: 0 };
      m[g].added++;
    }
    for (const n of existingNeeds as any[]) {
      const g = n.grade || "";
      const qty = n.quantity || 1;
      if (!m[g]) m[g] = { added: 0, existing: 0 };
      m[g].existing += qty;
    }
    return m;
  }, [addedNeeds, existingNeeds]);

  // Convert existing needs to NeedItem shape for unified display
  // Expand quantity > 1 into multiple items
  const existingAsNeedItems = useMemo<(NeedItem & { _existing: true })[]>(() => {
    const items: (NeedItem & { _existing: true })[] = [];
    for (const n of existingNeeds as any[]) {
      const grade = n.grade || "";
      const startDate = n.startDate || "";
      const endDate = n.endDate || "";
      const skills = n.skills || [];
      const utilization = n.utilization ?? 100;
      const person = n.assignedTo || undefined;
      const qty = n.quantity || 1;
      for (let q = 0; q < qty; q++) {
        items.push({
          id: `${n.id}_${q}`,
          grade,
          startDate,
          endDate,
          skills: [...skills],
          utilization,
          preferredPerson: person,
          _existing: true as const,
        });
      }
    }
    return items;
  }, [existingNeeds]);

  // All needs (existing + new) for pyramid & timeline
  const allNeeds = useMemo(() => [...existingAsNeedItems, ...addedNeeds], [existingAsNeedItems, addedNeeds]);

  // Sort needs by grade order for timeline display (only those with valid dates)
  const sortedNeeds = useMemo(
    () =>
      allNeeds
        .filter((n) => n.startDate && n.endDate)
        .sort((a, b) => (getGradeIndex().get(a.grade) ?? 99) - (getGradeIndex().get(b.grade) ?? 99)),
    [allNeeds]
  );

  const ganttRange = useMemo(() => buildGanttRange(allNeeds), [allNeeds]);
  const monthColumns = useMemo(
    () => buildMonthColumns(ganttRange.minDate, ganttRange.maxDate, ganttRange.totalDays),
    [ganttRange]
  );

  const dateError = !!(editForm.startDate && editForm.endDate && editForm.endDate < editForm.startDate);
  const formDatesValid = !!editForm.startDate && !!editForm.endDate && !dateError;
  const editWorkingDays = useMemo(
    () => computeWorkingDays(editForm.startDate, editForm.endDate),
    [editForm.startDate, editForm.endDate]
  );
  const canSave = !!selectedOpportunity && addedNeeds.length > 0;
  const canValidateEdit = !!editingGrade && formDatesValid;

  const editingGc = editingGrade ? getGradeColor(editingGrade) : null;

  // Today marker position
  const todayStr = formatLocalDate(new Date());
  const todayPct = useMemo(() => {
    if (!ganttRange.minDate || !ganttRange.maxDate || ganttRange.totalDays <= 0) return null;
    if (todayStr < ganttRange.minDate || todayStr > ganttRange.maxDate) return null;
    const gs = new Date(ganttRange.minDate + "T00:00:00").getTime();
    const ge = new Date(ganttRange.maxDate + "T00:00:00").getTime();
    const ts = new Date(todayStr + "T00:00:00").getTime();
    return ((ts - gs) / (ge - gs || 1)) * 100;
  }, [ganttRange, todayStr]);

  // Total working days summary
  const totalWorkingDays = useMemo(
    () => addedNeeds.reduce((sum, n) => sum + computeWorkingDays(n.startDate, n.endDate), 0),
    [addedNeeds]
  );

  const elegantT = `all 0.3s ${easing.elegant}`;

  // ─── Flash helper ─────────────────────────────────────────────────────
  const triggerFlash = useCallback((id: string) => {
    setLastAddedId(id);
    clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setLastAddedId(null), 800);
  }, []);

  // ─── Add need helper (shared by grade click & Add button) ─────────────
  const addNeed = useCallback(
    (grade: string) => {
      if (!getValidGrades().includes(grade) || !formDatesValid) return null;
      const id = generateId();
      const need: NeedItem = {
        id,
        grade,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        skills: [...editForm.skills],
        utilization: editForm.utilization,
        preferredPerson: editForm.preferredPerson || undefined,
      };
      setAddedNeeds((prev) => [...prev, need]);
      triggerFlash(id);
      return id;
    },
    [editForm, formDatesValid, triggerFlash]
  );

  // Delete an existing (already saved) need
  const handleDeleteExistingNeed = useCallback(
    (needId: string) => {
      if (!selectedOpportunity) return;
      const opportunityId = selectedOpportunity.opportunityId;
      const ds = useUserDataStore.getState();
      const current = ds.staffingNeeds[opportunityId] || [];
      ds.setStaffingNeeds(
        opportunityId,
        current.filter((n: any) => n.id !== needId)
      );
    },
    [selectedOpportunity]
  );

  // ─── Field-level validation helpers ─────────────────────────────────
  const validateNeedField = useCallback(
    (fieldName: string, value: any): string => {
      switch (fieldName) {
        case "grade":
          return !value ? "Grade is required" : "";
        case "startDate":
          return !value ? "Start date is required" : "";
        case "endDate": {
          if (!value) return "End date is required";
          if (editForm.startDate && value < editForm.startDate) return "End date must be after start date";
          return "";
        }
        default:
          return "";
      }
    },
    [editForm.startDate]
  );

  const handleBlurNeedField = useCallback(
    (fieldName: string, value: any) => {
      const err = validateNeedField(fieldName, value);
      setFormFieldErrors((prev) => ({ ...prev, [fieldName]: err }));
    },
    [validateNeedField]
  );

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setSelectedAccount(null);
    setSelectedOpportunity(null);
    setAddedNeeds([]);
    setEditingGrade(null);
    setEditForm(emptyEditForm());
    setEditingNeedId(null);
    setHoveredGrade(null);
    setLastAddedId(null);
    setFormFieldErrors({});
    onClose();
  }, [onClose]);

  // Grade click: auto-add if form has valid dates, otherwise toggle selection
  const handleGradeClick = useCallback(
    (grade: string) => {
      setFormFieldErrors((prev) => ({ ...prev, grade: "" }));
      if (formDatesValid && !editingNeedId) {
        // Auto-add — keep grade selected for rapid multi-add
        addNeed(grade);
        setEditingGrade(grade);
      } else {
        // Just toggle grade selection
        setEditingGrade((prev) => (prev === grade ? null : grade));
      }
    },
    [formDatesValid, editingNeedId, addNeed]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingGrade(null);
  }, []);

  // Add button / Enter key handler
  const handleValidateEdit = useCallback(() => {
    // Validate all fields and show inline errors
    const gradeErr = validateNeedField("grade", editingGrade);
    const startErr = validateNeedField("startDate", editForm.startDate);
    const endErr = validateNeedField("endDate", editForm.endDate);
    if (gradeErr || startErr || endErr) {
      setFormFieldErrors({ grade: gradeErr, startDate: startErr, endDate: endErr });
      return;
    }
    if (!editingGrade || !formDatesValid) return;
    if (!getValidGrades().includes(editingGrade)) return;

    if (editingNeedId) {
      // Update existing need
      setAddedNeeds((prev) =>
        prev.map((n) =>
          n.id === editingNeedId
            ? {
                ...n,
                grade: editingGrade,
                startDate: editForm.startDate,
                endDate: editForm.endDate,
                skills: [...editForm.skills],
                utilization: editForm.utilization,
                preferredPerson: editForm.preferredPerson || undefined,
              }
            : n
        )
      );
      triggerFlash(editingNeedId);
      setEditingNeedId(null);
    } else {
      addNeed(editingGrade);
      // Keep grade selected for quick multi-add
    }
  }, [editingGrade, editingNeedId, formDatesValid, editForm, addNeed, triggerFlash]);

  const handleRemoveNeed = useCallback(
    (id: string) => {
      setAddedNeeds((p) => p.filter((n) => n.id !== id));
      if (editingNeedId === id) {
        setEditingNeedId(null);
        setEditForm(emptyEditForm());
        setEditingGrade(null);
      }
    },
    [editingNeedId]
  );

  // Click an existing need bar → pre-fill form for duplication
  const handleClickExistingNeed = useCallback((need: NeedItem) => {
    setEditingNeedId(null);
    setEditingGrade(need.grade);
    setEditForm({
      startDate: need.startDate,
      endDate: need.endDate,
      skills: [...need.skills],
      skillInput: "",
      utilization: need.utilization,
      preferredPerson: need.preferredPerson || "",
    });
  }, []);

  // Click a bar to edit it
  const handleClickNeed = useCallback(
    (need: NeedItem) => {
      if (editingNeedId === need.id) {
        // Cancel edit
        setEditingNeedId(null);
        setEditForm(emptyEditForm());
        setEditingGrade(null);
      } else {
        setEditingNeedId(need.id);
        setEditingGrade(need.grade);
        setEditForm({
          startDate: need.startDate,
          endDate: need.endDate,
          skills: [...need.skills],
          skillInput: "",
          utilization: need.utilization,
          preferredPerson: need.preferredPerson || "",
        });
      }
    },
    [editingNeedId]
  );

  // Reset form
  const handleReset = useCallback(() => {
    setEditForm(emptyEditForm());
    setEditingGrade(null);
    setEditingNeedId(null);
  }, []);

  const handleSkillKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && editForm.skillInput.trim()) {
        e.preventDefault();
        const sk = editForm.skillInput.trim();
        setEditForm((p) => ({ ...p, skills: p.skills.includes(sk) ? p.skills : [...p.skills, sk], skillInput: "" }));
      }
    },
    [editForm.skillInput, editForm.skills]
  );

  // Enter key on date/charge fields → validate
  const handleFieldEnter = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && canValidateEdit) {
        e.preventDefault();
        handleValidateEdit();
      }
    },
    [canValidateEdit, handleValidateEdit]
  );

  const handleSave = useCallback(() => {
    if (!selectedOpportunity || !addedNeeds.length) return;
    const opportunityId = selectedOpportunity.opportunityId;
    const now = new Date().toISOString();
    const newNeeds = addedNeeds.map((n) => ({
      id: generateId(),
      opportunityId: opportunityId,
      grade: n.grade,
      quantity: 1,
      startDate: n.startDate,
      endDate: n.endDate,
      skills: [...n.skills],
      utilization: n.utilization,
      assignedTo: n.preferredPerson || undefined,
      status: "open" as const,
      createdAt: now,
      updatedAt: now,
    }));
    const ds = useUserDataStore.getState();
    ds.setStaffingNeeds(opportunityId, [...(ds.staffingNeeds[opportunityId] || []), ...newNeeds]);
    handleClose();
  }, [selectedOpportunity, addedNeeds, handleClose]);

  const setEditStart = (d: Date) => {
    setEditForm((p) => ({ ...p, startDate: formatLocalDate(d) }));
    setFormFieldErrors((prev) => ({ ...prev, startDate: "" }));
  };
  const setEditEnd = (d: Date) => {
    setEditForm((p) => ({ ...p, endDate: formatLocalDate(d) }));
    setFormFieldErrors((prev) => ({ ...prev, endDate: "" }));
  };
  const refDate = editForm.startDate || formatLocalDate(new Date());

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      TransitionComponent={DialogTransition}
      maxWidth="lg"
      fullWidth
      fullScreen={isPhone}
      PaperProps={{
        sx: { borderRadius: isPhone ? 0 : "12px", bgcolor: "background.default", backgroundImage: "none" },
      }}
    >
      {/* Title */}
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 1, pr: 6, bgcolor: "transparent", pb: 0.5, pt: 1.5 }}
      >
        <GroupIcon sx={{ color: "text.secondary", fontSize: 20 }} />
        <Typography variant="subtitle1" component="span" fontWeight={700}>
          New Staffing Need
        </Typography>
        {addedNeeds.length > 0 && (
          <Chip
            label={`${addedNeeds.length}`}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: "0.7rem",
              height: 20,
              bgcolor: alpha(theme.palette.info.main, 0.1),
              color: theme.palette.info.main,
            }}
          />
        )}
        <IconButton
          size="small"
          aria-label="Close staffing need dialog"
          onClick={handleClose}
          sx={{ position: "absolute", right: 12, top: 10 }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0, pb: 1, bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
        {/* Account & Opportunity */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 1.5, mt: 0.5, flexShrink: 0 }}>
          <Autocomplete
            options={accountList}
            value={selectedAccount}
            onChange={(_, v) => {
              setSelectedAccount(v);
              setSelectedOpportunity(null);
            }}
            renderInput={(p) => (
              <TextField {...p} label="Site" size="small" placeholder="Search..." variant="filled" sx={filledSx} />
            )}
            sx={{ flex: 1 }}
            slotProps={{ listbox: { sx: { maxHeight: 240 } } }}
          />
          <Autocomplete
            options={filteredOpportunities}
            value={selectedOpportunity}
            onChange={(_, v) => setSelectedOpportunity(v)}
            getOptionLabel={(o: any) => o.label || ""}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.opportunityId}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {option.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.account}
                  </Typography>
                </Box>
              </Box>
            )}
            isOptionEqualToValue={(o, v) => o.opportunityId === v.opportunityId}
            renderInput={(p) => (
              <TextField {...p} label="Actif *" size="small" placeholder="Search..." variant="filled" sx={filledSx} />
            )}
            sx={{ flex: 1.5 }}
            slotProps={{ listbox: { sx: { maxHeight: 240 } } }}
          />
        </Box>

        {/* Main content — form + pyramid/timeline */}
        {selectedOpportunity && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              animation: `fadeInUp 0.35s ${easing.elegant} both`,
              ...keyframes.fadeInUp,
            }}
          >
            {/* ── Existing needs ───────────────────────────────────── */}
            {existingNeeds.length > 0 && (
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.06),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}`,
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="warning.dark"
                  sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}
                >
                  <GroupIcon sx={{ fontSize: 14 }} />
                  {existingNeeds.length} existing need{existingNeeds.length > 1 ? "s" : ""}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {existingNeeds.map((n: any) => {
                    const grade = n.grade || "";
                    const gc = getGradeColor(grade);
                    const label = `${getGradeAbbr(grade)} ${n.quantity > 1 ? `×${n.quantity}` : ""}`.trim();
                    const sd = n.startDate;
                    const ed = n.endDate;
                    const dates =
                      sd && ed
                        ? `${new Date(sd + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} → ${new Date(ed + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`
                        : "";
                    return (
                      <Chip
                        key={n.id}
                        label={
                          <>
                            <b>{label}</b>
                            {dates ? ` · ${dates}` : ""}
                            {n.utilization ? ` · ${Math.round(n.utilization)}%` : ""}
                          </>
                        }
                        size="small"
                        onDelete={() => handleDeleteExistingNeed(n.id)}
                        deleteIcon={<DeleteOutlineIcon sx={{ fontSize: "14px !important" }} />}
                        sx={{
                          height: 24,
                          fontSize: "0.7rem",
                          fontWeight: 500,
                          bgcolor: gc ? alpha(gc.bg, 0.5) : alpha(theme.palette.divider, 0.15),
                          color: gc ? gc.text : "text.secondary",
                          "& .MuiChip-deleteIcon": { color: "inherit", opacity: 0.5, "&:hover": { opacity: 1 } },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* ── Form (always visible, full width) ───────────────── */}
            <Box
              sx={{
                flexShrink: 0,
                p: 1.25,
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
                bgcolor: editingGc ? alpha(editingGc.bg, isDark ? 0.12 : 0.2) : alpha(theme.palette.divider, 0.08),
                border: editingGc
                  ? `1px solid ${alpha(editingGc.border, 0.15)}`
                  : `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                transition: `background-color 0.3s ${easing.elegant}, border-color 0.3s ${easing.elegant}`,
              }}
            >
              {/* Row 1: Grade + Dates */}
              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                {/* Grade indicator */}
                {editingGrade && editingGc ? (
                  <Chip
                    label={
                      editingNeedId
                        ? `${getGradeAbbr(editingGrade)} ${editingGrade}`
                        : `${getGradeAbbr(editingGrade)} ${editingGrade}`
                    }
                    size="small"
                    onDelete={handleCancelEdit}
                    icon={editingNeedId ? <EditIcon sx={{ fontSize: "14px !important" }} /> : undefined}
                    sx={{
                      height: 24,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      bgcolor: editingGc.bg,
                      color: editingGc.text,
                      flexShrink: 0,
                      "& .MuiChip-deleteIcon": { fontSize: 14 },
                    }}
                  />
                ) : (
                  <Typography
                    variant="caption"
                    color={formFieldErrors.grade ? "error" : "text.disabled"}
                    sx={{ fontSize: "0.72rem", fontStyle: "italic", whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    {formFieldErrors.grade ? formFieldErrors.grade : "← Grade"}
                  </Typography>
                )}
                <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
                {/* Start */}
                <TextField
                  size="small"
                  label="Start"
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))}
                  onBlur={(e) => handleBlurNeedField("startDate", e.target.value)}
                  onKeyDown={handleFieldEnter}
                  InputLabelProps={{ shrink: true }}
                  error={!!formFieldErrors.startDate}
                  helperText={formFieldErrors.startDate || undefined}
                  variant="filled"
                  sx={{ width: 135, flexShrink: 0, ...filledSx }}
                />
                {(
                  [
                    ["Today", () => new Date()],
                    ["Mon.", nextMonday],
                    ["M+1", firstOfNextMonth],
                  ] as [string, () => Date][]
                ).map(([l, fn]) => (
                  <Chip
                    key={l}
                    label={l}
                    size="small"
                    clickable
                    onClick={() => setEditStart(fn())}
                    sx={{
                      fontSize: "0.58rem",
                      height: 18,
                      fontWeight: 600,
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                      color: "text.secondary",
                      "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.14) },
                    }}
                  />
                ))}
                <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
                {/* End */}
                <TextField
                  size="small"
                  label="End"
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))}
                  onBlur={(e) => handleBlurNeedField("endDate", e.target.value)}
                  onKeyDown={handleFieldEnter}
                  InputLabelProps={{ shrink: true }}
                  error={dateError || !!formFieldErrors.endDate}
                  helperText={formFieldErrors.endDate || undefined}
                  variant="filled"
                  sx={{ width: 135, flexShrink: 0, ...filledSx }}
                />
                {(
                  [
                    ["+3M", () => addMonths(new Date((editForm.startDate || refDate) + "T00:00:00"), 3)],
                    ["+6M", () => addMonths(new Date((editForm.startDate || refDate) + "T00:00:00"), 6)],
                    ["Fin Q", () => endOfQuarter(refDate)],
                  ] as [string, () => Date][]
                ).map(([l, fn]) => (
                  <Chip
                    key={l}
                    label={l}
                    size="small"
                    clickable
                    onClick={() => setEditEnd(fn())}
                    sx={{
                      fontSize: "0.58rem",
                      height: 18,
                      fontWeight: 600,
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                      color: "text.secondary",
                      "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.14) },
                    }}
                  />
                ))}
                {editForm.startDate && editForm.endDate && !dateError && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.3, ml: "auto", flexShrink: 0 }}>
                    <CalendarTodayIcon sx={{ fontSize: 11, color: "text.disabled" }} />
                    <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ fontSize: "0.65rem" }}>
                      {editWorkingDays}j
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Row 2: Utilization chips + Person + Skills + Add/Update + Reset */}
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                {/* Utilization presets */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.3, flexShrink: 0 }}>
                  {UTIL_PRESETS.map((u) => (
                    <Chip
                      key={u}
                      label={`${u}%`}
                      size="small"
                      clickable
                      onClick={() => setEditForm((p) => ({ ...p, utilization: u }))}
                      sx={{
                        height: 20,
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        minWidth: 0,
                        px: 0.25,
                        transition: elegantT,
                        bgcolor: editForm.utilization === u ? alpha(theme.palette.primary.main, 0.14) : "transparent",
                        color: editForm.utilization === u ? theme.palette.primary.main : "text.disabled",
                        border: `1px solid ${editForm.utilization === u ? alpha(theme.palette.primary.main, 0.25) : alpha(theme.palette.divider, 0.2)}`,
                        "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                      }}
                    />
                  ))}
                  <TextField
                    size="small"
                    type="number"
                    value={Math.round(editForm.utilization)}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        utilization: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                      }))
                    }
                    onKeyDown={handleFieldEnter}
                    inputProps={{ min: 0, max: 100, step: 5, "aria-label": "Utilization percentage" }}
                    variant="filled"
                    sx={{
                      width: 40,
                      ...filledSx,
                      "& .MuiFilledInput-input": {
                        py: 0.3,
                        px: 0.3,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textAlign: "center",
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: "0.62rem" }}>
                    %
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                {/* Person */}
                <Autocomplete
                  options={sortedEmployeeOptions}
                  value={sortedEmployeeOptions.find((e) => e.name === editForm.preferredPerson) || null}
                  onChange={(_, v) => setEditForm((p) => ({ ...p, preferredPerson: v?.name || "" }))}
                  getOptionLabel={(o: any) => o.name || ""}
                  groupBy={
                    editingGrade
                      ? (option: any) => (option.grade === editingGrade ? editingGrade : "Autres")
                      : undefined
                  }
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.empId} sx={{ py: 0.25 }}>
                      <PersonOutlineIcon sx={{ fontSize: 13, mr: 0.5, color: "text.disabled" }} />
                      <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.75rem" }}>
                        {option.name}
                      </Typography>
                      {option.grade && (
                        <Chip
                          label={getGradeAbbr(option.grade)}
                          size="small"
                          sx={{
                            ml: 0.5,
                            height: 14,
                            fontSize: "0.55rem",
                            fontWeight: 700,
                            bgcolor: getGradeColor(option.grade).bg,
                            color: getGradeColor(option.grade).text,
                          }}
                        />
                      )}
                    </Box>
                  )}
                  renderInput={(p) => (
                    <TextField {...p} size="small" placeholder="Personne" variant="filled" sx={filledSmallSx} />
                  )}
                  sx={{ flex: 1, minWidth: 140 }}
                  slotProps={{ listbox: { sx: { maxHeight: 200 } } }}
                />
                <Divider orientation="vertical" flexItem />
                {/* Skills */}
                <Box sx={{ minWidth: 180, flex: 1 }}>
                  <SkillsAutocomplete
                    value={editForm.skills}
                    onChange={(skills) => setEditForm((p) => ({ ...p, skills }))}
                    label=""
                    placeholder="CompÃ©tences..."
                    size="small"
                  />
                </Box>
                {/* Add / Update button */}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={editingNeedId ? <EditIcon sx={{ fontSize: 14 }} /> : <CheckIcon sx={{ fontSize: 14 }} />}
                  onClick={handleValidateEdit}
                  disabled={!canValidateEdit}
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    textTransform: "none",
                    borderRadius: 1.5,
                    py: 0.25,
                    px: 1.5,
                    flexShrink: 0,
                    bgcolor: editingGc ? editingGc.border : theme.palette.primary.main,
                    color: "#fff",
                    "&:hover": { bgcolor: editingGc ? editingGc.text : theme.palette.primary.dark },
                    "&.Mui-disabled": { bgcolor: alpha(theme.palette.primary.main, 0.2), color: alpha("#fff", 0.5) },
                  }}
                >
                  {editingNeedId ? "Modifier" : "Ajouter"}
                </Button>
                {/* Reset */}
                <Chip
                  label="Reset"
                  size="small"
                  clickable
                  onClick={handleReset}
                  sx={{
                    height: 20,
                    fontSize: "0.58rem",
                    fontWeight: 600,
                    bgcolor: "transparent",
                    color: "text.disabled",
                    "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.06), color: "text.secondary" },
                  }}
                />
              </Box>
            </Box>

            {/* ── Pyramid + Timeline side by side (pyramid drives height) ── */}
            <Box sx={{ display: "flex", gap: 2 }}>
              <NeedsPyramid
                validGrades={getValidGrades()}
                mPlusSet={getMPlusSet()}
                countPerGrade={countPerGrade}
                allNeeds={allNeeds}
                formDatesValid={formDatesValid}
                editingGrade={editingGrade}
                hoveredGrade={hoveredGrade}
                onGradeClick={handleGradeClick}
                onHoverGrade={setHoveredGrade}
                computeWorkingDays={computeWorkingDays}
                width={PYRAMID_WIDTH}
              />
              <NeedsTimeline
                sortedNeeds={sortedNeeds}
                allNeeds={allNeeds}
                existingNeedsCount={existingNeeds.length}
                addedNeedsCount={addedNeeds.length}
                totalWorkingDays={totalWorkingDays}
                ganttRange={ganttRange}
                monthColumns={monthColumns}
                todayPct={todayPct}
                hoveredGrade={hoveredGrade}
                editingNeedId={editingNeedId}
                lastAddedId={lastAddedId}
                formDatesValid={formDatesValid}
                onClickNeed={handleClickNeed}
                onClickExistingNeed={handleClickExistingNeed}
                onRemoveNeed={handleRemoveNeed}
                computeWorkingDays={computeWorkingDays}
              />
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 1.5, pt: 0.5, bgcolor: "background.default" }}>
        <Button onClick={handleClose} size="small" sx={{ fontWeight: 600 }}>
          Annuler
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          startIcon={<SaveIcon sx={{ fontSize: 14 }} />}
          disabled={!canSave}
          sx={{ fontWeight: 600 }}
        >
          Créer{addedNeeds.length > 0 ? ` (${addedNeeds.length})` : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default memo(CreateStaffingNeedModal);
