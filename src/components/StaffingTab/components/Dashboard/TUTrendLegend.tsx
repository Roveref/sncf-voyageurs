import React, { memo, useState, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import TuneIcon from "@mui/icons-material/Tune";
import { alpha } from "@mui/material/styles";
import { brand } from "../../../../config/brandConfig";

// GAIF brand palette — all tones from the legacy consulting palette (from brandConfig)
export const COLORS = {
  forecast: brand.primary, // R50 Bearing Red — Forecast TU
  actual: brand.secondary, // G60 Brown — Actual TU (SAP)
  target: brand.primaryDeep, // R70 Deep Red — Theoretical TU
  fte: brand.secondaryLight, // G50 Warm Grey — ETP curve (secondary axis)
  io: brand.secondaryDark, // G60 Dark Brown — I&O TU curve
  infinite: brand.primaryDark, // R60 Medium Red — Infinite capacity TU curve
  probInfinite: brand.primaryLight, // R40 Light Red — Probabilized infinite capacity TU curve
  turnoverChurn: brand.secondaryLighter, // G40 Medium Grey — Employee turnover churn curve
};

export const SERIES = [
  { key: "forecast", label: "Prévu", color: COLORS.forecast },
  { key: "actual", label: "Réalisé", color: COLORS.actual },
  { key: "target", label: "Théorique", color: COLORS.target },
  { key: "fte", label: "ETP", color: COLORS.fte },
  { key: "ioTU", label: "GAIF", color: COLORS.io },
  { key: "infiniteTU", label: "Capacité ∞", color: COLORS.infinite },
  { key: "probInfTU", label: "Capacité ∞ prob.", color: COLORS.probInfinite },
  { key: "gradeCappedTU", label: "Capacité ∞ par rôle", color: brand.secondary },
  { key: "turnoverChurn", label: "Rotation", color: COLORS.turnoverChurn },
];

// Dash patterns matching each Line component's strokeDasharray
export const DASH_PATTERNS: Record<string, string> = {
  forecast: "",
  actual: "",
  target: "5 5",
  fte: "",
  ioTU: "8 3 2 3",
  infiniteTU: "5 5",
  probInfTU: "5 5",
  gradeCappedTU: "8 4",
  turnoverChurn: "5 5",
};

export const PRIMARY_KEYS = ["forecast", "actual", "target"];

/** Toggle badge — colored dot + caption, alpha background when active (BookingsTab style) */
const LegendBadge = ({ series, active, onClick }: { series: any; active: boolean; onClick: () => void }) => (
  <Box
    onClick={onClick}
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 0.75,
      px: 1,
      py: 0.25,
      borderRadius: 1.5,
      bgcolor: active ? alpha(series.color, 0.15) : "transparent",
      cursor: "pointer",
      transition: "background-color 0.2s ease-in-out",
      userSelect: "none",
      "&:hover": { bgcolor: alpha(series.color, 0.1) },
    }}
  >
    <Box
      sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: series.color, opacity: active ? 1 : 0.4, flexShrink: 0 }}
    />
    <Typography
      variant="caption"
      sx={{
        fontSize: "0.7rem",
        fontWeight: active ? 600 : 400,
        whiteSpace: "nowrap",
        color: active ? series.color : "text.secondary",
        transition: "font-weight 0.2s ease-in-out, color 0.2s ease-in-out",
      }}
    >
      {series.label}
    </Typography>
  </Box>
);

/** Filter helper for series visibility based on data availability */
export const filterSeries = (s: any, { hasSap, isVarianceMode, hasIO, hasInfinite, useSapActuals, hasChurn }: any) => {
  if (s.key === "fte") return true;
  if (s.key === "turnoverChurn") return hasChurn;
  if (s.key === "ioTU") return hasIO;
  if (s.key === "infiniteTU") return hasInfinite;
  if (s.key === "probInfTU") return hasInfinite;
  if (s.key === "gradeCappedTU") return hasInfinite;
  if (isVarianceMode) return false;
  if (s.key === "actual" && !hasSap) return false;
  if (s.key === "forecast" && useSapActuals) return false;
  return true;
};

/** Compact legend: primary items inline + secondary behind TuneIcon popover */
export const TUTrendLegend = memo(
  ({
    visible,
    onToggle,
    hasSap,
    isVarianceMode = false,
    hasIO = false,
    hasInfinite = false,
    useSapActuals = false,
    hasChurn = false,
  }: any) => {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);

    const filterCtx = { hasSap, isVarianceMode, hasIO, hasInfinite, useSapActuals, hasChurn };
    const visibleSeries = SERIES.filter((s) => filterSeries(s, filterCtx));
    const primary = visibleSeries.filter((s) => PRIMARY_KEYS.includes(s.key));
    const secondary = visibleSeries.filter((s) => !PRIMARY_KEYS.includes(s.key));

    return (
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        {primary.map((s) => (
          <LegendBadge key={s.key} series={s} active={visible[s.key] !== false} onClick={() => onToggle(s.key)} />
        ))}
        {secondary.length > 0 && (
          <>
            <IconButton ref={anchorRef} size="small" onClick={() => setOpen((v) => !v)} sx={{ p: 0.25 }}>
              <TuneIcon sx={{ fontSize: 16, color: open ? "primary.main" : "text.secondary" }} />
            </IconButton>
            <Popover
              open={open}
              anchorEl={anchorRef.current}
              onClose={() => setOpen(false)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              slotProps={{
                paper: { sx: { p: 1.5, borderRadius: 2, display: "flex", flexDirection: "column", gap: 0.75 } },
              }}
            >
              {secondary.map((s) => (
                <LegendBadge key={s.key} series={s} active={visible[s.key] !== false} onClick={() => onToggle(s.key)} />
              ))}
            </Popover>
          </>
        )}
      </Box>
    );
  }
);
TUTrendLegend.displayName = "TUTrendLegend";

/** Hook to manage series visibility — share between TUOverview header and chart */
export const useTrendVisibility = () => {
  const [visible, setVisible] = useState<Record<string, boolean>>({
    forecast: true,
    actual: true,
    target: true,
    fte: false,
    ioTU: false,
    infiniteTU: false,
    probInfTU: false,
    gradeCappedTU: false,
    turnoverChurn: false,
  });
  const handleToggle = useCallback((key: string) => {
    setVisible((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  }, []);
  return { visible, handleToggle };
};
