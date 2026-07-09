import React, { useMemo } from "react";
/**
 * PipelineOverviewCard Component
 * Displays asset management KPIs: count, annual maintenance cost, residual value
 * Plus breakdown by patrimoine (subSegmentCode)
 */

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import { animations } from "../../../styles/animations";
import { AnimatedCurrency, AnimatedPercent } from "../../common/AnimatedNumbers";

/**
 * Pipeline overview card component — adapted for GAIF asset management
 * Shows: Nombre d'actifs, Cout annuel maintenance, Valeur residuelle totale
 * Breakdown by patrimoine (subSegmentCode)
 */

const PipelineOverviewCard = React.memo(
  ({
    isAllocated,
    totalRevenue,
    calculatedTotalRevenue,
    allocatedRevenue,
    allocationPercentage,
    dataLength,
    filteredOpportunities,
    showNetRevenue,
    showIO,
    isCompleteUnitSelected,
  }: any) => {
    const theme = useTheme();

    // Breakdown by patrimoine (subSegmentCode)
    const patrimoineBreakdown = useMemo(() => {
      const opps = filteredOpportunities || [];
      const groups: Record<string, { count: number; maintenanceCost: number }> = {};
      opps.forEach((opp: any) => {
        const key = opp.subSegmentCode || "Non classifie";
        if (!groups[key]) {
          groups[key] = { count: 0, maintenanceCost: 0 };
        }
        groups[key].count++;
        groups[key].maintenanceCost += Number(opp.grossRevenue || 0) || 0;
      });

      const totalCount = opps.length;
      const palette = [
        theme.palette.primary.light,
        theme.palette.primary.main,
        theme.palette.primary.dark,
        theme.palette.secondary.light,
        theme.palette.secondary.main,
        theme.palette.info.main,
        theme.palette.warning.main,
      ];

      return Object.entries(groups)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, data], idx) => ({
          name,
          count: data.count,
          maintenanceCost: data.maintenanceCost,
          percentage: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
          color: palette[idx % palette.length],
        }));
    }, [filteredOpportunities, theme]);

    return (
      <Card
        sx={{
          height: "100%",
          transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
            transform: "perspective(1000px) rotateX(-1.5deg) rotateY(1.5deg) translateY(-4px)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
            "& .MuiSvgIcon-root": {
              transform: "scale(1.1)",
            },
          },
          position: "relative",
          overflow: "visible",
          borderRadius: 3,
          ...animations.cardEntrance(0),
        }}
      >
        <CardContent sx={{ p: 3, height: "100%" }}>
          {/* Card Title */}
          <Typography variant="h6" fontWeight={700}>
            {isAllocated ? "Parc filtre" : "Synthese du parc"}
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* Breakdown by patrimoine (subSegmentCode) */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} color="text.primary" gutterBottom>
              Repartition par patrimoine
            </Typography>

            {patrimoineBreakdown.map((group) => (
              <Box key={group.name} sx={{ mb: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 0.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: group.color,
                        mr: 1,
                      }}
                    />
                    <Typography variant="body2" fontWeight={500}>
                      {group.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {group.count} actifs
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Box
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: alpha(group.color, 0.15),
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
                          width: `${group.percentage}%`,
                          bgcolor: group.color,
                          borderRadius: 4,
                          transition: "width 0.8s cubic-bezier(0.23, 1, 0.32, 1)",
                        }}
                      />
                    </Box>
                  </Box>
                  <AnimatedPercent
                    value={group.percentage}
                    variant="body2"
                    fontWeight={600}
                    sx={{ minWidth: 40, textAlign: "right" }}
                  />
                </Box>

                {/* Maintenance cost for this patrimoine group */}
                <AnimatedCurrency
                  value={group.maintenanceCost}
                  variant="body2"
                  fontWeight={400}
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }
);

PipelineOverviewCard.displayName = "PipelineOverviewCard";

export default React.memo(PipelineOverviewCard);
