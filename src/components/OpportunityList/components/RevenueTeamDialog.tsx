/**
 * RevenueTeamDialog — Standalone mini-dialog for editing revenue team allocations
 * per opportunity. Works for both CRM and manual opportunities.
 */

import React, { memo, useState, useEffect, useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Autocomplete from "@mui/material/Autocomplete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import BalanceIcon from "@mui/icons-material/Balance";
import { alpha, useTheme } from "@mui/material/styles";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { useCrmData } from "../../../queries/useCrmData";
import { GRADE_BUCKETS } from "../../../utils/constants";
import type { RevenueTeamMember } from "../../../types";
import { brand } from "../../../config/brandConfig";

// BearingPoint secondary palette for grade buckets
const BUCKET_COLORS: Record<string, string> = {
  "M/SM": brand.secondary,
  Director: brand.secondaryLight,
  Partner: brand.secondaryDark,
};

interface RevenueTeamDialogProps {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityName: string;
  /** Fields for auto-population when no saved team exists */
  em?: string;
  ep?: string;
  manager?: string;
  partner?: string;
}

const RevenueTeamDialog = memo(
  ({ open, onClose, opportunityId, opportunityName, em, ep, manager, partner }: RevenueTeamDialogProps) => {
    const theme = useTheme();
    const [members, setMembers] = useState<RevenueTeamMember[]>([]);

    // Build people list from all opportunities
    const { opportunityData } = useCrmData();
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

    // Load from store on open
    useEffect(() => {
      if (!open) return;
      const saved = useUserDataStore.getState().revenueTeam[opportunityId] || [];
      if (saved.length > 0) {
        setMembers(saved);
      } else {
        // Auto-populate from EM/EP/Manager/Partner
        const auto: RevenueTeamMember[] = [];
        const emVal = (em || "").trim();
        const epVal = (ep || "").trim();
        const mgrVal = (manager || "").trim();
        const ptrVal = (partner || "").trim();

        const msmNames = new Set<string>();
        if (emVal) msmNames.add(emVal);
        if (mgrVal && mgrVal !== emVal) msmNames.add(mgrVal);
        const msmPct = msmNames.size > 0 ? Math.round(100 / msmNames.size) : 100;
        msmNames.forEach((name) => {
          auto.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name,
            gradeBucket: "M/SM",
            percentage: msmPct,
          });
        });

        const ptrNames = new Set<string>();
        if (epVal) ptrNames.add(epVal);
        if (ptrVal && ptrVal !== epVal) ptrNames.add(ptrVal);
        const ptrPct = ptrNames.size > 0 ? Math.round(100 / ptrNames.size) : 100;
        ptrNames.forEach((name) => {
          auto.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name,
            gradeBucket: "Partner",
            percentage: ptrPct,
          });
        });

        setMembers(auto);
      }
    }, [open, opportunityId, em, ep, manager, partner]);

    const handleAdd = () => {
      setMembers((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: "",
          gradeBucket: "M/SM",
          percentage: 100,
        },
      ]);
    };

    const handleRemove = (id: string) => {
      setMembers((prev) => prev.filter((m) => m.id !== id));
    };

    const handleChange = (id: string, field: keyof RevenueTeamMember, value: any) => {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
    };

    const handleEqualize = (bucket: string) => {
      setMembers((prev) => {
        const bucketMembers = prev.filter((m) => m.gradeBucket === bucket);
        if (bucketMembers.length === 0) return prev;
        const equalPct = Math.round(100 / bucketMembers.length);
        const ids = new Set(bucketMembers.map((m) => m.id));
        return prev.map((m) => (ids.has(m.id) ? { ...m, percentage: equalPct } : m));
      });
    };

    const handleSave = () => {
      useUserDataStore.getState().setRevenueTeam(opportunityId, members);
      onClose();
    };

    // Bucket validation — warn if != 100%, block if > 100%
    const { bucketWarnings, bucketOverflows } = useMemo(() => {
      const warnings: Record<string, number> = {};
      const overflows: Record<string, number> = {};
      const sums: Record<string, number> = {};
      members.forEach((m) => {
        if (!m.name) return;
        sums[m.gradeBucket] = (sums[m.gradeBucket] || 0) + m.percentage;
      });
      for (const [bucket, sum] of Object.entries(sums)) {
        if (sum > 100.5) overflows[bucket] = sum;
        else if (Math.abs(sum - 100) > 0.5) warnings[bucket] = sum;
      }
      return { bucketWarnings: warnings, bucketOverflows: overflows };
    }, [members]);

    const hasOverflow = Object.keys(bucketOverflows).length > 0;

    return (
      <Dialog
        open={open}
        onClose={onClose}
        TransitionComponent={DialogTransition}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="secondary.main">
              Revenue Team
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {opportunityName}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {members.length > 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {members.map((member) => {
                const bucketColor = BUCKET_COLORS[member.gradeBucket] || brand.secondary;
                return (
                  <Box
                    key={member.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      px: 1.5,
                      py: 1,
                      borderRadius: 1.5,
                      bgcolor: alpha(bucketColor, 0.06),
                    }}
                  >
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={allPeopleList}
                      value={member.name}
                      onChange={(_e, v) => handleChange(member.id, "name", v || "")}
                      onInputChange={(_e, v) => handleChange(member.id, "name", v)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Name"
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              "& fieldset": { border: "none" },
                              bgcolor: "action.hover",
                              borderRadius: 1,
                            },
                            "& .MuiInputBase-input": { fontSize: "0.85rem" },
                          }}
                        />
                      )}
                      sx={{ flex: 1, minWidth: 0 }}
                    />

                    <TextField
                      select
                      size="small"
                      value={member.gradeBucket}
                      onChange={(e) => handleChange(member.id, "gradeBucket", e.target.value)}
                      sx={{
                        width: 110,
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": { border: "none" },
                          bgcolor: "action.hover",
                          borderRadius: 1,
                        },
                        "& .MuiSelect-select": { fontSize: "0.85rem" },
                      }}
                    >
                      {GRADE_BUCKETS.map((b) => (
                        <MenuItem key={b.value} value={b.value} sx={{ fontSize: "0.85rem" }}>
                          {b.value}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      type="number"
                      size="small"
                      value={member.percentage}
                      onChange={(e) =>
                        handleChange(member.id, "percentage", Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))
                      }
                      inputProps={{ min: 0, max: 100 }}
                      sx={{
                        width: 70,
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": { border: "none" },
                          bgcolor: "action.hover",
                          borderRadius: 1,
                        },
                        "& .MuiInputBase-input": { fontSize: "0.85rem", textAlign: "right" },
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      %
                    </Typography>

                    <IconButton size="small" onClick={() => handleRemove(member.id)} sx={{ p: 0.5 }}>
                      <CloseIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic", py: 2, textAlign: "center" }}>
              No revenue team members — full revenue will be attributed
            </Typography>
          )}

          {/* Bucket warnings & overflows */}
          {(Object.keys(bucketWarnings).length > 0 || Object.keys(bucketOverflows).length > 0) && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1.5 }}>
              {Object.entries(bucketOverflows).map(([bucket, sum]) => (
                <Chip
                  key={bucket}
                  size="small"
                  label={`${bucket}: ${sum}% (max 100%)`}
                  color="error"
                  variant="outlined"
                  sx={{ fontSize: "0.75rem", fontWeight: 600 }}
                />
              ))}
              {Object.entries(bucketWarnings).map(([bucket, sum]) => (
                <Chip
                  key={bucket}
                  size="small"
                  label={`${bucket}: ${sum}%`}
                  color="warning"
                  variant="outlined"
                  sx={{ fontSize: "0.75rem" }}
                />
              ))}
            </Box>
          )}

          {/* Add + equalize buttons */}
          <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
            <Button
              size="small"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={handleAdd}
              sx={{
                fontSize: "0.8rem",
                py: 0.5,
                px: 1.5,
                border: "none",
                bgcolor: alpha(brand.secondary, 0.08),
                color: brand.secondary,
                "&:hover": { bgcolor: alpha(brand.secondary, 0.15) },
              }}
            >
              Add member
            </Button>
            {members.length > 1 &&
              ["M/SM", "Director", "Partner"].map((bucket) => {
                const count = members.filter((m) => m.gradeBucket === bucket).length;
                if (count < 2) return null;
                return (
                  <Tooltip key={bucket} title={`Equalize ${bucket}`}>
                    <IconButton
                      size="small"
                      onClick={() => handleEqualize(bucket)}
                      sx={{
                        p: 0.5,
                        color: BUCKET_COLORS[bucket],
                        bgcolor: alpha(BUCKET_COLORS[bucket] || brand.secondary, 0.08),
                        "&:hover": { bgcolor: alpha(BUCKET_COLORS[bucket] || brand.secondary, 0.15) },
                      }}
                    >
                      <BalanceIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                );
              })}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} size="small">
            Cancel
          </Button>
          <Tooltip title={hasOverflow ? "A bucket exceeds 100%" : ""} arrow>
            <span>
              <Button
                onClick={handleSave}
                variant="contained"
                size="small"
                disabled={hasOverflow}
                sx={{ bgcolor: brand.secondary, "&:hover": { bgcolor: brand.secondaryDark } }}
              >
                Save
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>
    );
  }
);

RevenueTeamDialog.displayName = "RevenueTeamDialog";
export default RevenueTeamDialog;
