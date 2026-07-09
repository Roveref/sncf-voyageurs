/**
 * InlineNeedCreator — Context-aware staffing need creation panel.
 *
 * Expandable at the bottom of NeedsBoardV2. Shows a compact form on the left
 * and an impact preview on the right (current demand/supply/gap before & after).
 * Supports pre-filling from chart gap clicks.
 */

import { memo, useState, useMemo, useCallback, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Autocomplete from "@mui/material/Autocomplete";
import Slider from "@mui/material/Slider";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { GRADE_ORDER, getGradeColor, getGradeAbbr } from "../../constants";
import { useUserDataStore } from "../../../../stores/useUserDataStore";
import { SkillsAutocomplete } from "../../../shared";
import { functional } from "../../../../config/brandConfig";
import { countWorkingDaysInRange } from "../../utils/dateUtils";
import { sanitizeGrade } from "../../utils/demandCalc";
import type { MonthBucket, DemandSupplyRow } from "../../utils/demandCalc";

const UTIL_PRESETS = [25, 50, 75, 100];

interface InlineNeedCreatorProps {
  onClose: () => void;
  opportunityData: any[];
  prefill?: { grade?: string; startDate?: string; endDate?: string } | null;
  buckets: MonthBucket[];
  rows: DemandSupplyRow[];
  isHoliday: (dateStr: string) => boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const InlineNeedCreator = memo(
  ({ onClose, opportunityData, prefill, buckets, rows, isHoliday }: InlineNeedCreatorProps) => {
    const theme = useTheme();
    const manualAccounts = useUserDataStore((s) => s.manualAccounts);

    // ── Form state ──
    const [selectedGrade, setSelectedGrade] = useState<string | null>(prefill?.grade || null);
    const [selectedOpp, setSelectedOpp] = useState<any>(null);
    const [startDate, setStartDate] = useState(prefill?.startDate || "");
    const [endDate, setEndDate] = useState(prefill?.endDate || "");
    const [utilization, setUtilization] = useState(100);
    const [skills, setSkills] = useState<string[]>([]);
    const [probability, setProbability] = useState(100);

    // Apply prefill on change
    useEffect(() => {
      if (prefill?.grade) setSelectedGrade(prefill.grade);
      if (prefill?.startDate) setStartDate(prefill.startDate);
      if (prefill?.endDate) setEndDate(prefill.endDate);
    }, [prefill]);

    // ── Derived ──
    const oppList = useMemo(() => {
      return opportunityData.map((o: any) => ({
        ...o,
        label: o.opportunity || o.opportunityId,
        account: o.account || "",
      }));
    }, [opportunityData]);

    const dateError = !!(startDate && endDate && endDate < startDate);
    const datesValid = !!startDate && !!endDate && !dateError;

    const workingDays = useMemo(() => {
      if (!datesValid) return 0;
      const s = new Date(startDate + "T00:00:00");
      const e = new Date(endDate + "T00:00:00");
      e.setDate(e.getDate() + 1); // make exclusive
      return countWorkingDaysInRange(s, e, isHoliday);
    }, [startDate, endDate, datesValid, isHoliday]);

    const canSave = !!selectedOpp && !!selectedGrade && datesValid;

    // ── Impact preview ──
    const impact = useMemo(() => {
      if (!selectedGrade || !datesValid) return null;

      // Find overlapping month buckets
      const sk = sanitizeGrade(selectedGrade);
      let currentDemand = 0;
      let currentSupply = 0;
      let matchingBuckets = 0;

      for (const row of rows) {
        const bucket = buckets.find((b) => b.key === row.monthKey);
        if (!bucket) continue;
        if (endDate < bucket.startDate || startDate >= bucket.endDate) continue;
        matchingBuckets++;
        currentDemand += row[`demand_${sk}`] || 0;
        currentSupply += row[`supply_${sk}`] || 0;
      }

      if (matchingBuckets === 0) return null;

      // Compute new need's ETP contribution
      const avgDemandPerMonth = currentDemand / matchingBuckets;
      const avgSupplyPerMonth = currentSupply / matchingBuckets;
      const avgBucketDays = buckets.reduce((s, b) => s + b.workingDays, 0) / buckets.length;
      const newEtp = (utilization / 100) * (workingDays / matchingBuckets / avgBucketDays);

      return {
        currentDemand: Math.round(avgDemandPerMonth * 10) / 10,
        currentSupply: Math.round(avgSupplyPerMonth * 10) / 10,
        currentGap: Math.round((avgDemandPerMonth - avgSupplyPerMonth) * 10) / 10,
        newEtp: Math.round(newEtp * 10) / 10,
        afterDemand: Math.round((avgDemandPerMonth + newEtp) * 10) / 10,
        afterGap: Math.round((avgDemandPerMonth + newEtp - avgSupplyPerMonth) * 10) / 10,
        months: matchingBuckets,
      };
    }, [selectedGrade, datesValid, startDate, endDate, utilization, workingDays, rows, buckets]);

    // ── Save ──
    const handleSave = useCallback(() => {
      if (!canSave || !selectedGrade) return;
      const opportunityId = selectedOpp.opportunityId;
      const now = new Date().toISOString();

      const newNeed = {
        id: generateId(),
        opportunityId: opportunityId,
        grade: selectedGrade,
        quantity: 1,
        startDate,
        endDate,
        skills: [...skills],
        utilization,
        probability: probability / 100,
        status: "open" as const,
        createdAt: now,
        updatedAt: now,
      };

      const ds = useUserDataStore.getState();
      ds.setStaffingNeeds(opportunityId, [...(ds.staffingNeeds[opportunityId] || []), newNeed]);
      // Reset form but keep grade for rapid multi-add
      setSelectedOpp(null);
      setSkills([]);
    }, [canSave, selectedGrade, selectedOpp, startDate, endDate, skills, utilization, probability]);

    const gradeGc = selectedGrade ? getGradeColor(selectedGrade) : null;

    return (
      <Box
        sx={{
          borderTop: 2,
          borderColor: gradeGc ? gradeGc.border : "divider",
          bgcolor: gradeGc ? alpha(gradeGc.bg, 0.3) : alpha(theme.palette.divider, 0.05),
          transition: "all 0.25s ease",
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", px: 1.5, py: 0.5 }}>
          <AddIcon sx={{ fontSize: 16, color: "text.secondary", mr: 0.5 }} />
          <Typography variant="caption" fontWeight={700} sx={{ flex: 1, fontSize: "0.75rem" }}>
            New need
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", gap: 1, px: 1.5, pb: 1.25 }}>
          {/* ── Left: Form ── */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.75, minWidth: 0 }}>
            {/* Grade chips */}
            <Box sx={{ display: "flex", gap: 0.3, flexWrap: "wrap" }}>
              {GRADE_ORDER.map((grade) => {
                const gc = getGradeColor(grade);
                const isActive = selectedGrade === grade;
                return (
                  <Chip
                    key={grade}
                    label={getGradeAbbr(grade)}
                    size="small"
                    clickable
                    onClick={() => setSelectedGrade(isActive ? null : grade)}
                    sx={{
                      height: 22,
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      bgcolor: isActive ? gc.bg : "transparent",
                      color: isActive ? gc.text : "text.disabled",
                      border: `1px solid ${isActive ? gc.border : theme.palette.divider}`,
                      transition: "all 0.15s ease",
                    }}
                  />
                );
              })}
            </Box>

            {/* Opportunity */}
            <Autocomplete
              options={oppList}
              value={selectedOpp}
              onChange={(_, v) => setSelectedOpp(v)}
              getOptionLabel={(o: any) => o.label || ""}
              isOptionEqualToValue={(o, v) => o.opportunityId === v.opportunityId}
              renderInput={(p) => (
                <TextField
                  {...p}
                  label="Actif"
                  size="small"
                  variant="filled"
                  sx={{
                    "& .MuiFilledInput-root": {
                      borderRadius: 1,
                      bgcolor: "action.hover",
                      "&:before, &:after": { display: "none" },
                    },
                    "& .MuiFilledInput-input": { fontSize: "0.75rem", py: 0.75 },
                  }}
                />
              )}
              size="small"
              slotProps={{ listbox: { sx: { maxHeight: 160, "& .MuiAutocomplete-option": { fontSize: "0.75rem" } } } }}
            />

            {/* Dates */}
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              <TextField
                size="small"
                label="Start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                variant="filled"
                sx={{
                  flex: 1,
                  "& .MuiFilledInput-root": {
                    borderRadius: 1,
                    bgcolor: "action.hover",
                    "&:before, &:after": { display: "none" },
                  },
                  "& .MuiFilledInput-input": { fontSize: "0.72rem" },
                }}
              />
              <TextField
                size="small"
                label="End"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                variant="filled"
                error={dateError}
                sx={{
                  flex: 1,
                  "& .MuiFilledInput-root": {
                    borderRadius: 1,
                    bgcolor: "action.hover",
                    "&:before, &:after": { display: "none" },
                  },
                  "& .MuiFilledInput-input": { fontSize: "0.72rem" },
                }}
              />
              {datesValid && (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  fontWeight={700}
                  sx={{ fontSize: "0.6rem", flexShrink: 0 }}
                >
                  {workingDays}j
                </Typography>
              )}
            </Box>

            {/* Utilization + Probability */}
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
              <Box sx={{ display: "flex", gap: 0.25, alignItems: "center" }}>
                {UTIL_PRESETS.map((u) => (
                  <Chip
                    key={u}
                    label={`${u}%`}
                    size="small"
                    clickable
                    onClick={() => setUtilization(u)}
                    sx={{
                      height: 20,
                      fontSize: "0.58rem",
                      fontWeight: 700,
                      minWidth: 0,
                      px: 0.2,
                      bgcolor: utilization === u ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                      color: utilization === u ? theme.palette.primary.main : "text.disabled",
                      border: `1px solid ${utilization === u ? alpha(theme.palette.primary.main, 0.25) : alpha(theme.palette.divider, 0.2)}`,
                    }}
                  />
                ))}
              </Box>
              <Divider orientation="vertical" flexItem />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem", flexShrink: 0 }}>
                Proba
              </Typography>
              <Slider
                value={probability}
                onChange={(_, v) => setProbability(v as number)}
                min={0}
                max={100}
                step={5}
                size="small"
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}%`}
                sx={{ flex: 1, ml: 0.5, "& .MuiSlider-thumb": { width: 12, height: 12 } }}
              />
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{ fontSize: "0.6rem", minWidth: 28, textAlign: "right" }}
              >
                {probability}%
              </Typography>
            </Box>

            {/* Skills */}
            <SkillsAutocomplete value={skills} onChange={setSkills} size="small" placeholder="Skills..." />
          </Box>

          {/* ── Right: Impact preview ── */}
          <Box
            sx={{
              width: 150,
              flexShrink: 0,
              bgcolor: alpha(theme.palette.divider, 0.04),
              borderRadius: 1.5,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              p: 1,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
            }}
          >
            {impact ? (
              <>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ fontSize: "0.65rem", color: "text.secondary", mb: 0.25 }}
                >
                  {selectedGrade ? getGradeAbbr(selectedGrade) : ""} Impact
                </Typography>

                <ImpactRow label="Demand" value={impact.currentDemand} unit="FTE" />
                <ImpactRow label="Avail." value={impact.currentSupply} unit="FTE" />
                <ImpactRow
                  label="Gap"
                  value={impact.currentGap}
                  unit="FTE"
                  color={impact.currentGap > 0 ? functional.warningDark : functional.successDark}
                  sign
                />

                <Divider sx={{ my: 0.25 }} />

                <Typography variant="caption" fontWeight={700} sx={{ fontSize: "0.6rem", color: "text.secondary" }}>
                  After adding
                </Typography>
                <ImpactRow label="Demand" value={impact.afterDemand} unit="FTE" bold delta={`+${impact.newEtp}`} />
                <ImpactRow
                  label="Gap"
                  value={impact.afterGap}
                  unit="FTE"
                  color={impact.afterGap > 0 ? functional.warningDark : functional.successDark}
                  bold
                  sign
                />
              </>
            ) : (
              <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem", textAlign: "center" }}>
                  Select a grade and dates to see the impact
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ display: "flex", alignItems: "center", px: 1.5, pb: 1, gap: 1 }}>
          <Button size="small" onClick={onClose} sx={{ textTransform: "none", fontSize: "0.68rem" }}>
            Cancel
          </Button>
          <Box sx={{ flex: 1 }} />
          {impact && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
              +{impact.newEtp} FTE over {impact.months} months
            </Typography>
          )}
          <Button
            size="small"
            variant="contained"
            disabled={!canSave}
            onClick={handleSave}
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            sx={{ textTransform: "none", fontSize: "0.68rem", py: 0.25 }}
          >
            Add
          </Button>
        </Box>
      </Box>
    );
  }
);
InlineNeedCreator.displayName = "InlineNeedCreator";

// ── Impact row sub-component ──
const ImpactRow = memo(
  ({
    label,
    value,
    unit,
    color,
    bold,
    sign,
    delta,
  }: {
    label: string;
    value: number;
    unit: string;
    color?: string;
    bold?: boolean;
    sign?: boolean;
    delta?: string;
  }) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <Typography variant="caption" sx={{ fontSize: "0.58rem", color: "text.secondary" }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.25 }}>
        {delta && (
          <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "info.main" }}>
            ({delta})
          </Typography>
        )}
        <Typography
          variant="caption"
          sx={{
            fontSize: "0.62rem",
            fontWeight: bold ? 700 : 500,
            color: color || "text.primary",
          }}
        >
          {sign && value > 0 ? "+" : ""}
          {value.toFixed(1)} {unit}
        </Typography>
      </Box>
    </Box>
  )
);
ImpactRow.displayName = "ImpactRow";

export default InlineNeedCreator;
