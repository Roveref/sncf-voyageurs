import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  JOB_CATEGORIES,
  ABSENCE_CATS,
  CHARGEABLE_CATS,
  GO_CATS,
  TRAINING_CATS,
  HOURS_PER_DAY,
  getHoursPerDay,
} from "../../constants";
import { CATEGORY_THEME, getHeatmapStyle, getGradeTarget } from "../../constants/theme";
import { getCategoryLabel, isChargeableCategory } from "../../utils/categoryUtils";
import { spreadMarkers, fmtP, CH_COLORS, GO_COLORS } from "./tooltipHelpers";

const TOOLTIP_BAR_H = 240;
const TOOLTIP_BAR_W = 52;
const TOOLTIP_BAR_H_COMPACT = 360;
const TOOLTIP_BAR_W_COMPACT = 48;
const TOOLTIP_MARKER_W = 72;
const TOOLTIP_MARKER_W_COMPACT = 68;

/**
 * Rich tooltip with a vertical progress bar + categorised hours breakdown.
 * Used by HeatmapStrip and AggregateHeatmapStrip for cell tooltips.
 */
const TooltipProgressBar = memo(
  ({
    h,
    grade,
    suffix = "",
    workDays = 0,
    items = null,
    isAvg = false,
    chCombined = true,
    teamNetHours = 0,
    headerLabel = null,
    theoTarget = null,
    mirror = false,
    compact = false,
    dispoLabel = null,
    overLabel = null,
    topProjects = null,
    hidePerDay = false,
    hideOver = false,
    hideDispo = false,
  }: any) => {
    const HPD = getHoursPerDay(grade);
    const barH = compact ? TOOLTIP_BAR_H_COMPACT : TOOLTIP_BAR_H;
    const barW = compact ? TOOLTIP_BAR_W_COMPACT : TOOLTIP_BAR_W;
    const markerW = compact ? TOOLTIP_MARKER_W_COMPACT : TOOLTIP_MARKER_W;
    const tuRaw = h.tu;
    const toRaw = h.to;
    const tuToEqual = Math.round(tuRaw) === Math.round(toRaw);
    const gradeTarget = grade ? getGradeTarget(grade) : theoTarget;
    const tuColor = grade
      ? getHeatmapStyle(Math.round(tuRaw), grade).backgroundColor
      : theoTarget
        ? getHeatmapStyle(Math.round(tuRaw), undefined, theoTarget).backgroundColor
        : undefined;
    const totalH = h.totalBase || h.netH || 1;
    const netPct = totalH > 0 ? (h.netH / totalH) * 100 : 100;
    const hasAbs = (h.absH || 0) > 0;
    const hasHol = (h.holH || 0) > 0;
    const showVol = workDays > 0;
    const fmtHVal = (v: number) => {
      const s = v.toFixed(1);
      return s.endsWith(".0") ? s.slice(0, -2) : s;
    };

    // ── Classify items into sections ──────────────────────────────────────────
    const field = isAvg ? "avg" : "util";
    const pureChItems: any[] = [],
      goItems: any[] = [],
      trainingItems: any[] = [],
      reservationItems: any[] = [],
      ncItems: any[] = [];
    (items || []).forEach((it: any) => {
      const cat = it.category;
      if (ABSENCE_CATS.has(cat)) return;
      if (CHARGEABLE_CATS.has(cat)) pureChItems.push(it);
      else if (GO_CATS.has(cat)) goItems.push(it);
      else if (TRAINING_CATS.has(cat)) trainingItems.push(it);
      else if (cat === JOB_CATEGORIES.RESERVATION) reservationItems.push(it);
      else ncItems.push(it);
    });
    const chItems = chCombined ? [...pureChItems, ...goItems] : pureChItems;
    if (!chCombined) ncItems.unshift(...goItems);

    // ── Bar segments: chargeable (bottom) → GO → other → dispo → abs → hol ──
    const itemToH = (it: any) => (it.avgH != null ? it.avgH : ((it[field] || 0) * HPD) / 100);
    const barSegs: { pct: number; color: string }[] = [];
    if (pureChItems.length > 0) {
      pureChItems.forEach((it, i) => {
        barSegs.push({ pct: (itemToH(it) / totalH) * 100, color: CH_COLORS[i % CH_COLORS.length] });
      });
    }
    if (goItems.length > 0) {
      goItems.forEach((it, i) => {
        barSegs.push({ pct: (itemToH(it) / totalH) * 100, color: GO_COLORS[i % GO_COLORS.length] });
      });
    }
    if (chItems.length === 0 && h.chH > 0) {
      barSegs.push({ pct: (h.chH / totalH) * 100, color: "#60a5fa" });
    }
    if (!chCombined && goItems.length === 0 && h.goH > 0)
      barSegs.push({ pct: (h.goH / totalH) * 100, color: "#22d3ee" });
    if (h.trH > 0) barSegs.push({ pct: (h.trH / totalH) * 100, color: "#34d399" });
    if ((h.resH || 0) > 0) barSegs.push({ pct: (h.resH / totalH) * 100, color: "#fbbf24" });
    if ((h.ncH || 0) > 0) barSegs.push({ pct: (h.ncH / totalH) * 100, color: "text.disabled" });
    if (h.diH > 0) barSegs.push({ pct: (h.diH / totalH) * 100, color: "text.secondary" });
    if (hasAbs) barSegs.push({ pct: (h.absH / totalH) * 100, color: "#f87171" });
    if (hasHol) barSegs.push({ pct: (h.holH / totalH) * 100, color: "#fca5a5" });

    // ── Markers on left axis ──────────────────────────────────────────────────
    const tuBarPct = (tuRaw / 100) * netPct;
    const toBarPct = (toRaw / 100) * netPct;
    const cibleBarPct = gradeTarget ? (gradeTarget / 100) * netPct : null;

    const rawMarkers: any[] = [];
    if (hidePerDay && showVol) {
      // Dividers show TU/TO/Net values — only keep target marker on bar
    } else {
      if (hasAbs || hasHol)
        rawMarkers.push({
          pct: netPct,
          label: `Net ${fmtHVal(h.netH)} h${suffix}${showVol ? " · " + ((h.netH * workDays) / HPD).toFixed(1).replace(/\.0$/, "") + " d - " + fmtHVal(h.netH * workDays) + " h" : ""}`,
          color: "#fca5a5",
        });
      if (tuToEqual) {
        rawMarkers.push({ pct: tuBarPct, label: `TU/TO ${fmtP(tuRaw)}%`, color: tuColor || "#38bdf8", bold: true });
      } else {
        rawMarkers.push({ pct: toBarPct, label: `TO ${fmtP(toRaw)}%`, color: "#c4b5fd" });
        rawMarkers.push({ pct: tuBarPct, label: `TU ${fmtP(tuRaw)}%`, color: tuColor || "#38bdf8", bold: true });
      }
    }
    const positioned = spreadMarkers(rawMarkers, barH);

    // ── Right panel sections with bar-aligned positions ───────────────────────
    const chTotalPctRaw = (h.chH / (h.netH || 1)) * 100;
    const trPctRaw = (h.trH / (h.netH || 1)) * 100;
    const resPctRaw = ((h.resH || 0) / (h.netH || 1)) * 100;
    const ncPctRaw = ((h.ncH || 0) / (h.netH || 1)) * 100;
    const diPctRaw = (h.diH / (h.netH || 1)) * 100;
    const absPctRaw = ((h.absH || 0) / (totalH || 1)) * 100;
    const holPctRaw = ((h.holH || 0) / (totalH || 1)) * 100;

    const chBarPct = (h.chH / totalH) * 100;
    const trBarH = (h.trH / totalH) * 100;
    const resBarH = ((h.resH || 0) / totalH) * 100;
    const ncBarH = ((h.ncH || 0) / totalH) * 100;
    const diBarH = (h.diH / totalH) * 100;
    const absBarH = ((h.absH || 0) / totalH) * 100;
    const holBarH = ((h.holH || 0) / totalH) * 100;
    let cumPct = 0;
    const chMid = cumPct + chBarPct / 2;
    cumPct += chBarPct;
    const trMid = cumPct + trBarH / 2;
    cumPct += trBarH;
    const resMid = cumPct + resBarH / 2;
    cumPct += resBarH;
    const ncMid = cumPct + ncBarH / 2;
    cumPct += ncBarH;
    const diMid = cumPct + diBarH / 2;
    cumPct += diBarH;
    const netBoundaryPct = cumPct; // boundary between availability and absences = Net line position
    const absMid = cumPct + absBarH / 2;
    cumPct += absBarH;
    const holMid = cumPct + holBarH / 2;

    const noTraining = h.trH <= 0;
    const nothingBetweenNetAndTU = ncBarH < 0.5 && diBarH < 0.5 && resBarH < 0.5;
    const rightSections: { pct: number; key: string }[] = [];
    if (h.chH > 0) rightSections.push({ pct: chMid, key: "ch" });
    // Divider positions — Bar top→bottom: Hol → Abs → [NET] → Di → NC → Res → [TO] → Tr → [TU] → Ch
    // Merge adjacent dividers when nothing visible separates them in the bar.
    const aboveChOrTr = resBarH > 0.5 ? resMid : ncBarH > 0.5 ? ncMid : diMid;
    if (hidePerDay && showVol) {
      if (noTraining && nothingBetweenNetAndTU) {
        // TU=TO, nothing between Net and TU → single combined "Net | TU/TO"
        rightSections.push({ pct: netBoundaryPct, key: "nettotu-divider" });
      } else if (noTraining) {
        // TU=TO, but stuff visible between Net and TU → separate TU/TO + Net
        rightSections.push({ pct: (chMid + aboveChOrTr) / 2, key: "tuto-only-divider" });
      } else {
        // Has training → TU always separate (between Ch and Tr)
        rightSections.push({ pct: (chMid + trMid) / 2, key: "tu-divider" });
      }
    }
    if (!noTraining) rightSections.push({ pct: trMid, key: "training" });
    if (resBarH > 0.5) rightSections.push({ pct: resMid, key: "reservation" });
    // TO divider (only when training): merge with Net if nothing between them
    if (hidePerDay && showVol && !noTraining) {
      if (nothingBetweenNetAndTU) {
        rightSections.push({ pct: netBoundaryPct, key: "netto-divider" });
      } else {
        rightSections.push({ pct: (trMid + aboveChOrTr) / 2, key: "to-divider" });
      }
    }
    if (hasAbs) rightSections.push({ pct: absMid, key: "abs" });
    if ((h.overH || 0) >= 0.05 && !hideOver) rightSections.push({ pct: holMid, key: "over" });
    // Net divider: only when not already covered by nettotu or netto merge
    if (hidePerDay && showVol && !nothingBetweenNetAndTU)
      rightSections.push({ pct: netBoundaryPct, key: "net-divider" });
    if (ncBarH > 0) rightSections.push({ pct: ncMid, key: "nc" });
    if (h.diH >= 0.05 && !hideDispo) rightSections.push({ pct: diMid, key: "dispo" });
    if (hasHol) rightSections.push({ pct: holMid, key: "hol" });
    const positionedRight = spreadMarkers(rightSections, barH, 24);

    const fmtH = (hrs: number) => {
      const sfx = isAvg ? "/d" : "";
      if (showVol) {
        const totalHrs = hrs * workDays;
        const totalDays = (totalHrs / HPD).toFixed(1).replace(/\.0$/, "");
        if (hidePerDay) return `${totalDays} d - ${fmtHVal(totalHrs)} h`;
        return `${fmtHVal(hrs)} h${sfx} · ${totalDays} d - ${fmtHVal(totalHrs)} h`;
      }
      return `${fmtHVal(hrs)} h${sfx}`;
    };

    const autoM = mirror ? { mr: "auto" } : { ml: "auto" };
    const padS = mirror ? { pr: 1.25 } : { pl: 1.25 };
    const flexDir = mirror ? "row-reverse" : "row";
    const maxChItems = compact ? Infinity : 4;

    // ── Compute column widths from actual values (hidePerDay mode) ──────────
    const COL_GAP = 6;
    const colCell = {
      display: "inline-block",
      textAlign: "right" as const,
      fontVariantNumeric: "tabular-nums",
      fontSize: "0.75rem",
    };

    // Collect all values that will be rendered to find max widths
    const allPctStrs: string[] = [];
    const allDayStrs: string[] = [];
    const allHrsStrs: string[] = [];
    if (hidePerDay && showVol) {
      const addVal = (pctStr: string, hrs: number) => {
        const totalHrs = hrs * workDays;
        const totalDays = (totalHrs / HPD).toFixed(1).replace(/\.0$/, "");
        if (pctStr) allPctStrs.push(`${pctStr} %`);
        allDayStrs.push(totalDays);
        allHrsStrs.push(fmtHVal(totalHrs));
      };
      // Section headers
      addVal(fmtP(chTotalPctRaw), h.chH);
      addVal(fmtP(trPctRaw), h.trH);
      if (resBarH > 0) addVal(fmtP(resPctRaw), h.resH || 0);
      if (ncBarH > 0) addVal(fmtP(ncPctRaw), h.ncH || 0);
      addVal(fmtP(diPctRaw), h.diH);
      if (hasAbs) addVal(fmtP(absPctRaw), h.absH);
      if (hasHol) addVal(fmtP(holPctRaw), h.holH);
      if ((h.overH || 0) >= 0.05 && !hideOver) addVal("", h.overH);
      // Items
      if (topProjects && topProjects.length > 0) {
        topProjects.forEach((p: any) => addVal(h.netH > 0 ? fmtP((p.hours / h.netH) * 100) : "0", p.hours));
      } else if (chItems.length > 0) {
        chItems.slice(0, maxChItems).forEach((it) => {
          const itemH = it.avgH != null ? it.avgH : ((it[field] || 0) * HPD) / 100;
          const pctOfNet = h.netH > 0 ? (itemH / h.netH) * 100 : 0;
          addVal(fmtP(pctOfNet), itemH);
        });
      }
      trainingItems.forEach((it) => {
        const itemH = it.avgH != null ? it.avgH : ((it[field] || 0) * HPD) / 100;
        const pctOfNet = h.netH > 0 ? (itemH / h.netH) * 100 : 0;
        addVal(fmtP(pctOfNet), itemH);
      });
    }
    const maxPct = allPctStrs.reduce((m, s) => Math.max(m, s.length), 0);
    const maxDay = allDayStrs.reduce((m, s) => Math.max(m, s.length), 0);
    const maxHrs = allHrsStrs.reduce((m, s) => Math.max(m, s.length), 0);
    // Use fixed px widths (based on ~8px per char at 14px font) so columns align across different font sizes
    // Ensure headers ("%"=1, "Days"=4, "Hours"=5) fit too
    const PX_PER_CH = 8;
    const colWPct = `${Math.max(maxPct, 1) * PX_PER_CH}px`;
    const colWD = `${Math.max(maxDay, 4) * PX_PER_CH}px`;
    const colWH = `${Math.max(maxHrs, 5) * PX_PER_CH}px`;

    const renderAlignedValues = (pctStr: string, hrs: number, _fontSize = "0.75rem", bold = false) => {
      if (hidePerDay && showVol) {
        const totalHrs = hrs * workDays;
        const totalDays = (totalHrs / HPD).toFixed(1).replace(/\.0$/, "");
        const fs = _fontSize;
        return (
          <Box
            component="span"
            sx={{ ...autoM, ...(mirror ? { pr: 1 } : { pl: 1 }), whiteSpace: "nowrap", display: "inline-flex" }}
          >
            {mirror ? (
              <>
                <Typography
                  component="span"
                  sx={{ ...colCell, fontSize: fs, width: colWPct, fontWeight: bold ? 600 : 500 }}
                >
                  {pctStr ? `${pctStr} %` : ""}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    ...colCell,
                    fontSize: fs,
                    width: colWD,
                    ml: `${COL_GAP}px`,
                    color: "text.secondary",
                    fontWeight: 400,
                  }}
                >
                  {totalDays}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    ...colCell,
                    fontSize: fs,
                    width: colWH,
                    ml: `${COL_GAP}px`,
                    color: "text.secondary",
                    fontWeight: 400,
                  }}
                >
                  {fmtHVal(totalHrs)}
                </Typography>
              </>
            ) : (
              <>
                <Typography
                  component="span"
                  sx={{
                    ...colCell,
                    textAlign: "left",
                    fontSize: fs,
                    width: colWH,
                    color: "text.secondary",
                    fontWeight: 400,
                  }}
                >
                  {fmtHVal(totalHrs)}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    ...colCell,
                    textAlign: "left",
                    fontSize: fs,
                    width: colWD,
                    ml: `${COL_GAP}px`,
                    color: "text.secondary",
                    fontWeight: 400,
                  }}
                >
                  {totalDays}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    ...colCell,
                    textAlign: "left",
                    fontSize: fs,
                    width: colWPct,
                    ml: `${COL_GAP}px`,
                    fontWeight: bold ? 600 : 500,
                  }}
                >
                  {pctStr ? `${pctStr} %` : ""}
                </Typography>
              </>
            )}
          </Box>
        );
      }
      return (
        <Typography
          component="span"
          sx={{
            ...autoM,
            fontWeight: bold ? 600 : 500,
            ...(mirror ? { pr: 1 } : { pl: 1 }),
            whiteSpace: "nowrap",
            fontSize: _fontSize,
          }}
        >
          {pctStr ? <>{pctStr}% </> : null}
          <Typography component="span" sx={{ color: "text.secondary", fontWeight: 400, fontSize: "inherit" }}>
            {pctStr ? "(" : ""}
            {fmtH(hrs)}
            {pctStr ? ")" : ""}
          </Typography>
        </Typography>
      );
    };

    const renderItem = (it: any, color?: string) => {
      const v = it[field] || 0;
      const name = it.name || getCategoryLabel(it.category);
      const itemH = it.avgH != null ? it.avgH : (v * HPD) / 100;
      const pctOfNet = h.netH > 0 ? (itemH / h.netH) * 100 : 0;
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, lineHeight: 1.4, flexDirection: flexDir }}>
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: "2px",
              flexShrink: 0,
              bgcolor: color || CATEGORY_THEME[it.category]?.hex || "#d1d5db",
            }}
          />
          <Typography component="span" sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}>
            {name}
            {isChargeableCategory(it.category) && it.jobNo && (
              <Typography
                component="span"
                sx={{ color: "text.disabled", fontFamily: "monospace", ml: 0.5, fontSize: "inherit" }}
              >
                ({it.jobNo})
              </Typography>
            )}
          </Typography>
          {renderAlignedValues(fmtP(pctOfNet), itemH)}
        </Box>
      );
    };

    const maxNcItems = compact ? Infinity : 3;

    const renderSection = (s: { pct: number; [k: string]: any }) => {
      switch (s.key) {
        case "ch":
          return (
            <Box key="ch">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#93c5fd",
                  flexDirection: flexDir,
                }}
              >
                <Typography component="span" sx={{ fontSize: "inherit" }}>
                  Chargeable
                </Typography>
                {renderAlignedValues(fmtP(chTotalPctRaw), h.chH, "14px", true)}
              </Box>
              {topProjects && topProjects.length > 0 ? (
                <Box sx={{ mt: 0.25, "& > * + *": { mt: 0.25 } }}>
                  {topProjects.map((p: any, i: number) => (
                    <Box
                      key={i}
                      sx={{ display: "flex", alignItems: "center", gap: 0.75, lineHeight: 1.4, flexDirection: flexDir }}
                    >
                      <Box
                        component="span"
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "2px",
                          flexShrink: 0,
                          bgcolor: p.name === "Others…" ? "#64748b" : CH_COLORS[i % CH_COLORS.length],
                        }}
                      />
                      <Typography
                        component="span"
                        sx={{
                          whiteSpace: "nowrap",
                          fontSize: "0.75rem",
                          fontStyle: p.name === "Others…" ? "italic" : "normal",
                          color: p.name === "Others…" ? "text.secondary" : "inherit",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {mirror
                          ? [p.name, p.jobNo && p.jobNo !== p.name ? p.jobNo : "", p.account]
                              .filter(Boolean)
                              .join(" - ")
                          : [p.account, p.jobNo, p.name].filter(Boolean).join(" - ")}
                      </Typography>
                      {renderAlignedValues(h.netH > 0 ? fmtP((p.hours / h.netH) * 100) : "0", p.hours)}
                    </Box>
                  ))}
                </Box>
              ) : chItems.length > 0 ? (
                <Box sx={{ mt: 0.25, "& > * + *": { mt: 0.25 } }}>
                  {chItems.slice(0, maxChItems).map((it, i) => {
                    const isGo = GO_CATS.has(it.category);
                    const chIdx = isGo ? i - pureChItems.length : i;
                    const color = isGo ? GO_COLORS[chIdx % GO_COLORS.length] : CH_COLORS[chIdx % CH_COLORS.length];
                    return <React.Fragment key={i}>{renderItem(it, color)}</React.Fragment>;
                  })}
                </Box>
              ) : h.chH > 0 ? (
                <Typography sx={{ fontSize: "0.75rem", color: "text.disabled", ...padS, mt: 0.25 }}>
                  {fmtH(h.chH)}
                </Typography>
              ) : (
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", ...padS, mt: 0.25 }}>--</Typography>
              )}
              {!topProjects && chItems.length > maxChItems && (
                <Typography sx={{ fontSize: "11px", color: "text.secondary", ...padS, mt: 0.25 }}>
                  and {chItems.length - maxChItems} more...
                </Typography>
              )}
            </Box>
          );
        case "training":
          return (
            <Box key="training">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#6ee7b7",
                  flexDirection: flexDir,
                }}
              >
                <Typography component="span" sx={{ fontSize: "inherit" }}>
                  Training
                </Typography>
                {renderAlignedValues(fmtP(trPctRaw), h.trH, "14px", true)}
              </Box>
              {trainingItems.length > 1 ? (
                <Box sx={{ mt: 0.25, "& > * + *": { mt: 0.25 } }}>
                  {trainingItems.map((it, i) => (
                    <React.Fragment key={i}>{renderItem(it)}</React.Fragment>
                  ))}
                </Box>
              ) : trainingItems.length === 0 && h.trH <= 0 ? (
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", ...padS, mt: 0.25 }}>--</Typography>
              ) : null}
            </Box>
          );
        case "reservation":
          return (
            <Box key="reservation">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#fcd34d",
                  flexDirection: flexDir,
                }}
              >
                <Typography component="span" sx={{ fontSize: "inherit" }}>
                  Reservation
                </Typography>
                {renderAlignedValues(fmtP(resPctRaw), h.resH || 0, "14px", true)}
              </Box>
              {reservationItems.length > 1 && (
                <Box sx={{ mt: 0.25, "& > * + *": { mt: 0.25 } }}>
                  {reservationItems.map((it, i) => (
                    <React.Fragment key={i}>{renderItem(it)}</React.Fragment>
                  ))}
                </Box>
              )}
            </Box>
          );
        case "nc":
          return (
            <Box key="nc">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#d1d5db",
                  flexDirection: flexDir,
                }}
              >
                <Typography component="span" sx={{ fontSize: "inherit" }}>
                  Non Chargeable
                </Typography>
                {renderAlignedValues(fmtP(ncPctRaw), h.ncH || 0, "14px", true)}
              </Box>
              {ncItems.length > 0 ? (
                <Box sx={{ mt: 0.25, "& > * + *": { mt: 0.25 } }}>
                  {ncItems.slice(0, maxNcItems).map((it, i) => (
                    <React.Fragment key={i}>{renderItem(it)}</React.Fragment>
                  ))}
                </Box>
              ) : (h.ncH || 0) > 0 ? (
                <Typography sx={{ fontSize: "0.75rem", color: "text.disabled", ...padS, mt: 0.25 }}>
                  {fmtH(h.ncH)}
                </Typography>
              ) : null}
              {ncItems.length > maxNcItems && (
                <Typography sx={{ fontSize: "11px", color: "text.secondary", ...padS, mt: 0.25 }}>
                  and {ncItems.length - maxNcItems} more...
                </Typography>
              )}
            </Box>
          );
        case "dispo":
          return (
            <Box
              key="dispo"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                fontSize: "14px",
                fontWeight: 600,
                color: "text.disabled",
                flexDirection: flexDir,
              }}
            >
              <Typography component="span" sx={{ fontSize: "inherit" }}>
                {dispoLabel || "Availability"}
              </Typography>
              {renderAlignedValues(fmtP(diPctRaw), h.diH, "14px", true)}
            </Box>
          );
        case "abs":
          return (
            <Box
              key="abs"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                fontSize: "14px",
                fontWeight: 600,
                color: "#fca5a5",
                flexDirection: flexDir,
              }}
            >
              <Typography component="span" sx={{ fontSize: "inherit" }}>
                Absences
              </Typography>
              {renderAlignedValues(fmtP(absPctRaw), h.absH, "14px", true)}
            </Box>
          );
        case "hol":
          return (
            <Box
              key="hol"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                fontSize: "14px",
                fontWeight: 600,
                color: "#fca5a5",
                flexDirection: flexDir,
              }}
            >
              <Typography component="span" sx={{ fontSize: "inherit" }}>
                Holiday
              </Typography>
              {renderAlignedValues(fmtP(holPctRaw), h.holH, "14px", true)}
            </Box>
          );
        case "over":
          return (
            <Box
              key="over"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                fontSize: "14px",
                fontWeight: 600,
                color: "#f97316",
                flexDirection: flexDir,
              }}
            >
              <Typography component="span" sx={{ fontSize: "inherit" }}>
                {overLabel || "Overcharged SAP"}
              </Typography>
              {renderAlignedValues("", h.overH, "14px", true)}
            </Box>
          );
        case "tuto-only-divider": {
          const tutoHrs = h.chH * workDays;
          const tutoDays = (tutoHrs / HPD).toFixed(1).replace(/\.0$/, "");
          return (
            <Box key={s.key} sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.5 }}>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#3b82f6" }} />
              <Typography
                component="span"
                sx={{ fontSize: "0.8rem", color: "#93c5fd", fontWeight: 700, whiteSpace: "nowrap" }}
              >
                TU/TO - {fmtP(tuRaw)}% &ndash; {tutoDays}&nbsp;d &ndash; {fmtHVal(tutoHrs)}&nbsp;h
              </Typography>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#3b82f6" }} />
            </Box>
          );
        }
        case "nettotu-divider":
        case "tuto-divider": {
          const tuHrs2 = h.chH * workDays;
          const tuDays2 = (tuHrs2 / HPD).toFixed(1).replace(/\.0$/, "");
          const netHrs2 = h.netH * workDays;
          const netDays2 = (netHrs2 / HPD).toFixed(1).replace(/\.0$/, "");
          return (
            <Box key={s.key} sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.5 }}>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#ef4444" }} />
              <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                <Typography component="span" sx={{ color: "#fca5a5", fontSize: "inherit", fontWeight: "inherit" }}>
                  Net - {netDays2}&nbsp;d - {fmtHVal(netHrs2)}&nbsp;h
                </Typography>
                <Typography component="span" sx={{ color: "#64748b", fontSize: "inherit", fontWeight: "inherit" }}>
                  {" "}
                  |{" "}
                </Typography>
                <Typography component="span" sx={{ color: "#93c5fd", fontSize: "inherit", fontWeight: "inherit" }}>
                  TU/TO - {fmtP(tuRaw)}% &ndash; {tuDays2}&nbsp;d &ndash; {fmtHVal(tuHrs2)}&nbsp;h
                </Typography>
              </Typography>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#3b82f6" }} />
            </Box>
          );
        }
        case "tu-divider": {
          const tuHrs = h.chH * workDays;
          const tuDays = (tuHrs / HPD).toFixed(1).replace(/\.0$/, "");
          return (
            <Box key="tu-divider" sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.5 }}>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#3b82f6" }} />
              <Typography
                component="span"
                sx={{ fontSize: "0.8rem", color: "#93c5fd", fontWeight: 700, whiteSpace: "nowrap" }}
              >
                TU - {fmtP(tuRaw)}% &ndash; {tuDays}&nbsp;d &ndash; {fmtHVal(tuHrs)}&nbsp;h
              </Typography>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#3b82f6" }} />
            </Box>
          );
        }
        case "to-divider": {
          const toHrs = (h.chH + h.trH) * workDays;
          const toDays = (toHrs / HPD).toFixed(1).replace(/\.0$/, "");
          return (
            <Box key="to-divider" sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.5 }}>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#22c55e" }} />
              <Typography
                component="span"
                sx={{ fontSize: "0.8rem", color: "#6ee7b7", fontWeight: 700, whiteSpace: "nowrap" }}
              >
                TO - {fmtP(toRaw)}% &ndash; {toDays}&nbsp;d &ndash; {fmtHVal(toHrs)}&nbsp;h
              </Typography>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#22c55e" }} />
            </Box>
          );
        }
        case "netto-divider": {
          const nettoNetHrs = h.netH * workDays;
          const nettoNetDays = (nettoNetHrs / HPD).toFixed(1).replace(/\.0$/, "");
          const nettoToHrs = (h.chH + h.trH) * workDays;
          const nettoToDays = (nettoToHrs / HPD).toFixed(1).replace(/\.0$/, "");
          return (
            <Box key="netto-divider" sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.5 }}>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#ef4444" }} />
              <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                <Typography component="span" sx={{ color: "#fca5a5", fontSize: "inherit", fontWeight: "inherit" }}>
                  Net - {nettoNetDays}&nbsp;d - {fmtHVal(nettoNetHrs)}&nbsp;h
                </Typography>
                <Typography component="span" sx={{ color: "#64748b", fontSize: "inherit", fontWeight: "inherit" }}>
                  {" "}
                  |{" "}
                </Typography>
                <Typography component="span" sx={{ color: "#6ee7b7", fontSize: "inherit", fontWeight: "inherit" }}>
                  TO - {fmtP(toRaw)}% &ndash; {nettoToDays}&nbsp;d &ndash; {fmtHVal(nettoToHrs)}&nbsp;h
                </Typography>
              </Typography>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#ef4444" }} />
            </Box>
          );
        }
        case "net-divider": {
          const netTotalHrs = h.netH * workDays;
          const netTotalDays = (netTotalHrs / HPD).toFixed(1).replace(/\.0$/, "");
          return (
            <Box key="net-divider" sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.5 }}>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#ef4444" }} />
              <Typography
                component="span"
                sx={{ fontSize: "0.8rem", color: "#fca5a5", fontWeight: 700, whiteSpace: "nowrap" }}
              >
                Net &ndash; {netTotalDays}&nbsp;d &ndash; {fmtHVal(netTotalHrs)}&nbsp;h
              </Typography>
              <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "#ef4444" }} />
            </Box>
          );
        }
        default:
          return null;
      }
    };

    // ── Team TU impact if this person was at target ────────────────────────────
    const teamGainPts = (() => {
      if (!gradeTarget || tuRaw >= gradeTarget || !teamNetHours || teamNetHours <= 0) return null;
      const gainHPerDay = Math.max(0, (gradeTarget / 100) * h.netH - h.chH);
      if (gainHPerDay <= 0) return null;
      const days = showVol ? workDays : 1;
      const totalGainH = gainHPerDay * days;
      return (totalGainH / teamNetHours) * 100;
    })();

    // ── Reusable sub-blocks ──────────────────────────────────────────────────
    const totalLabel =
      hidePerDay && showVol
        ? `${((totalH * workDays) / HPD).toFixed(1).replace(/\.0$/, "")} d - ${fmtHVal(totalH * workDays)} h`
        : `${fmtHVal(totalH)} h${suffix}${showVol ? ` · ${((totalH * workDays) / HPD).toFixed(1).replace(/\.0$/, "")} d - ${fmtHVal(totalH * workDays)} h` : ""}`;

    const markerBlock = (
      <Box
        sx={{
          position: "relative",
          flexShrink: 0,
          width: markerW,
          height: hidePerDay && showVol ? "100%" : barH,
          minHeight: barH,
        }}
      >
        {positioned.map((m, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute",
              ...(mirror ? { left: 0 } : { right: 0 }),
              display: "flex",
              alignItems: "center",
              bottom: m.px,
              transform: "translateY(50%)",
            }}
          >
            {mirror ? (
              <>
                <Box component="span" sx={{ width: 4, borderTop: `1px ${m.dashed ? "dashed" : "solid"} ${m.color}` }} />
                <Typography
                  component="span"
                  sx={{ fontSize: "11px", lineHeight: 1, ml: 0.25, fontWeight: m.bold ? 700 : 400, color: m.color }}
                >
                  {m.label}
                </Typography>
              </>
            ) : (
              <>
                <Typography
                  component="span"
                  sx={{ fontSize: "11px", lineHeight: 1, mr: 0.25, fontWeight: m.bold ? 700 : 400, color: m.color }}
                >
                  {m.label}
                </Typography>
                <Box component="span" sx={{ width: 4, borderTop: `1px ${m.dashed ? "dashed" : "solid"} ${m.color}` }} />
              </>
            )}
          </Box>
        ))}
      </Box>
    );

    const barBlock = (
      <Box
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: "column-reverse",
          borderRadius: "2px",
          overflow: "hidden",
          width: barW,
          height: hidePerDay && showVol ? "100%" : barH,
          minHeight: barH,
          bgcolor: "text.primary",
        }}
      >
        {barSegs
          .filter((s) => s.pct > 0)
          .map((s, i) => (
            <Box key={i} sx={{ flexShrink: 0, height: `${s.pct}%`, bgcolor: s.color }} />
          ))}
        {cibleBarPct != null && (
          <Box
            sx={{
              position: "absolute",
              display: "flex",
              alignItems: "center",
              bottom: `${Math.min(cibleBarPct, 100)}%`,
              left: 0,
              right: 0,
            }}
          >
            <Box sx={{ flex: 1, borderTop: "1px dashed rgba(255,255,255,0.6)" }} />
            <Typography
              component="span"
              sx={{
                fontSize: "11px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1,
                px: 0.25,
                whiteSpace: "nowrap",
                textShadow: "0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)",
              }}
            >
              {grade ? `${gradeTarget}%` : `${fmtP(gradeTarget)}%`}
            </Typography>
            <Box sx={{ flex: 1, borderTop: "1px dashed rgba(255,255,255,0.6)" }} />
          </Box>
        )}
        {(hasAbs || hasHol) && (
          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              borderTop: "1px solid rgba(255,255,255,0.5)",
              bottom: `${netPct}%`,
            }}
          />
        )}
      </Box>
    );

    const colHeaderRow =
      hidePerDay && showVol ? (
        <Box sx={{ display: "flex", alignItems: "center", flexDirection: flexDir, mb: 0.5 }}>
          <Box sx={{ flex: 1 }} />
          <Box
            component="span"
            sx={{ ...autoM, ...(mirror ? { pr: 1 } : { pl: 1 }), whiteSpace: "nowrap", display: "inline-flex" }}
          >
            {mirror ? (
              <>
                <Typography
                  component="span"
                  sx={{ ...colCell, width: colWPct, fontSize: "0.65rem", color: "text.disabled", fontWeight: 600 }}
                >
                  %
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    ...colCell,
                    width: colWD,
                    ml: `${COL_GAP}px`,
                    fontSize: "0.65rem",
                    color: "text.disabled",
                    fontWeight: 600,
                  }}
                >
                  Days
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    ...colCell,
                    width: colWH,
                    ml: `${COL_GAP}px`,
                    fontSize: "0.65rem",
                    color: "text.disabled",
                    fontWeight: 600,
                  }}
                >
                  Hours
                </Typography>
              </>
            ) : (
              <>
                <Typography
                  component="span"
                  sx={{
                    ...colCell,
                    textAlign: "left",
                    width: colWH,
                    fontSize: "0.65rem",
                    color: "text.disabled",
                    fontWeight: 600,
                  }}
                >
                  Hours
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    ...colCell,
                    textAlign: "left",
                    width: colWD,
                    ml: `${COL_GAP}px`,
                    fontSize: "0.65rem",
                    color: "text.disabled",
                    fontWeight: 600,
                  }}
                >
                  Days
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    ...colCell,
                    textAlign: "left",
                    width: colWPct,
                    ml: `${COL_GAP}px`,
                    fontSize: "0.65rem",
                    color: "text.disabled",
                    fontWeight: 600,
                  }}
                >
                  %
                </Typography>
              </>
            )}
          </Box>
        </Box>
      ) : null;

    const totalDivider =
      hidePerDay && showVol ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "text.disabled" }} />
          <Typography
            component="span"
            sx={{ fontSize: "0.8rem", color: "text.secondary", fontWeight: 700, whiteSpace: "nowrap" }}
          >
            Total &ndash; {((totalH * workDays) / HPD).toFixed(1).replace(/\.0$/, "")}&nbsp;d &ndash;{" "}
            {fmtHVal(totalH * workDays)}&nbsp;h
          </Typography>
          <Box sx={{ flex: 1, borderTop: "1px solid", borderColor: "text.disabled" }} />
        </Box>
      ) : null;

    const sectionsBlock = (() => {
      const sorted = [...positionedRight].sort((a, b) => b.pct - a.pct);
      if (hidePerDay && showVol) {
        const netIdx = sorted.findIndex((s) => s.key === "net-divider");
        const topKeys = new Set(["hol", "abs", "over", "net-divider"]);
        const topGroup = sorted.filter((s) => topKeys.has(s.key));
        const bottomGroup = sorted.filter((s) => !topKeys.has(s.key));
        return (
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: barH }}>
            {colHeaderRow}
            {topGroup.map((s) => (
              <Box key={s.key} sx={{ py: 0.75 }}>
                {renderSection(s)}
              </Box>
            ))}
            <Box sx={{ flex: 1 }} />
            {bottomGroup.map((s) => (
              <Box key={s.key} sx={{ py: 0.75 }}>
                {renderSection(s)}
              </Box>
            ))}
          </Box>
        );
      }
      return (
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            minHeight: barH,
            mt: 2,
          }}
        >
          {colHeaderRow}
          {sorted.map((s) => (
            <Box key={s.key} sx={{ py: 0.75 }}>
              {renderSection(s)}
            </Box>
          ))}
        </Box>
      );
    })();

    const barAndMarkers = (
      <Box sx={{ flexShrink: 0, display: "flex", flexDirection: "column" }}>
        {!(hidePerDay && showVol) && (
          <Typography
            sx={{
              fontSize: "11px",
              color: "text.disabled",
              textAlign: "center",
              mb: 0.25,
            }}
          >
            {totalLabel}
          </Typography>
        )}
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            flex: hidePerDay && showVol ? 1 : undefined,
            height: hidePerDay && showVol ? undefined : barH,
          }}
        >
          {hidePerDay && showVol ? (
            barBlock
          ) : mirror ? (
            <>
              {barBlock}
              {markerBlock}
            </>
          ) : (
            <>
              {markerBlock}
              {barBlock}
            </>
          )}
        </Box>
      </Box>
    );

    return (
      <Box
        sx={{
          ...(headerLabel ? {} : { borderTop: "1px solid #4b5563", mt: 1, pt: 1 }),
          ...(hidePerDay && showVol ? { flex: 1, display: "flex", flexDirection: "column" } : {}),
        }}
      >
        {headerLabel && !compact && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography component="span" sx={{ fontWeight: 600 }}>
              {headerLabel}
            </Typography>
            {teamGainPts != null && teamGainPts > 0 && (
              <Box
                component="span"
                sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "11px", ml: "auto" }}
              >
                <Typography
                  component="span"
                  sx={{
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: "rgba(6,78,59,0.5)",
                    color: "#6ee7b7",
                    fontWeight: 600,
                    fontSize: "inherit",
                  }}
                >
                  +{teamGainPts < 0.1 ? teamGainPts.toFixed(2) : teamGainPts.toFixed(1)} team TU pts
                </Typography>
                <Typography component="span" sx={{ color: "text.secondary", fontSize: "inherit" }}>
                  if at target
                </Typography>
              </Box>
            )}
          </Box>
        )}
        {headerLabel && compact && (
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, mb: 0.5, textAlign: mirror ? "right" : "left" }}>
            {headerLabel}
          </Typography>
        )}
        {!headerLabel && !compact && teamGainPts != null && teamGainPts > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75, fontSize: "11px" }}>
            <Typography
              component="span"
              sx={{
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                bgcolor: "rgba(6,78,59,0.5)",
                color: "#6ee7b7",
                fontWeight: 600,
                fontSize: "inherit",
              }}
            >
              +{teamGainPts < 0.1 ? teamGainPts.toFixed(2) : teamGainPts.toFixed(1)} team TU pts
            </Typography>
            <Typography component="span" sx={{ color: "text.secondary", fontSize: "inherit" }}>
              if at target
            </Typography>
          </Box>
        )}
        {totalDivider}
        <Box sx={{ display: "flex", gap: compact ? 1.5 : 2.5, ...(hidePerDay && showVol ? { flex: 1 } : {}) }}>
          {hidePerDay && showVol && !mirror ? (
            <>
              {barAndMarkers}
              {sectionsBlock}
            </>
          ) : (
            <>
              {sectionsBlock}
              {barAndMarkers}
            </>
          )}
        </Box>
      </Box>
    );
  }
);

TooltipProgressBar.displayName = "TooltipProgressBar";

export default TooltipProgressBar;
