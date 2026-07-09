/**
 * LeftPanel — Form side of the split-panel staffing need creation modal.
 * Grouped into visual sections: Opportunity, Profile, Planning, Details.
 */

import React, { memo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Slider from "@mui/material/Slider";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { getGradeColor, getGradeAbbr, GRADE_ORDER } from "../../StaffingTab/constants";
import { M_PLUS_GRADES, M_MINUS_GRADES } from "../../StaffingTab/constants/theme";
import { SkillsAutocomplete } from "../../shared";
import { getPresetButtonSx } from "../../shared/DateRangeFilter";
import { filledSx, filledSmallSx } from "../staffingNeedUtils";
import type { NeedFormState } from "./types";

// ── Reusable section wrapper ──
const Section = ({ children, sx }: { children: React.ReactNode; sx?: any }) => (
  <Box sx={{ bgcolor: "background.paper", borderRadius: 2.5, p: 2, ...sx }}>{children}</Box>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="overline"
    sx={{ fontSize: "0.65rem", fontWeight: 700, color: "text.secondary", letterSpacing: 0.8, mb: 1, display: "block" }}
  >
    {children}
  </Typography>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="caption"
    color="text.disabled"
    sx={{ fontSize: "0.6rem", fontWeight: 600, mb: 0.5, display: "block" }}
  >
    {children}
  </Typography>
);

interface LeftPanelProps {
  accountList: string[];
  filteredOpportunities: Record<string, any>[];
  selectedAccount: string | null;
  setSelectedAccount: (v: string | null) => void;
  selectedOpportunity: Record<string, any> | null;
  setSelectedOpportunity: (v: Record<string, any> | null) => void;
  form: NeedFormState;
  updateForm: (patch: Partial<NeedFormState>) => void;
  setStartDate: (d: Date) => void;
  setEndDate: (d: Date) => void;
  quickStartDates: readonly { label: string; fn: () => Date }[];
  quickEndDates: readonly { label: string; fn: () => Date }[];
  formErrors: Record<string, string>;
  dateError: boolean;
  formDatesValid: boolean;
  canAdd: boolean;
  sortedEmployeeOptions: { empId: string; name: string; grade: string }[];
  editingNeedId: string | null;
  editingExistingNeedId: string | null;
  isEditing: boolean;
  addNeed: () => void;
  resetForm: () => void;
}

const LeftPanel = memo(
  ({
    accountList,
    filteredOpportunities,
    selectedAccount,
    setSelectedAccount,
    selectedOpportunity,
    setSelectedOpportunity,
    form,
    updateForm,
    setStartDate,
    setEndDate,
    quickStartDates,
    quickEndDates,
    formErrors,
    dateError,
    formDatesValid,
    canAdd,
    sortedEmployeeOptions,
    editingNeedId,
    editingExistingNeedId,
    isEditing,
    addNeed,
    resetForm,
  }: LeftPanelProps) => {
    const theme = useTheme();

    const handleFieldEnter = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && canAdd) {
          e.preventDefault();
          addNeed();
        }
      },
      [canAdd, addNeed]
    );

    const mPlusGrades = M_PLUS_GRADES.filter((g) => GRADE_ORDER.includes(g));
    const mMinusGrades = M_MINUS_GRADES.filter((g) => GRADE_ORDER.includes(g));
    const selectedGc = form.grade ? getGradeColor(form.grade) : null;

    // Toolbar-style button sx (matching StaffingTab date range filter)
    const dateBtnSx = (isActive: boolean) => ({
      ...getPresetButtonSx(isActive, {
        activeBg: theme.palette.grey[400],
        activeHoverBg: theme.palette.grey[500],
        inactiveBg: theme.palette.grey[100],
        inactiveHoverBg: theme.palette.grey[200],
        activeColor: theme.palette.getContrastText(theme.palette.grey[400]),
        inactiveColor: theme.palette.text.secondary,
      }),
      flex: 1,
      minWidth: 0,
      height: 30,
      fontSize: "0.75rem",
    });

    return (
      <Box
        sx={{
          width: 440,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          overflow: "auto",
          pr: 0.5,
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 2 },
        }}
      >
        {/* ═══ OPPORTUNITY ═══ */}
        <Section>
          <SectionLabel>Actif</SectionLabel>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            <Autocomplete
              options={accountList}
              value={selectedAccount}
              onChange={(_, v) => {
                setSelectedAccount(v);
                setSelectedOpportunity(null);
              }}
              renderInput={(p) => (
                <TextField
                  {...p}
                  label="Site"
                  size="small"
                  placeholder="Tous les sites..."
                  variant="filled"
                  sx={filledSx}
                />
              )}
              size="small"
              slotProps={{ listbox: { sx: { maxHeight: 200 } } }}
            />
            <Autocomplete
              options={filteredOpportunities}
              value={selectedOpportunity}
              onChange={(_, v) => setSelectedOpportunity(v)}
              getOptionLabel={(o: any) => o.label || ""}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.opportunityId}>
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.85rem" }}>
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
              size="small"
              slotProps={{ listbox: { sx: { maxHeight: 200 } } }}
            />
          </Box>
        </Section>

        {/* ═══ PROFILE (grade + skills + person) ═══ */}
        <Section>
          <SectionLabel>Rôle</SectionLabel>

          <FieldLabel>Grade *</FieldLabel>
          <Box sx={{ display: "flex", gap: 0.5, mb: 0.5 }}>
            {mPlusGrades.map((g) => {
              const gc = getGradeColor(g);
              const selected = form.grade === g;
              return (
                <Chip
                  key={g}
                  label={getGradeAbbr(g)}
                  size="small"
                  clickable
                  onClick={() => updateForm({ grade: form.grade === g ? "" : g })}
                  sx={{
                    flex: 1,
                    height: 30,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    bgcolor: selected ? gc.bg : alpha(gc.bg, 0.35),
                    color: selected ? gc.text : alpha(gc.text, 0.45),
                    border: selected ? `2px solid ${gc.border}` : "2px solid transparent",
                    boxShadow: selected ? `0 2px 8px ${alpha(gc.border, 0.3)}` : "none",
                    transition: "all 0.2s ease",
                    "&:hover": { bgcolor: alpha(gc.bg, 0.65) },
                  }}
                />
              );
            })}
          </Box>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {mMinusGrades.map((g) => {
              const gc = getGradeColor(g);
              const selected = form.grade === g;
              return (
                <Chip
                  key={g}
                  label={getGradeAbbr(g)}
                  size="small"
                  clickable
                  onClick={() => updateForm({ grade: form.grade === g ? "" : g })}
                  sx={{
                    flex: 1,
                    height: 30,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    bgcolor: selected ? gc.bg : alpha(gc.bg, 0.35),
                    color: selected ? gc.text : alpha(gc.text, 0.45),
                    border: selected ? `2px solid ${gc.border}` : "2px solid transparent",
                    boxShadow: selected ? `0 2px 8px ${alpha(gc.border, 0.3)}` : "none",
                    transition: "all 0.2s ease",
                    "&:hover": { bgcolor: alpha(gc.bg, 0.65) },
                  }}
                />
              );
            })}
          </Box>
          {formErrors.grade && (
            <Typography variant="caption" color="error" sx={{ fontSize: "0.7rem", mt: 0.5 }}>
              {formErrors.grade}
            </Typography>
          )}

          <Divider sx={{ my: 1.5 }} />

          <FieldLabel>Compétences</FieldLabel>
          <SkillsAutocomplete
            value={form.skills}
            onChange={(skills) => updateForm({ skills })}
            label=""
            placeholder="Add a skill..."
            size="small"
            variant="filled"
            textFieldSx={filledSmallSx}
          />

          <Box sx={{ mt: 1.5 }}>
            <FieldLabel>Preferred person</FieldLabel>
            <Autocomplete
              options={sortedEmployeeOptions}
              value={sortedEmployeeOptions.find((e) => e.name === form.preferredPerson) || null}
              onChange={(_, v) => updateForm({ preferredPerson: v?.name || "" })}
              getOptionLabel={(o) => o.name || ""}
              groupBy={form.grade ? (option) => (option.grade === form.grade ? form.grade : "Others") : undefined}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.empId} sx={{ py: 0.3 }}>
                  <PersonOutlineIcon sx={{ fontSize: 14, mr: 0.5, color: "text.disabled" }} />
                  <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.78rem" }}>
                    {option.name}
                  </Typography>
                  {option.grade && (
                    <Chip
                      label={getGradeAbbr(option.grade)}
                      size="small"
                      sx={{
                        ml: 0.5,
                        height: 16,
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
                <TextField
                  {...p}
                  size="small"
                  placeholder="No preference..."
                  variant="filled"
                  hiddenLabel
                  sx={filledSmallSx}
                />
              )}
              size="small"
              slotProps={{ listbox: { sx: { maxHeight: 180 } } }}
            />
          </Box>
        </Section>

        {/* ═══ PLANNING (dates + util + prob + qty stacked) ═══ */}
        <Section>
          <SectionLabel>Planning</SectionLabel>

          {/* Dates */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TextField
                size="small"
                label="Start *"
                type="date"
                value={form.startDate}
                onChange={(e) => updateForm({ startDate: e.target.value })}
                onKeyDown={handleFieldEnter}
                InputLabelProps={{ shrink: true }}
                error={!!formErrors.startDate}
                helperText={formErrors.startDate}
                variant="filled"
                fullWidth
                sx={filledSx}
              />
              <Box sx={{ display: "flex", gap: 0.5, mt: 0.75 }}>
                {quickStartDates.map(({ label, fn }) => (
                  <Button key={label} size="small" onClick={() => setStartDate(fn())} sx={dateBtnSx(false)}>
                    {label}
                  </Button>
                ))}
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              <TextField
                size="small"
                label="End *"
                type="date"
                value={form.endDate}
                onChange={(e) => updateForm({ endDate: e.target.value })}
                onKeyDown={handleFieldEnter}
                InputLabelProps={{ shrink: true }}
                error={dateError || !!formErrors.endDate}
                helperText={formErrors.endDate}
                variant="filled"
                fullWidth
                sx={filledSx}
              />
              <Box sx={{ display: "flex", gap: 0.5, mt: 0.75 }}>
                {quickEndDates.map(({ label, fn }) => (
                  <Button key={label} size="small" onClick={() => setEndDate(fn())} sx={dateBtnSx(false)}>
                    {label}
                  </Button>
                ))}
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Utilization + Probability — inline sliders */}
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <Box sx={{ flex: 1 }}>
              <FieldLabel>Charge</FieldLabel>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5 }}>
                <Slider
                  value={form.utilization}
                  onChange={(_, v) => updateForm({ utilization: v as number })}
                  min={0}
                  max={100}
                  step={5}
                  size="small"
                  sx={{
                    flex: 1,
                    color: theme.palette.primary.main,
                    "& .MuiSlider-thumb": { width: 14, height: 14 },
                    "& .MuiSlider-track": { height: 4 },
                    "& .MuiSlider-rail": { height: 4 },
                  }}
                />
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ fontSize: "0.78rem", minWidth: 36, textAlign: "right" }}
                >
                  {form.utilization}%
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              <FieldLabel>Probabilité</FieldLabel>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5 }}>
                <Slider
                  value={form.probability}
                  onChange={(_, v) => updateForm({ probability: v as number })}
                  min={0}
                  max={100}
                  step={5}
                  size="small"
                  sx={{
                    flex: 1,
                    color: theme.palette.primary.main,
                    "& .MuiSlider-thumb": { width: 14, height: 14 },
                    "& .MuiSlider-track": { height: 4 },
                    "& .MuiSlider-rail": { height: 4 },
                  }}
                />
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ fontSize: "0.78rem", minWidth: 32, textAlign: "right" }}
                >
                  {form.probability}%
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Quantity + Add need — inline row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem", fontWeight: 600 }}>
                Qty
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1.5,
                  overflow: "hidden",
                  bgcolor: "background.default",
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => updateForm({ quantity: Math.max(1, form.quantity - 1) })}
                  sx={{ borderRadius: 0, width: 28, height: 28 }}
                >
                  <RemoveIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <Typography
                  sx={{ width: 24, textAlign: "center", fontWeight: 700, fontSize: "0.85rem", lineHeight: "28px" }}
                >
                  {form.quantity}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => updateForm({ quantity: Math.min(10, form.quantity + 1) })}
                  sx={{ borderRadius: 0, width: 28, height: 28 }}
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              size="small"
              startIcon={isEditing ? <EditIcon sx={{ fontSize: 14 }} /> : <CheckIcon sx={{ fontSize: 14 }} />}
              onClick={addNeed}
              disabled={!canAdd}
              sx={{
                fontWeight: 700,
                fontSize: "0.78rem",
                borderRadius: 2,
                py: 0.5,
                px: 2.5,
                bgcolor: selectedGc ? selectedGc.border : theme.palette.primary.main,
                color: "#fff",
                "&:hover": { bgcolor: selectedGc ? selectedGc.text : theme.palette.primary.dark },
                "&.Mui-disabled": { bgcolor: alpha(theme.palette.primary.main, 0.15), color: alpha("#fff", 0.4) },
              }}
            >
              {isEditing ? "Update" : "+ Add need"}
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={resetForm}
              sx={{
                fontWeight: 600,
                fontSize: "0.72rem",
                color: "text.disabled",
                minWidth: 0,
                px: 1,
                "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.06), color: "text.secondary" },
              }}
            >
              Reset
            </Button>
          </Box>
        </Section>
      </Box>
    );
  }
);

LeftPanel.displayName = "LeftPanel";
export default LeftPanel;
