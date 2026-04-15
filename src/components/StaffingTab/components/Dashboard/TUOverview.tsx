import React, { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { alpha, useTheme } from "@mui/material/styles";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import Grid from "@mui/material/Grid2";
import { UtilizationDistribution, GradePyramid, GradePyramidLegend } from "../Dashboard";
import TUTrendChart, { TUTrendLegend, TUTrendYearSelector, useTrendVisibility, useTrendYears } from "./TUTrendChart";
import { fmtHD } from "../../constants/theme";
import { getHoursPerDay } from "../../constants";
import { SAP_WARN, SAP_GOOD } from "../../constants";
import { animations, keyframes } from "../../../../styles/animations";
import { useAnimatedNumber } from "../../../../hooks/useAnimatedNumber";
import { AnimatedCount, AnimatedPercent } from "../../../../components/common/AnimatedNumbers";
import { getRealEmpId, countUniqueReal } from "../../utils/empIdUtils";
import { getToday } from "../../../../utils/formatters";
import { brand } from "../../../../config/brandConfig";
import { DetachableCard } from "../../../../components/shared";

// ─── Shared card styling ─────────────────────────────────────────────────────
const cardSx = (delay: number) => ({
  height: "100%",
  borderRadius: 3,
  overflow: "visible",
  transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
  },
  ...animations.cardEntrance(delay),
  position: "relative",
});

// ─── Mode-aware color helper (BearingPoint palette) ─────────────────────────
const getModeColor = (_theme: any, heatmapMode: string) => {
  switch (heatmapMode) {
    case "to":
      return brand.secondaryDark; // G60 Dark Brown
    case "availability":
      return brand.secondaryLighter; // G40 Light Warm Grey
    case "hours":
      return brand.primaryDeep; // R70 Deep Red
    case "variance_hours":
    case "variance_hours_pct":
      return brand.secondary; // G60 Brown
    default:
      return brand.primaryDark; // R60 Bearing Red
  }
};

// ─── Card 1: KPI Current + Delta + Distribution ─────────────────────────────
/** Count weekdays between two dates (exclusive of end) */
const countWeekdays = (from: Date, to: Date): number => {
  let count = 0;
  const c = new Date(from);
  c.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (c < end) {
    const dw = c.getDay();
    if (dw !== 0 && dw !== 6) count++;
    c.setDate(c.getDate() + 1);
  }
  return count;
};

/** Get the current bucket boundaries based on granularity and today's date */
const getBucketWorkDays = (granularity: string): number => {
  const now = new Date();
  const y = now.getFullYear(),
    m = now.getMonth(),
    d = now.getDate();
  let start: Date, end: Date;
  switch (granularity) {
    case "month": {
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 1);
      break;
    }
    case "halfmonth": {
      if (d <= 15) {
        start = new Date(y, m, 1);
        end = new Date(y, m, 16);
      } else {
        start = new Date(y, m, 16);
        end = new Date(y, m + 1, 1);
      }
      break;
    }
    case "2week": {
      // 2-week bucket: align to Monday of current 2-week period
      const dow = (now.getDay() + 6) % 7; // 0=Mon
      const monday = new Date(y, m, d - dow);
      const weekNum = Math.floor((monday.getTime() - new Date(y, 0, 1).getTime()) / (7 * 86400000));
      start = new Date(monday);
      if (weekNum % 2 !== 0) start.setDate(start.getDate() - 7);
      end = new Date(start);
      end.setDate(end.getDate() + 14);
      break;
    }
    case "week": {
      const dow = (now.getDay() + 6) % 7;
      start = new Date(y, m, d - dow);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;
    }
    default: // 'day'
      return 1;
  }
  return countWeekdays(start, end);
};

const GRAN_LABELS: Record<string, string> = {
  day: "day",
  week: "week",
  "2week": "2 wk",
  halfmonth: "fortnight",
  month: "month",
};

/** Animated TU/variance value display */
const AnimatedTUValue = ({ value, color, unit }: { value: number; color: string; unit: string }) => {
  const decimals = unit === "h" ? 0 : 1;
  const animated = useAnimatedNumber(value, 600, decimals);
  const formatted = unit === "h" ? `${animated}h` : `${animated}${unit}`;
  return (
    <Typography variant="h4" sx={{ fontWeight: 700, color }}>
      {formatted}
    </Typography>
  );
};

/** Animated formatted value (mode-aware: hours → 0 decimals, % → 1 decimal) */
const AnimatedFmtVal = memo(
  ({
    value,
    color,
    unit,
    variant = "h5",
    fontWeight = 700,
    sx = {},
  }: {
    value: number;
    color: string;
    unit: string;
    variant?: any;
    fontWeight?: number;
    sx?: any;
  }) => {
    const decimals = unit === "h" ? 0 : 1;
    const animated = useAnimatedNumber(value, 600, decimals);
    const formatted = unit === "h" ? `${animated}h` : `${animated}${unit}`;
    return (
      <Typography variant={variant} component="span" sx={{ fontWeight, color, ...sx }}>
        {formatted}
      </Typography>
    );
  }
);
AnimatedFmtVal.displayName = "AnimatedFmtVal";

/** Animated hours value with sign prefix */
const AnimatedSignedHours = memo(
  ({
    value,
    color,
    variant = "h6",
    fontWeight = 700,
  }: {
    value: number;
    color: string;
    variant?: any;
    fontWeight?: number;
  }) => {
    const animated = useAnimatedNumber(Math.abs(value), 600, 0);
    const prefix = value >= 0 ? "+" : "-";
    const display = value === 0 ? "0h" : `${prefix}${animated}h`;
    return (
      <Typography variant={variant} component="span" sx={{ fontWeight, color }}>
        {display}
      </Typography>
    );
  }
);
AnimatedSignedHours.displayName = "AnimatedSignedHours";

const TUCurrentCard = memo(
  ({ teamTuStats, projectCount, heatmapMode, showIO, allEmployees, granularity, aggVarianceHours }: any) => {
    const theme = useTheme();
    const {
      potentialTU,
      delta,
      gainHours,
      theoreticalTU,
      modeLabel,
      modeUnit,
      isVarianceMode,
      isHoursMode = false,
      ioTU,
    } = teamTuStats;
    // In variance_hours mode, use aggVarianceHours from AggHeatmapStrip (single source of truth)
    const currentTU = isVarianceMode && aggVarianceHours != null ? aggVarianceHours : teamTuStats.currentTU;

    const todayDailyNet = useMemo(() => {
      const today = getToday();
      const seen = new Set<string>();
      let net = 0;
      (allEmployees || []).forEach((emp: any) => {
        const realId = getRealEmpId(emp);
        if (seen.has(realId)) return;
        const arrived = !emp._arrivalDate || emp._arrivalDate <= today;
        const notDeparted = !emp._departureDate || emp._departureDate >= today;
        if (arrived && notDeparted) {
          seen.add(realId);
          net += getHoursPerDay(emp.grade);
        }
      });
      return net;
    }, [allEmployees]);

    const bucketWorkDays = useMemo(() => getBucketWorkDays(granularity || "day"), [granularity]);
    const bucketNet = todayDailyNet * bucketWorkDays;
    const bucketLabel = GRAN_LABELS[granularity] || "day";
    const mainColor = getModeColor(theme, heatmapMode);
    const fmtVal = (v: number) => (modeUnit === "h" ? `${v.toFixed(0)}h` : `${v.toFixed(1)}${modeUnit}`);

    return (
      <Card sx={cardSx(0)}>
        <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Title */}
          <Typography variant="h6" fontWeight={700}>
            Overview
          </Typography>

          <Divider sx={{ my: 3 }} />

          {/* Timeline 3 points or variance fallback */}
          {isVarianceMode || isHoursMode ? (
            <Box
              sx={{
                bgcolor: alpha(mainColor, 0.06),
                borderRadius: 2,
                p: 2.5,
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AnimatedTUValue value={currentTU} color={mainColor} unit={modeUnit} />
            </Box>
          ) : (
            <>
              {/* Dynamic timeline */}
              {(() => {
                const FIRM_TARGET = 75;
                const mergeThreshold = 1; // merge if within 1pt
                const firmMergedWithTarget = Math.abs(theoreticalTU - FIRM_TARGET) < mergeThreshold;

                // Build points: current is always first
                const exceedsTarget = currentTU >= theoreticalTU && theoreticalTU > 0;
                const points: { value: number; label: string; color: string; glow?: boolean }[] = [
                  {
                    value: currentTU,
                    label: "Current",
                    color: exceedsTarget ? "#10b981" : mainColor,
                    glow: exceedsTarget,
                  },
                ];

                if (firmMergedWithTarget) {
                  // Merged: show as "Target (75%)"
                  points.push({ value: theoreticalTU, label: "Target (75%)", color: brand.secondary }); // G60 Brown
                } else {
                  // Separate points — add both, will be sorted
                  points.push({ value: theoreticalTU, label: "Target", color: brand.secondary }); // G60 Brown
                  points.push({ value: FIRM_TARGET, label: "Cabinet", color: brand.primaryDeep }); // R70 Deep Red
                }

                points.push({ value: potentialTU, label: "Potential", color: brand.secondaryLighter }); // G40 Light

                // Sort by value (current first is guaranteed since it's usually lowest, but sort all non-current)
                const [current, ...rest] = points;
                rest.sort((a, b) => a.value - b.value);
                const sorted = [current, ...rest];

                // Deduplicate points that are very close
                const deduped = [sorted[0]];
                for (let i = 1; i < sorted.length; i++) {
                  if (Math.abs(sorted[i].value - deduped[deduped.length - 1].value) < 0.5) {
                    // Merge labels
                    deduped[deduped.length - 1].label += ` / ${sorted[i].label}`;
                  } else {
                    deduped.push(sorted[i]);
                  }
                }

                const totalNet = teamTuStats.totalNet || 0;

                return (
                  <Box
                    sx={{ px: 2, py: 2, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}
                  >
                    {/* Values row — same flex structure as dots, overflow visible for edge labels */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-end",
                        mx: "auto",
                        width: "95%",
                        mb: 0.5,
                        overflow: "visible",
                        pt: 5,
                      }}
                    >
                      {deduped.map((pt, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <Box sx={{ flex: 1 }} />}
                          <Box sx={{ position: "relative", width: 12, flexShrink: 0 }}>
                            <Box
                              sx={{
                                position: "absolute",
                                left: "50%",
                                bottom: 0,
                                transform: "translateX(-50%)",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <AnimatedFmtVal
                                value={pt.value}
                                color={pt.color}
                                unit={modeUnit}
                                sx={{ display: "block" }}
                              />
                              <Typography
                                variant="caption"
                                sx={{ color: "text.secondary", fontWeight: 500, display: "block" }}
                              >
                                {pt.label}
                              </Typography>
                            </Box>
                          </Box>
                        </React.Fragment>
                      ))}
                    </Box>
                    {/* Dots + lines */}
                    <Box sx={{ display: "flex", alignItems: "center", mx: "auto", width: "95%", my: 1 }}>
                      {deduped.map((pt, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <Box sx={{ flex: 1, height: 3, bgcolor: alpha(pt.color, 0.3) }} />}
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              bgcolor: pt.color,
                              flexShrink: 0,
                              ...(pt.glow && {
                                boxShadow: "0 0 8px rgba(16, 185, 129, 0.6), 0 0 16px rgba(16, 185, 129, 0.3)",
                                animation: "pulse 2s ease-in-out infinite",
                                "@keyframes pulse": {
                                  "0%, 100%": {
                                    boxShadow: "0 0 8px rgba(16, 185, 129, 0.6), 0 0 16px rgba(16, 185, 129, 0.3)",
                                  },
                                  "50%": {
                                    boxShadow: "0 0 12px rgba(16, 185, 129, 0.8), 0 0 24px rgba(16, 185, 129, 0.4)",
                                  },
                                },
                              }),
                            }}
                          />
                        </React.Fragment>
                      ))}
                    </Box>

                    {/* Days between points */}
                    {totalNet > 0 && deduped.length > 1 && (
                      <Box sx={{ display: "flex", mx: "auto", width: "95%", mt: 0.5 }}>
                        <Box sx={{ width: 6, flexShrink: 0 }} />
                        {deduped.slice(1).map((pt, i) => {
                          const gap = pt.value - deduped[i].value;
                          return (
                            <Box key={i} sx={{ flex: 1, textAlign: "center" }}>
                              {gap > 0.5 && (
                                <Typography variant="body2" sx={{ color: "text.primary" }}>
                                  {Math.ceil(((gap / 100) * totalNet) / 8)}d
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                        <Box sx={{ width: 6, flexShrink: 0 }} />
                      </Box>
                    )}
                  </Box>
                );
              })()}

              {/* Secondary info */}
              <Divider sx={{ my: 1 }} />
              <Box sx={{ textAlign: "center" }}>
                {showIO === "show" && ioTU != null && (
                  <Typography
                    variant="caption"
                    sx={{ color: "#7c3aed", fontWeight: 600, fontSize: "0.75rem", display: "block" }}
                  >
                    I&O{" "}
                    <AnimatedPercent
                      value={ioTU}
                      variant="inherit"
                      color="inherit"
                      fontWeight={600}
                      decimals={1}
                      sx={{ fontSize: "inherit" }}
                    />
                  </Typography>
                )}
                {bucketNet > 0 && (
                  <>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", fontStyle: "italic", fontSize: "0.75rem", display: "block" }}
                    >
                      Per {bucketLabel}: 1d = {((8 / bucketNet) * 100).toFixed(3)}% · 1pt = {fmtHD(bucketNet / 100)}
                    </Typography>
                    {teamTuStats.totalNet > 0 && (
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", fontStyle: "italic", fontSize: "0.75rem", display: "block" }}
                      >
                        Period: 1d = {((8 / teamTuStats.totalNet) * 100).toFixed(3)}% · 1pt ={" "}
                        {fmtHD(teamTuStats.totalNet / 100)}
                      </Typography>
                    )}
                  </>
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    );
  }
);
TUCurrentCard.displayName = "TUCurrentCard";

// ─── Card 2: M- / M+ Split ──────────────────────────────────────────────────
const GradeSplitCard = memo(({ teamTuStats, showIO }: any) => {
  const theme = useTheme();
  const {
    mminusTU,
    mminusCount,
    mplusTU,
    mplusCount,
    mplusFTE,
    mminusFTE,
    mplusRealFTE,
    mminusRealFTE,
    modeUnit,
    isVarianceMode,
    isHoursMode = false,
    mplusIoTU,
    mminusIoTU,
  } = teamTuStats;
  const fmtVal = (v: number) => (modeUnit === "h" ? `${v.toFixed(0)}h` : `${v.toFixed(1)}${modeUnit}`);

  // For variance modes, progress bar width doesn't apply the same way
  const barWidth = (v: number) => (isVarianceMode ? 50 : Math.min(Math.abs(v), 100));

  const Section = ({ label, tu, count, fte, realFte, color, ioTU }: any) => (
    <Box
      sx={{
        flex: 1,
        bgcolor: alpha(color, 0.06),
        borderRadius: 2,
        p: 2.5,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-evenly",
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color, mt: 1 }}>
        <AnimatedFmtVal value={tu} color={color} unit={modeUnit} variant="inherit" fontWeight={700} />
        {showIO === "show" && ioTU != null && (
          <Typography component="span" sx={{ color: "#7c3aed", fontSize: "0.875rem", fontWeight: 500, ml: 0.5 }}>
            (I&O{" "}
            <AnimatedPercent
              value={ioTU}
              variant="inherit"
              color="inherit"
              fontWeight={500}
              decimals={1}
              sx={{ fontSize: "inherit" }}
            />
            )
          </Typography>
        )}
      </Typography>
      <Box sx={{ color: "text.secondary", mt: 1 }}>
        <Typography variant="body2">
          <AnimatedCount value={count} variant="inherit" color="inherit" fontWeight={400} suffix=" Emp." />
        </Typography>
        <Typography variant="body2">
          <AnimatedFmtVal
            value={fte != null ? fte : count}
            color="inherit"
            unit=" FTE"
            variant="inherit"
            fontWeight={400}
            sx={{ fontSize: "inherit" }}
          />
          {realFte != null && realFte < (fte ?? count) - 0.05 && (
            <Typography component="span" sx={{ color: "warning.main", fontSize: "0.875rem", ml: 0.5 }}>
              (
              <AnimatedFmtVal
                value={realFte}
                color="inherit"
                unit=" actual"
                variant="inherit"
                fontWeight={400}
                sx={{ fontSize: "inherit" }}
              />
              )
            </Typography>
          )}
        </Typography>
      </Box>
      {!isVarianceMode && !isHoursMode && (
        <Box sx={{ mt: 2, height: 6, borderRadius: 3, bgcolor: alpha(color, 0.12), overflow: "hidden" }}>
          <Box
            sx={{
              height: "100%",
              width: `${barWidth(tu)}%`,
              bgcolor: color,
              borderRadius: 3,
              transition: "width 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          />
        </Box>
      )}
    </Box>
  );

  return (
    <Card sx={cardSx(100)}>
      <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
        <Typography variant="h6" fontWeight={700}>
          Grade Split
        </Typography>
        <Divider sx={{ my: 3 }} />
        <Box sx={{ display: "flex", gap: 2, flex: 1 }}>
          <Section
            label="M−"
            tu={mminusTU}
            count={mminusCount}
            fte={mminusFTE}
            realFte={mminusRealFTE}
            color={brand.primaryLight}
            ioTU={mminusIoTU}
          />
          <Section
            label="M+"
            tu={mplusTU}
            count={mplusCount}
            fte={mplusFTE}
            realFte={mplusRealFTE}
            color={brand.secondaryDark}
            ioTU={mplusIoTU}
          />
        </Box>
      </CardContent>
    </Card>
  );
});
GradeSplitCard.displayName = "GradeSplitCard";

// ─── Card 3: SAP Fill Rate / Projects fallback ──────────────────────────────
const SapCard = memo(({ teamTuStats, sapData, projectCount, aggVarianceHours }: any) => {
  const theme = useTheme();

  if (!sapData) {
    // Fallback: project summary card
    return (
      <Card sx={cardSx(200)}>
        <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
          <Typography variant="h6" fontWeight={700}>
            Projects
          </Typography>
          <Divider sx={{ my: 3 }} />
          <Box
            sx={{
              bgcolor: alpha(brand.secondaryLight, 0.06),
              borderRadius: 2,
              p: 2.5,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <AnimatedCount value={projectCount} variant="h4" color={brand.secondaryLight} fontWeight={700} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              active projects
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const { sapAvgPct, sapTotalDays, sapTotalActiveDays, sapTotalOverH, sapTotalMissingH, sapEmployeesWithVariance } =
    teamTuStats;
  // Use aggVarianceHours from AggregateHeatmapStrip (single source of truth)
  const sapVarianceHours = aggVarianceHours ?? teamTuStats.sapVarianceHours ?? 0;
  const sapColor =
    sapAvgPct >= SAP_GOOD
      ? brand.secondaryDark // G60 Dark — good
      : sapAvgPct >= SAP_WARN
        ? brand.primaryLight // R40 Light Red — warning
        : brand.primaryDark; // R60 — poor
  const hasVariance = sapVarianceHours != null;
  const varColor = !hasVariance || sapVarianceHours >= 0 ? brand.secondaryDark : brand.primaryDark; // G60 Dark / R60

  return (
    <Card sx={cardSx(200)}>
      <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
        <Typography variant="h6" fontWeight={700}>
          SAP
        </Typography>
        <Divider sx={{ my: 3 }} />

        {/* Fill rate */}
        <Box sx={{ bgcolor: alpha(sapColor, 0.06), borderRadius: 2, p: 2, mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
            <AnimatedPercent value={sapAvgPct} variant="h5" color={sapColor} fontWeight={700} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              fill rate
            </Typography>
            {sapTotalActiveDays > 0 && (
              <Typography variant="body2" sx={{ color: "text.secondary", ml: "auto" }}>
                <AnimatedCount value={sapTotalDays} variant="inherit" color="inherit" fontWeight={400} /> /{" "}
                <AnimatedCount
                  value={sapTotalActiveDays}
                  variant="inherit"
                  color="inherit"
                  fontWeight={400}
                  suffix="d"
                />
              </Typography>
            )}
          </Box>
          <Box sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: alpha(sapColor, 0.12), overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                width: `${Math.min(sapAvgPct, 100)}%`,
                bgcolor: sapColor,
                borderRadius: 3,
                transition: "width 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            />
          </Box>
        </Box>

        {/* Overcharged & Missing */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
          <Box sx={{ flex: 1, bgcolor: alpha("#99171D", 0.06), borderRadius: 2, p: 2 }}>
            <AnimatedSignedHours value={sapTotalOverH > 0 ? sapTotalOverH : 0} color="#99171D" />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              overcharged
            </Typography>
          </Box>
          <Box sx={{ flex: 1, bgcolor: alpha("#99171D", 0.06), borderRadius: 2, p: 2 }}>
            <AnimatedCount
              value={sapTotalMissingH > 0 ? Math.round(sapTotalMissingH) : 0}
              variant="h6"
              color="#99171D"
              fontWeight={700}
              suffix="h"
            />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              missing
            </Typography>
          </Box>
        </Box>

        {/* Variance in hours (total, not average) */}
        {hasVariance && (
          <Box sx={{ bgcolor: alpha(varColor, 0.06), borderRadius: 2, p: 2, mt: "auto" }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <AnimatedSignedHours
                value={sapVarianceHours}
                color={sapVarianceHours === 0 ? "text.secondary" : varColor}
              />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                variance
              </Typography>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
});
SapCard.displayName = "SapCard";

// ─── Card 4: Team Churn ──────────────────────────────────────────────────────
const ChurnCard = memo(({ teamTuStats, timelineStart, timelineEnd }: any) => {
  const theme = useTheme();
  const {
    turnoverArrivals,
    turnoverDepartures,
    turnoverArrivalsAll,
    turnoverDeparturesAll,
    turnoverChurnRate,
    activeCount,
  } = teamTuStats;
  const depColor = "#99171D"; // R70 Deep Red
  const arrColor = brand.secondaryLight; // G50 Warm Grey

  const maxBar = Math.max(turnoverDeparturesAll || 0, turnoverArrivalsAll || 0, 1);
  const barWidth = (v: number) => Math.max((v / maxBar) * 100, 0);

  return (
    <Card sx={cardSx(300)}>
      <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
        <Typography variant="h6" fontWeight={700}>
          Turnover
        </Typography>
        <Divider sx={{ my: 3 }} />

        {/* Churn rate */}
        <Box
          sx={{
            bgcolor: alpha(brand.primaryDark, 0.06),
            borderRadius: 2,
            p: 2,
            mb: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 62,
          }}
        >
          {turnoverChurnRate != null ? (
            <AnimatedPercent
              value={turnoverChurnRate}
              variant="h5"
              color={brand.primaryDark}
              fontWeight={700}
              decimals={1}
            />
          ) : (
            <Typography variant="h5" sx={{ fontWeight: 700, color: brand.primaryDark }}>
              —
            </Typography>
          )}
        </Box>

        {/* Departures bar */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
            Departures
          </Typography>
          {/* Labels aligned above bar segments */}
          <Box sx={{ display: "flex", mb: 0.25 }}>
            <Box sx={{ width: `${barWidth(turnoverDepartures)}%`, transition: "width 0.4s ease" }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  color: depColor,
                  fontSize: "0.875rem",
                  display: "block",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                <AnimatedCount
                  value={turnoverDepartures}
                  variant="inherit"
                  color="inherit"
                  fontWeight={400}
                  sx={{ fontSize: "inherit", lineHeight: "inherit" }}
                />
              </Typography>
            </Box>
            {turnoverDeparturesAll > turnoverDepartures && (
              <Box
                sx={{
                  width: `${barWidth(turnoverDeparturesAll - turnoverDepartures)}%`,
                  transition: "width 0.4s ease",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "baseline",
                  gap: 0.25,
                }}
              >
                <Typography
                  sx={{ fontWeight: 600, color: alpha(depColor, 0.5), fontSize: "0.875rem", lineHeight: 1.2 }}
                >
                  <AnimatedCount
                    value={turnoverDeparturesAll}
                    variant="inherit"
                    color="inherit"
                    fontWeight={400}
                    sx={{ fontSize: "inherit", lineHeight: "inherit" }}
                  />
                </Typography>
                <Typography sx={{ fontWeight: 500, color: alpha(depColor, 0.4), fontSize: "0.75rem", lineHeight: 1.2 }}>
                  inc. interns
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: alpha(depColor, 0.12), overflow: "hidden", display: "flex" }}>
            <Box
              sx={{
                height: "100%",
                width: `${barWidth(turnoverDepartures)}%`,
                bgcolor: depColor,
                borderRadius: "4px 0 0 4px",
                transition: "width 0.4s ease",
              }}
            />
            {turnoverDeparturesAll > turnoverDepartures && (
              <Box
                sx={{
                  height: "100%",
                  width: `${barWidth(turnoverDeparturesAll - turnoverDepartures)}%`,
                  bgcolor: alpha(depColor, 0.35),
                  borderRadius: "0 4px 4px 0",
                  transition: "width 0.4s ease",
                }}
              />
            )}
          </Box>
        </Box>

        {/* Arrivals bar */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
            Arrivals
          </Typography>
          {/* Labels aligned above bar segments */}
          <Box sx={{ display: "flex", mb: 0.25 }}>
            <Box sx={{ width: `${barWidth(turnoverArrivals)}%`, transition: "width 0.4s ease" }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  color: arrColor,
                  fontSize: "0.875rem",
                  display: "block",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                <AnimatedCount
                  value={turnoverArrivals}
                  variant="inherit"
                  color="inherit"
                  fontWeight={400}
                  sx={{ fontSize: "inherit", lineHeight: "inherit" }}
                />
              </Typography>
            </Box>
            {turnoverArrivalsAll > turnoverArrivals && (
              <Box
                sx={{
                  width: `${barWidth(turnoverArrivalsAll - turnoverArrivals)}%`,
                  transition: "width 0.4s ease",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "baseline",
                  gap: 0.25,
                }}
              >
                <Typography
                  sx={{ fontWeight: 600, color: alpha(arrColor, 0.5), fontSize: "0.875rem", lineHeight: 1.2 }}
                >
                  <AnimatedCount
                    value={turnoverArrivalsAll}
                    variant="inherit"
                    color="inherit"
                    fontWeight={400}
                    sx={{ fontSize: "inherit", lineHeight: "inherit" }}
                  />
                </Typography>
                <Typography sx={{ fontWeight: 500, color: alpha(arrColor, 0.4), fontSize: "0.75rem", lineHeight: 1.2 }}>
                  inc. interns
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: alpha(arrColor, 0.12), overflow: "hidden", display: "flex" }}>
            <Box
              sx={{
                height: "100%",
                width: `${barWidth(turnoverArrivals)}%`,
                bgcolor: arrColor,
                borderRadius: "4px 0 0 4px",
                transition: "width 0.4s ease",
              }}
            />
            {turnoverArrivalsAll > turnoverArrivals && (
              <Box
                sx={{
                  height: "100%",
                  width: `${barWidth(turnoverArrivalsAll - turnoverArrivals)}%`,
                  bgcolor: alpha(arrColor, 0.35),
                  borderRadius: "0 4px 4px 0",
                  transition: "width 0.4s ease",
                }}
              />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});
ChurnCard.displayName = "ChurnCard";

// ─── Main TUOverview ─────────────────────────────────────────────────────────
const TUOverview = memo(
  ({
    teamTuStats,
    filteredEmployees,
    gradeItems,
    sapData,
    onWaterfallEnter,
    onWaterfallMove,
    onWaterfallLeave,
    onUtilizationBucketClick,
    activeUtilizationBucket,
    onGradeTierClick,
    activeGradeTier,
    timelineStart,
    timelineEnd,
    chargeableCombined,
    enabledHolidayDates,
    sapLookup,
    fullSapLookup,
    projectCount,
    granularity,
    heatmapMode,
    employeeMetadata,
    allEmployees,
    ioJobcodes,
    pipelineJobcodes,
    staffingNeeds,
    showIO,
    useSapActuals,
    onDateRangeChange,
    dailyGrid,
    aggVarianceHours,
  }: any) => {
    const { visible, handleToggle } = useTrendVisibility();
    const { selectedYears, availableYears, yearColors, initYears, toggleYear } = useTrendYears();
    const { modeLabel } = teamTuStats;
    const [pyramidMode, setPyramidMode] = useState<"grade" | "project" | "client">("grade");
    const [topNProjects, setTopNProjects] = useState(7);
    const [topNClients, setTopNClients] = useState(7);
    const cyclePyramid = () =>
      setPyramidMode((m) => (m === "grade" ? "project" : m === "project" ? "client" : "grade"));

    return (
      <Grid container spacing={3}>
        {/* Row 1: 4 KPI Cards */}
        <Grid size={{ xs: 12, md: 3 }}>
          <DetachableCard
            group="Staffing"
            storageKey="pip-overview"
            title="Overview"
            defaultWidth={450}
            defaultHeight={400}
          >
            <TUCurrentCard
              teamTuStats={teamTuStats}
              projectCount={projectCount}
              heatmapMode={heatmapMode}
              showIO={showIO}
              allEmployees={allEmployees}
              granularity={granularity}
              aggVarianceHours={aggVarianceHours}
            />
          </DetachableCard>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <DetachableCard
            group="Staffing"
            storageKey="pip-grade-split"
            title="Grade Split"
            defaultWidth={450}
            defaultHeight={400}
          >
            <GradeSplitCard teamTuStats={teamTuStats} showIO={showIO} />
          </DetachableCard>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <DetachableCard group="Staffing" storageKey="pip-sap" title="SAP" defaultWidth={450} defaultHeight={400}>
            <SapCard
              teamTuStats={teamTuStats}
              sapData={sapData}
              projectCount={projectCount}
              aggVarianceHours={aggVarianceHours}
            />
          </DetachableCard>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <DetachableCard
            group="Staffing"
            storageKey="pip-turnover"
            title="Turnover"
            defaultWidth={450}
            defaultHeight={400}
          >
            <ChurnCard teamTuStats={teamTuStats} timelineStart={timelineStart} timelineEnd={timelineEnd} />
          </DetachableCard>
        </Grid>

        {/* Row 2: Grade Pyramid + Trend Chart */}
        {gradeItems.length > 0 && (
          <Grid size={{ xs: 12, md: 5 }}>
            <DetachableCard
              group="Staffing"
              storageKey="pip-pyramid"
              title="Grade Pyramid"
              defaultWidth={600}
              defaultHeight={650}
            >
              <Card sx={cardSx(400)}>
                <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 32 }}>
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                      {pyramidMode === "grade" ? (
                        <Typography variant="h6" fontWeight={700}>
                          Grade Pyramid
                        </Typography>
                      ) : pyramidMode === "project" ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Typography variant="h6" fontWeight={700}>
                            Project Pyramid
                          </Typography>
                          <TextField
                            type="number"
                            size="small"
                            value={topNProjects}
                            onChange={(e) => setTopNProjects(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
                            inputProps={{
                              min: 1,
                              max: 20,
                              style: { textAlign: "center", padding: "2px 4px", fontSize: "1rem", fontWeight: 700 },
                            }}
                            sx={{ width: 44, "& .MuiOutlinedInput-root": { height: 28 } }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Typography variant="h6" fontWeight={700}>
                            Client Pyramid
                          </Typography>
                          <TextField
                            type="number"
                            size="small"
                            value={topNClients}
                            onChange={(e) => setTopNClients(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
                            inputProps={{
                              min: 1,
                              max: 20,
                              style: { textAlign: "center", padding: "2px 4px", fontSize: "1rem", fontWeight: 700 },
                            }}
                            sx={{ width: 44, "& .MuiOutlinedInput-root": { height: 28 } }}
                          />
                        </Box>
                      )}
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
                        {(() => {
                          const pStart = timelineStart ? new Date(timelineStart).toISOString().slice(0, 10) : null;
                          const pEnd = timelineEnd ? new Date(timelineEnd).toISOString().slice(0, 10) : null;
                          const realIds = new Set<string>();
                          filteredEmployees.forEach((e: any) => {
                            const realId = getRealEmpId(e);
                            const countHC =
                              !e._isGradeSplit ||
                              ((!e._arrivalDate || !pEnd || e._arrivalDate < pEnd) &&
                                (!e._departureDate || !pStart || e._departureDate >= pStart));
                            if (countHC) realIds.add(realId);
                          });
                          const hc = realIds.size;
                          let totalWD = 0;
                          if (timelineStart && timelineEnd) {
                            const c = new Date(timelineStart);
                            c.setHours(0, 0, 0, 0);
                            const eD = new Date(timelineEnd);
                            eD.setHours(0, 0, 0, 0);
                            while (c < eD) {
                              if (c.getDay() !== 0 && c.getDay() !== 6) totalWD++;
                              c.setDate(c.getDate() + 1);
                            }
                          }
                          const fte =
                            totalWD > 0
                              ? filteredEmployees.reduce(
                                  (s: number, e: any) =>
                                    s + Math.min(1, (e._presenceActiveN || e._displayActiveN || 0) / totalWD),
                                  0
                                )
                              : hc;
                          return fte === hc ? `${hc} emp.` : `${hc} emp. · ${fte.toFixed(2)} FTE`;
                        })()}
                      </Typography>
                    </Box>
                    <Tooltip
                      title={
                        pyramidMode === "grade"
                          ? "Switch to Project Pyramid"
                          : pyramidMode === "project"
                            ? "Switch to Client Pyramid"
                            : "Switch to Grade Pyramid"
                      }
                    >
                      <IconButton size="small" onClick={cyclePyramid} sx={{ color: "text.secondary" }}>
                        <SwapHorizIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: "flex", gap: 1, height: 540, flex: "0 0 540px", overflow: "hidden" }}>
                    <Box sx={{ display: "flex", alignItems: "stretch", mr: 1, gap: 1, py: 2 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          color: "text.secondary",
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          fontSize: "0.75rem",
                          letterSpacing: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        Distribution
                      </Typography>
                      <UtilizationDistribution
                        employees={filteredEmployees}
                        onBucketClick={onUtilizationBucketClick}
                        activeBucket={activeUtilizationBucket}
                        heatmapMode={heatmapMode}
                        vertical
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                      />
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                    <GradePyramid
                      items={gradeItems}
                      employees={filteredEmployees}
                      onTierClick={onGradeTierClick}
                      activeTier={activeGradeTier}
                      timelineStart={timelineStart}
                      timelineEnd={timelineEnd}
                      employeeMetadata={employeeMetadata}
                      pyramidMode={pyramidMode}
                      pipelineJobcodes={pipelineJobcodes}
                      showIO={showIO}
                      ioJobcodes={ioJobcodes}
                      chargeableCombined={chargeableCombined}
                      topNProjects={topNProjects}
                      topNClients={topNClients}
                      heatmapMode={heatmapMode}
                      dailyGrid={dailyGrid}
                      sx={{ flex: 1 }}
                      hideLegend
                    />
                  </Box>
                </CardContent>
              </Card>
            </DetachableCard>
          </Grid>
        )}
        <Grid size={{ xs: 12, md: gradeItems.length > 0 ? 7 : 12 }}>
          <DetachableCard group="Staffing" storageKey="pip-trend" title="Trend" defaultWidth={900} defaultHeight={550}>
            <Card sx={{ ...cardSx(500), overflow: "hidden" }}>
              <CardContent
                sx={{
                  p: 3,
                  pb: 2,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  "&:last-child": { pb: 2 },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: 32,
                    flexShrink: 0,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="h6" fontWeight={700}>
                      Trend
                    </Typography>
                    <TUTrendYearSelector
                      selectedYears={selectedYears}
                      availableYears={availableYears}
                      yearColors={yearColors}
                      onToggle={toggleYear}
                    />
                  </Box>
                  <TUTrendLegend
                    visible={visible}
                    onToggle={handleToggle}
                    hasSap={!!sapLookup}
                    isVarianceMode={teamTuStats.isVarianceMode}
                    hasIO={!!ioJobcodes}
                    hasInfinite={!!staffingNeeds && staffingNeeds.length > 0}
                    useSapActuals={useSapActuals}
                    hasChurn={teamTuStats.turnoverChurnRate != null}
                  />
                </Box>
                <Divider sx={{ my: 3 }} />
                <TUTrendChart
                  employees={filteredEmployees}
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  chargeableCombined={chargeableCombined}
                  enabledHolidayDates={enabledHolidayDates}
                  sapLookup={sapLookup}
                  fullSapLookup={fullSapLookup}
                  granularity={granularity}
                  visible={visible}
                  onToggle={handleToggle}
                  theoreticalTU={teamTuStats.theoreticalTU}
                  heatmapMode={heatmapMode}
                  employeeMetadata={employeeMetadata}
                  allEmployees={allEmployees}
                  ioJobcodes={ioJobcodes}
                  staffingNeeds={staffingNeeds}
                  selectedYears={selectedYears}
                  onYearsAvailable={initYears}
                  useSapActuals={useSapActuals}
                  onDateRangeChange={onDateRangeChange}
                />
              </CardContent>
            </Card>
          </DetachableCard>
        </Grid>
      </Grid>
    );
  }
);

TUOverview.displayName = "TUOverview";

export default TUOverview;
