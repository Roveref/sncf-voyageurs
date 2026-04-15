/**
 * StaffingNeeds Component
 * Manages staffing needs for a specific opportunity.
 * Designed as a tab panel within OpportunityActions.
 * Dual-view: "Current Staffing" (placeholder) + "Staffing Needs" (CRUD).
 * Persists to localStorage (keyed by staffing_needs_{opportunityId})
 */

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Card,
  Grid,
  Tooltip,
  Collapse,
  Divider,
  Paper,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import PeopleIcon from "@mui/icons-material/People";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import EventIcon from "@mui/icons-material/Event";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import { STAFFING_PROFILES } from "../../../utils/constants";

const PROFILE_COLORS = {
  intern: "default",
  analyst: "default",
  consultant: "info",
  senior_consultant: "info",
  manager: "warning",
  senior_manager: "warning",
  associate_director: "secondary",
  partner: "error",
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const emptyNeed = {
  profile: "",
  quantity: 1,
  startDate: "",
  endDate: "",
  skills: [],
};

const StaffingNeeds = ({ opportunityId }) => {
  const theme = useTheme();

  // Lazy-initialize from localStorage (same pattern as OpportunityActions)
  const [staffingNeeds, setStaffingNeeds] = useState(() => {
    try {
      const saved = localStorage.getItem(`staffing_needs_${opportunityId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...emptyNeed });
  const [skillInput, setSkillInput] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Re-load from localStorage when opportunityId changes
  useEffect(() => {
    const saved = localStorage.getItem(`staffing_needs_${opportunityId}`);
    setStaffingNeeds(saved ? JSON.parse(saved) : []);
  }, [opportunityId]);

  // Re-sync from localStorage when another component modifies data
  useEffect(() => {
    const handler = () => {
      const savedRaw = localStorage.getItem(`staffing_needs_${opportunityId}`);
      const saved = savedRaw ? JSON.parse(savedRaw) : [];
      setStaffingNeeds((prev) => (JSON.stringify(prev) === JSON.stringify(saved) ? prev : saved));
    };
    window.addEventListener("staffingNeedsChanged", handler);
    return () => window.removeEventListener("staffingNeedsChanged", handler);
  }, [opportunityId]);

  // Auto-save to localStorage
  useEffect(() => {
    if (staffingNeeds.length > 0) {
      localStorage.setItem(`staffing_needs_${opportunityId}`, JSON.stringify(staffingNeeds));
    } else {
      localStorage.removeItem(`staffing_needs_${opportunityId}`);
    }
    window.dispatchEvent(new CustomEvent("staffingNeedsChanged"));
  }, [staffingNeeds, opportunityId]);

  // Total people needed
  const totalPeople = staffingNeeds.reduce((sum, need) => sum + (need.quantity || 0), 0);

  // Get profile label from value
  const getProfileLabel = (value) => {
    const profile = STAFFING_PROFILES.find((p) => p.value === value);
    return profile ? profile.label : value;
  };

  const handleStartAdd = () => {
    setFormData({ ...emptyNeed });
    setSkillInput("");
    setEditingId(null);
    setIsAdding(true);
  };

  const handleStartEdit = (need) => {
    setFormData({
      profile: need.profile,
      quantity: need.quantity,
      startDate: need.startDate || "",
      endDate: need.endDate || "",
      skills: [...(need.skills || [])],
    });
    setSkillInput("");
    setEditingId(need.id);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!formData.profile || formData.quantity < 1) return;

    const now = new Date().toISOString();
    if (editingId) {
      setStaffingNeeds((prev) =>
        prev.map((need) =>
          need.id === editingId
            ? {
                ...need,
                profile: formData.profile,
                quantity: formData.quantity,
                startDate: formData.startDate || null,
                endDate: formData.endDate || null,
                skills: formData.skills,
                updatedAt: now,
              }
            : need
        )
      );
      setEditingId(null);
    } else {
      const newNeed = {
        id: generateId(),
        opportunityId,
        profile: formData.profile,
        quantity: formData.quantity,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        skills: formData.skills,
        createdAt: now,
        updatedAt: now,
      };
      setStaffingNeeds((prev) => [...prev, newNeed]);
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
      setStaffingNeeds((prev) => prev.filter((need) => need.id !== deleteTargetId));
      if (editingId === deleteTargetId) {
        setEditingId(null);
        setFormData({ ...emptyNeed });
      }
    }
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault();
      const skill = skillInput.trim();
      if (!formData.skills.includes(skill)) {
        setFormData((prev) => ({ ...prev, skills: [...prev.skills, skill] }));
      }
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skillToRemove) }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR");
    } catch {
      return "-";
    }
  };

  const dateError = formData.startDate && formData.endDate && formData.endDate < formData.startDate;

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
        transition: "all 0.3s",
        "&:hover": { boxShadow: theme.shadows[6], transform: "translateY(-2px)" },
      }}
    >
      <Typography variant="subtitle2" gutterBottom fontWeight={600} color="primary.main">
        {editingId ? "Edit Staffing Need" : "New Staffing Need"}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
        <Box sx={{ display: "flex", gap: 2 }}>
          <FormControl size="small" sx={{ flex: 2 }}>
            <InputLabel>Profile *</InputLabel>
            <Select
              value={formData.profile}
              label="Profile *"
              onChange={(e) => setFormData((prev) => ({ ...prev, profile: e.target.value }))}
            >
              {STAFFING_PROFILES.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
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
            disabled={!formData.profile || formData.quantity < 1 || dateError}
            startIcon={<SaveIcon />}
          >
            {editingId ? "Update" : "Add"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );

  return (
    <Box>
      {/* ── Current Staffing Section (placeholder) ── */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <PeopleIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
            Current Staffing
          </Typography>
        </Box>
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            textAlign: "center",
            borderStyle: "dashed",
            borderColor: alpha(theme.palette.divider, 0.4),
            borderRadius: 2,
            bgcolor: alpha(theme.palette.background.default, 0.3),
          }}
        >
          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
            Coming soon — current staffing data will appear here
          </Typography>
        </Paper>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* ── Staffing Needs Section ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WorkOutlineIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />
          <Typography variant="subtitle2" fontWeight={700} color="info.main">
            Staffing Needs
          </Typography>
          {totalPeople > 0 && (
            <Chip
              label={`${totalPeople} person${totalPeople > 1 ? "s" : ""}`}
              size="small"
              color="info"
              sx={{ fontWeight: 600, fontSize: "0.7rem", height: 22 }}
            />
          )}
        </Box>
        {!isAdding && !editingId && (
          <Button size="small" startIcon={<AddIcon />} onClick={handleStartAdd} variant="contained" color="primary">
            Add Need
          </Button>
        )}
      </Box>

      {/* Add form */}
      <Collapse in={isAdding}>{isAdding && renderForm()}</Collapse>

      {/* Staffing needs list */}
      {staffingNeeds.length === 0 && !isAdding ? (
        <Paper
          elevation={3}
          sx={{
            p: 3,
            textAlign: "center",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            transition: "all 0.3s",
            "&:hover": { boxShadow: "0 8px 24px rgba(0,0,0,0.2)", transform: "translateY(-2px)" },
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No staffing needs defined yet
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            Click "Add Need" to define staffing requirements
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {staffingNeeds.map((need) => (
            <React.Fragment key={need.id}>
              {editingId === need.id ? (
                renderForm()
              ) : (
                <Card
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      borderColor: alpha(theme.palette.info.main, 0.3),
                      boxShadow: `0 2px 8px ${alpha(theme.palette.info.main, 0.08)}`,
                    },
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <Chip
                          icon={<PersonIcon sx={{ fontSize: 14 }} />}
                          label={getProfileLabel(need.profile)}
                          size="small"
                          color={PROFILE_COLORS[need.profile] || "default"}
                          sx={{ fontWeight: 600, fontSize: "0.75rem", height: 24 }}
                        />
                        <Typography variant="body2" fontWeight={600}>
                          x{need.quantity}
                        </Typography>
                        {(need.startDate || need.endDate) && (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <EventIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(need.startDate)} → {formatDate(need.endDate)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      {need.skills && need.skills.length > 0 && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                          {need.skills.map((skill) => (
                            <Chip
                              key={skill}
                              label={skill}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: "0.65rem",
                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                color: theme.palette.primary.main,
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                              }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5, ml: 1 }}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleStartEdit(need)}
                          sx={{ color: theme.palette.info.main }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setDeleteTargetId(need.id);
                            setDeleteDialogOpen(true);
                          }}
                          sx={{ color: theme.palette.error.main }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Card>
              )}
            </React.Fragment>
          ))}
        </Box>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs">
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
