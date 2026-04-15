/**
 * CreateOpportunityModal Component
 * Modal for creating and editing manual opportunities
 * Design matches OpportunityExpandedDetails for visual consistency
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Typography,
  Autocomplete,
  createFilterOptions,
  MenuItem,
  alpha,
  useTheme,
  Grid,
  Card,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import AddIcon from "@mui/icons-material/Add";
import GroupIcon from "@mui/icons-material/Group";
import Chip from "@mui/material/Chip";
import { STAFFING_PROFILES } from "../utils/constants";
import CreateAccountModal from "./CreateAccountModal";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";

// Limit account autocomplete to 50 results for performance (65k+ accounts)
const crmFilterOptions = createFilterOptions({
  limit: 50,
  matchFrom: "any",
});

// Status options based on STATUS_TEXT constants
const STATUS_OPTIONS = [
  { value: 1, label: "Lead Identified" },
  { value: 4, label: "Go Approved" },
  { value: 6, label: "Proposal Submitted" },
  { value: 11, label: "Client Won" },
  { value: 13, label: "AEL" },
  { value: 14, label: "Booked" },
  { value: 15, label: "Lost" },
];

const CreateOpportunityModal = ({
  open,
  onClose,
  editOpportunity,
  setEditOpportunity,
  onOpportunityCreated,
  onOpportunityUpdated,
  onOpportunityDeleted,
  onAccountCreated,
  filterOptions = {},
  opportunityData = [],
  crmAccounts = [],
  manualAccounts = [],
  segmentToSubSegmentMap = {},
}) => {
  const theme = useTheme();
  const isEditMode = !!editOpportunity;
  const [createAccountOpen, setCreateAccountOpen] = useState(false);

  // Extract lists from filterOptions
  // Separate opportunity accounts (priority) from CRM-only accounts
  const opportunityAccountsList = useMemo(() => {
    const oppAccounts = new Set();
    opportunityData.forEach((opp) => {
      const account = opp["Account"];
      if (account && account.trim()) oppAccounts.add(account);
    });
    return [...oppAccounts].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [opportunityData]);

  const allAccountsList = useMemo(() => {
    const accountSet = new Set(filterOptions.accounts || []);
    manualAccounts.forEach((a) => accountSet.add(a.Account));
    return [...accountSet].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [filterOptions.accounts, manualAccounts]);

  // Set of manual account names for visual badge - uses small manualAccounts array
  const manualAccountSet = useMemo(() => {
    return new Set(manualAccounts.map((a) => a.Account));
  }, [manualAccounts]);
  const serviceLinesList = filterOptions.serviceLine1 || [];
  const serviceOfferingsList = filterOptions.serviceOfferings || [];

  // Base account-to-segment mapping from CRM + opportunity data (stable, only changes on file upload)
  const baseAccountToSegmentMap = useMemo(() => {
    const map = {};
    crmAccounts.forEach((crm) => {
      const account = crm["Account"];
      const segmentCode = crm["Sub Segment Code"];
      if (account && segmentCode && !map[account]) {
        map[account] = { segmentCode, subSegment: crm["Sub Segment"] };
      }
    });
    opportunityData.forEach((opp) => {
      const account = opp["Account"];
      const segmentCode = opp["Sub Segment Code"];
      if (account && segmentCode && !map[account]) {
        map[account] = { segmentCode, subSegment: opp["Sub Segment"] };
      }
    });
    return map;
  }, [opportunityData, crmAccounts]);

  // Merge with manual accounts (small array, fast)
  const accountToSegmentMap = useMemo(() => {
    if (manualAccounts.length === 0) return baseAccountToSegmentMap;
    const map = { ...baseAccountToSegmentMap };
    manualAccounts.forEach((acc) => {
      if (acc.Account && acc["Sub Segment Code"] && !map[acc.Account]) {
        map[acc.Account] = { segmentCode: acc["Sub Segment Code"], subSegment: acc["Sub Segment"] };
      }
    });
    return map;
  }, [baseAccountToSegmentMap, manualAccounts]);

  // Get unique technology partners from existing data
  const techPartnersList = useMemo(() => {
    const partners = new Set();
    opportunityData.forEach((opp) => {
      ["Technology Partner", "Technology Partner 1", "Technology Partner 2", "Technology Partner 3"].forEach((key) => {
        const partner = opp[key];
        if (partner && partner.trim() && partner !== "-") {
          partner.split(",").forEach((p) => {
            const trimmed = p.trim();
            if (trimmed) partners.add(trimmed);
          });
        }
      });
    });
    return Array.from(partners).sort();
  }, [opportunityData]);

  // Get unique project types from existing data
  const projectTypesList = useMemo(() => {
    const types = new Set();
    opportunityData.forEach((opp) => {
      const projectType = opp["Project Type"];
      if (projectType && projectType.trim() && projectType !== "-") {
        types.add(projectType.trim());
      }
    });
    return Array.from(types).sort();
  }, [opportunityData]);

  // Get unique managers from existing data
  const managersList = useMemo(() => {
    const managers = new Set();
    opportunityData.forEach((opp) => {
      const manager = opp["Manager"];
      if (manager && manager.trim() && manager !== "-") {
        managers.add(manager.trim());
      }
    });
    return Array.from(managers).sort();
  }, [opportunityData]);

  // Get unique partners from existing data
  const partnersList = useMemo(() => {
    const partners = new Set();
    opportunityData.forEach((opp) => {
      const partner = opp["Partner"];
      if (partner && partner.trim() && partner !== "-") {
        partners.add(partner.trim());
      }
    });
    return Array.from(partners).sort();
  }, [opportunityData]);

  // Get unique engagement managers from existing data
  const engagementManagersList = useMemo(() => {
    const ems = new Set();
    opportunityData.forEach((opp) => {
      const em = opp["EM"];
      if (em && em.trim() && em !== "-") {
        ems.add(em.trim());
      }
    });
    return Array.from(ems).sort();
  }, [opportunityData]);

  // Get unique engagement partners from existing data
  const engagementPartnersList = useMemo(() => {
    const eps = new Set();
    opportunityData.forEach((opp) => {
      const ep = opp["EP"];
      if (ep && ep.trim() && ep !== "-") {
        eps.add(ep.trim());
      }
    });
    return Array.from(eps).sort();
  }, [opportunityData]);

  // Generate Opportunity ID format: M-XXXXXX
  const generateOpportunityId = () => {
    const random = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    return `M-${random}`;
  };

  // Format number with spaces as thousands separator (French format)
  const formatNumberWithSpaces = (value) => {
    if (!value && value !== 0) return "";
    const numValue = typeof value === "string" ? parseFloat(value.replace(/\s/g, "")) : value;
    if (isNaN(numValue)) return "";
    return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  // Parse number from formatted string (remove spaces)
  const parseNumberFromFormatted = (formattedValue) => {
    if (!formattedValue) return "";
    const cleaned = formattedValue.replace(/\s/g, "");
    return cleaned;
  };

  const [formData, setFormData] = useState({
    "Opportunity ID": generateOpportunityId(),
    Opportunity: "",
    Account: "",
    Status: 1,
    "Win %": "",
    "Gross Revenue": "",
    "Net Revenue": "",
    "CM1%": "",
    "Project Type": "",
    "Booking Date": "",
    "Actual Booking Date": "",
    "Technology Partner": "",
    "Service Line 1": "",
    "Service Offering 1": "",
    "Allocation 1": "",
    "Sub Segment Code": "",
    "Sub Segment": "",
    "Service Line 2": "",
    "Service Offering 2": "",
    "Allocation 2": "",
    "Service Line 3": "",
    "Service Offering 3": "",
    "Allocation 3": "",
    Manager: "",
    Partner: "",
    EM: "",
    EP: "",
    "Lost Comment": "",
    "Creation Date": new Date().toISOString(),
  });

  const [errors, setErrors] = useState({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Staffing needs state
  const [staffingNeeds, setStaffingNeeds] = useState([]);
  const [staffingForm, setStaffingForm] = useState({ profile: "", quantity: 1 });

  // Calculate total allocation percentage
  const totalAllocation = useMemo(() => {
    const alloc1 = parseFloat(formData["Allocation 1"]) || 0;
    const alloc2 = parseFloat(formData["Allocation 2"]) || 0;
    const alloc3 = parseFloat(formData["Allocation 3"]) || 0;
    return alloc1 + alloc2 + alloc3;
  }, [formData["Allocation 1"], formData["Allocation 2"], formData["Allocation 3"]]);

  // Check if status is Booked or Lost
  const isBooked = formData["Status"] === 14;
  const isLost = formData["Status"] === 15;

  // Get status color based on status value
  const getStatusColor = (status) => {
    switch (status) {
      case 1:
      case 4:
        return {
          bgcolor: alpha(theme.palette.primary.light, 0.15),
          color: theme.palette.primary.light,
          borderColor: alpha(theme.palette.primary.light, 0.3),
          headerBg: theme.palette.primary.light,
        };
      case 6:
        return {
          bgcolor: alpha(theme.palette.primary.main, 0.15),
          color: theme.palette.primary.main,
          borderColor: alpha(theme.palette.primary.main, 0.3),
          headerBg: theme.palette.primary.main,
        };
      case 11:
      case 13:
        return {
          bgcolor: alpha(theme.palette.primary.dark, 0.15),
          color: theme.palette.primary.dark,
          borderColor: alpha(theme.palette.primary.dark, 0.3),
          headerBg: theme.palette.primary.dark,
        };
      case 14:
        return {
          bgcolor: alpha(theme.palette.success.main, 0.15),
          color: theme.palette.success.main,
          borderColor: alpha(theme.palette.success.main, 0.3),
          headerBg: theme.palette.success.main,
        };
      case 15:
        return {
          bgcolor: alpha(theme.palette.error.main, 0.15),
          color: theme.palette.error.main,
          borderColor: alpha(theme.palette.error.main, 0.3),
          headerBg: theme.palette.error.main,
        };
      default:
        return {
          bgcolor: alpha(theme.palette.grey[500], 0.15),
          color: theme.palette.grey[700],
          borderColor: alpha(theme.palette.grey[500], 0.3),
          headerBg: theme.palette.grey[500],
        };
    }
  };

  const statusColor = getStatusColor(formData["Status"]);

  // Load edit data when in edit mode
  useEffect(() => {
    if (isEditMode && editOpportunity) {
      setFormData({
        "Opportunity ID": editOpportunity["Opportunity ID"],
        Opportunity: editOpportunity["Opportunity"] || "",
        Account: editOpportunity["Account"] || "",
        Status: editOpportunity["Status"] || 1,
        "Win %": editOpportunity["Win %"] || "",
        "Gross Revenue": editOpportunity["Gross Revenue"] || "",
        "Net Revenue": editOpportunity["Net Revenue"] || "",
        "CM1%": editOpportunity["CM1%"] || "",
        "Project Type": editOpportunity["Project Type"] || "",
        "Booking Date": editOpportunity["Booking Date"] || "",
        "Actual Booking Date": editOpportunity["Actual Booking Date"] || "",
        "Technology Partner": editOpportunity["Technology Partner"] || "",
        "Service Line 1": editOpportunity["Service Line 1"] || "",
        "Service Offering 1": editOpportunity["Service Offering 1"] || "",
        "Allocation 1": editOpportunity["Allocation 1"] || "",
        "Sub Segment Code": editOpportunity["Sub Segment Code"] || "",
        "Sub Segment": editOpportunity["Sub Segment"] || "",
        "Service Line 2": editOpportunity["Service Line 2"] || "",
        "Service Offering 2": editOpportunity["Service Offering 2"] || "",
        "Allocation 2": editOpportunity["Allocation 2"] || "",
        "Service Line 3": editOpportunity["Service Line 3"] || "",
        "Service Offering 3": editOpportunity["Service Offering 3"] || "",
        "Allocation 3": editOpportunity["Allocation 3"] || "",
        Manager: editOpportunity["Manager"] || "",
        Partner: editOpportunity["Partner"] || "",
        EM: editOpportunity["EM"] || "",
        EP: editOpportunity["EP"] || "",
        "Lost Comment": editOpportunity["Lost Comment"] || "",
        "Creation Date": editOpportunity["Creation Date"] || new Date().toISOString(),
      });
    } else {
      // Reset form for new opportunity
      setFormData({
        "Opportunity ID": generateOpportunityId(),
        Opportunity: "",
        Account: "",
        Status: 1,
        "Win %": "",
        "Gross Revenue": "",
        "Net Revenue": "",
        "CM1%": "",
        "Project Type": "",
        "Booking Date": "",
        "Actual Booking Date": "",
        "Technology Partner": "",
        "Service Line 1": "",
        "Service Offering 1": "",
        "Allocation 1": "",
        "Sub Segment Code": "",
        "Sub Segment": "",
        "Service Line 2": "",
        "Service Offering 2": "",
        "Allocation 2": "",
        "Service Line 3": "",
        "Service Offering 3": "",
        "Allocation 3": "",
        Manager: "",
        Partner: "",
        EM: "",
        EP: "",
        "Lost Comment": "",
        "Creation Date": new Date().toISOString(),
      });
    }
    setErrors({});
    // Load existing staffing needs when editing
    if (isEditMode && editOpportunity) {
      try {
        const saved = localStorage.getItem(`staffing_needs_${editOpportunity["Opportunity ID"]}`);
        setStaffingNeeds(saved ? JSON.parse(saved) : []);
      } catch {
        setStaffingNeeds([]);
      }
    } else {
      setStaffingNeeds([]);
    }
    setStaffingForm({ profile: "", quantity: 1 });
  }, [editOpportunity, isEditMode, open]);

  const handleClose = () => {
    if (setEditOpportunity) {
      setEditOpportunity(null);
    }
    if (onClose) {
      onClose();
    }
    setErrors({});
  };

  // Handle new account created from CreateAccountModal
  const handleNewAccountCreated = (newAccount) => {
    // Propagate to App.js to add to crmAccounts
    if (onAccountCreated) {
      onAccountCreated(newAccount);
    }
    // Select the new account and auto-fill segment
    setFormData((prev) => ({
      ...prev,
      Account: newAccount.Account,
      "Sub Segment Code": newAccount["Sub Segment Code"] || "",
      "Sub Segment": newAccount["Sub Segment"] || "",
    }));
  };

  const handleChange = (field, value) => {
    // Auto-fill segment code and sub-segment when account is selected
    if (field === "Account" && value && accountToSegmentMap[value]) {
      setFormData((prev) => ({
        ...prev,
        Account: value,
        "Sub Segment Code": accountToSegmentMap[value].segmentCode,
        "Sub Segment": accountToSegmentMap[value].subSegment || "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  // Copy Engagement Manager/Partner to Manager/Partner
  const handleCopyEngagementToAccount = () => {
    setFormData((prev) => ({
      ...prev,
      Manager: prev["EM"] || "",
      Partner: prev["EP"] || "",
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields validation
    if (!formData["Opportunity"]?.trim()) {
      newErrors["Opportunity"] = "Required";
    }
    if (!formData["Account"]?.trim()) {
      newErrors["Account"] = "Required";
    }
    if (!formData["Status"]) {
      newErrors["Status"] = "Required";
    }
    if (!formData["Gross Revenue"] && formData["Gross Revenue"] !== 0) {
      newErrors["Gross Revenue"] = "Required";
    }
    if (!formData["Net Revenue"] && formData["Net Revenue"] !== 0) {
      newErrors["Net Revenue"] = "Required";
    }
    if (!formData["Service Line 1"]?.trim()) {
      newErrors["Service Line 1"] = "Required";
    }

    // If status is Booked, Actual Booking Date is required
    if (isBooked && !formData["Actual Booking Date"]) {
      newErrors["Actual Booking Date"] = "Required when status is Booked";
    }

    // Check allocation total = 100% if any allocations are provided
    const hasAllocations = formData["Allocation 1"] || formData["Allocation 2"] || formData["Allocation 3"];
    if (hasAllocations && totalAllocation !== 100) {
      newErrors["Allocation"] = "Total allocation must equal 100%";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    // Prepare opportunity data
    const opportunityData = {
      ...formData,
      isManual: true,
      "Win %": parseFloat(formData["Win %"]) || 0,
      "Gross Revenue": parseFloat(formData["Gross Revenue"]) || 0,
      "Net Revenue": parseFloat(formData["Net Revenue"]) || 0,
      "CM1%": parseFloat(formData["CM1%"]) || 0,
      "Allocation 1": parseFloat(formData["Allocation 1"]) || 0,
      "Allocation 2": parseFloat(formData["Allocation 2"]) || 0,
      "Allocation 3": parseFloat(formData["Allocation 3"]) || 0,
      "Estimated Booking Date": formData["Booking Date"] || "",
      "Booking/Lost Date": formData["Actual Booking Date"] || "",
    };

    // Save to localStorage
    const existingOpportunities = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");

    if (isEditMode) {
      // Update existing opportunity
      const index = existingOpportunities.findIndex(
        (opp) => opp["Opportunity ID"] === opportunityData["Opportunity ID"]
      );
      if (index !== -1) {
        existingOpportunities[index] = opportunityData;
      }
      localStorage.setItem("manual_opportunities", JSON.stringify(existingOpportunities));

      if (onOpportunityUpdated) {
        onOpportunityUpdated(opportunityData);
      }
    } else {
      // Create new opportunity
      existingOpportunities.push(opportunityData);
      localStorage.setItem("manual_opportunities", JSON.stringify(existingOpportunities));

      if (onOpportunityCreated) {
        onOpportunityCreated(opportunityData);
      }
    }

    // Save staffing needs to localStorage
    const oppId = opportunityData["Opportunity ID"];
    if (staffingNeeds.length > 0) {
      localStorage.setItem(`staffing_needs_${oppId}`, JSON.stringify(staffingNeeds));
    } else {
      localStorage.removeItem(`staffing_needs_${oppId}`);
    }
    window.dispatchEvent(new CustomEvent("staffingNeedsChanged"));

    handleClose();
  };

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!isEditMode || !editOpportunity) return;

    // Remove from localStorage
    const existingOpportunities = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");
    const filtered = existingOpportunities.filter((opp) => opp["Opportunity ID"] !== editOpportunity["Opportunity ID"]);
    localStorage.setItem("manual_opportunities", JSON.stringify(filtered));

    if (onOpportunityDeleted) {
      onOpportunityDeleted(editOpportunity["Opportunity ID"]);
    }

    setDeleteConfirmOpen(false);
    handleClose();
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
  };

  // Get service offerings filtered by service line
  const getOfferingsForServiceLine = (serviceLine) => {
    if (!serviceLine) return [];
    return serviceOfferingsList
      .filter((offering) => offering.startsWith(serviceLine + "::"))
      .map((offering) => offering.split("::")[1]);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: theme.shadows[10],
            maxHeight: "90vh",
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: 0,
              backgroundColor: alpha(theme.palette.background.paper, 0.7),
              border: `1px solid ${alpha(statusColor.headerBg, 0.1)}`,
              boxShadow: "none",
            }}
          >
            {/* Opportunity Title Banner */}
            <Box
              sx={{
                p: 2.5,
                bgcolor: alpha(statusColor.headerBg, 0.06),
                borderBottom: `1px solid ${alpha(statusColor.headerBg, 0.1)}`,
                backgroundImage: `linear-gradient(to right, ${alpha(
                  statusColor.headerBg,
                  0.1
                )}, ${alpha(statusColor.headerBg, 0.04)})`,
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Box sx={{ flex: 1, mr: 2 }}>
                  {/* Opportunity Name Input */}
                  <TextField
                    fullWidth
                    placeholder="Opportunity Name"
                    value={formData["Opportunity"]}
                    onChange={(e) => handleChange("Opportunity", e.target.value)}
                    error={!!errors["Opportunity"]}
                    helperText={errors["Opportunity"]}
                    variant="standard"
                    sx={{
                      mb: 1,
                      "& .MuiInputBase-input": {
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: theme.palette.primary.main,
                      },
                    }}
                  />

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {/* Win % Input */}
                    <TextField
                      type="number"
                      placeholder="Win %"
                      value={formData["Win %"]}
                      onChange={(e) => handleChange("Win %", e.target.value)}
                      size="small"
                      inputProps={{ min: 0, max: 150 }}
                      sx={{
                        width: 80,
                        "& .MuiInputBase-input": { fontSize: "0.75rem", textAlign: "center" },
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      ID: {formData["Opportunity ID"]}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                  </IconButton>
                  {/* Status Selector */}
                  <TextField
                    select
                    value={formData["Status"]}
                    onChange={(e) => handleChange("Status", e.target.value)}
                    error={!!errors["Status"]}
                    size="small"
                    sx={{
                      minWidth: 150,
                      "& .MuiOutlinedInput-root": {
                        fontWeight: 600,
                        backgroundColor: statusColor.bgcolor,
                        color: statusColor.color,
                        border: `1px solid ${statusColor.borderColor}`,
                        borderRadius: "8px",
                      },
                    }}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              </Box>
            </Box>

            {/* Lost Comment Section - Only for lost status */}
            {isLost && (
              <Box
                sx={{
                  p: 2.5,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                }}
              >
                <Box
                  sx={{
                    backgroundColor: alpha(theme.palette.error.main, 0.06),
                    borderRadius: "8px",
                    border: "1px solid rgb(254, 226, 226)",
                    maxWidth: "95%",
                    mx: "auto",
                    p: 2,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={600} color="error.main" sx={{ mb: 1.5 }}>
                    Lost Comment
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Enter reason for loss..."
                    value={formData["Lost Comment"]}
                    onChange={(e) => handleChange("Lost Comment", e.target.value)}
                    variant="outlined"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        bgcolor: alpha(theme.palette.error.main, 0.08),
                        borderLeft: `3px solid ${theme.palette.error.main}`,
                      },
                    }}
                  />
                </Box>
              </Box>
            )}

            {/* Total Opportunity Amount */}
            <Box
              sx={{
                p: 2.5,
                bgcolor: alpha(theme.palette.primary.main, 0.03),
                borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="text"
                    label="Gross Revenue (€)"
                    value={formatNumberWithSpaces(formData["Gross Revenue"])}
                    onChange={(e) => handleChange("Gross Revenue", parseNumberFromFormatted(e.target.value))}
                    error={!!errors["Gross Revenue"]}
                    helperText={errors["Gross Revenue"]}
                    size="small"
                    inputProps={{
                      inputMode: "numeric",
                      pattern: "[0-9 ]*",
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="text"
                    label="Net Revenue (€)"
                    value={formatNumberWithSpaces(formData["Net Revenue"])}
                    onChange={(e) => handleChange("Net Revenue", parseNumberFromFormatted(e.target.value))}
                    error={!!errors["Net Revenue"]}
                    helperText={errors["Net Revenue"]}
                    size="small"
                    inputProps={{
                      inputMode: "numeric",
                      pattern: "[0-9 ]*",
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Three Column Layout */}
            <Grid container sx={{ p: 0 }}>
              {/* Opportunity Details - Left Column */}
              <Grid
                item
                xs={12}
                md={4}
                sx={{
                  p: 2.5,
                  borderRight: {
                    xs: "none",
                    md: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                  },
                  backgroundColor: alpha(theme.palette.background.default, 0.3),
                }}
              >
                <Typography
                  variant="subtitle2"
                  color="primary.main"
                  fontWeight={700}
                  sx={{ mb: 2, display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      mr: 1,
                    }}
                  />
                  Opportunity Details
                </Typography>

                {/* Account */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <Autocomplete
                    fullWidth
                    options={allAccountsList}
                    filterOptions={(options, state) => {
                      // No input: show only accounts with existing opportunities
                      if (!state.inputValue) {
                        return opportunityAccountsList.slice(0, 50);
                      }
                      // With input: search across all accounts (incl. CRM)
                      return crmFilterOptions(options, state);
                    }}
                    value={formData["Account"]}
                    onChange={(event, newValue) => handleChange("Account", newValue || "")}
                    renderOption={(props, option) => (
                      <li {...props} key={option}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                          <span style={{ flex: 1 }}>{option}</span>
                          {manualAccountSet.has(option) && (
                            <Box
                              component="span"
                              sx={{
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                backgroundColor: "#E3F2FD",
                                color: "#1565C0",
                                px: 0.8,
                                py: 0.2,
                                borderRadius: 1,
                              }}
                            >
                              New
                            </Box>
                          )}
                        </Box>
                      </li>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Account"
                        error={!!errors["Account"]}
                        helperText={errors["Account"]}
                        size="small"
                        margin="dense"
                        placeholder="Type to search all CRM accounts..."
                      />
                    )}
                  />
                  <IconButton
                    onClick={() => setCreateAccountOpen(true)}
                    title="Create new account"
                    sx={{
                      mt: "12px",
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                      borderRadius: 1.5,
                      color: theme.palette.primary.main,
                      "&:hover": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                        borderColor: theme.palette.primary.main,
                      },
                    }}
                    size="small"
                  >
                    <AddBusinessIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Project Type */}
                <Autocomplete
                  fullWidth
                  freeSolo
                  options={projectTypesList}
                  value={formData["Project Type"]}
                  onChange={(event, newValue) => handleChange("Project Type", newValue || "")}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Project Type"
                      size="small"
                      margin="dense"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                  )}
                />

                {/* CM1% */}
                <TextField
                  fullWidth
                  type="number"
                  label="CM1 (%)"
                  value={formData["CM1%"]}
                  onChange={(e) => handleChange("CM1%", e.target.value)}
                  size="small"
                  margin="dense"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        borderStyle: "dashed",
                      },
                    },
                  }}
                />

                {/* Booking Dates */}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, mb: 1 }}>
                  Booking Dates
                </Typography>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    value={formData["Booking Date"] ? new Date(formData["Booking Date"]) : null}
                    onChange={(date) => handleChange("Booking Date", date ? date.toISOString().split("T")[0] : "")}
                    slotProps={{
                      textField: {
                        size: "small",
                        fullWidth: true,
                        margin: "dense",
                        label: "Estimated Booking Date",
                        sx: {
                          "& .MuiInputBase-root": {
                            minHeight: 48,
                            alignItems: "center",
                          },
                          "& .MuiInputBase-input": {
                            color: "text.primary",
                          },
                          "& .MuiInputBase-input::placeholder": {
                            color: "text.secondary",
                            opacity: 1,
                          },
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": {
                              borderStyle: "dashed",
                            },
                          },
                        },
                        variant: "outlined",
                      },
                      field: {
                        clearable: true,
                        onClear: () => handleChange("Booking Date", ""),
                      },
                      actionBar: {
                        actions: ["clear"],
                      },
                    }}
                    format="dd/MM/yyyy"
                  />
                  {isBooked && (
                    <DatePicker
                      value={formData["Actual Booking Date"] ? new Date(formData["Actual Booking Date"]) : null}
                      onChange={(date) =>
                        handleChange("Actual Booking Date", date ? date.toISOString().split("T")[0] : "")
                      }
                      slotProps={{
                        textField: {
                          size: "small",
                          fullWidth: true,
                          margin: "dense",
                          label: "Actual Booking Date",
                          error: !!errors["Actual Booking Date"],
                          helperText: errors["Actual Booking Date"],
                          sx: {
                            "& .MuiInputBase-root": {
                              minHeight: 48,
                              alignItems: "center",
                            },
                            "& .MuiInputBase-input": {
                              color: "text.primary",
                            },
                            "& .MuiInputBase-input::placeholder": {
                              color: "text.secondary",
                              opacity: 1,
                            },
                          },
                          variant: "outlined",
                        },
                        field: {
                          clearable: true,
                          onClear: () => handleChange("Actual Booking Date", ""),
                        },
                        actionBar: {
                          actions: ["clear"],
                        },
                      }}
                      format="dd/MM/yyyy"
                    />
                  )}
                </LocalizationProvider>

                {/* Technology Partners */}
                <Autocomplete
                  fullWidth
                  freeSolo
                  options={techPartnersList}
                  value={formData["Technology Partner"]}
                  onChange={(event, newValue) => handleChange("Technology Partner", newValue || "")}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Technology Partner"
                      size="small"
                      margin="dense"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                  )}
                />
              </Grid>

              {/* Service Offerings - Center Column */}
              <Grid
                item
                xs={12}
                md={4}
                sx={{
                  p: 2.5,
                  borderRight: {
                    xs: "none",
                    md: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                  },
                  background: alpha(theme.palette.background.paper, 0.6),
                }}
              >
                <Typography
                  variant="subtitle2"
                  color="secondary.main"
                  fontWeight={700}
                  sx={{ mb: 2, display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "secondary.main",
                      mr: 1,
                    }}
                  />
                  Service Offerings
                </Typography>

                {/* Service Line 1 */}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  Primary Service
                </Typography>
                <Autocomplete
                  fullWidth
                  freeSolo
                  options={serviceLinesList}
                  value={formData["Service Line 1"]}
                  onChange={(event, newValue) => {
                    handleChange("Service Line 1", newValue || "");
                    handleChange("Service Offering 1", "");
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Service Line"
                      error={!!errors["Service Line 1"]}
                      helperText={errors["Service Line 1"]}
                      size="small"
                      margin="dense"
                    />
                  )}
                />
                <Grid container spacing={1}>
                  <Grid item xs={9}>
                    <Autocomplete
                      fullWidth
                      freeSolo
                      options={getOfferingsForServiceLine(formData["Service Line 1"])}
                      value={formData["Service Offering 1"]}
                      onChange={(event, newValue) => handleChange("Service Offering 1", newValue || "")}
                      disabled={!formData["Service Line 1"]}
                      renderInput={(params) => (
                        <TextField {...params} placeholder="Service Offering" size="small" margin="dense" />
                      )}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      type="number"
                      placeholder="%"
                      value={formData["Allocation 1"]}
                      onChange={(e) => handleChange("Allocation 1", e.target.value)}
                      size="small"
                      inputProps={{ min: 0, max: 100 }}
                      margin="dense"
                    />
                  </Grid>
                </Grid>

                {/* Service Line 2 */}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, mb: 0.5 }}>
                  Secondary Service
                </Typography>
                <Autocomplete
                  fullWidth
                  freeSolo
                  options={serviceLinesList}
                  value={formData["Service Line 2"]}
                  onChange={(event, newValue) => {
                    handleChange("Service Line 2", newValue || "");
                    handleChange("Service Offering 2", "");
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Service Line"
                      size="small"
                      margin="dense"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                  )}
                />
                <Grid container spacing={1}>
                  <Grid item xs={9}>
                    <Autocomplete
                      fullWidth
                      freeSolo
                      options={getOfferingsForServiceLine(formData["Service Line 2"])}
                      value={formData["Service Offering 2"]}
                      onChange={(event, newValue) => handleChange("Service Offering 2", newValue || "")}
                      disabled={!formData["Service Line 2"]}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Service Offering"
                          size="small"
                          margin="dense"
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              "& fieldset": {
                                borderStyle: "dashed",
                              },
                            },
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      type="number"
                      placeholder="%"
                      value={formData["Allocation 2"]}
                      onChange={(e) => handleChange("Allocation 2", e.target.value)}
                      size="small"
                      inputProps={{ min: 0, max: 100 }}
                      margin="dense"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                  </Grid>
                </Grid>

                {/* Service Line 3 */}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, mb: 0.5 }}>
                  Tertiary Service
                </Typography>
                <Autocomplete
                  fullWidth
                  freeSolo
                  options={serviceLinesList}
                  value={formData["Service Line 3"]}
                  onChange={(event, newValue) => {
                    handleChange("Service Line 3", newValue || "");
                    handleChange("Service Offering 3", "");
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Service Line"
                      size="small"
                      margin="dense"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                  )}
                />
                <Grid container spacing={1}>
                  <Grid item xs={9}>
                    <Autocomplete
                      fullWidth
                      freeSolo
                      options={getOfferingsForServiceLine(formData["Service Line 3"])}
                      value={formData["Service Offering 3"]}
                      onChange={(event, newValue) => handleChange("Service Offering 3", newValue || "")}
                      disabled={!formData["Service Line 3"]}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Service Offering"
                          size="small"
                          margin="dense"
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              "& fieldset": {
                                borderStyle: "dashed",
                              },
                            },
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      type="number"
                      placeholder="%"
                      value={formData["Allocation 3"]}
                      onChange={(e) => handleChange("Allocation 3", e.target.value)}
                      size="small"
                      inputProps={{ min: 0, max: 100 }}
                      margin="dense"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              </Grid>

              {/* Team Information - Right Column */}
              <Grid
                item
                xs={12}
                md={4}
                sx={{
                  p: 2.5,
                  backgroundColor: alpha(theme.palette.background.default, 0.3),
                }}
              >
                <Typography
                  variant="subtitle2"
                  color="info.main"
                  fontWeight={700}
                  sx={{ mb: 2, display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "info.main",
                      mr: 1,
                    }}
                  />
                  Team Information
                </Typography>

                <Autocomplete
                  fullWidth
                  freeSolo
                  options={engagementManagersList}
                  value={formData["EM"]}
                  onChange={(event, newValue) => handleChange("EM", newValue || "")}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Engagement Manager"
                      size="small"
                      margin="dense"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                  )}
                />

                <Autocomplete
                  fullWidth
                  freeSolo
                  options={engagementPartnersList}
                  value={formData["EP"]}
                  onChange={(event, newValue) => handleChange("EP", newValue || "")}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Engagement Partner"
                      size="small"
                      margin="dense"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                  )}
                />

                {/* Copy Engagement to Account button */}
                <Box sx={{ display: "flex", justifyContent: "center", my: 1.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyEngagementToAccount}
                    disabled={!formData["EM"] && !formData["EP"]}
                    sx={{
                      fontSize: "0.75rem",
                      py: 0.5,
                      px: 1.5,
                      borderStyle: "dashed",
                      borderColor: "info.main",
                      color: "info.main",
                      "&:hover": {
                        borderStyle: "dashed",
                        borderColor: "info.dark",
                        bgcolor: alpha(theme.palette.info.main, 0.04),
                      },
                    }}
                  >
                    Copy to Account
                  </Button>
                </Box>

                <Autocomplete
                  fullWidth
                  freeSolo
                  options={managersList}
                  value={formData["Manager"]}
                  onChange={(event, newValue) => handleChange("Manager", newValue || "")}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Manager"
                      size="small"
                      margin="dense"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                  )}
                />

                <Autocomplete
                  fullWidth
                  freeSolo
                  options={partnersList}
                  value={formData["Partner"]}
                  onChange={(event, newValue) => handleChange("Partner", newValue || "")}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Partner"
                      size="small"
                      margin="dense"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderStyle: "dashed",
                          },
                        },
                      }}
                    />
                  )}
                />

                {/* Staffing Needs Section */}
                <Typography
                  variant="subtitle2"
                  color="warning.main"
                  fontWeight={700}
                  sx={{ mt: 3, mb: 1.5, display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "warning.main",
                      mr: 1,
                    }}
                  />
                  Staffing Needs
                </Typography>

                {/* Add staffing need mini-form */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", mb: 1 }}>
                  <TextField
                    select
                    label="Profile"
                    size="small"
                    value={staffingForm.profile}
                    onChange={(e) => setStaffingForm((prev) => ({ ...prev, profile: e.target.value }))}
                    sx={{ flex: 1, "& .MuiOutlinedInput-root": { "& fieldset": { borderStyle: "dashed" } } }}
                  >
                    {STAFFING_PROFILES.map((p) => (
                      <MenuItem key={p.value} value={p.value}>
                        {p.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Qty"
                    type="number"
                    size="small"
                    value={staffingForm.quantity}
                    onChange={(e) =>
                      setStaffingForm((prev) => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))
                    }
                    sx={{ width: 65, "& .MuiOutlinedInput-root": { "& fieldset": { borderStyle: "dashed" } } }}
                    inputProps={{ min: 1 }}
                  />
                  <IconButton
                    size="small"
                    color="warning"
                    disabled={!staffingForm.profile}
                    onClick={() => {
                      const now = new Date().toISOString();
                      setStaffingNeeds((prev) => [
                        ...prev,
                        {
                          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          opportunityId: formData["Opportunity ID"],
                          profile: staffingForm.profile,
                          quantity: staffingForm.quantity,
                          startDate: null,
                          endDate: null,
                          skills: [],
                          createdAt: now,
                          updatedAt: now,
                        },
                      ]);
                      setStaffingForm({ profile: "", quantity: 1 });
                    }}
                    sx={{ border: "1px dashed", borderColor: "warning.main", borderRadius: 1, p: 0.5 }}
                  >
                    <AddIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>

                {/* Staffing needs list */}
                {staffingNeeds.length > 0 && (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {staffingNeeds.map((need) => {
                      const profileLabel =
                        STAFFING_PROFILES.find((p) => p.value === need.profile)?.label || need.profile;
                      return (
                        <Box
                          key={need.id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.warning.main, 0.04),
                            border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}`,
                          }}
                        >
                          <GroupIcon sx={{ fontSize: 14, color: "warning.main", flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ fontSize: "0.8rem", flex: 1 }}>
                            {profileLabel}{" "}
                            <Typography component="span" fontWeight={700} sx={{ fontSize: "0.8rem" }}>
                              x{need.quantity}
                            </Typography>
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => setStaffingNeeds((prev) => prev.filter((n) => n.id !== need.id))}
                            sx={{ p: 0.25 }}
                          >
                            <CloseIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                          </IconButton>
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {staffingNeeds.length === 0 && (
                  <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
                    No staffing needs added
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Card>
        </DialogContent>

        {/* Footer Actions */}
        <DialogActions
          sx={{
            p: 2,
            justifyContent: "space-between",
            bgcolor: "background.paper",
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {isEditMode && (
              <Button
                onClick={handleDeleteClick}
                color="error"
                variant="outlined"
                startIcon={<DeleteIcon />}
                size="small"
              >
                Delete
              </Button>
            )}
            {/* Allocation Total Warning */}
            {(formData["Allocation 1"] || formData["Allocation 2"] || formData["Allocation 3"]) &&
              totalAllocation !== 100 && (
                <Alert severity="warning" sx={{ py: 0.5, "& .MuiAlert-message": { fontSize: "0.75rem" } }}>
                  Total allocation: {totalAllocation}% (must equal 100%)
                </Alert>
              )}
          </Box>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button onClick={handleClose} variant="outlined" size="medium">
              Cancel
            </Button>
            <Button onClick={handleSave} variant="contained" size="medium" sx={{ minWidth: 100 }}>
              {isEditMode ? "Update" : "Create"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.error.main, 0.1),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mr: 2,
              }}
            >
              <DeleteIcon color="error" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Delete Opportunity
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Are you sure you want to delete this opportunity? This action cannot be undone.
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 3 }}>
            <Button onClick={handleDeleteCancel} variant="outlined">
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirm} variant="contained" color="error">
              Delete
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Create Account Modal */}
      <CreateAccountModal
        open={createAccountOpen}
        onClose={() => setCreateAccountOpen(false)}
        onAccountCreated={handleNewAccountCreated}
        crmAccounts={crmAccounts}
        segmentToSubSegmentMap={segmentToSubSegmentMap}
      />
    </>
  );
};

export default CreateOpportunityModal;
