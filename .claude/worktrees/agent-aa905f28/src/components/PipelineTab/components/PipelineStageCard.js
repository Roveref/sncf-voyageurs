import React, { useMemo } from "react";
/**
 * PipelineStageCard Component
 * Displays pipeline breakdown by stage with progress bars + deal aging
 * Performance-optimized with React.memo
 */

import { Card, CardContent, Typography, Box, Divider, Chip, alpha } from "@mui/material";
import { COLORS, ALL_STATUSES } from "../utils/constants";
import { keyframes } from "../../../styles/animations";

/**
 * Pipeline by stage card component
 * Memoized to prevent unnecessary re-renders
 */
const PipelineStageCard = React.memo(
  ({ pipelineByStatus, isAllocated, allocatedRevenue, totalRevenue, showIO, filteredOpportunities = [] }) => {
    // Compute average age by status number
    const agingByStatus = useMemo(() => {
      const now = new Date();
      const byStatus = {};

      filteredOpportunities.forEach((opp) => {
        const status = opp["Status"];
        const creationDate = opp["Creation Date"];
        if (!creationDate) return;

        const created = new Date(creationDate);
        if (isNaN(created.getTime())) return;

        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        if (days >= 0) {
          if (!byStatus[status]) byStatus[status] = { totalDays: 0, count: 0 };
          byStatus[status].totalDays += days;
          byStatus[status].count += 1;
        }
      });

      const result = {};
      Object.entries(byStatus).forEach(([status, data]) => {
        result[status] = Math.round(data.totalDays / data.count);
      });
      return result;
    }, [filteredOpportunities]);

    // Map status label to status number for aging lookup
    const statusLabelToNumber = useMemo(() => {
      const map = {};
      ALL_STATUSES.forEach(({ status, statusNumber }) => {
        map[status] = statusNumber;
      });
      return map;
    }, []);

    return (
      <Card
        sx={{
          height: "100%",
          transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
            transform: "translateY(-8px)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
          },
          borderRadius: 3,
          animation: "fadeInUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) 200ms both",
          ...keyframes.fadeInUp,
        }}
      >
        <CardContent sx={{ p: 3, height: "100%" }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Pipeline by Status
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ mt: 2 }}>
            {pipelineByStatus.map((item, index) => {
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
                          label={`~${avgDays}j`}
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
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{
                          color: COLORS[index % COLORS.length],
                        }}
                      >
                        {new Intl.NumberFormat("fr-FR", {
                          style: "percent",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(item.originalValue / (isAllocated ? allocatedRevenue : totalRevenue) || 0)}
                      </Typography>
                      <Chip
                        label={`${item.count} opps`}
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
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(item.originalValue)}
                    </Typography>
                    {isAllocated && item.allocatedValue !== item.originalValue && (
                      <>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          →
                        </Typography>
                        <Typography variant="body2" color="secondary.main" sx={{ mt: 0.5 }}>
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }).format(item.allocatedValue || 0)}
                        </Typography>
                      </>
                    )}
                    {showIO && (
                      <Typography variant="body2" color="primary.main" sx={{ mt: 0.5, fontSize: "0.75rem" }}>
                        (I&O:{" "}
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(item.calculatedValue)}
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
