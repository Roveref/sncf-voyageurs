/**
 * TeamStaffingColumn — Right column: responsable mission / expert référent, équipe projet, besoins experts
 */

import React, { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Grid from "@mui/material/Grid2";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import BalanceIcon from "@mui/icons-material/Balance";
import { alpha, useTheme } from "@mui/material/styles";
import { GRADE_BUCKETS } from "../../utils/constants";
import type { RevenueTeamMember } from "../../types";
import { brand } from "../../config/brandConfig";

interface TeamStaffingColumnProps {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
  engagementManagersList: any[];
  engagementPartnersList: any[];
  managersList: any[];
  partnersList: any[];
  onCopyEngagementToAccount: () => void;
  revenueTeam: RevenueTeamMember[];
  setRevenueTeam: React.Dispatch<React.SetStateAction<RevenueTeamMember[]>>;
  allPeopleList: string[];
}

const dashedFieldSx = {
  "& .MuiOutlinedInput-root": {
    "& fieldset": { border: "none" },
    bgcolor: "action.hover",
    borderRadius: 1,
  },
};

const BUCKET_COLORS: Record<string, string> = {
  "M/SM": brand.secondary,
  Director: brand.secondaryLight,
  Partner: brand.secondaryDark,
};

const TeamStaffingColumn = ({
  formData,
  onChange,
  engagementManagersList,
  engagementPartnersList,
  managersList,
  partnersList,
  onCopyEngagementToAccount,
  revenueTeam,
  setRevenueTeam,
  allPeopleList,
}: TeamStaffingColumnProps) => {
  const theme = useTheme();

  // ── Revenue team handlers ──
  const handleAddRevenueMember = () => {
    setRevenueTeam((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: "",
        gradeBucket: "M/SM",
        percentage: 100,
      },
    ]);
  };

  const handleRemoveRevenueMember = (id: string) => {
    setRevenueTeam((prev) => prev.filter((m) => m.id !== id));
  };

  const handleRevenueMemberChange = (id: string, field: keyof RevenueTeamMember, value: any) => {
    setRevenueTeam((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const handleEqualizeBucket = (bucket: string) => {
    setRevenueTeam((prev) => {
      const bucketMembers = prev.filter((m) => m.gradeBucket === bucket);
      if (bucketMembers.length === 0) return prev;
      const equalPct = Math.round(100 / bucketMembers.length);
      const bucketIds = new Set(bucketMembers.map((m) => m.id));
      return prev.map((m) => (bucketIds.has(m.id) ? { ...m, percentage: equalPct } : m));
    });
  };

  // ── Bucket validation ──
  const bucketWarnings = useMemo(() => {
    const warnings: Record<string, number> = {};
    const bucketSums: Record<string, number> = {};
    revenueTeam.forEach((m) => {
      if (!m.name) return;
      bucketSums[m.gradeBucket] = (bucketSums[m.gradeBucket] || 0) + m.percentage;
    });
    for (const [bucket, sum] of Object.entries(bucketSums)) {
      if (Math.abs(sum - 100) > 0.5) warnings[bucket] = sum;
    }
    return warnings;
  }, [revenueTeam]);

  return (
    <Grid
      size={{ xs: 12, md: 4 }}
      sx={{
        p: 2.5,
        bgcolor: alpha(theme.palette.background.default, 0.3),
      }}
    >
      <Typography
        variant="subtitle2"
        color={brand.secondary}
        fontWeight={700}
        sx={{ mb: 2, display: "flex", alignItems: "center" }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: brand.secondary,
            mr: 1,
          }}
        />
        Team Information
      </Typography>

      <Autocomplete
        fullWidth
        freeSolo
        options={engagementManagersList}
        value={formData.em}
        onChange={(_event, newValue) => onChange("em", newValue || "")}
        renderInput={(params) => (
          <TextField {...params} label="Responsable mission" size="small" margin="dense" sx={dashedFieldSx} />
        )}
      />

      <Autocomplete
        fullWidth
        freeSolo
        options={engagementPartnersList}
        value={formData.ep}
        onChange={(_event, newValue) => onChange("ep", newValue || "")}
        renderInput={(params) => (
          <TextField {...params} label="Expert référent" size="small" margin="dense" sx={dashedFieldSx} />
        )}
      />

      {/* Copy Engagement to Account button */}
      <Box sx={{ display: "flex", justifyContent: "center", my: 1.5 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={onCopyEngagementToAccount}
          disabled={!formData.em && !formData.ep}
          sx={{
            fontSize: "0.75rem",
            py: 0.5,
            px: 1.5,
            border: "none",
            bgcolor: alpha(theme.palette.info.main, 0.08),
            color: "info.main",
            "&:hover": {
              bgcolor: alpha(theme.palette.info.main, 0.15),
            },
          }}
        >
          Copier vers le site
        </Button>
      </Box>

      <Autocomplete
        fullWidth
        freeSolo
        options={managersList}
        value={formData.manager}
        onChange={(_event, newValue) => onChange("manager", newValue || "")}
        renderInput={(params) => (
          <TextField {...params} label="Manager" size="small" margin="dense" sx={dashedFieldSx} />
        )}
      />

      <Autocomplete
        fullWidth
        freeSolo
        options={partnersList}
        value={formData.partner}
        onChange={(_event, newValue) => onChange("partner", newValue || "")}
        renderInput={(params) => (
          <TextField {...params} label="Partner" size="small" margin="dense" sx={dashedFieldSx} />
        )}
      />

      {/* ── Revenue Team Section ── */}
      <Typography
        variant="subtitle2"
        color={brand.secondary}
        fontWeight={700}
        sx={{ mt: 3, mb: 1.5, display: "flex", alignItems: "center" }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: brand.secondary,
            mr: 1,
          }}
        />
        Équipe projet
      </Typography>

      {/* Revenue team member list */}
      {revenueTeam.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 1 }}>
          {revenueTeam.map((member) => {
            const bucketColor = BUCKET_COLORS[member.gradeBucket] || brand.secondary;
            return (
              <Box
                key={member.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: alpha(bucketColor, 0.06),
                }}
              >
                {/* Person name */}
                <Autocomplete
                  freeSolo
                  size="small"
                  options={allPeopleList}
                  value={member.name}
                  onChange={(_e, v) => handleRevenueMemberChange(member.id, "name", v || "")}
                  onInputChange={(_e, v) => handleRevenueMemberChange(member.id, "name", v)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Nom"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": { border: "none" },
                          bgcolor: "transparent",
                          py: 0,
                        },
                        "& .MuiInputBase-input": { fontSize: "0.8rem", py: "2px" },
                      }}
                    />
                  )}
                  sx={{ flex: 1, minWidth: 0 }}
                />

                {/* Grade bucket */}
                <TextField
                  select
                  size="small"
                  value={member.gradeBucket}
                  onChange={(e) => handleRevenueMemberChange(member.id, "gradeBucket", e.target.value)}
                  sx={{
                    width: 80,
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { border: "none" },
                      bgcolor: "transparent",
                    },
                    "& .MuiSelect-select": { fontSize: "0.75rem", py: "3px" },
                  }}
                >
                  {GRADE_BUCKETS.map((b) => (
                    <MenuItem key={b.value} value={b.value} sx={{ fontSize: "0.8rem" }}>
                      {b.value}
                    </MenuItem>
                  ))}
                </TextField>

                {/* Percentage */}
                <TextField
                  type="number"
                  size="small"
                  value={member.percentage}
                  onChange={(e) =>
                    handleRevenueMemberChange(
                      member.id,
                      "percentage",
                      Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                    )
                  }
                  inputProps={{ min: 0, max: 100 }}
                  sx={{
                    width: 52,
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { border: "none" },
                      bgcolor: "transparent",
                    },
                    "& .MuiInputBase-input": { fontSize: "0.8rem", py: "2px", textAlign: "right" },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mr: -0.5 }}>
                  %
                </Typography>

                {/* Remove button */}
                <IconButton size="small" onClick={() => handleRemoveRevenueMember(member.id)} sx={{ p: 0.25 }}>
                  <CloseIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Bucket validation warnings */}
      {Object.entries(bucketWarnings).length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
          {Object.entries(bucketWarnings).map(([bucket, sum]) => (
            <Chip
              key={bucket}
              size="small"
              label={`${bucket}: ${sum}%`}
              color="warning"
              variant="outlined"
              sx={{ fontSize: "0.7rem", height: 20 }}
            />
          ))}
        </Box>
      )}

      {/* Add member + equalize buttons */}
      <Box sx={{ display: "flex", gap: 0.75, mb: 0.5 }}>
        <Button
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={handleAddRevenueMember}
          sx={{
            fontSize: "0.75rem",
            py: 0.25,
            px: 1,
            border: "none",
            bgcolor: alpha(brand.secondary, 0.08),
            color: brand.secondary,
            "&:hover": { bgcolor: alpha(brand.secondary, 0.15) },
          }}
        >
          Add
        </Button>
        {revenueTeam.length > 1 && (
          <>
            {["M/SM", "Director", "Partner"].map((bucket) => {
              const count = revenueTeam.filter((m) => m.gradeBucket === bucket).length;
              if (count < 2) return null;
              return (
                <Tooltip key={bucket} title={`Equalize ${bucket}`}>
                  <IconButton
                    size="small"
                    onClick={() => handleEqualizeBucket(bucket)}
                    sx={{
                      p: 0.25,
                      color: BUCKET_COLORS[bucket],
                      bgcolor: alpha(BUCKET_COLORS[bucket] || brand.secondary, 0.08),
                      "&:hover": { bgcolor: alpha(BUCKET_COLORS[bucket] || brand.secondary, 0.15) },
                    }}
                  >
                    <BalanceIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              );
            })}
          </>
        )}
      </Box>

      {revenueTeam.length === 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
          No revenue team — will use full revenue
        </Typography>
      )}
    </Grid>
  );
};

TeamStaffingColumn.displayName = "TeamStaffingColumn";
export default memo(TeamStaffingColumn);
