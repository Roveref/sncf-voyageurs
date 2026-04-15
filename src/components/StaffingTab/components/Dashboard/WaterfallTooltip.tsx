import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getTooltipStyle, TOOLTIP_STYLE, TOOLTIP_FIXED_W, TOOLTIP_FIXED_H } from "../Tooltip/tooltipHelpers";
import { fmtHD } from "../../constants/theme";

const CHART_H = 150;
const COL_W = 72;

interface WaterfallStep {
  value: number;
  offset: number;
  color: string;
  tc?: string;
  type: string;
  label: string;
}

interface WaterfallHover {
  x: number;
  y: number;
  steps: WaterfallStep[];
  title: string;
  grossH: number;
  tu: number;
}

interface WaterfallTooltipProps {
  waterfallHover: WaterfallHover | null;
}

/**
 * Waterfall chart tooltip showing hours breakdown (Gross → Abs → Net → Ch → GO → Tr).
 */
const WaterfallTooltip = memo(({ waterfallHover }: WaterfallTooltipProps) => {
  if (!waterfallHover || !waterfallHover.steps.length) return null;

  const wfW = Math.max(TOOLTIP_FIXED_W, waterfallHover.steps.length * (COL_W + 6) + 48);
  const style = getTooltipStyle(waterfallHover.x, waterfallHover.y, wfW, TOOLTIP_FIXED_H);

  return (
    <Box sx={{ ...TOOLTIP_STYLE, ...style }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>
        {waterfallHover.title}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.75 }} style={{ height: CHART_H + 18 }}>
        {waterfallHover.steps.map((s, i) => {
          const barH = (s.value / waterfallHover.grossH) * CHART_H;
          const bottomOffset = (s.offset / waterfallHover.grossH) * CHART_H;
          return (
            <Box key={i} sx={{ position: "relative" }} style={{ width: COL_W, height: CHART_H + 18 }}>
              <Box
                sx={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 36,
                  borderRadius: 0.5,
                  backgroundColor: s.color,
                }}
                style={{ bottom: bottomOffset, height: Math.max(2, barH) }}
              />
              <Box
                component="span"
                sx={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: "11px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  color: s.tc || "white",
                }}
                style={{ bottom: bottomOffset + Math.max(2, barH) + 3 }}
              >
                {s.type === "sub" ? `−${fmtHD(s.value)}` : fmtHD(s.value)}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: "flex", gap: 0.75, mt: 0.75, borderTop: 1, borderColor: "grey.600", pt: 0.75 }}>
        {waterfallHover.steps.map((s, i) => (
          <Box key={i} sx={{ textAlign: "center" }} style={{ width: COL_W }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: "11px",
                lineHeight: 1.2,
                color: s.type === "result" ? "white" : s.tc || "grey.400",
                ...(s.type === "result" && { fontWeight: "bold" }),
              }}
            >
              {s.label}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ borderTop: 1, borderColor: "grey.600", mt: 1.25, pt: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "#7dd3fc" }}>
          TU {waterfallHover.tu.toFixed(1)}%
        </Typography>
      </Box>
    </Box>
  );
});

WaterfallTooltip.displayName = "WaterfallTooltip";

export default WaterfallTooltip;
