import React, { useMemo } from "react";
/**
 * PipelineStageCard Component
 * Displays pipeline breakdown by stage with progress bars + deal aging
 * Performance-optimized with React.memo
 */

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import { alpha } from "@mui/material/styles";
import { COLORS, getAllStatuses } from "../utils/constants";
import { animations, keyframes } from "../../../styles/animations";
import { AnimatedCurrency, AnimatedPercent } from "../../common/AnimatedNumbers";

/**
 * Pipeline by stage card component
 * Memoized to prevent unnecessary re-renders
 */
const PipelineStageCard = React.memo(
  ({ pipelineByStatus, isAllocated, allocatedRevenue, totalRevenue, showIO, filteredOpportunities = [] }: any) => {
    // Compute average age by status number
    const agingByStatus = useMemo(() => {
      const now = new Date();
      const byStatus: Record<string, any> = {};

      filteredOpportunities.forEach((opp: any) => {
        const status = opp.status;
        const creationDate = opp.creationDate;
        if (!creationDate) return;

        const created = new Date(creationDate);
        if (isNaN(created.getTime())) return;

        const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (days >= 0) {
          if (!byStatus[status]) byStatus[status] = { totalDays: 0, count: 0 };
          byStatus[status].totalDays += days;
          byStatus[status].count += 1;
        }
      });

      const result: Record<string, any> = {};
      Object.entries(byStatus).forEach(([status, data]: [string, any]) => {
        result[status] = Math.round(data.totalDays / data.count);
      });
      return result;
    }, [filteredOpportunities]);

    // Map status label to status number for aging lookup
    const statusLabelToNumber = useMemo(() => {
      const map: Record<string, any> = {};
      getAllStatuses().forEach(({ status, statusNumber }: any) => {
        map[status] = statusNumber;
      });
      return map;
    }, []);

    return (
      <Card
        sx={{
          height: "100%",
          transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
            transform: "perspective(1000px) rotateX(-1.5deg) rotateY(1.5deg) translateY(-4px)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
          },
          borderRadius: 3,
          ...animations.cardEntrance(200),
          position: "relative",
        }}
      >
        <CardContent sx={{ p: 3, height: "100%" }}>
          <Typography variant="h6" fontWeight={700}>
            Parc par phase de vie
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ mt: 2 }}>
            {pipelineByStatus.map((item: any, index: number) => {
              const statusNumber = statusLabelToNumber[item.status];
              const avgDays = statusNumber != null ? agingByStatus[statusNumber] : null;

              return (
                <Box key={item.status} sx={{ mb: 2.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 0.5,
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {item.status}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {avgDays != null && (
                        <Chip
                          label={`~${avgDays}d`}
                          size="small"
                          sx={{
                            height: "18px",
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            backgroundColor: alpha(COLORS[index % COLORS.length], 0.08),
                            color: "text.secondary",
                            "& .MuiChip-label": { px: 0.75 },
                          }}
                        />
                      )}
                      <AnimatedPercent
                        value={(item.originalValue / (isAllocated ? allocatedRevenue : totalRevenue)) * 100 || 0}
                        variant="body2"
                        fontWeight={500}
                        color={COLORS[index % COLORS.length]}
                      />
                      <Chip
                        label={`${item.count} actifs`}
                        size="small"
                        sx={{
                          height: "20px",
                          fontSize: "0.7rem",
                          backgroundColor: alpha(COLORS[index % COLORS.length], 0.12),
                          color: COLORS[index % COLORS.length],
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Box sx={{ flex: 1, mr: 1 }}>
                      <Box
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          bgcolor: alpha(COLORS[index % COLORS.length], 0.15),
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            height: "100%",
                            width: `${
                              (item.originalValue / (isAllocated ? allocatedRevenue : totalRevenue)) * 100 || 0
                            }%`,
                            bgcolor: COLORS[index % COLORS.length],
                            borderRadius: 5,
                            transition: "width 0.8s cubic-bezier(0.23, 1, 0.32, 1)",
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <AnimatedCurrency
                      value={item.originalValue}
                      variant="body2"
                      fontWeight={400}
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    />
                    {isAllocated && item.allocatedValue !== item.originalValue && (
                      <>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          →
                        </Typography>
                        <AnimatedCurrency
                          value={item.allocatedValue || 0}
                          variant="body2"
                          fontWeight={400}
                          color="secondary.main"
                          sx={{ mt: 0.5 }}
                        />
                      </>
                    )}
                    {showIO && (
                      <Typography
                        variant="body2"
                        color="primary.main"
                        component="span"
                        sx={{ mt: 0.5, fontSize: "0.75rem", display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                      >
                        (I&O:{" "}
                        <AnimatedCurrency
                          value={item.calculatedValue}
                          variant="body2"
                          fontWeight={400}
                          color="primary.main"
                          sx={{ fontSize: "0.75rem" }}
                        />
                        )
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>
    );
  }
);

PipelineStageCard.displayName = "PipelineStageCard";

export default PipelineStageCard;
