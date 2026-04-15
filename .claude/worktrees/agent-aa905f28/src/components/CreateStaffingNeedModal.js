/**
 * CreateStaffingNeedModal
 * Standalone modal for creating a staffing need from the FAB.
 * User selects an opportunity, then fills in the staffing need form.
 */

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Autocomplete,
  alpha,
  useTheme,
  Grid,
} from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import SaveIcon from "@mui/icons-material/Save";
import { STAFFING_PROFILES } from "../utils/constants";

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const emptyForm = {
  profile: "",
  quantity: 1,
  startDate: "",
  endDate: "",
  skills: [],
};

const CreateStaffingNeedModal = ({ open, onClose, opportunityData = [] }) => {
  const theme = useTheme();
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [skillInput, setSkillInput] = useState("");

  const handleClose = () => {
    setSelectedOpportunity(null);
    setFormData({ ...emptyForm });
    setSkillInput("");
    onClose();
  };

  const handleSave = () => {
    if (!selectedOpportunity || !formData.profile || formData.quantity < 1) return;

    const oppId = selectedOpportunity["Opportunity ID"];
    const now = new Date().toISOString();
    const newNeed = {
      id: generateId(),
      opportunityId: oppId,
      profile: formData.profile,
      quantity: formData.quantity,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      skills: formData.skills,
      createdAt: now,
      updatedAt: now,
    };

    // Save directly to localStorage
    const existing = JSON.parse(localStorage.getItem(`staffing_needs_${oppId}`) || "[]");
    existing.push(newNeed);
    localStorage.setItem(`staffing_needs_${oppId}`, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent("staffingNeedsChanged"));

    handleClose();
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

  const dateError = formData.startDate && formData.endDate && formData.endDate < formData.startDate;

  // Build options list for the opportunity autocomplete
  const opportunityOptions = opportunityData.map((opp) => ({
    ...opp,
    label: `${opp["Opportunity"] || opp["Opportunity ID"]}`,
    account: opp["Account"] || "",
  }));

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <GroupIcon color="info" />
        <Typography variant="h6" component="span">
          New Staffing Need
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
          {/* Opportunity Selector */}
          <Autocomplete
            options={opportunityOptions}
            value={selectedOpportunity}
            onChange={(_, value) => setSelectedOpportunity(value)}
            getOptionLabel={(option) => option.label || ""}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option["Opportunity ID"]}>
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
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Opportunity *"
                size="small"
                placeholder="Search by opportunity name..."
              />
            )}
            isOptionEqualToValue={(option, value) => option["Opportunity ID"] === value["Opportunity ID"]}
          />

          {selectedOpportunity && (
            <>
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
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))
                  }
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
                      onDelete={() =>
                        setFormData((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }))
                      }
                      sx={{
                        fontSize: "0.75rem",
                        height: 24,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                      }}
                    />
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          startIcon={<SaveIcon />}
          disabled={!selectedOpportunity || !formData.profile || formData.quantity < 1 || dateError}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateStaffingNeedModal;
