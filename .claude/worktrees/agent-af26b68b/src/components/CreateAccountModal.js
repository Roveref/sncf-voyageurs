import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Typography,
  Autocomplete,
  createFilterOptions,
  alpha,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";

const parentAccountFilter = createFilterOptions({
  limit: 50,
  matchFrom: "any",
});

const CreateAccountModal = ({ open, onClose, onAccountCreated, crmAccounts = [], segmentToSubSegmentMap = {} }) => {
  const theme = useTheme();

  const [formData, setFormData] = useState({
    name: "",
    parentAccount: "",
    country: "",
    segmentCode: "",
    subSegment: "",
  });
  const [errors, setErrors] = useState({});

  // Build a map of account name -> account data for parent auto-fill
  const accountDataMap = useMemo(() => {
    const map = new Map();
    crmAccounts.forEach((crm) => {
      if (crm.Account && !map.has(crm.Account)) {
        map.set(crm.Account, crm);
      }
    });
    return map;
  }, [crmAccounts]);

  // Parent accounts list = unique values from _be_reportingparent column
  const parentAccountsList = useMemo(() => {
    const parents = new Set();
    crmAccounts.forEach((crm) => {
      const parent = crm["Parent Account"];
      if (parent && parent.trim()) {
        parents.add(parent.trim());
      }
    });
    return Array.from(parents).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [crmAccounts]);

  // Extract unique countries from CRM accounts
  const countriesList = useMemo(() => {
    const countries = new Set();
    crmAccounts.forEach((crm) => {
      const country = crm["Country"];
      if (country && country.trim()) {
        countries.add(country.trim());
      }
    });
    return Array.from(countries).sort();
  }, [crmAccounts]);

  // Extract unique segments from CRM accounts + segmentToSubSegmentMap
  const segmentsList = useMemo(() => {
    const segments = new Set();
    Object.keys(segmentToSubSegmentMap).forEach((code) => segments.add(code));
    crmAccounts.forEach((crm) => {
      const code = crm["Sub Segment Code"];
      if (code && code.trim()) segments.add(code.trim());
    });
    return Array.from(segments).sort();
  }, [crmAccounts, segmentToSubSegmentMap]);

  // Sub-segments for selected segment
  const subSegmentsList = useMemo(() => {
    if (!formData.segmentCode) return [];
    const subs = new Set();
    if (segmentToSubSegmentMap[formData.segmentCode]) {
      segmentToSubSegmentMap[formData.segmentCode].forEach((s) => subs.add(s));
    }
    crmAccounts.forEach((crm) => {
      if (crm["Sub Segment Code"] === formData.segmentCode) {
        const sub = crm["Sub Segment"];
        if (sub && sub.trim()) subs.add(sub.trim());
      }
    });
    return Array.from(subs).sort();
  }, [formData.segmentCode, crmAccounts, segmentToSubSegmentMap]);

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // When parent account is selected, auto-fill segment and sub-segment
      if (field === "parentAccount" && value) {
        const parentData = accountDataMap.get(value);
        if (parentData) {
          updated.segmentCode = parentData["Sub Segment Code"] || "";
          updated.subSegment = parentData["Sub Segment"] || "";
        }
      }

      // Reset sub-segment when segment changes manually
      if (field === "segmentCode") {
        updated.subSegment = "";
      }
      return updated;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = "Required";
    }
    if (!formData.segmentCode) {
      newErrors.segmentCode = "Required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const newAccount = {
      Account: formData.name.trim(),
      "Sub Segment Code": formData.segmentCode,
      "Sub Segment": formData.subSegment,
      Country: formData.country,
      "Parent Account": formData.parentAccount,
      isManual: true,
      createdAt: new Date().toISOString(),
    };

    onAccountCreated(newAccount);
    handleClose();
  };

  const handleClose = () => {
    setFormData({ name: "", parentAccount: "", country: "", segmentCode: "", subSegment: "" });
    setErrors({});
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 2,
          pt: 3,
          px: 4,
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <AddBusinessIcon sx={{ color: theme.palette.primary.main, fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Create New Account
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 4 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
          {/* Account Name */}
          <TextField
            fullWidth
            label="Account Name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            size="small"
            autoFocus
          />

          {/* Parent Account - from _be_reportingparent column */}
          <Autocomplete
            fullWidth
            freeSolo
            options={parentAccountsList}
            filterOptions={parentAccountFilter}
            value={formData.parentAccount}
            onChange={(e, newValue) => handleChange("parentAccount", newValue || "")}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Parent Account (optional)"
                size="small"
                placeholder="Type to search parent accounts..."
              />
            )}
          />

          {/* Country */}
          <Autocomplete
            fullWidth
            freeSolo
            options={countriesList}
            value={formData.country}
            onChange={(e, newValue) => handleChange("country", newValue || "")}
            renderInput={(params) => <TextField {...params} label="Country" size="small" />}
          />

          {/* Segment */}
          <Autocomplete
            fullWidth
            options={segmentsList}
            value={formData.segmentCode}
            onChange={(e, newValue) => handleChange("segmentCode", newValue || "")}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Segment"
                error={!!errors.segmentCode}
                helperText={errors.segmentCode}
                size="small"
              />
            )}
          />

          {/* Sub-Segment */}
          <Autocomplete
            fullWidth
            freeSolo
            options={subSegmentsList}
            value={formData.subSegment}
            onChange={(e, newValue) => handleChange("subSegment", newValue || "")}
            disabled={!formData.segmentCode}
            renderInput={(params) => <TextField {...params} label="Sub-Segment" size="small" />}
          />
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 4,
          py: 2.5,
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        }}
      >
        <Button onClick={handleClose} variant="outlined" sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" sx={{ textTransform: "none" }}>
          Create Account
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateAccountModal;
