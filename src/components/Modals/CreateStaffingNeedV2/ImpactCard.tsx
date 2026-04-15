/**
 * ImpactCard — Shows demand/supply/gap before and after adding the staged needs.
 */

import React, { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { computeWorkingDays } from "../staffingNeedUtils";
import type { StagedNeed, TimelineAssignment } from "./types";

interface ImpactCardProps {
  currentAssignments: TimelineAssignment[];
  upcomingAssignments: TimelineAssignment[];
  stagedNeeds: StagedNeed[];
  previewNeed: { grade: string; startDate: string; endDate: string; utilization: number; quantity: number } | null;
}

const ImpactCard = memo(({ currentAssignments, upcomingAssignments, stagedNeeds, previewNeed }: ImpactCardProps) => {
  const theme = useTheme();

  const metrics = useMemo(() => {
    const allAssignments = [...currentAssignments, ...upcomingAssignments];
    if (!allAssignments.length && !stagedNeeds.length && !previewNeed) return null;

    const currentSupply = allAssignments.reduce((sum, a) => sum + a.utilization / 100, 0);

    const stagedDemandFte = stagedNeeds.reduce(
      (sum, n) => sum + (n.utilization / 100) * n.quantity * (n.probability / 100),
      0
    );
    const previewDemandFte = previewNeed ? (previewNeed.utilization / 100) * previewNeed.quantity : 0;
    const totalNewFte = stagedDemandFte + previewDemandFte;

    const allDates = [...stagedNeeds.map((n) => n.startDate), ...stagedNeeds.map((n) => n.endDate)];
    if (previewNeed?.startDate) allDates.push(previewNeed.startDate);
    if (previewNeed?.endDate) allDates.push(previewNeed.endDate);
    if (!allDates.length) return null;

    const sorted = allDates.filter(Boolean).sort();
    const startMonth = new Date(sorted[0] + "T00:00:00").toLocaleDateString("en-GB", { month: "short" });
    const endMonth = new Date(sorted[sorted.length - 1] + "T00:00:00").toLocaleDateString("en-GB", { month: "short" });
    const periodLabel = startMonth === endMonth ? startMonth : `${startMonth} \u2013 ${endMonth}`;

    const totalWorkingDays = stagedNeeds.reduce(
      (sum, n) => sum + computeWorkingDays(n.startDate, n.endDate) * n.quantity,
      0
    );

    return { supply: currentSupply, newDemandFte: totalNewFte, totalWorkingDays, periodLabel };
  }, [currentAssignments, upcomingAssignments, stagedNeeds, previewNeed]);

  return (
    <Box sx={{ bgcolor: "background.paper", borderRadius: 2.5, p: 2, border: 1, borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.25 }}>
        <TrendingUpIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography
          variant="overline"
          sx={{ fontSize: "0.65rem", fontWeight: 700, color: "text.secondary", letterSpacing: 0.8 }}
        >
          Impact{metrics ? ` (${metrics.periodLabel})` : ""}
        </Typography>
      </Box>

      {!metrics ? (
        <Box sx={{ py: 1.5, textAlign: "center", borderRadius: 2, bgcolor: "background.default" }}>
          <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>
            Fill in the form to see projected impact
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 2 }}>
          {/* Supply */}
          <Box sx={{ flex: 1, textAlign: "center", py: 1, px: 1, borderRadius: 2, bgcolor: "background.default" }}>
            <Typography
              sx={{
                fontSize: "0.6rem",
                fontWeight: 600,
                color: "text.disabled",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                mb: 0.25,
              }}
            >
              Current supply
            </Typography>
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 700 }}>{metrics.supply.toFixed(1)}</Typography>
            <Typography sx={{ fontSize: "0.6rem", color: "text.disabled" }}>FTE</Typography>
          </Box>

          {/* New demand */}
          <Box
            sx={{
              flex: 1,
              textAlign: "center",
              py: 1,
              px: 1,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <Typography
              sx={{
                fontSize: "0.6rem",
                fontWeight: 600,
                color: "text.disabled",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                mb: 0.25,
              }}
            >
              New demand
            </Typography>
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: theme.palette.primary.main }}>
              +{metrics.newDemandFte.toFixed(1)}
            </Typography>
            <Typography sx={{ fontSize: "0.6rem", color: "text.disabled" }}>FTE</Typography>
          </Box>

          {/* Working days */}
          {metrics.totalWorkingDays > 0 && (
            <Box
              sx={{
                flex: 1,
                textAlign: "center",
                py: 1,
                px: 1,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.info.main, 0.04),
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  color: "text.disabled",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  mb: 0.25,
                }}
              >
                Working days
              </Typography>
              <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: theme.palette.info.main }}>
                {metrics.totalWorkingDays}
              </Typography>
              <Typography sx={{ fontSize: "0.6rem", color: "text.disabled" }}>days</Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
});

ImpactCard.displayName = "ImpactCard";
export default ImpactCard;
