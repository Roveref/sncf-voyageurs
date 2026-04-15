/**
 * StaffingNeeds Component
 * Manages staffing needs for a specific opportunity.
 * Designed as a tab panel within OpportunityActions.
 * Dual-view: "Current Staffing" (from staffing data) + "Staffing Needs" (CRUD).
 * Persists to useUserDataStore (keyed by opportunityId)
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { useComputedStore } from "../../../stores/useComputedStore";
import { safeJsonParse } from "../../../utils/safeJson";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Avatar from "@mui/material/Avatar";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Slider from "@mui/material/Slider";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import PeopleIcon from "@mui/icons-material/People";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import EventIcon from "@mui/icons-material/Event";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import { GRADE_ORDER } from "../../StaffingTab/constants";
import { useUIStore } from "../../../stores/useUIStore";
import { computeNeedStatus, getAssignmentsFromEditorStates } from "../../StaffingTab/utils/needStatusUtils";
import AssignmentIcon from "@mui/icons-material/Assignment";

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const emptyNeed = {
  grade: "",
  quantity: 1,
  startDate: "",
  endDate: "",
  skills: [] as string[],
  probability: 1,
};

// ── Helper: read staffing index from localStorage ───────────────────────────
const readStaffingIndex = (): Record<string, any[]> | null => {
  const raw = localStorage.getItem("staffing_employee_index");
  return raw ? safeJsonParse<Record<string, any[]> | null>(raw, null) : null;
};

// ── Helper: get initials for avatar ─────────────────────────────────────────
const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ── Helper: utilization color ───────────────────────────────────────────────
const getUtilColor = (util: number) => {
  if (util >= 100) return "#ef4444";
  if (util >= 80) return "#10b981";
  if (util >= 50) return "#3b82f6";
  return "#f59e0b";
};

const EMPTY_NEEDS: any[] = [];

const StaffingNeeds = ({
  opportunityId,
  jobCode,
  opportunityRow,
}: {
  opportunityId: string;
  jobCode: string;
  opportunityRow: any;
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const setStaffingNeedOpportunity = useUIStore((s) => s.setStaffingNeedOpportunity);
  const setCreateStaffingNeedModalOpen = useUIStore((s) => s.setCreateStaffingNeedModalOpen);

  const handleOpenStaffingModal = () => {
    if (opportunityRow) setStaffingNeedOpportunity(opportunityRow);
    setCreateStaffingNeedModalOpen(true);
  };

  // ── Current staffing from staffing index ──────────────────────────────────
  const staffingIndexVersion = useComputedStore((s) => s.staffingIndexVersion);
  const staffingIndex = useMemo(readStaffingIndex, [staffingIndexVersion]);

  const currentStaffing = useMemo(() => {
    if (!staffingIndex) return [];
    // Try Job Code first (7-digit chargeable), then Opportunity ID (6-digit GO)
    const lookupKeys: string[] = [];
    if (jobCode) lookupKeys.push(String(jobCode).trim());
    if (opportunityId) lookupKeys.push(String(opportunityId).trim());

    const seen = new Set();
    const results: any[] = [];
    for (const key of lookupKeys) {
      const entries = staffingIndex[key];
      if (!entries) continue;
      for (const entry of entries) {
        if (seen.has(entry.empId)) continue;
        seen.add(entry.empId);
        results.push({ ...entry, matchedKey: key });
      }
    }
    return results;
  }, [staffingIndex, jobCode, opportunityId]);

  // Read staffing needs directly from store (no local mirror to avoid loops)
  const staffingNeeds = useUserDataStore((s) => s.staffingNeeds[opportunityId]) ?? EMPTY_NEEDS;

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...emptyNeed });
  const [skillInput, setSkillInput] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Total people needed
  const totalPeople = staffingNeeds.reduce((sum, need) => sum + (need.quantity || 0), 0);

  const handleStartAdd = () => {
    setFormData({ ...emptyNeed });
    setSkillInput("");
    setEditingId(null);
    setIsAdding(true);
  };

  const handleStartEdit = (need: any) => {
    setFormData({
      grade: need.grade || "",
      quantity: need.quantity,
      startDate: need.startDate || "",
      endDate: need.endDate || "",
      skills: [...(need.skills || [])],
      probability: need.probability ?? 1,
    });
    setSkillInput("");
    setEditingId(need.id);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!formData.grade || formData.quantity < 1) return;

    const now = new Date().toISOString();
    if (editingId) {
      useUserDataStore.getState().setStaffingNeeds(
        opportunityId,
        staffingNeeds.map((need) =>
          need.id === editingId
            ? {
                ...need,
                grade: formData.grade,
                quantity: formData.quantity,
                startDate: formData.startDate || "",
                endDate: formData.endDate || "",
                skills: formData.skills,
                probability: formData.probability ?? 1,
                updatedAt: now,
              }
            : need
        )
      );
      setEditingId(null);
    } else {
      const newNeed: any = {
        id: generateId(),
        opportunityId,
        grade: formData.grade,
        quantity: formData.quantity,
        utilization: 100,
        startDate: formData.startDate || "",
        endDate: formData.endDate || "",
        skills: formData.skills,
        probability: formData.probability ?? 1,
        createdAt: now,
        updatedAt: now,
      };
      useUserDataStore.getState().setStaffingNeeds(opportunityId, [...staffingNeeds, newNeed]);
      setIsAdding(false);
    }
    setFormData({ ...emptyNeed });
    setSkillInput("");
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ ...emptyNeed });
    setSkillInput("");
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      useUserDataStore.getState().setStaffingNeeds(
        opportunityId,
        staffingNeeds.filter((need) => need.id !== deleteTargetId)
      );
      // Cascade: remove assignments linked to this need from editor states
      const store = useUserDataStore.getState();
      for (const [empId, state] of Object.entries(store.editorStates) as [string, any][]) {
        if (!state?.current) continue;
        const filtered = state.current.filter((s: any) => s.needId !== deleteTargetId);
        if (filtered.length !== state.current.length) {
          store.setEditorState(empId, { ...state, current: filtered });
        }
      }
      if (editingId === deleteTargetId) {
        setEditingId(null);
        setFormData({ ...emptyNeed });
      }
    }
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault();
      const skill = skillInput.trim();
      if (!formData.skills.includes(skill)) {
        setFormData((prev) => ({ ...prev, skills: [...prev.skills, skill] }));
      }
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skillToRemove) }));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR");
    } catch {
      return "-";
    }
  };

  const dateError = !!(formData.startDate && formData.endDate && formData.endDate < formData.startDate);

  const renderForm = () => (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        mb: 2,
        borderRadius: 2,
        bgcolor: alpha(theme.palette.background.paper, 0.9),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        boxShadow: theme.shadows[3],
        transition: "box-shadow 0.3s, transform 0.3s",
        "&:hover": { boxShadow: theme.shadows[6], transform: "translateY(-2px)" },
      }}
    >
      <Typography variant="subtitle2" gutterBottom fontWeight={600} color="primary.main">
        {editingId ? "Edit Staffing Need" : "New Staffing Need"}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
        <Box sx={{ display: "flex", gap: 2 }}>
          <FormControl size="small" sx={{ flex: 2 }}>
            <InputLabel>Grade *</InputLabel>
            <Select
              value={formData.grade}
              label="Grade *"
              onChange={(e) => setFormData((prev) => ({ ...prev, grade: e.target.value }))}
            >
              {[...GRADE_ORDER].reverse().map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Qty"
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData((prev) => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
            inputProps={{ min: 1 }}
            sx={{ width: 80 }}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            size="small"
            label="Start Date"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="End Date"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            error={dateError}
            helperText={dateError ? "End date must be after start date" : ""}
            sx={{ flex: 1 }}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: "text.secondary", whiteSpace: "nowrap", minWidth: 90 }}
          >
            Probability: {Math.round((formData.probability ?? 1) * 100)}%
          </Typography>
          <Slider
            size="small"
            value={formData.probability ?? 1}
            onChange={(_, v) => setFormData((prev) => ({ ...prev, probability: v as number }))}
            min={0}
            max={1}
            step={0.05}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
            sx={{ flex: 1 }}
          />
        </Box>
        <TextField
          size="small"
          label="Skills (press Enter to add)"
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleSkillKeyDown}
          fullWidth
          placeholder="e.g. SAP, Cloud, Data..."
        />
        {formData.skills.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {formData.skills.map((skill) => (
              <Chip
                key={skill}
                label={skill}
                size="small"
                onDelete={() => handleRemoveSkill(skill)}
                sx={{
                  fontSize: "0.75rem",
                  height: 24,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                  "& .MuiChip-deleteIcon": {
                    fontSize: 16,
                    color: alpha(theme.palette.primary.main, 0.5),
                    "&:hover": { color: theme.palette.primary.main },
                  },
                }}
              />
            ))}
          </Box>
        )}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Button size="small" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            disabled={!formData.grade || formData.quantity < 1 || dateError}
            startIcon={<SaveIcon />}
          >
            {editingId ? "Update" : "Add"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );

  // Derived status from editor states
  const editorStates = useUserDataStore((s) => s.editorStates);
  const allAssignments = useMemo(() => getAssignmentsFromEditorStates(editorStates), [editorStates]);
  const needStatuses = useMemo(() => {
    return staffingNeeds.map((n) => ({
      ...n,
      derivedStatus: computeNeedStatus(n, allAssignments),
      assignmentCount: allAssignments.filter((a) => a.needId === n.id && a.status !== "cancelled").length,
    }));
  }, [staffingNeeds, allAssignments]);

  return (
    <Box>
      {/* ── Quick action: open NeedsBoard ── */}
      {staffingNeeds.length > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 1.5,
            p: 1,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            border: 1,
            borderColor: alpha(theme.palette.primary.main, 0.12),
          }}
        >
          <AssignmentIcon sx={{ fontSize: 16, color: "primary.main" }} />
          <Typography variant="caption" sx={{ flex: 1, fontSize: "0.72rem" }}>
            {totalPeople} need{totalPeople > 1 ? "s" : ""} &middot;{" "}
            {needStatuses.filter((n) => n.derivedStatus === "filled").length} filled &middot;{" "}
            {needStatuses.filter((n) => n.derivedStatus === "open").length} open
          </Typography>
          <Button
            size="small"
            variant="outlined"
            sx={{ textTransform: "none", fontSize: "0.7rem" }}
            onClick={handleOpenStaffingModal}
          >
            Manage
          </Button>
          <Button
            size="small"
            variant="text"
            sx={{ textTransform: "none", fontSize: "0.65rem", color: "primary.main", minWidth: 0 }}
            onClick={() => {
              const oppName = opportunityRow?.opportunity || opportunityRow?.opportunity || "";
              useUIStore.getState().setPendingStaffingFilter({ text: oppName, type: "project" });
              navigate("/staffing");
            }}
          >
            Open in Staffing
          </Button>
        </Box>
      )}
      {/* ── Current & Past Staffing Sections ── */}
      {(() => {
        const now = new Date();
        const currentPeople = currentStaffing.filter((p) => new Date(p.startDate) <= now && new Date(p.endDate) >= now);
        const upcomingPeople = currentStaffing.filter((p) => new Date(p.startDate) > now);
        const activePeople = [...currentPeople, ...upcomingPeople];
        const pastPeople = currentStaffing.filter((p) => new Date(p.endDate) < now);

        const renderPersonRow = (person: any) => {
          const start = new Date(person.startDate);
          const end = new Date(person.endDate);
          const isActive = start <= now && end >= now;
          const isUpcoming = start > now;
          const utilColor = getUtilColor(person.utilization);
          return (
            <Box
              key={person.empId}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                py: 0.3,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                <Typography variant="caption" fontWeight={600} noWrap sx={{ fontSize: "0.72rem" }}>
                  {person.name}
                </Typography>
                {person.grade && (
                  <Chip
                    label={person.grade}
                    size="small"
                    sx={{ fontSize: "0.58rem", height: 16, bgcolor: alpha(theme.palette.text.secondary, 0.08) }}
                  />
                )}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
                  {formatDate(person.startDate)} → {formatDate(person.endDate)}
                </Typography>
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: "0.65rem", color: utilColor }}>
                  {person.utilization}%
                </Typography>
              </Box>
            </Box>
          );
        };

        return (
          <>
            {/* Past Staffing */}
            {pastPeople.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.disabled"
                    sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: 0.8 }}
                  >
                    Past Staffing
                  </Typography>
                  <Chip
                    label={`${pastPeople.length}`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.6rem",
                      height: 18,
                      bgcolor: alpha(theme.palette.text.disabled, 0.1),
                      color: "text.disabled",
                    }}
                  />
                </Box>
                <Box sx={{ opacity: 0.6 }}>{pastPeople.map(renderPersonRow)}</Box>
              </Box>
            )}

            {pastPeople.length > 0 && <Divider sx={{ my: 1.5 }} />}

            {/* Current Staffing */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.disabled"
                    sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: 0.8 }}
                  >
                    Current Staffing
                  </Typography>
                  {currentPeople.length > 0 && (
                    <Chip
                      label={`${currentPeople.length}`}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.6rem",
                        height: 18,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        color: theme.palette.success.main,
                      }}
                    />
                  )}
                </Box>
                {jobCode && (
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem" }}>
                    {jobCode}
                  </Typography>
                )}
              </Box>

              {!staffingIndex ? (
                <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic", fontSize: "0.68rem" }}>
                  Import a staffing file in the Staffing tab to view data here
                </Typography>
              ) : currentPeople.length === 0 ? (
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.68rem" }}>
                  No current staffing
                </Typography>
              ) : (
                <Box>{currentPeople.map(renderPersonRow)}</Box>
              )}
            </Box>

            {/* Upcoming Staffing */}
            {upcomingPeople.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.disabled"
                    sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: 0.8 }}
                  >
                    Upcoming Staffing
                  </Typography>
                  <Chip
                    label={`${upcomingPeople.length}`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.6rem",
                      height: 18,
                      bgcolor: alpha(theme.palette.info.main, 0.1),
                      color: theme.palette.info.main,
                    }}
                  />
                </Box>
                <Box sx={{ opacity: 0.8 }}>{upcomingPeople.map(renderPersonRow)}</Box>
              </Box>
            )}

            <Divider sx={{ my: 1.5 }} />
          </>
        );
      })()}

      {/* ── Lost opportunity warning ── */}
      {opportunityRow?.status === 15 && staffingNeeds.length > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            mb: 1,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <Typography variant="caption" sx={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 600 }}>
            This opportunity is lost — staffing needs below may no longer be relevant
          </Typography>
        </Box>
      )}

      {/* ── Staffing Needs Section ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.disabled"
            sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: 0.8 }}
          >
            Staffing Needs
          </Typography>
          {totalPeople > 0 && (
            <Chip
              label={`${totalPeople}`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: "0.6rem",
                height: 18,
                bgcolor: alpha(theme.palette.info.main, 0.1),
                color: theme.palette.info.main,
              }}
            />
          )}
        </Box>
        {!isAdding && !editingId && (
          <IconButton
            size="small"
            onClick={handleOpenStaffingModal}
            sx={{
              width: 28,
              height: 28,
              bgcolor: alpha(theme.palette.info.main, 0.08),
              "&:hover": { bgcolor: alpha(theme.palette.info.main, 0.15) },
            }}
          >
            <AddIcon sx={{ fontSize: 16, color: theme.palette.info.main }} />
          </IconButton>
        )}
      </Box>

      {/* Add form */}
      <Collapse in={isAdding}>{isAdding && renderForm()}</Collapse>

      {/* Staffing needs list */}
      {staffingNeeds.length === 0 && !isAdding ? (
        <Box>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.68rem" }}>
            No staffing needs yet
          </Typography>
        </Box>
      ) : (
        <Box>
          {staffingNeeds.map((need) => (
            <React.Fragment key={need.id}>
              {editingId === need.id ? (
                renderForm()
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 0.3,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                    <Typography variant="caption" fontWeight={600} noWrap sx={{ fontSize: "0.72rem" }}>
                      {(need as any).assignedTo || "Any"}
                    </Typography>
                    <Chip
                      label={need.grade || ""}
                      size="small"
                      sx={{ fontSize: "0.58rem", height: 16, bgcolor: alpha(theme.palette.text.secondary, 0.08) }}
                    />
                    {(need.quantity ?? 0) > 1 && (
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{ fontSize: "0.65rem", color: theme.palette.info.main }}
                      >
                        x{need.quantity}
                      </Typography>
                    )}
                    {need.skills &&
                      need.skills.length > 0 &&
                      need.skills.map((skill) => (
                        <Chip
                          key={skill}
                          label={skill}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: "0.55rem",
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            color: theme.palette.primary.main,
                          }}
                        />
                      ))}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
                      {need.startDate && need.endDate
                        ? `${formatDate(need.startDate)} → ${formatDate(need.endDate)}`
                        : "—"}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{ fontSize: "0.65rem", color: theme.palette.info.main }}
                    >
                      {Math.round(need.utilization ?? 100)}%
                    </Typography>
                  </Box>
                </Box>
              )}
            </React.Fragment>
          ))}
        </Box>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        TransitionComponent={DialogTransition}
        maxWidth="xs"
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Are you sure you want to delete this staffing need?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StaffingNeeds;
