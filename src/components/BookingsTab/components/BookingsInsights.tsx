import React, { memo, useMemo } from "react";
import Grid from "@mui/material/Grid2";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { useTheme, alpha } from "@mui/material/styles";

import { animations } from "../../../styles/animations";
import { AnimatedCurrency, AnimatedCount, AnimatedPercent } from "../../common/AnimatedNumbers";

interface InsightsData {
  bookings: any[];
  losses: any[];
  bookingsTotalRevenue: number;
  lossesTotalRevenue: number;
  bookingsAllocatedRevenue: number;
  lossesAllocatedRevenue: number;
  bookingsCalculatedRevenue: number;
  lossesCalculatedRevenue: number;
  avgBookingSize: number;
  avgLossSize: number;
  avgBookingAllocated: number;
  avgLossAllocated: number;
  avgBookingCalculated: number;
  avgLossCalculated: number;
  hasAllocation: boolean;
  winRateNewContract: number;
  newContractWins: number;
  newContractTotal: number;
  winRateExtension: number;
  extensionWins: number;
  extensionTotal: number;
}

interface BookingsInsightsProps {
  insightsData: InsightsData;
  showLost: boolean;
  showIO: boolean;
  bookingTargets?: { annualGross: number; annualNet: number; ioGross: number };
  showNetRevenue?: boolean;
  annualMaintenanceCost?: number;
}

const BookingsInsights = memo(
  ({
    insightsData,
    showLost,
    showIO,
    bookingTargets,
    showNetRevenue,
    annualMaintenanceCost = 0,
  }: BookingsInsightsProps) => {
    const theme = useTheme();

    // Compute GAIF maintenance KPIs from the bookings/losses arrays
    const maintenanceKpis = useMemo(() => {
      const items = showLost ? insightsData.losses : insightsData.bookings;

      // Taux de conformite VR: VR interventions with winPct===100 / total VR interventions
      const vrInterventions = items.filter((item: any) => item.engagementType === "VR");
      const vrConformes = vrInterventions.filter((item: any) => item.winPct === 100);
      const tauxConformiteVR = vrInterventions.length > 0 ? (vrConformes.length / vrInterventions.length) * 100 : 0;

      // Taux de realisation: interventions with status=14 / total
      const realisees = items.filter((item: any) => Number(item.status) === 14);
      const tauxRealisation = items.length > 0 ? (realisees.length / items.length) * 100 : 0;

      return {
        vrTotal: vrInterventions.length,
        vrConformes: vrConformes.length,
        tauxConformiteVR,
        realisees: realisees.length,
        totalItems: items.length,
        tauxRealisation,
      };
    }, [insightsData.bookings, insightsData.losses, showLost]);

    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          mb: 3,
          overflow: "visible",
          transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
            transform: "perspective(1000px) rotateX(-1.5deg) rotateY(1.5deg) translateY(-4px)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
          },
          ...animations.cardEntrance(0),
          position: "relative",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6" gutterBottom fontWeight={600}>
            {showLost ? "Interventions annulees" : "Indicateurs maintenance"}
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Coût annuel maintenance — vue d'ensemble du parc */}
        {!showLost && (
          <Grid container spacing={3} sx={{ px: 2, pt: 1, pb: 2 }}>
            <Grid size={12}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  textAlign: "center",
                  bgcolor: alpha(theme.palette.success.main, 0.08),
                  transition:
                    "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                  },
                  ...animations.cardEntrance(0),
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                  sx={{ display: "block", fontSize: "0.7rem" }}
                >
                  Coût annuel maintenance
                </Typography>
                <AnimatedCurrency value={annualMaintenanceCost} variant="h5" fontWeight={700} color="success.main" />
              </Box>
            </Grid>
          </Grid>
        )}

        <Grid container spacing={3} sx={{ px: 2, py: 1 }}>
          {/* Cout total interventions / Cout total annulees */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ overflow: "visible" }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                height: "100%",
                transition:
                  "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                },
                ...animations.cardEntrance(100),
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {showLost ? "Cout total annulees" : "Cout total interventions"}
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  position: "relative",
                  minHeight: 70,
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <AnimatedCurrency
                    value={showLost ? insightsData.lossesTotalRevenue : insightsData.bookingsTotalRevenue}
                    color={showLost ? "error.main" : "success.main"}
                  />
                </Box>
                <AnimatedCount
                  value={showLost ? insightsData.losses.length : insightsData.bookings.length}
                  variant="h5"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ ml: 2 }}
                />
              </Box>
            </Box>
          </Grid>

          {/* Cout moyen par intervention */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ overflow: "visible" }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                height: "100%",
                transition:
                  "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                },
                ...animations.cardEntrance(200),
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {showLost ? "Cout moyen annulee" : "Cout moyen par intervention"}
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 70,
                  justifyContent: "center",
                }}
              >
                <AnimatedCurrency
                  value={showLost ? insightsData.avgLossSize : insightsData.avgBookingSize}
                  color="info.main"
                />
              </Box>
            </Box>
          </Grid>

          {/* Taux de conformite VR */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ overflow: "visible" }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                height: "100%",
                transition:
                  "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                },
                ...animations.cardEntrance(300),
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Taux de conformite VR
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 70,
                  justifyContent: "center",
                }}
              >
                <AnimatedPercent
                  value={maintenanceKpis.tauxConformiteVR}
                  variant="h5"
                  fontWeight={700}
                  color={maintenanceKpis.tauxConformiteVR >= 80 ? "success.main" : "warning.main"}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  ({maintenanceKpis.vrConformes}/{maintenanceKpis.vrTotal} VR conformes)
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Taux de realisation */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ overflow: "visible" }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                height: "100%",
                transition:
                  "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                },
                ...animations.cardEntrance(400),
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Taux de realisation
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 70,
                  justifyContent: "center",
                }}
              >
                <AnimatedPercent
                  value={maintenanceKpis.tauxRealisation}
                  variant="h5"
                  fontWeight={700}
                  color={maintenanceKpis.tauxRealisation >= 80 ? "success.main" : "warning.main"}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  ({maintenanceKpis.realisees}/{maintenanceKpis.totalItems} realisees)
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    );
  }
);

BookingsInsights.displayName = "BookingsInsights";

export default BookingsInsights;
