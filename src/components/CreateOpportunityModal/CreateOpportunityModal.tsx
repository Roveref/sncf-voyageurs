/**
 * CreateOpportunityModal Component
 * Modal for creating and editing manual opportunities
 * Design matches OpportunityExpandedDetails for visual consistency
 *
 * Orchestrator: owns form state, validation, save/delete logic.
 * Visual sections delegated to sub-components.
 */

import React, { useState, useEffect, useMemo, memo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import useResponsive from "../../hooks/useResponsive";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid2";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupIcon from "@mui/icons-material/Group";
import { alpha, useTheme } from "@mui/material/styles";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useUIStore } from "../../stores/useUIStore";
import type { RevenueTeamMember } from "../../types";
import CreateAccountModal from "../Modals/CreateAccountModal";
import { generateOpportunityId, getStatusColor, validateOpportunityForm } from "./validation";
import OpportunityBanner from "./OpportunityBanner";
import LostCommentSection from "./LostCommentSection";
import RevenueSection from "./RevenueSection";
import OpportunityDetailsColumn from "./OpportunityDetailsColumn";
import ServiceOfferingsColumn from "./ServiceOfferingsColumn";
import TeamStaffingColumn from "./TeamStaffingColumn";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

const INITIAL_FORM_DATA = () => ({
  opportunityId: generateOpportunityId(),
  opportunity: "",
  account: "",
  status: 1,
  winPct: "",
  grossRevenue: "",
  netRevenue: "",
  cm1Pct: "",
  engagementType: "",
  bookingDate: "",
  estimatedBookingDate: "",
  techPartner1: "",
  serviceLine1: "",
  serviceOffering1: "",
  allocation1: "",
  subSegmentCode: "",
  subSegment: "",
  serviceLine2: "",
  serviceOffering2: "",
  allocation2: "",
  serviceLine3: "",
  serviceOffering3: "",
  allocation3: "",
  manager: "",
  partner: "",
  em: "",
  ep: "",
  lostComment: "",
  creationDate: new Date().toISOString(),
});

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
  serviceToOfferingMap = {},
}: any) => {
  const theme = useTheme();
  const { isPhone } = useResponsive();
  const isEditMode = !!editOpportunity;
  const [createAccountOpen, setCreateAccountOpen] = useState(false);

  // Extract lists from filterOptions
  const opportunityAccountsList = useMemo(() => {
    const oppAccounts = new Set<string>();
    opportunityData.forEach((opp: any) => {
      const account = opp.account;
      if (account && account.trim()) oppAccounts.add(account);
    });
    return [...oppAccounts].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [opportunityData]);

  const allAccountsList = useMemo((): string[] => {
    const accountSet = new Set<string>(filterOptions.accounts || []);
    manualAccounts.forEach((a: any) => accountSet.add(a.account));
    return [...accountSet].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [filterOptions.accounts, manualAccounts]);

  const manualAccountSet = useMemo(() => {
    return new Set(manualAccounts.map((a: any) => a.account)) as Set<string>;
  }, [manualAccounts]);

  const serviceLinesList = filterOptions.serviceLine1 || [];
  const svcToOfferingMap: Record<string, string[]> = serviceToOfferingMap || {};

  // Base account-to-segment mapping from CRM + opportunity data
  const baseAccountToSegmentMap = useMemo(() => {
    const map: Record<string, { segmentCode: string; subSegment: string }> = {};
    crmAccounts.forEach((crm: any) => {
      const account = crm.account;
      const segmentCode = crm.subSegmentCode;
      if (account && segmentCode && !map[account]) {
        map[account] = { segmentCode, subSegment: crm.subSegment };
      }
    });
    opportunityData.forEach((opp: any) => {
      const account = opp.account;
      const segmentCode = opp.subSegmentCode;
      if (account && segmentCode && !map[account]) {
        map[account] = { segmentCode, subSegment: opp.subSegment };
      }
    });
    return map;
  }, [opportunityData, crmAccounts]);

  const accountToSegmentMap = useMemo(() => {
    if (manualAccounts.length === 0) return baseAccountToSegmentMap;
    const map = { ...baseAccountToSegmentMap };
    manualAccounts.forEach((acc: any) => {
      if (acc.account && acc.subSegmentCode && !map[acc.account]) {
        map[acc.account] = { segmentCode: acc.subSegmentCode, subSegment: acc.subSegment };
      }
    });
    return map;
  }, [baseAccountToSegmentMap, manualAccounts]);

  // Unique lists derived from opportunity data
  const techPartnersList = useMemo(() => {
    const partners = new Set();
    opportunityData.forEach((opp: any) => {
      ["techPartner1", "techPartner2", "techPartner3"].forEach((key) => {
        const partner = opp[key];
        if (partner && partner.trim() && partner !== "-") {
          partner.split(",").forEach((p: string) => {
            const trimmed = p.trim();
            if (trimmed) partners.add(trimmed);
          });
        }
      });
    });
    return Array.from(partners).sort();
  }, [opportunityData]);

  const projectTypesList = useMemo(() => {
    const types = new Set<string>();
    opportunityData.forEach((opp: any) => {
      const projectType = opp.engagementType;
      if (projectType && projectType.trim() && projectType !== "-") {
        types.add(projectType.trim());
      }
    });
    return Array.from(types).sort();
  }, [opportunityData]);

  const managersList = useMemo(() => {
    const managers = new Set<string>();
    opportunityData.forEach((opp: any) => {
      const manager = opp.manager;
      if (manager && manager.trim() && manager !== "-") {
        managers.add(manager.trim());
      }
    });
    return Array.from(managers).sort();
  }, [opportunityData]);

  const partnersList = useMemo(() => {
    const partners = new Set<string>();
    opportunityData.forEach((opp: any) => {
      const partner = opp.partner;
      if (partner && partner.trim() && partner !== "-") {
        partners.add(partner.trim());
      }
    });
    return Array.from(partners).sort();
  }, [opportunityData]);

  const engagementManagersList = useMemo(() => {
    const ems = new Set<string>();
    opportunityData.forEach((opp: any) => {
      const em = opp.em;
      if (em && em.trim() && em !== "-") {
        ems.add(em.trim());
      }
    });
    return Array.from(ems).sort();
  }, [opportunityData]);

  const engagementPartnersList = useMemo(() => {
    const eps = new Set<string>();
    opportunityData.forEach((opp: any) => {
      const ep = opp.ep;
      if (ep && ep.trim() && ep !== "-") {
        eps.add(ep.trim());
      }
    });
    return Array.from(eps).sort();
  }, [opportunityData]);

  // All unique people (for revenue team autocomplete)
  const allPeopleList = useMemo(() => {
    const people = new Set<string>();
    opportunityData.forEach((opp: any) => {
      ["manager", "partner", "em", "ep"].forEach((field) => {
        const v = opp[field];
        if (v && typeof v === "string" && v.trim() && v !== "-") people.add(v.trim());
      });
    });
    return [...people].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [opportunityData]);

  // --- Form state ---
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [revenueTeam, setRevenueTeam] = useState<RevenueTeamMember[]>([]);
  const [staffingPromptOpen, setStaffingPromptOpen] = useState(false);
  const [createdOpportunity, setCreatedOpportunity] = useState<any>(null);

  // Merge submit-time errors with inline field errors (submit-time take priority)
  const mergedErrors = useMemo(() => ({ ...fieldErrors, ...errors }), [fieldErrors, errors]);

  const totalAllocation = useMemo(() => {
    const alloc1 = parseFloat(formData.allocation1) || 0;
    const alloc2 = parseFloat(formData.allocation2) || 0;
    const alloc3 = parseFloat(formData.allocation3) || 0;
    return alloc1 + alloc2 + alloc3;
  }, [formData.allocation1, formData.allocation2, formData.allocation3]);

  const isBooked = formData.status === 14;
  const isLost = formData.status === 15;
  const statusColor = getStatusColor(formData.status, theme);

  // Load edit data when in edit mode
  useEffect(() => {
    if (isEditMode && editOpportunity) {
      setFormData({
        opportunityId: editOpportunity.opportunityId,
        opportunity: editOpportunity.opportunity || "",
        account: editOpportunity.account || "",
        status: editOpportunity.status || 1,
        winPct: editOpportunity.winPct || "",
        grossRevenue: editOpportunity.grossRevenue || "",
        netRevenue: editOpportunity.netRevenue || "",
        cm1Pct: editOpportunity.cm1Pct || "",
        engagementType: editOpportunity.engagementType || "",
        bookingDate: editOpportunity.bookingDate || "",
        estimatedBookingDate: editOpportunity.estimatedBookingDate || "",
        techPartner1: String(editOpportunity.techPartner1 || "") || "",
        serviceLine1: editOpportunity.serviceLine1 || "",
        serviceOffering1: editOpportunity.serviceOffering1 || "",
        allocation1: editOpportunity.allocation1 || "",
        subSegmentCode: editOpportunity.subSegmentCode || "",
        subSegment: editOpportunity.subSegment || "",
        serviceLine2: editOpportunity.serviceLine2 || "",
        serviceOffering2: editOpportunity.serviceOffering2 || "",
        allocation2: editOpportunity.allocation2 || "",
        serviceLine3: editOpportunity.serviceLine3 || "",
        serviceOffering3: editOpportunity.serviceOffering3 || "",
        allocation3: editOpportunity.allocation3 || "",
        manager: editOpportunity.manager || "",
        partner: editOpportunity.partner || "",
        em: String(editOpportunity.em || "") || "",
        ep: String(editOpportunity.ep || "") || "",
        lostComment: editOpportunity.lostComment || "",
        creationDate: editOpportunity.creationDate || new Date().toISOString(),
      });
    } else {
      setFormData(INITIAL_FORM_DATA());
    }
    setErrors({});
    setFieldErrors({});
    if (isEditMode && editOpportunity) {
      const storeState = useUserDataStore.getState();

      // Load revenue team from store, or pre-populate from EM/EP/Manager/Partner
      const savedTeam = storeState.revenueTeam[editOpportunity.opportunityId] || [];
      if (savedTeam.length > 0) {
        setRevenueTeam(savedTeam);
      } else {
        const auto: RevenueTeamMember[] = [];
        const em = (editOpportunity.em || "").trim();
        const ep = (editOpportunity.ep || "").trim();
        const mgr = (editOpportunity.manager || "").trim();
        const ptr = (editOpportunity.partner || "").trim();
        // M/SM bucket: EM + Manager (if different)
        const msmNames = new Set<string>();
        if (em) msmNames.add(em);
        if (mgr && mgr !== em) msmNames.add(mgr);
        const msmPct = msmNames.size > 0 ? Math.round(100 / msmNames.size) : 100;
        msmNames.forEach((name) => {
          auto.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name,
            gradeBucket: "M/SM",
            percentage: msmPct,
          });
        });
        // Partner bucket: EP + Partner (if different)
        const ptrNames = new Set<string>();
        if (ep) ptrNames.add(ep);
        if (ptr && ptr !== ep) ptrNames.add(ptr);
        const ptrPct = ptrNames.size > 0 ? Math.round(100 / ptrNames.size) : 100;
        ptrNames.forEach((name) => {
          auto.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name,
            gradeBucket: "Partner",
            percentage: ptrPct,
          });
        });
        setRevenueTeam(auto);
      }
    } else {
      setRevenueTeam([]);
    }
  }, [editOpportunity, isEditMode, open]);

  // --- Inline validation ---
  const validateField = (fieldName: string, value: any): string => {
    switch (fieldName) {
      case "opportunity":
        return !String(value ?? "").trim() ? "Required" : "";
      case "account":
        return !String(value ?? "").trim() ? "Required" : "";
      case "grossRevenue":
        return value === "" || value === null || value === undefined ? "Required" : "";
      case "bookingDate": {
        if (!value) return "";
        const d = new Date(value);
        return isNaN(d.getTime()) ? "Invalid date format" : "";
      }
      case "estimatedBookingDate": {
        if (!value) return "";
        const estDate = new Date(value);
        if (isNaN(estDate.getTime())) return "Invalid date format";
        if (formData.bookingDate) {
          const endDate = new Date(formData.bookingDate);
          if (!isNaN(endDate.getTime()) && estDate >= endDate) return "Must be before end date";
        }
        return "";
      }
      default:
        return "";
    }
  };

  const handleBlurField = (fieldName: string, value: any) => {
    const err = validateField(fieldName, value);
    setFieldErrors((prev) => ({ ...prev, [fieldName]: err }));
  };

  // --- Handlers ---
  const handleClose = () => {
    if (setEditOpportunity) setEditOpportunity(null);
    if (onClose) onClose();
    setErrors({});
    setFieldErrors({});
  };

  const handleNewAccountCreated = (newAccount: any) => {
    if (onAccountCreated) onAccountCreated(newAccount);
    setFormData((prev) => ({
      ...prev,
      account: newAccount.account,
      subSegmentCode: newAccount.subSegmentCode || "",
      subSegment: newAccount.subSegment || "",
    }));
  };

  const handleChange = (field: string, value: any) => {
    if (field === "account" && value && accountToSegmentMap[value]) {
      setFormData((prev) => ({
        ...prev,
        account: value,
        subSegmentCode: accountToSegmentMap[value].segmentCode,
        subSegment: accountToSegmentMap[value].subSegment || "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleCopyEngagementToAccount = () => {
    setFormData((prev) => ({
      ...prev,
      manager: prev.em || "",
      partner: prev.ep || "",
    }));
  };

  const getOfferingsForServiceLine = (serviceLine: string) => {
    if (!serviceLine) return [];
    return svcToOfferingMap[serviceLine] || [];
  };

  const handleSave = () => {
    const newErrors = validateOpportunityForm(formData, isBooked, totalAllocation);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const opportunityPayload = {
      ...formData,
      isManual: true,
      winPct: parseFloat(formData.winPct) || 0,
      grossRevenue: parseFloat(formData.grossRevenue) || 0,
      netRevenue: parseFloat(formData.netRevenue) || 0,
      cm1Pct: parseFloat(formData.cm1Pct) || 0,
      allocation1: parseFloat(formData.allocation1) || 0,
      allocation2: parseFloat(formData.allocation2) || 0,
      allocation3: parseFloat(formData.allocation3) || 0,
      estimatedBookingDate: formData.bookingDate || "",
      bookingDate: formData.estimatedBookingDate || "",
    };

    const ds = useUserDataStore.getState();
    const existingOpportunities = ds.manualOpportunities;

    if (isEditMode) {
      const updated = existingOpportunities.map((opp) =>
        opp.opportunityId === opportunityPayload.opportunityId ? opportunityPayload : opp
      );
      ds.setManualOpportunities(updated);
      if (onOpportunityUpdated) onOpportunityUpdated(opportunityPayload);
    } else {
      ds.addManualOpportunity(opportunityPayload);
      if (onOpportunityCreated) onOpportunityCreated(opportunityPayload);
    }

    ds.setRevenueTeam(opportunityPayload.opportunityId, revenueTeam);

    if (isEditMode) {
      handleClose();
    } else {
      setCreatedOpportunity(opportunityPayload);
      handleClose();
      setStaffingPromptOpen(true);
    }
  };

  const handleStaffingPromptConfirm = () => {
    setStaffingPromptOpen(false);
    if (createdOpportunity) {
      useUIStore.getState().setStaffingNeedOpportunity(createdOpportunity);
      useUIStore.getState().setCreateStaffingNeedModalOpen(true);
    }
    setCreatedOpportunity(null);
  };

  const handleStaffingPromptCancel = () => {
    setStaffingPromptOpen(false);
    setCreatedOpportunity(null);
  };

  const handleDeleteClick = () => setDeleteConfirmOpen(true);
  const handleDeleteCancel = () => setDeleteConfirmOpen(false);

  const handleDeleteConfirm = () => {
    if (!isEditMode || !editOpportunity) return;
    useUserDataStore.getState().deleteManualOpportunity(editOpportunity.opportunityId);
    if (onOpportunityDeleted) onOpportunityDeleted(editOpportunity.opportunityId);
    setDeleteConfirmOpen(false);
    handleClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        TransitionComponent={DialogTransition}
        maxWidth="lg"
        fullWidth
        fullScreen={isPhone}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: theme.shadows[10],
            maxHeight: "90vh",
          },
        }}
      >
        <DialogContent
          sx={{
            p: 0,
            // Global style: remove all outlined input borders, harmonize labels
            "& .MuiOutlinedInput-root": {
              "& fieldset": { border: "none" },
              bgcolor: "action.hover",
              borderRadius: 1,
            },
            // All labels: subtle by default
            "& .MuiInputLabel-root": {
              opacity: 0.45,
              fontWeight: 400,
            },
            // Mandatory fields: bold, full opacity (marked with data-mandatory on parent)
            "& [data-mandatory] .MuiInputLabel-root": {
              opacity: 0.85,
              fontWeight: 600,
            },
          }}
        >
          <Card
            elevation={0}
            sx={{
              borderRadius: 0,
              backgroundColor: alpha(theme.palette.background.paper, 0.7),
              border: "none",
            }}
          >
            <OpportunityBanner
              formData={formData}
              errors={mergedErrors}
              statusColor={statusColor}
              onChange={handleChange}
              onClose={handleClose}
              onBlurField={handleBlurField}
            />

            {isLost && <LostCommentSection value={formData.lostComment} onChange={handleChange} />}

            <RevenueSection
              formData={formData}
              errors={mergedErrors}
              onChange={handleChange}
              onBlurField={handleBlurField}
            />

            {/* Three Column Layout */}
            <Grid container sx={{ p: 0, gap: 0 }}>
              <OpportunityDetailsColumn
                formData={formData}
                errors={mergedErrors}
                onChange={handleChange}
                onBlurField={handleBlurField}
                allAccountsList={allAccountsList}
                opportunityAccountsList={opportunityAccountsList}
                manualAccountSet={manualAccountSet}
                projectTypesList={projectTypesList}
                techPartnersList={techPartnersList}
                isBooked={isBooked}
                onOpenCreateAccount={() => setCreateAccountOpen(true)}
              />

              <ServiceOfferingsColumn
                formData={formData}
                errors={mergedErrors}
                onChange={handleChange}
                serviceLinesList={serviceLinesList}
                getOfferingsForServiceLine={getOfferingsForServiceLine}
              />

              <TeamStaffingColumn
                formData={formData}
                onChange={handleChange}
                engagementManagersList={engagementManagersList}
                engagementPartnersList={engagementPartnersList}
                managersList={managersList}
                partnersList={partnersList}
                onCopyEngagementToAccount={handleCopyEngagementToAccount}
                revenueTeam={revenueTeam}
                setRevenueTeam={setRevenueTeam}
                allPeopleList={allPeopleList}
              />
            </Grid>
          </Card>
        </DialogContent>

        {/* Footer Actions */}
        <DialogActions
          sx={{
            p: 2,
            justifyContent: "space-between",
            bgcolor: "background.paper",
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
                Supprimer
              </Button>
            )}
            {(formData.allocation1 || formData.allocation2 || formData.allocation3) && totalAllocation !== 100 && (
              <Alert severity="warning" sx={{ py: 0.5, "& .MuiAlert-message": { fontSize: "0.75rem" } }}>
                Total allocation: {totalAllocation}% (must equal 100%)
              </Alert>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button onClick={handleClose} variant="outlined" size="medium">
              Annuler
            </Button>
            <Button onClick={handleSave} variant="contained" size="medium" sx={{ minWidth: 100 }}>
              {isEditMode ? "Modifier" : "Créer"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <DeleteConfirmDialog open={deleteConfirmOpen} onCancel={handleDeleteCancel} onConfirm={handleDeleteConfirm} />

      <CreateAccountModal
        open={createAccountOpen}
        onClose={() => setCreateAccountOpen(false)}
        onAccountCreated={handleNewAccountCreated}
        crmAccounts={crmAccounts}
        segmentToSubSegmentMap={segmentToSubSegmentMap}
      />

      {/* Staffing need prompt after opportunity creation */}
      <Dialog
        open={staffingPromptOpen}
        onClose={handleStaffingPromptCancel}
        TransitionComponent={DialogTransition}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogContent sx={{ textAlign: "center", pt: 3, pb: 1 }}>
          <GroupIcon sx={{ fontSize: 40, color: "warning.main", mb: 1.5 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Créer un besoin d'intervention ?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Souhaitez-vous créer un besoin d'intervention pour{" "}
            <strong>{createdOpportunity?.opportunity || "cet actif"}</strong> ?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 1, pb: 2.5 }}>
          <Button onClick={handleStaffingPromptCancel} variant="outlined" size="medium">
            Non merci
          </Button>
          <Button onClick={handleStaffingPromptConfirm} variant="contained" color="warning" size="medium">
            Créer un besoin d'intervention
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

CreateOpportunityModal.displayName = "CreateOpportunityModal";
export default memo(CreateOpportunityModal);
