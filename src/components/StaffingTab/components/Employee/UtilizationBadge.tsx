import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getUtilizationToken, getHeatmapStyle } from "../../constants/theme";
import { TU_LOW, TU_PARTIAL, TU_FULL } from "../../constants";

/**
 * Get utilization level and associated styles (delegates to theme tokens).
 */
const getUtilizationLevel = (rate: number) => {
  const token = getUtilizationToken(rate);
  return {
    level:
      rate === 0
        ? "available"
        : rate < TU_LOW
          ? "low"
          : rate < TU_PARTIAL
            ? "partial"
            : rate <= TU_FULL
              ? "optimal"
              : "overbooked",
    label: token.label,
    bgColor: token.bg,
    textColor: token.text,
    barColor: token.bar,
    dotColor: token.dot,
  };
};

/**
 * Status badge
 */
export const StatusBadge = memo(({ rate, showLabel = true, size = "md" }: any) => {
  const { label, bgColor, textColor, dotColor } = getUtilizationLevel(rate);
  const sizes: Record<string, { px: number; py: number; fontSize: string }> = {
    sm: { px: 1, py: 0.25, fontSize: "0.75rem" },
    md: { px: 1.25, py: 0.5, fontSize: "0.875rem" },
    lg: { px: 1.5, py: 0.75, fontSize: "1rem" },
  };
  const s = sizes[size];

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        borderRadius: "9999px",
        fontWeight: 500,
        bgcolor: bgColor,
        color: textColor,
        px: s.px,
        py: s.py,
        fontSize: s.fontSize,
      }}
    >
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: dotColor,
        }}
      />
      {showLabel && label}
    </Box>
  );
});
StatusBadge.displayName = "StatusBadge";

/**
 * Progress bar
 */
export const UtilizationBar = memo(({ rate, height = "h-2", showPercentage = false, sx: sxProp = {} }: any) => {
  const { barColor } = getUtilizationLevel(rate);
  const capped = Math.min(rate, 100);

  const heightMap: Record<string, number> = { "h-1.5": 6, "h-2": 8, "h-3": 12 };
  const h = heightMap[height] || 8;

  return (
    <Box sx={{ position: "relative", display: "flex", alignItems: "center", ...sxProp }}>
      <Box sx={{ flex: 1, height: h, bgcolor: "#e5e7eb", borderRadius: "9999px", overflow: "hidden" }}>
        <Box
          sx={{
            height: h,
            bgcolor: barColor,
            borderRadius: "9999px",
            transition: "width 300ms",
            width: `${capped}%`,
          }}
        />
      </Box>
      {showPercentage && (
        <Typography component="span" sx={{ ml: 1, fontSize: "0.875rem", fontWeight: 500, color: "text.secondary" }}>
          {rate.toFixed(0)}%
        </Typography>
      )}
    </Box>
  );
});
UtilizationBar.displayName = "UtilizationBar";

/**
 * Combined indicator (bar + pct + optional badge)
 */
export const UtilizationIndicator = memo(({ rate, size = "md", showBadge = true }: any) => {
  const { barColor, textColor } = getUtilizationLevel(rate);
  const cfg = (
    {
      sm: { h: 6, w: 64, fontSize: "0.75rem" },
      md: { h: 8, w: 96, fontSize: "0.875rem" },
      lg: { h: 12, w: 128, fontSize: "1rem" },
    } as Record<string, { h: number; w: number; fontSize: string }>
  )[size];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box sx={{ width: cfg.w }}>
        <Box sx={{ width: "100%", height: cfg.h, bgcolor: "#e5e7eb", borderRadius: "9999px", overflow: "hidden" }}>
          <Box
            sx={{
              height: cfg.h,
              bgcolor: barColor,
              borderRadius: "9999px",
              transition: "width 300ms",
              width: `${Math.min(rate, 100)}%`,
            }}
          />
        </Box>
      </Box>
      <Typography
        component="span"
        sx={{
          fontSize: cfg.fontSize,
          fontWeight: 600,
          color: textColor,
          minWidth: "3rem",
        }}
      >
        {rate.toFixed(0)}%
      </Typography>
      {showBadge && <StatusBadge rate={rate} showLabel={false} size="sm" />}
    </Box>
  );
});
UtilizationIndicator.displayName = "UtilizationIndicator";

/**
 * Mini heatmap bar (collapsed view)
 */
export const MiniHeatmap = memo(({ dailyUtilization = [], width, height }: any) => {
  if (!dailyUtilization || dailyUtilization.length === 0) {
    return <Box sx={{ width: width || "100%", height: height || 12, bgcolor: "#f3f4f6", borderRadius: 1 }} />;
  }

  const segCount = Math.min(dailyUtilization.length, 60);
  const perSeg = Math.ceil(dailyUtilization.length / segCount);
  const segments: { rate: number; isWeekend: boolean }[] = [];

  for (let i = 0; i < segCount; i++) {
    const slice = dailyUtilization.slice(i * perSeg, Math.min((i + 1) * perSeg, dailyUtilization.length));
    const working = slice.filter((d: any) => d.isWorkingDay);
    if (working.length === 0) {
      segments.push({ rate: -1, isWeekend: true });
    } else {
      segments.push({
        rate: working.reduce((s: number, d: any) => s + d.utilizationRate, 0) / working.length,
        isWeekend: false,
      });
    }
  }

  return (
    <Box sx={{ width: width || "100%", height: height || 12, display: "flex", borderRadius: 1, overflow: "hidden" }}>
      {segments.map((seg, idx) => {
        if (seg.isWeekend) return <Box key={idx} sx={{ flex: 1, bgcolor: "#e5e7eb" }} />;
        return <Box key={idx} sx={{ flex: 1 }} style={getHeatmapStyle(seg.rate)} />;
      })}
    </Box>
  );
});
MiniHeatmap.displayName = "MiniHeatmap";

/**
 * Avatar with initials
 */
const avatarColors = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1", "#0ea5e9"];

export const EmployeeAvatar = memo(({ name, empId, size = "md" }: any) => {
  const initials = name
    .split(" ")
    .map((p: string) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  const idx = empId.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % avatarColors.length;

  const sizes: Record<string, { width: number; height: number; fontSize: string }> = {
    sm: { width: 32, height: 32, fontSize: "0.75rem" },
    md: { width: 40, height: 40, fontSize: "0.875rem" },
    lg: { width: 48, height: 48, fontSize: "1rem" },
  };
  const s = sizes[size];

  return (
    <Box
      sx={{
        width: s.width,
        height: s.height,
        fontSize: s.fontSize,
        bgcolor: avatarColors[idx],
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 600,
      }}
    >
      {initials}
    </Box>
  );
});
EmployeeAvatar.displayName = "EmployeeAvatar";

export { getUtilizationLevel };
