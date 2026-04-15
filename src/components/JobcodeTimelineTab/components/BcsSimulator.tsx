/**
 * BcsSimulator — Live BCS CM1 projection
 *
 * Two modes:
 * - With jobcode: fetches SAP/MDS/CRM data and pre-fills
 * - Blank (no jobcode): starts empty for quoting new projects
 *
 * Supports T&M (revenue = days × client rate per grade) and Fixed Price.
 * SCR rates (France Consulting) are locked. SBR/client rates are editable.
 */

import React, { memo, useState, useEffect, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { alpha, useTheme } from "@mui/material/styles";
import { fetchBcsData, fetchBcsRates, BcsResponse, BcsRatesResponse } from "../../../services/api";
import { gradeColors } from "../../../config/brandConfig";
import { animations } from "../../../styles/animations";

// ── Types ──

type ContractType = "tm" | "fp";

interface BcsRow {
  id: string;
  label: string; // grade name
  personName: string; // Prénom Nom
  scrPerDay: number; // base SCR (before inflation)
  clientRate: number; // SBR or negotiated rate
  year: number; // year for inflation adjustment
  actualDays: number;
  forecastDays: number;
  isManual: boolean;
  scrEditable: boolean;
  actualByYear: Record<number, number>;
  forecastByYear: Record<number, number>;
}

interface Props {
  jobcode?: string; // optional — blank BCS if omitted
}

// ── Types ──

type ServiceOffering = "advisory" | "implementation" | "strategy";

const SERVICE_OFFERING_LABELS: Record<ServiceOffering, string> = {
  advisory: "Business & IT Advisory",
  implementation: "IT Implementation",
  strategy: "Strategy Consulting",
};

import { MAGR_PROFILES, GRADE_ORDER } from "../../StaffingTab/constants";

const STATUS_LABELS: Record<number, { label: string; color: "success" | "info" | "warning" | "error" | "default" }> = {
  1: { label: "Lead", color: "default" },
  4: { label: "Go", color: "info" },
  6: { label: "Proposal", color: "warning" },
  11: { label: "Won", color: "success" },
  14: { label: "Booked", color: "info" },
  15: { label: "Lost", color: "error" },
};

const nbsp = (s: string) => s.replace(/\u202F|\u00A0/g, " "); // force regular spaces
const fmt = (n: number) =>
  nbsp(n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + " €";
const fmtDays = (n: number) => nbsp(n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtPct = (n: number) =>
  nbsp(n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + " %";

const emptyYearMap = (): Record<number, number> => ({});

/** Resolve SCR and rate card for a grade label (supports "Manager Advanced" → advanced MAGR profile) */
function resolveRates(
  label: string,
  scrRates: Record<string, number>,
  rateCard: Record<string, number>,
  magrProfiles?: Record<string, any>
): { scr: number; rc: number } {
  const isAdvanced = label.endsWith(" Advanced");
  const baseGrade = isAdvanced ? label.replace(" Advanced", "") : label;

  if (magrProfiles && isAdvanced) {
    // Find the advanced MAGR profile for this grade
    const profile = Object.values(magrProfiles).find((p: any) => p.grade === baseGrade && p.advanced);
    if (profile) {
      const rcField = Object.keys(rateCard).length > 0 ? rateCard : {};
      return { scr: profile.scr || 0, rc: rcField[baseGrade] || 0 };
    }
  }

  return { scr: scrRates[baseGrade] || 0, rc: rateCard[baseGrade] || 0 };
}

function makeGradeRow(
  grade: string,
  scrRates: Record<string, number>,
  rateCard: Record<string, number>,
  year?: number,
  personName?: string,
  magrProfiles?: Record<string, any>
): BcsRow {
  const { scr, rc } = resolveRates(grade, scrRates, rateCard, magrProfiles);
  return {
    id: `${grade}_${Date.now()}_${Math.random()}`,
    label: grade,
    personName: personName || "",
    scrPerDay: scr,
    clientRate: rc,
    year: year || new Date().getFullYear(),
    actualDays: 0,
    forecastDays: 0,
    isManual: false,
    scrEditable: false,
    actualByYear: emptyYearMap(),
    forecastByYear: emptyYearMap(),
  };
}

// ── Component ──

const BcsSimulator = ({ jobcode }: Props) => {
  const theme = useTheme();
  const isBlank = !jobcode;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BcsResponse | null>(null);
  const [rates, setRates] = useState<BcsRatesResponse | null>(null);

  const [contractType, setContractType] = useState<ContractType>("fp");
  const [serviceOffering, setServiceOffering] = useState<ServiceOffering>("advisory");
  const [selectedOppIds, setSelectedOppIds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<BcsRow[]>([]);
  const [grossRevenue, setGrossRevenue] = useState(0);
  const [netRevenue, setNetRevenue] = useState(0);
  const [inflationPct, setInflationPct] = useState(5);
  const [targetCm1Pct, setTargetCm1Pct] = useState(0);

  // ── Fetch rates + data ──

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Always load rates from DB
      let loadedRates: BcsRatesResponse;
      let bcsData: BcsResponse | null = null;

      if (isBlank) {
        loadedRates = await fetchBcsRates();
      } else {
        bcsData = await fetchBcsData(jobcode!);
        loadedRates = { scrRates: bcsData.scrRates, rateCards: bcsData.rateCards, magrProfiles: bcsData.magrProfiles };
      }

      setRates(loadedRates);
      setData(bcsData);

      const rateCard = loadedRates.rateCards[serviceOffering] || {};
      const scrMap = loadedRates.scrRates || {};

      if (isBlank) {
        // Blank mode: start empty — user adds grades manually
        setRows([]);
      } else if (bcsData) {
        // Jobcode mode: map SAP/MDS dashboard grades to BCS grades
        const autoSelected = new Set(
          bcsData.opportunities.filter((o) => o.status === 11 || o.status === 14).map((o) => o.id)
        );
        if (autoSelected.size === 0) bcsData.opportunities.forEach((o) => autoSelected.add(o.id));
        setSelectedOppIds(autoSelected);

        // Build one row per employee (with name from DB)
        const empRows: BcsRow[] = bcsData.employees.map((emp) => {
          const { scr, rc } = resolveRates(emp.grade, scrMap, rateCard, loadedRates.magrProfiles);
          return {
            id: `${emp.empId}_${Date.now()}`,
            label: emp.grade,
            personName: emp.name,
            scrPerDay: scr,
            clientRate: rc,
            year: emp.cosYear,
            actualDays: emp.actualDays,
            forecastDays: emp.forecastDays,
            isManual: false,
            scrEditable: false,
            actualByYear: emptyYearMap(),
            forecastByYear: emptyYearMap(),
          };
        });
        setRows(empRows);

        const selOpps = bcsData.opportunities.filter((o) => autoSelected.has(o.id));
        setGrossRevenue(selOpps.reduce((s, o) => s + o.grossRevenue, 0));
        setNetRevenue(selOpps.reduce((s, o) => s + o.netRevenue, 0));

        const totalSelRev = selOpps.reduce((s, o) => s + o.netRevenue, 0);
        if (totalSelRev > 0) {
          setTargetCm1Pct(selOpps.reduce((s, o) => s + o.cm1Pct * o.netRevenue, 0) / totalSelRev);
        }
      }
    } catch (e: any) {
      setError(e.message || "Loading error");
    }
    setLoading(false);
  }, [jobcode, isBlank, serviceOffering]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Opportunity toggle ──

  const toggleOpp = useCallback(
    (id: string) => {
      if (!data) return;
      setSelectedOppIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        const selOpps = data.opportunities.filter((o) => next.has(o.id));
        setGrossRevenue(selOpps.reduce((s, o) => s + o.grossRevenue, 0));
        setNetRevenue(selOpps.reduce((s, o) => s + o.netRevenue, 0));
        const totalSelRev = selOpps.reduce((s, o) => s + o.netRevenue, 0);
        if (totalSelRev > 0) setTargetCm1Pct(selOpps.reduce((s, o) => s + o.cm1Pct * o.netRevenue, 0) / totalSelRev);
        return next;
      });
    },
    [data]
  );

  // ── Row edits ──

  const updateRow = useCallback((id: string, field: keyof BcsRow, value: number | string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // When service offering changes, only update the reference — client rates stay as-is
  const handleOfferingChange = useCallback((offering: ServiceOffering) => {
    setServiceOffering(offering);
    // Rate card info updates automatically via `rates.rateCards[serviceOffering]` in render
    // Client rates (SBR) are NOT overwritten — user keeps their chosen rates
  }, []);

  // Add a grade row (from BCS grade list or manual)
  const addGradeRow = useCallback(
    (grade: string) => {
      if (!rates) return;
      const scrMap = rates.scrRates || {};
      const rateCard = rates.rateCards[serviceOffering] || {};
      const isBcsGrade = GRADE_ORDER.includes(grade) || grade.endsWith(" Advanced");
      setRows((prev) => [
        ...prev,
        {
          id: `${grade}_${Date.now()}_${Math.random()}`,
          label: grade,
          personName: "",
          ...(() => {
            const { scr, rc } = resolveRates(grade, scrMap, rateCard, rates.magrProfiles);
            return { scrPerDay: scr, clientRate: rc };
          })(),
          year: new Date().getFullYear(),
          actualDays: 0,
          forecastDays: 0,
          isManual: !isBcsGrade,
          scrEditable: !isBcsGrade,
          actualByYear: emptyYearMap(),
          forecastByYear: emptyYearMap(),
        },
      ]);
    },
    [rates, serviceOffering]
  );

  // ── Computed values ──

  const computed = useMemo(() => {
    const baseYear = 2025; // SCR rates in DB are CY25
    const inflFactor = (year: number) => Math.pow(1 + inflationPct / 100, year - baseYear);

    let totalActual = 0,
      totalForecast = 0,
      totalCost = 0;
    let cosSap = 0,
      cosForecast = 0;
    let tmRevenue = 0; // T&M computed revenue

    const rowDetails = rows.map((r) => {
      const projected = r.actualDays + r.forecastDays;

      // Apply inflation based on the row's year
      const rowInflFactor = inflFactor(r.year);
      const adjustedScr = r.scrPerDay * rowInflFactor;
      const cost = projected * adjustedScr;
      const actualCost = r.actualDays * adjustedScr;
      const forecastCost = r.forecastDays * adjustedScr;
      const rowRevenue = projected * r.clientRate; // T&M revenue for this row

      totalActual += r.actualDays;
      totalForecast += r.forecastDays;
      totalCost += cost;
      cosSap += actualCost;
      cosForecast += forecastCost;
      tmRevenue += rowRevenue;

      return { ...r, projected, cost, rowRevenue };
    });

    // In T&M mode, NR = computed from days × client rate (can be overridden manually, but auto-computed)
    const effectiveNetRevenue = contractType === "tm" ? tmRevenue : netRevenue;
    const cm1 = effectiveNetRevenue - totalCost;
    const cm1Pct = effectiveNetRevenue > 0 ? (cm1 / effectiveNetRevenue) * 100 : 0;

    const budgetCm1Pct = targetCm1Pct;
    const cosMax = effectiveNetRevenue * (1 - budgetCm1Pct / 100);
    const envelopeVsCurrent = cosMax - totalCost;
    const blendedScr = totalForecast > 0 ? cosForecast / totalForecast : 500;
    const envelopeRemaining = cosMax - cosSap;
    const envelopeDays = blendedScr > 0 ? Math.floor(envelopeRemaining / blendedScr) : 0;
    const daysDelta = envelopeDays - totalForecast;

    return {
      rowDetails,
      totalActual,
      totalForecast,
      totalProjected: totalActual + totalForecast,
      totalCost,
      cosSap,
      cosForecast,
      cm1,
      cm1Pct,
      effectiveNetRevenue,
      budgetCm1Pct,
      cosMax,
      envelopeVsCurrent,
      envelopeRemaining,
      blendedScr,
      envelopeDays,
      daysDelta,
      tmRevenue,
      deltaCm1Pts: cm1Pct - budgetCm1Pct,
    };
  }, [rows, netRevenue, data, selectedOppIds, inflationPct, contractType, targetCm1Pct]);

  // ── Render helpers ──

  const gradeChip = (grade: string) => {
    const gc = gradeColors[grade];
    return gc ? { bgcolor: gc.bg, color: gc.text } : { bgcolor: "#f5f5f5", color: "#666" };
  };

  const cm1Color = (pct: number) =>
    pct >= 30 ? theme.palette.success.main : pct >= 20 ? theme.palette.warning.main : theme.palette.error.main;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography color="error" variant="body2">
          {error}
        </Typography>
        <Button size="small" onClick={load} sx={{ mt: 1 }}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      {/* ── Section header ── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          mb: 2,
          pb: 1.5,
          borderBottom: `2px solid ${theme.palette.primary.main}`,
        }}
      >
        <Tooltip
          title="CM1 = Contribution Margin 1 (Revenue - Direct Costs). Simulates the profitability of a project based on staffing costs vs. revenue."
          arrow
        >
          <Typography variant="h6" fontWeight={700} fontSize={18} sx={{ cursor: "help" }}>
            CM1 Simulator
          </Typography>
        </Tooltip>
        <Chip
          label={isBlank ? "New BCS" : "BCS Live"}
          size="small"
          sx={{
            fontSize: "0.7rem",
            fontWeight: 600,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            color: "primary.main",
          }}
        />
        <Box flex={1} />
        <Select
          value={serviceOffering}
          onChange={(e) => handleOfferingChange(e.target.value as ServiceOffering)}
          size="small"
          sx={{ fontSize: "0.75rem", fontWeight: 600, height: 28, minWidth: 170, "& .MuiSelect-select": { py: 0.25 } }}
        >
          {(Object.entries(SERVICE_OFFERING_LABELS) as [ServiceOffering, string][]).map(([key, label]) => (
            <MenuItem key={key} value={key} sx={{ fontSize: "0.8rem" }}>
              {label}
            </MenuItem>
          ))}
        </Select>
        <ToggleButtonGroup
          value={contractType}
          exclusive
          onChange={(_, v) => {
            if (v) setContractType(v);
          }}
          size="small"
          sx={{ height: 28 }}
        >
          <ToggleButton value="tm" sx={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "none", px: 1.5 }}>
            T&M
          </ToggleButton>
          <ToggleButton value="fp" sx={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "none", px: 1.5 }}>
            Fixed Price
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ── Opportunity selection (only with jobcode) ── */}
      {!isBlank && data && data.opportunities.length > 0 && (
        <Box sx={{ bgcolor: "background.paper", borderRadius: 3, p: 2.5, mb: 2.5 }}>
          <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ mb: 1.5 }}>
            Associated opportunities — select those to include
          </Typography>
          {data.opportunities.map((opp) => (
            <Box
              key={opp.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1,
                px: 1.5,
                borderRadius: 2,
                "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.04) },
              }}
            >
              <Checkbox
                size="small"
                checked={selectedOppIds.has(opp.id)}
                onChange={() => toggleOpp(opp.id)}
                sx={{ p: 0.5 }}
              />
              <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                {opp.name}
              </Typography>
              <Chip
                label={STATUS_LABELS[opp.status]?.label || `Status ${opp.status}`}
                size="small"
                color={STATUS_LABELS[opp.status]?.color || "default"}
                variant="outlined"
                sx={{ fontSize: "0.65rem", height: 20 }}
              />
              <Typography variant="caption" color="text.secondary">
                CM1 {opp.cm1Pct ? opp.cm1Pct.toFixed(2) + "%" : "—"}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90, textAlign: "right" }}>
                {fmt(opp.grossRevenue)}
              </Typography>
            </Box>
          ))}
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5 }}>
            <Typography variant="body2" fontWeight={600}>
              Total selected
            </Typography>
            <Box flex={1} />
            <Typography variant="caption" color="text.secondary">
              Avg. opening CM1
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {computed.budgetCm1Pct.toFixed(2)}%
            </Typography>
            <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ minWidth: 90, textAlign: "right" }}>
              {fmt(grossRevenue)}
            </Typography>
          </Box>
        </Box>
      )}

      {/* ── CM1 Banner (gauge + waterfall + inputs) ── */}
      <Box
        sx={{
          bgcolor: "background.paper",
          borderRadius: 3,
          p: 3,
          mb: 2.5,
          display: "flex",
          alignItems: "center",
          gap: 4,
          ...animations.cardEntrance(0),
        }}
      >
        {/* Donut: projected CM1% + target ring */}
        <Box
          sx={{
            width: 160,
            height: 160,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width="160"
            height="160"
            viewBox="0 0 160 160"
            style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}
          >
            {/* Background track */}
            <circle cx="80" cy="80" r="65" fill="none" stroke={alpha(theme.palette.divider, 0.2)} strokeWidth="12" />
            {/* Target ring (dashed, outer) */}
            {computed.budgetCm1Pct > 0 && (
              <circle
                cx="80"
                cy="80"
                r="65"
                fill="none"
                stroke={alpha(theme.palette.info.main, 0.3)}
                strokeWidth="12"
                strokeDasharray={`${(2 * Math.PI * 65 * Math.min(computed.budgetCm1Pct, 100)) / 100} ${2 * Math.PI * 65}`}
                strokeLinecap="round"
              />
            )}
            {/* Projected CM1% (inner, solid) */}
            <circle cx="80" cy="80" r="52" fill="none" stroke={alpha(theme.palette.divider, 0.15)} strokeWidth="10" />
            <circle
              cx="80"
              cy="80"
              r="52"
              fill="none"
              stroke={cm1Color(computed.cm1Pct)}
              strokeWidth="10"
              strokeDasharray={2 * Math.PI * 52}
              strokeDashoffset={2 * Math.PI * 52 * (1 - Math.min(Math.max(computed.cm1Pct, 0), 100) / 100)}
              strokeLinecap="round"
            />
          </svg>
          <Box textAlign="center">
            <Typography variant="h4" fontWeight={800} sx={{ color: cm1Color(computed.cm1Pct), lineHeight: 1 }}>
              {fmtPct(computed.cm1Pct)}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Projected CM1
            </Typography>
            {computed.budgetCm1Pct > 0 && (
              <Typography
                variant="caption"
                display="block"
                sx={{
                  color: computed.deltaCm1Pts >= 0 ? "success.main" : "error.main",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                }}
              >
                Δ {computed.deltaCm1Pts >= 0 ? "+" : ""}
                {fmtPct(computed.deltaCm1Pts)}
              </Typography>
            )}
          </Box>
          {/* Target label */}
          {computed.budgetCm1Pct > 0 && (
            <Typography
              variant="caption"
              sx={{ position: "absolute", bottom: -2, fontSize: "0.6rem", color: "info.main", fontWeight: 600 }}
            >
              Target {fmtPct(computed.budgetCm1Pct)}
            </Typography>
          )}
        </Box>

        {/* Waterfall with inline GR/NR inputs */}
        <Box flex={1}>
          {/* GR row — editable */}
          <Box sx={{ display: "flex", alignItems: "center", py: 0.75, fontSize: 13 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              Gross Revenue
            </Typography>
            <TextField
              size="small"
              type="number"
              value={grossRevenue}
              onChange={(e) => setGrossRevenue(Number(e.target.value) || 0)}
              sx={{
                "& input": { fontSize: 13, fontWeight: 600, textAlign: "right", p: "3px 6px" },
                width: 110,
                bgcolor: alpha(theme.palette.warning.light, 0.15),
                borderRadius: 1,
                mr: 0.5,
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ width: 10 }}>
              €
            </Typography>
            <Box
              sx={{
                width: 100,
                height: 5,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.divider, 0.2),
                ml: 1.5,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  width: `${computed.effectiveNetRevenue > 0 ? Math.min((grossRevenue / computed.effectiveNetRevenue) * 100, 100) : 100}%`,
                  bgcolor: alpha(theme.palette.grey[500], 0.4),
                  borderRadius: 3,
                }}
              />
            </Box>
          </Box>
          {/* NR row — editable */}
          <Box sx={{ display: "flex", alignItems: "center", py: 0.75, fontSize: 13 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              Net Revenue
            </Typography>
            <TextField
              size="small"
              type="number"
              value={netRevenue}
              onChange={(e) => setNetRevenue(Number(e.target.value) || 0)}
              sx={{
                "& input": { fontSize: 13, fontWeight: 600, textAlign: "right", p: "3px 6px" },
                width: 110,
                bgcolor: alpha(theme.palette.warning.light, 0.15),
                borderRadius: 1,
                mr: 0.5,
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ width: 10 }}>
              €
            </Typography>
            <Box
              sx={{
                width: 100,
                height: 5,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.divider, 0.2),
                ml: 1.5,
                overflow: "hidden",
              }}
            >
              <Box sx={{ height: "100%", width: "100%", bgcolor: theme.palette.info.main, borderRadius: 3 }} />
            </Box>
          </Box>
          {/* COS rows */}
          <Box sx={{ display: "flex", alignItems: "center", py: 0.75, fontSize: 13 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {isBlank ? "− COS (days × SCR)" : "− Actual COS (SAP)"}
            </Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ minWidth: 110, textAlign: "right", color: "warning.main" }}
            >
              -{fmt(computed.cosSap)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ width: 10 }}></Typography>
            <Box
              sx={{
                width: 100,
                height: 5,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.divider, 0.2),
                ml: 1.5,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  width: `${computed.effectiveNetRevenue > 0 ? (computed.cosSap / computed.effectiveNetRevenue) * 100 : 0}%`,
                  bgcolor: "warning.main",
                  borderRadius: 3,
                }}
              />
            </Box>
          </Box>
          {computed.cosForecast > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", py: 0.75, fontSize: 13 }}>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                − Forecast COS (MDS)
              </Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{ minWidth: 110, textAlign: "right", color: "secondary.main" }}
              >
                -{fmt(computed.cosForecast)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 10 }}></Typography>
              <Box
                sx={{
                  width: 100,
                  height: 5,
                  borderRadius: 3,
                  bgcolor: alpha(theme.palette.divider, 0.2),
                  ml: 1.5,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    height: "100%",
                    width: `${computed.effectiveNetRevenue > 0 ? (computed.cosForecast / computed.effectiveNetRevenue) * 100 : 0}%`,
                    bgcolor: "secondary.main",
                    borderRadius: 3,
                  }}
                />
              </Box>
            </Box>
          )}
          {/* CM1 result */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              py: 0.75,
              mt: 0.75,
              pt: 1.25,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            <Typography variant="body1" fontWeight={700} sx={{ flex: 1 }}>
              = Projected CM1
            </Typography>
            <Typography
              variant="body1"
              fontWeight={700}
              sx={{ minWidth: 110, textAlign: "right", color: cm1Color(computed.cm1Pct) }}
            >
              {fmt(computed.cm1)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ width: 10 }}></Typography>
            <Box
              sx={{
                width: 100,
                height: 5,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.divider, 0.2),
                ml: 1.5,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  width: `${Math.max(0, computed.cm1Pct)}%`,
                  bgcolor: cm1Color(computed.cm1Pct),
                  borderRadius: 3,
                }}
              />
            </Box>
          </Box>
          {/* CM1 restante pour atteindre la cible */}
          {computed.budgetCm1Pct > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", py: 0.5, fontSize: 12 }}>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1, fontStyle: "italic" }}>
                Remaining CM1 to reach target ({fmtPct(computed.budgetCm1Pct)})
              </Typography>
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{
                  minWidth: 110,
                  textAlign: "right",
                  color: computed.envelopeVsCurrent >= 0 ? "success.main" : "error.main",
                }}
              >
                {computed.envelopeVsCurrent >= 0 ? "+" : ""}
                {fmt(computed.envelopeVsCurrent)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 10 }}></Typography>
              <Box sx={{ width: 100 }} />
            </Box>
          )}
        </Box>

        {/* CM1% cible input */}
        <Box
          sx={{
            minWidth: 140,
            p: 2,
            bgcolor: alpha(theme.palette.text.primary, 0.03),
            borderRadius: 2.5,
            textAlign: "center",
          }}
        >
          <Typography
            variant="caption"
            fontWeight={500}
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            CM1% target
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mt: 1 }}>
            <TextField
              size="small"
              type="number"
              value={targetCm1Pct}
              onChange={(e) => setTargetCm1Pct(Number(e.target.value) || 0)}
              sx={{
                "& input": {
                  fontSize: 18,
                  fontWeight: 800,
                  textAlign: "center",
                  p: "4px 4px",
                  color: theme.palette.info.main,
                },
                width: 70,
                bgcolor: alpha(theme.palette.info.main, 0.06),
                borderRadius: 1,
              }}
            />
            <Typography fontWeight={600} color="info.main">
              %
            </Typography>
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem", mt: 0.5, display: "block" }}>
            envelope & margin
          </Typography>
        </Box>
      </Box>

      {/* ── Grade table ── */}
      <Box sx={{ bgcolor: "background.paper", borderRadius: 3, mb: 2.5, overflow: "hidden" }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2.5,
            py: 1.5,
            flexWrap: "wrap",
            gap: 1,
            bgcolor: alpha(theme.palette.action.hover, 0.03),
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              Breakdown by grade
            </Typography>
            <Typography variant="caption" sx={{ color: "warning.main", fontWeight: 500 }}>
              ✎ editable
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              SCR inflation / yr
            </Typography>
            <TextField
              size="small"
              type="number"
              value={inflationPct}
              onChange={(e) => setInflationPct(Number(e.target.value) || 0)}
              InputProps={{
                endAdornment: (
                  <Typography variant="caption" color="text.secondary">
                    %
                  </Typography>
                ),
              }}
              sx={{
                "& input": { fontSize: 13, fontWeight: 600, textAlign: "right", p: "4px 4px 4px 8px" },
                width: 75,
                bgcolor: "#fefce8",
                borderRadius: 1,
              }}
            />
            {data?.baseYear && inflationPct !== 0 && (
              <Typography variant="caption" color="text.secondary">
                base CY{String(data.baseYear).slice(2)}
              </Typography>
            )}
          </Box>
          {!isBlank && (
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={load}
              sx={{ fontSize: "0.75rem", textTransform: "none" }}
            >
              Reload SAP/MDS
            </Button>
          )}
        </Box>

        {/* Table */}
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <Box component="thead">
            <Box
              component="tr"
              sx={{
                "& th": {
                  p: "10px 12px",
                  textAlign: "right",
                  fontWeight: 600,
                  fontSize: 11,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                  bgcolor: alpha(theme.palette.action.hover, 0.03),
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  whiteSpace: "nowrap",
                },
                "& th:first-of-type": { textAlign: "left", width: 30 },
              }}
            >
              <Box component="th" sx={{ width: 30 }}></Box>
              <Box component="th" sx={{ textAlign: "left !important" }}>
                Grade
              </Box>
              <Box component="th" sx={{ textAlign: "left !important" }}>
                Name
              </Box>
              <Box component="th">
                <Tooltip title="COS year — inflation applies from March 1st (before 01/03 = N-1 rate)" arrow>
                  <span>COS Year</span>
                </Tooltip>
              </Box>
              <Box component="th">SBR / d</Box>
              {isBlank ? (
                <Box component="th">Days</Box>
              ) : (
                <>
                  <Box component="th">
                    Actual d{" "}
                    <Chip
                      label="SAP"
                      size="small"
                      sx={{ fontSize: "0.55rem", height: 14, ml: 0.5, bgcolor: "#dbeafe", color: "#1d4ed8" }}
                    />
                  </Box>
                  <Box component="th">
                    Forecast d{" "}
                    <Chip
                      label="MDS"
                      size="small"
                      sx={{ fontSize: "0.55rem", height: 14, ml: 0.5, bgcolor: "#e0e7ff", color: "#4338ca" }}
                    />
                  </Box>
                  <Box component="th" sx={{ borderLeft: `2px solid ${theme.palette.divider}` }}>
                    Projected d
                  </Box>
                </>
              )}
              <Box component="th">Projected cost</Box>
              <Box component="th">Revenue</Box>
              <Box component="th">CM1%</Box>
              <Box component="th" sx={{ borderLeft: `2px solid ${theme.palette.divider}` }}>
                <Tooltip title="Additional chargeable days at this grade to reach the CM1% target" arrow>
                  <span>Margin d</span>
                </Tooltip>
              </Box>
            </Box>
          </Box>
          <Box component="tbody">
            {computed.rowDetails.map((r) => {
              const gc = gradeChip(r.label);
              // Marge: how many more days of this grade to land at CM1% target
              // FP: adding 1 day adds scrPerDay to COS, no revenue change → marge = envelope / SCR
              // T&M: adding 1 day adds clientRate to NR and scrPerDay to COS
              //   X = -envelope / (cr*(1-target%) - scr)
              const displayMarge = (() => {
                if (r.scrPerDay <= 0) return 0;
                if (contractType === "tm" && r.clientRate > 0 && computed.budgetCm1Pct > 0) {
                  const denom = r.clientRate * (1 - computed.budgetCm1Pct / 100) - r.scrPerDay;
                  if (Math.abs(denom) < 0.01) return 0;
                  return -computed.envelopeVsCurrent / denom;
                }
                return computed.envelopeVsCurrent / r.scrPerDay;
              })();
              const hpd = r.label.startsWith("AP") || r.label.startsWith("00") ? 7 : 8;
              const margeHours = displayMarge * hpd;

              return (
                <Box
                  component="tr"
                  key={r.id}
                  sx={{
                    "& td": {
                      p: "8px 12px",
                      textAlign: "right",
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    },
                    "& td:first-of-type": { textAlign: "left" },
                    "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.04) },
                    ...(r.isManual ? { bgcolor: "#fffbeb" } : {}),
                  }}
                >
                  <Box component="td" sx={{ width: 30 }}>
                    {(r.isManual || isBlank) && (
                      <IconButton
                        size="small"
                        onClick={() => removeRow(r.id)}
                        sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Box>
                  <Box component="td" sx={{ textAlign: "left !important" }}>
                    {r.isManual ? (
                      <TextField
                        size="small"
                        value={r.label}
                        onChange={(e) => updateRow(r.id, "label", e.target.value)}
                        sx={{
                          "& input": { fontSize: 12, fontWeight: 600, p: "2px 6px" },
                          width: 120,
                          bgcolor: "#fef3c7",
                          borderRadius: 1,
                        }}
                      />
                    ) : (
                      <Chip
                        label={r.label}
                        size="small"
                        sx={{ fontSize: "0.7rem", fontWeight: 600, ...gc, border: "none" }}
                      />
                    )}
                  </Box>
                  <Box component="td" sx={{ textAlign: "left !important" }}>
                    <TextField
                      size="small"
                      value={r.personName}
                      placeholder="—"
                      onChange={(e) => updateRow(r.id, "personName", e.target.value)}
                      sx={{
                        "& input": { fontSize: 12, fontWeight: 500, p: "2px 6px" },
                        width: 130,
                        bgcolor: alpha(theme.palette.warning.light, 0.15),
                        borderRadius: 1,
                      }}
                    />
                  </Box>
                  <Box component="td">
                    <TextField
                      size="small"
                      type="number"
                      value={r.year}
                      onChange={(e) => updateRow(r.id, "year", Number(e.target.value) || new Date().getFullYear())}
                      sx={{
                        "& input": { fontSize: 12, fontWeight: 500, textAlign: "center", p: "2px 4px" },
                        width: 55,
                        bgcolor: "#fefce8",
                        borderRadius: 1,
                      }}
                    />
                    {inflationPct !== 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          fontSize: "0.6rem",
                          color: "text.disabled",
                          textAlign: "center",
                          mt: 0.25,
                        }}
                      >
                        SCR {fmt(r.scrPerDay * Math.pow(1 + inflationPct / 100, r.year - 2025))}
                      </Typography>
                    )}
                  </Box>
                  <Box component="td">
                    <TextField
                      size="small"
                      type="number"
                      value={r.clientRate}
                      onChange={(e) => updateRow(r.id, "clientRate", Number(e.target.value) || 0)}
                      sx={{
                        "& input": { fontSize: 12, fontWeight: 500, textAlign: "right", p: "2px 6px" },
                        width: 70,
                        bgcolor: "#fefce8",
                        borderRadius: 1,
                      }}
                    />
                    {(() => {
                      const rcValue = rates?.rateCards[serviceOffering]?.[r.label];
                      if (!rcValue || r.isManual) return null;
                      return (
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            fontSize: "0.6rem",
                            color: "text.disabled",
                            textAlign: "right",
                            mt: 0.25,
                          }}
                        >
                          RC {Math.round(rcValue).toLocaleString("fr-FR")} €
                        </Typography>
                      );
                    })()}
                  </Box>
                  {isBlank ? (
                    /* Blank mode: single "Jours" column */
                    <Box component="td">
                      <TextField
                        size="small"
                        type="number"
                        value={r.actualDays}
                        onChange={(e) => {
                          updateRow(r.id, "actualDays", Number(e.target.value) || 0);
                        }}
                        sx={{
                          "& input": { fontSize: 13, fontWeight: 500, textAlign: "right", p: "4px 8px" },
                          width: 70,
                          bgcolor: alpha(theme.palette.warning.light, 0.15),
                          borderRadius: 1,
                        }}
                      />
                    </Box>
                  ) : (
                    /* Jobcode mode: Réel + Forecast + Projeté */
                    <>
                      <Box component="td">
                        <TextField
                          size="small"
                          type="number"
                          value={r.actualDays}
                          onChange={(e) => updateRow(r.id, "actualDays", Number(e.target.value) || 0)}
                          sx={{
                            "& input": { fontSize: 13, fontWeight: 500, textAlign: "right", p: "4px 8px" },
                            width: 70,
                            bgcolor: alpha(theme.palette.warning.light, 0.15),
                            borderRadius: 1,
                          }}
                        />
                      </Box>
                      <Box component="td">
                        <TextField
                          size="small"
                          type="number"
                          value={r.forecastDays}
                          onChange={(e) => updateRow(r.id, "forecastDays", Number(e.target.value) || 0)}
                          sx={{
                            "& input": { fontSize: 13, fontWeight: 500, textAlign: "right", p: "4px 8px" },
                            width: 70,
                            bgcolor: alpha(theme.palette.warning.light, 0.15),
                            borderRadius: 1,
                          }}
                        />
                      </Box>
                      <Box
                        component="td"
                        sx={{ fontWeight: 600, borderLeft: `2px solid ${alpha(theme.palette.divider, 0.5)}` }}
                      >
                        {fmtDays(r.projected)}
                      </Box>
                    </>
                  )}
                  <Box component="td" sx={{ fontWeight: 600 }}>
                    {fmt(r.cost)}
                  </Box>
                  <Box component="td" sx={{ fontWeight: 600, color: "info.main" }}>
                    {fmt(r.rowRevenue)}
                  </Box>
                  <Box
                    component="td"
                    sx={{
                      fontWeight: 600,
                      color:
                        r.rowRevenue > 0 ? cm1Color(((r.rowRevenue - r.cost) / r.rowRevenue) * 100) : "text.disabled",
                    }}
                  >
                    {r.rowRevenue > 0 ? `${(((r.rowRevenue - r.cost) / r.rowRevenue) * 100).toFixed(2)}%` : "—"}
                  </Box>
                  <Box
                    component="td"
                    sx={{
                      fontWeight: 700,
                      borderLeft: `2px solid ${alpha(theme.palette.divider, 0.5)}`,
                      color: displayMarge >= 0 ? "success.main" : "error.main",
                    }}
                  >
                    {computed.budgetCm1Pct > 0 ? (
                      <>
                        {displayMarge >= 0 ? "+" : ""}
                        {displayMarge.toFixed(2)} j
                        <Typography
                          variant="caption"
                          sx={{ display: "block", fontSize: "0.6rem", color: "text.disabled", mt: 0.25 }}
                        >
                          {margeHours >= 0 ? "+" : ""}
                          {margeHours.toFixed(2)} h
                        </Typography>
                      </>
                    ) : (
                      "—"
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
          {/* Footer */}
          <Box component="tfoot">
            <Box
              component="tr"
              sx={{
                "& td": {
                  p: "10px 12px",
                  textAlign: "right",
                  fontWeight: 700,
                  fontSize: 13,
                  borderTop: `2px solid ${theme.palette.divider}`,
                  bgcolor: alpha(theme.palette.action.hover, 0.03),
                },
                "& td:first-of-type": { textAlign: "left" },
              }}
            >
              <Box component="td"></Box>
              <Box component="td" sx={{ textAlign: "left !important" }}>
                Total
              </Box>
              <Box component="td"></Box>
              <Box component="td"></Box>
              <Box component="td"></Box>
              {isBlank ? (
                <Box component="td">{fmtDays(computed.totalActual)}</Box>
              ) : (
                <>
                  <Box component="td">{fmtDays(computed.totalActual)}</Box>
                  <Box component="td">{fmtDays(computed.totalForecast)}</Box>
                  <Box component="td" sx={{ borderLeft: `2px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                    {fmtDays(computed.totalProjected)}
                  </Box>
                </>
              )}
              <Box component="td" sx={{ color: "primary.main" }}>
                {fmt(computed.totalCost)}
              </Box>
              <Box component="td" sx={{ color: "info.main" }}>
                {fmt(computed.tmRevenue)}
              </Box>
              {(() => {
                const tableCm1Pct =
                  computed.tmRevenue > 0 ? ((computed.tmRevenue - computed.totalCost) / computed.tmRevenue) * 100 : 0;
                return (
                  <Box component="td" sx={{ fontWeight: 700, color: cm1Color(tableCm1Pct) }}>
                    {fmtPct(tableCm1Pct)}
                  </Box>
                );
              })()}
              <Box
                component="td"
                sx={{
                  borderLeft: `2px solid ${alpha(theme.palette.divider, 0.5)}`,
                  color: computed.envelopeVsCurrent >= 0 ? "success.main" : "error.main",
                }}
              >
                {computed.budgetCm1Pct > 0 ? fmt(computed.envelopeVsCurrent) : "—"}
              </Box>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1,
            borderTop: `1px dashed ${theme.palette.divider}`,
          }}
        >
          <AddIcon sx={{ fontSize: 14, color: "text.secondary" }} />
          <Select
            value=""
            displayEmpty
            onChange={(e) => {
              if (e.target.value) addGradeRow(e.target.value);
            }}
            size="small"
            sx={{ fontSize: "0.75rem", height: 28, minWidth: 180, "& .MuiSelect-select": { py: 0.25 } }}
            renderValue={() => (
              <Typography variant="caption" color="text.secondary">
                Add a grade...
              </Typography>
            )}
          >
            {(() => {
              // Build grade list: standard grades + "Advanced" variants for grades with advanced MAGR profiles
              const advancedGrades = new Set(MAGR_PROFILES.filter((p) => p.advanced).map((p) => p.grade));
              const items: string[] = [];
              for (const g of [...GRADE_ORDER].reverse()) {
                items.push(g);
                if (advancedGrades.has(g)) items.push(`${g} Advanced`);
              }
              return items.map((g) => (
                <MenuItem key={g} value={g} sx={{ fontSize: "0.8rem" }}>
                  {g}
                </MenuItem>
              ));
            })()}
            <Divider />
            <MenuItem value={`Subco_${Date.now()}`} sx={{ fontSize: "0.8rem", fontStyle: "italic" }}>
              Autre (subco, custom...)
            </MenuItem>
          </Select>
        </Box>
      </Box>
    </Box>
  );
};

BcsSimulator.displayName = "BcsSimulator";
export default memo(BcsSimulator);
