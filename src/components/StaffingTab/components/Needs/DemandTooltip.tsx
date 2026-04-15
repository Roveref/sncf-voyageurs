/**
 * DemandTooltip — Custom Recharts tooltip for the demand chart.
 * Shows per-grade breakdown: Demande / Dispo / Dispo matchée.
 */

import { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { GRADE_ORDER, getGradeColor, getGradeAbbr } from "../../constants";
import { sanitizeGrade } from "../../utils/demandCalc";

interface DemandTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  mode?: "etp" | "headcount";
}

const DemandTooltip = memo(({ active, payload, label, mode = "etp" }: DemandTooltipProps) => {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const unit = mode === "etp" ? "FTE" : "pers.";

  // Collect grades that have data in any column
  const grades = GRADE_ORDER.filter((grade) => {
    const sk = sanitizeGrade(grade);
    return (row[`demand_${sk}`] || 0) > 0 || (row[`supply_${sk}`] || 0) > 0;
  });

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        px: 1.5,
        py: 1,
        minWidth: 260,
        boxShadow: 2,
      }}
    >
      <Typography variant="caption" fontWeight={700} sx={{ mb: 0.75, display: "block", textTransform: "capitalize" }}>
        {label}
      </Typography>

      {/* Header row */}
      <Box sx={{ display: "flex", gap: 0.5, mb: 0.3 }}>
        <Box sx={{ width: 50 }} />
        <Typography
          variant="caption"
          sx={{ flex: 1, fontSize: "0.6rem", fontWeight: 600, color: "text.disabled", textAlign: "right" }}
        >
          Demand
        </Typography>
        <Typography
          variant="caption"
          sx={{ flex: 1, fontSize: "0.6rem", fontWeight: 600, color: "text.disabled", textAlign: "right" }}
        >
          Supply
        </Typography>
        <Typography
          variant="caption"
          sx={{ flex: 1, fontSize: "0.6rem", fontWeight: 600, color: "text.disabled", textAlign: "right" }}
        >
          Matched
        </Typography>
      </Box>

      {/* Per-grade rows */}
      {grades.map((grade) => {
        const sk = sanitizeGrade(grade);
        const gc = getGradeColor(grade);
        const demand = row[`demand_${sk}`] || 0;
        const supply = row[`supply_${sk}`] || 0;
        const matched = row[`matched_${sk}`] || 0;
        return (
          <Box key={grade} sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.15 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, width: 50 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: gc.text, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: 600 }}>
                {getGradeAbbr(grade)}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{
                flex: 1,
                fontSize: "0.68rem",
                fontWeight: demand > 0 ? 700 : 400,
                textAlign: "right",
                color: demand > 0 ? "text.primary" : "text.disabled",
              }}
            >
              {demand > 0 ? demand.toFixed(1) : "–"}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                flex: 1,
                fontSize: "0.68rem",
                fontWeight: 400,
                textAlign: "right",
                color: supply > 0 ? "text.secondary" : "text.disabled",
              }}
            >
              {supply > 0 ? supply.toFixed(1) : "–"}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                flex: 1,
                fontSize: "0.68rem",
                fontWeight: matched > 0 ? 600 : 400,
                textAlign: "right",
                color: matched > 0 ? "#10b981" : "text.disabled",
              }}
            >
              {matched > 0 ? matched.toFixed(1) : "–"}
            </Typography>
          </Box>
        );
      })}

      {/* Totals row */}
      <Box sx={{ display: "flex", gap: 0.5, borderTop: 1, borderColor: "divider", mt: 0.4, pt: 0.4 }}>
        <Box sx={{ width: 50 }}>
          <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: 700 }}>
            Total
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ flex: 1, fontSize: "0.68rem", fontWeight: 700, textAlign: "right" }}>
          {row.demandTotal?.toFixed(1)}
        </Typography>
        <Typography
          variant="caption"
          sx={{ flex: 1, fontSize: "0.68rem", fontWeight: 600, textAlign: "right", color: "text.secondary" }}
        >
          {row.supplyTotal?.toFixed(1)}
        </Typography>
        <Typography
          variant="caption"
          sx={{ flex: 1, fontSize: "0.68rem", fontWeight: 700, textAlign: "right", color: "#10b981" }}
        >
          {row.matchedTotal?.toFixed(1)}
        </Typography>
      </Box>

      {/* Gap */}
      {row.gapTotal !== 0 && (
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.3 }}>
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ fontSize: "0.68rem", color: row.gapTotal > 0 ? "error.main" : "success.main" }}
          >
            Gap (demand − matched)
          </Typography>
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ fontSize: "0.68rem", color: row.gapTotal > 0 ? "error.main" : "success.main" }}
          >
            {row.gapTotal > 0 ? "+" : ""}
            {row.gapTotal?.toFixed(1)} {unit}
          </Typography>
        </Box>
      )}
    </Box>
  );
});
DemandTooltip.displayName = "DemandTooltip";

export default DemandTooltip;
